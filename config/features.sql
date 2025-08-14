-----------------------------------------------------------------------------------------------------------
-- Feature 1: Add a new hotel



CREATE OR REPLACE PROCEDURE create_hotel (
    p_hotel_name    VARCHAR2,
    p_hotel_address VARCHAR2,
    p_state         VARCHAR2,
    p_zipcode       VARCHAR2,
    p_website       VARCHAR2,
    p_phone         VARCHAR2
) AS
BEGIN
    INSERT INTO hotel (
        hotel_name,
        hotel_address,
        state,
        zip_code,
        website,
        phone
    ) VALUES (
        p_hotel_name,
        p_hotel_address,
        p_state,
        p_zipcode,
        p_website,
        p_phone
    );

    DBMS_OUTPUT.PUT_LINE('Hotel Added Successfully!...');
END;
/









 -----------------------------------------------------------------------------------------------------------
 -- Feature 1: Add rooms to the newly added hotel





CREATE OR REPLACE PROCEDURE create_hotel_room (
    p_h_id     NUMBER,
    t_s_room   NUMBER,
    t_m_room   NUMBER,
    t_l_room   NUMBER,
    a_s_room   NUMBER,
    a_m_room   NUMBER,
    a_l_room   NUMBER
) AS
    v_s_id  NUMBER;
    v_m_id  NUMBER;
    v_l_id  NUMBER;
BEGIN
    -- Get ROOM_IDs for each room_size
    SELECT room_id INTO v_s_id FROM room_type WHERE room_size = 'small_hall';
    SELECT room_id INTO v_m_id FROM room_type WHERE room_size = 'medium_hall';
    SELECT room_id INTO v_l_id FROM room_type WHERE room_size = 'large_hall';

    -- Insert rows into AVAILABLE_ROOM_PER_HOTEL
    INSERT INTO available_room_per_hotel (
        hotel_id, room_id, total_room, available_room
    ) VALUES (
        p_h_id, v_s_id, t_s_room, a_s_room
    );

    INSERT INTO available_room_per_hotel (
        hotel_id, room_id, total_room, available_room
    ) VALUES (
        p_h_id, v_m_id, t_m_room, a_m_room
    );

    INSERT INTO available_room_per_hotel (
        hotel_id, room_id, total_room, available_room
    ) VALUES (
        p_h_id, v_l_id, t_l_room, a_l_room
    );

    DBMS_OUTPUT.PUT_LINE('Rooms Added Successfully!...');
END;
/







CREATE OR REPLACE FUNCTION get_hotel_rooms (
    p_hotel_id IN NUMBER
) RETURN SYS_REFCURSOR
AS
    rc SYS_REFCURSOR;
BEGIN
    OPEN rc FOR
        SELECT
            rt.room_id,
            rt.room_size,
            rt.room_capacity,
            rt.room_price,
            arh.total_room,
            arh.available_room
        FROM available_room_per_hotel arh
        JOIN room_type rt
          ON arh.room_id = rt.room_id
       WHERE arh.hotel_id = p_hotel_id;

    RETURN rc;
END;
/







 -----------------------------------------------------------------------------------------------------------
 -- Feature 2: Update hotel rooms


CREATE OR REPLACE PROCEDURE update_hotel_room (
    p_hotel_id        NUMBER,
    p_room_size       VARCHAR2,
    p_total_room      NUMBER,
    p_available_room  NUMBER
) AS
BEGIN
    UPDATE available_room_per_hotel arh
    SET
        total_room     = p_total_room,
        available_room = p_available_room
    WHERE arh.hotel_id = p_hotel_id
      AND arh.room_id = (
            SELECT rt.room_id
            FROM room_type rt
            WHERE rt.room_size = p_room_size
      );

    DBMS_OUTPUT.PUT_LINE('Hotel room updated successfully!...');
END;
/




 -----------------------------------------------------------------------------------------------------------
 -- Feature 3 -> Reserve Events by Clients








CREATE OR REPLACE PROCEDURE insert_event_reservation (
    p_guest_id           NUMBER,
    p_hotel_id           NUMBER,
    p_event_id           NUMBER,
    p_room_id            NUMBER,
    p_start_date         DATE,
    p_end_date           DATE,
    p_room_quantity      NUMBER,
    p_room_invoice       NUMBER,   -- use NUMBER(12,2) if you want fixed scale
    p_date_of_reservation DATE,
    p_no_of_people       NUMBER,
    p_status             NUMBER
) AS
    v_total_rooms      NUMBER;
    v_available_rooms  NUMBER;
BEGIN
    /* 1) Lock the availability row to prevent concurrent over-booking */
    SELECT total_room, available_room
      INTO v_total_rooms, v_available_rooms
      FROM available_room_per_hotel
     WHERE hotel_id = p_hotel_id
       AND room_id  = p_room_id
       FOR UPDATE;

    /* 2) Validate availability BEFORE inserting the reservation */
    IF v_available_rooms < p_room_quantity THEN
        RAISE_APPLICATION_ERROR(-20001, 'Insufficient available rooms for reservation');
    END IF;

    /* 3) Insert the reservation */
    INSERT INTO event_reservation (
        guest_id,
        hotel_id,
        event_id,
        room_id,
        start_date,
        end_date,
        room_quantity,
        room_invoice,
        date_of_reservation,
        no_of_people,
        status
    ) VALUES (
        p_guest_id,
        p_hotel_id,
        p_event_id,
        p_room_id,
        p_start_date,
        p_end_date,
        p_room_quantity,
        p_room_invoice,
        p_date_of_reservation,
        p_no_of_people,
        p_status
    );

    /* 4) Deduct availability */
    UPDATE available_room_per_hotel
       SET available_room = available_room - p_room_quantity
     WHERE hotel_id = p_hotel_id
       AND room_id  = p_room_id;

    DBMS_OUTPUT.PUT_LINE('Event Reservation Added Successfully!...');

EXCEPTION
    WHEN NO_DATA_FOUND THEN
        RAISE_APPLICATION_ERROR(-20002, 'No availability record found for the given hotel and room type');
    WHEN OTHERS THEN
        RAISE_APPLICATION_ERROR(-20003, 'Failed to add event reservation: ' || SQLERRM);
END;
/









 -----------------------------------------------------------------------------------------------------------
 -- Feature 4: Get event rooms
 -- GET_EVENT_ROOMS function



CREATE OR REPLACE FUNCTION get_event_rooms (
    p_event_id IN NUMBER
) RETURN SYS_REFCURSOR
AS
    rc SYS_REFCURSOR;
BEGIN
    OPEN rc FOR
        SELECT
            h.hotel_id,
            h.hotel_name,
            rt.room_id,
            rt.room_size,
            rt.room_capacity,
            rt.room_price,
            ar.total_room,
            ar.available_room,
            er.start_date,
            er.end_date,
            er.room_quantity,
            er.room_invoice,
            er.date_of_reservation,
            er.no_of_people,
            er.status
        FROM event_reservation er
        JOIN hotel h
          ON er.hotel_id = h.hotel_id
        JOIN room_type rt
          ON er.room_id = rt.room_id
        JOIN available_room_per_hotel ar
          ON h.hotel_id = ar.hotel_id
         AND rt.room_id = ar.room_id
       WHERE er.event_id = p_event_id;

    RETURN rc;
END;
/




 -----------------------------------------------------------------------------------------------------------
 -- Feature 5: Get event rooms by hotel



CREATE OR REPLACE FUNCTION get_available_rooms_with_type
RETURN SYS_REFCURSOR
AS
  rc SYS_REFCURSOR;
BEGIN
  OPEN rc FOR
    SELECT
      arh.available_room_id,
      arh.hotel_id,
      arh.room_id,
      rt.room_size AS room_type_name,
      arh.available_room AS available_rooms
    FROM available_room_per_hotel arh
    INNER JOIN room_type rt
      ON arh.room_id = rt.room_id;

  RETURN rc;
END;
/



 -----------------------------------------------------------------------------------------------------------
 -- Feature 6: Adding extra room to event reservation

CREATE OR REPLACE PROCEDURE add_extra_room_to_event_reservation (
    p_event_reservation_id  NUMBER,
    p_additional_rooms      NUMBER
) AS
    v_hotel_id        NUMBER;
    v_room_id         NUMBER;
    v_status          NUMBER;
    v_available_room  NUMBER;
    v_room_price      NUMBER;
BEGIN
    /* 1) Fetch reservation details and lock the reservation row */
    SELECT hotel_id, room_id, status
      INTO v_hotel_id, v_room_id, v_status
      FROM event_reservation
     WHERE event_reservation_id = p_event_reservation_id
       FOR UPDATE;

    /* Ensure reservation is in 'Reserved' status (1) */
    IF v_status <> 1 THEN
        RAISE_APPLICATION_ERROR(-20010, 'Reservation is not in Reserved status.');
    END IF;

    /* 2) Lock the availability row and verify capacity */
    SELECT available_room
      INTO v_available_room
      FROM available_room_per_hotel
     WHERE hotel_id = v_hotel_id
       AND room_id  = v_room_id
       FOR UPDATE;

    IF v_available_room < p_additional_rooms THEN
        RAISE_APPLICATION_ERROR(-20011, 'Not enough available rooms for the requested addition.');
    END IF;

    /* 3) Get the room price */
    SELECT room_price
      INTO v_room_price
      FROM room_type
     WHERE room_id = v_room_id;

    /* 4) Update the reservation (quantity + invoice) */
    UPDATE event_reservation
       SET room_quantity = room_quantity + p_additional_rooms,
           room_invoice  = NVL(room_invoice, 0) + (p_additional_rooms * v_room_price)
     WHERE event_reservation_id = p_event_reservation_id;

    /* 5) Deduct from availability */
    UPDATE available_room_per_hotel
       SET available_room = available_room - p_additional_rooms
     WHERE hotel_id = v_hotel_id
       AND room_id  = v_room_id;

    DBMS_OUTPUT.PUT_LINE('Extra room added successfully!...');

EXCEPTION
    WHEN NO_DATA_FOUND THEN
        RAISE_APPLICATION_ERROR(-20012, 'Reservation or availability row not found.');
    WHEN OTHERS THEN
        RAISE_APPLICATION_ERROR(-20013, 'Failed to add extra room: ' || SQLERRM);
END;
/
