-- Feature 1: Add a new hotel
CREATE OR REPLACE PROCEDURE CREATE_HOTEL (
    P_HOTEL_NAME VARCHAR,
    P_HOTEL_ADDRESS VARCHAR,
    P_STATE VARCHAR,
    P_ZIPCODE VARCHAR,
    P_WEBSITE VARCHAR,
    P_PHONE VARCHAR
) AS
    $$        BEGIN INSERT INTO HOTEL (
        HOTEL_ID,
        HOTEL_NAME,
        HOTEL_ADDRESS,
        STATE,
        ZIP_CODE,
        WEBSITE,
        PHONE
    ) VALUES (
        NEXTVAL('add_hotel'),
        P_HOTEL_NAME,
        P_HOTEL_ADDRESS,
        P_STATE,
        P_ZIPCODE,
        P_WEBSITE,
        P_PHONE
    );
    RAISE     NOTICE 'Hotel Added Successfully!...';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Please contact your administrator!...';
    END;
    $$        LANGUAGE PLPGSQL;
 -- Feature 1: Add rooms to the newly added hotel
    CREATE    OR REPLACE

    PROCEDURE CREATE_HOTEL_ROOM (
        P_H_ID INT,
        T_S_ROOM INT,
        T_M_ROOM INT,
        T_L_ROOM INT,
        A_S_ROOM INT,
        A_M_ROOM INT,
        A_L_ROOM INT
    ) AS
        $$   DECLARE S_ID INT;
        M_ID INT;
        L_ID INT;
    BEGIN
        SELECT
            ROOM_ID INTO S_ID
        FROM
            ROOM_TYPE
        WHERE
            ROOM_SIZE = 'small_hall';
        SELECT
            ROOM_ID INTO M_ID
        FROM
            ROOM_TYPE
        WHERE
            ROOM_SIZE = 'medium_hall';
        SELECT
            ROOM_ID INTO L_ID
        FROM
            ROOM_TYPE
        WHERE
            ROOM_SIZE = 'large_hall';
        INSERT INTO AVAILABLE_ROOM_PER_HOTEL (
            AVAILABLE_ROOM_ID,
            HOTEL_ID,
            ROOM_ID,
            TOTAL_ROOM,
            AVAILABLE_ROOM
        ) VALUES (
            NEXTVAL('add_hotel_room'),
            P_H_ID,
            S_ID,
            T_S_ROOM,
            A_S_ROOM
        );
        INSERT INTO AVAILABLE_ROOM_PER_HOTEL (
            AVAILABLE_ROOM_ID,
            HOTEL_ID,
            ROOM_ID,
            TOTAL_ROOM,
            AVAILABLE_ROOM
        ) VALUES (
            NEXTVAL('add_hotel_room'),
            P_H_ID,
            M_ID,
            T_M_ROOM,
            A_M_ROOM
        );
        INSERT INTO AVAILABLE_ROOM_PER_HOTEL (
            AVAILABLE_ROOM_ID,
            HOTEL_ID,
            ROOM_ID,
            TOTAL_ROOM,
            AVAILABLE_ROOM
        ) VALUES (
            NEXTVAL('add_hotel_room'),
            P_H_ID,
            L_ID,
            T_L_ROOM,
            A_L_ROOM
        );
        RAISE NOTICE 'Rooms Added Successfully!...';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'Please contact your administrator!...';
    END;

    $$        LANGUAGE PLPGSQL;
 -- Get rooms by hotel ID
    CREATE    OR REPLACE

    FUNCTION GET_HOTEL_ROOMS(
        P_HOTEL_ID INT
    ) RETURNS TABLE ( ROOM_ID INT, ROOM_SIZE VARCHAR(30), ROOM_CAPACITY INT, ROOM_PRICE NUMERIC, TOTAL_ROOM INT, AVAILABLE_ROOM INT ) AS
        $$     BEGIN RETURN QUERY
        SELECT
            RT.ROOM_ID,
            RT.ROOM_SIZE,
            RT.ROOM_CAPACITY,
            RT.ROOM_PRICE,
            ARH.TOTAL_ROOM,
            ARH.AVAILABLE_ROOM
        FROM
            AVAILABLE_ROOM_PER_HOTEL ARH
            JOIN ROOM_TYPE RT
            ON ARH.ROOM_ID = RT.ROOM_ID
        WHERE
            ARH.HOTEL_ID = P_HOTEL_ID;
    END;
    $$     LANGUAGE PLPGSQL;
 -- Feature 2: Update hotel rooms
    CREATE OR REPLACE

    FUNCTION UPDATE_HOTEL_ROOM(
        P_HOTEL_ID INT,
        P_ROOM_SIZE VARCHAR,
        P_TOTAL_ROOM INT,
        P_AVAILABLE_ROOM INT
    ) RETURNS VOID AS
        $$  BEGIN UPDATE AVAILABLE_ROOM_PER_HOTEL AS ARH SET TOTAL_ROOM = P_TOTAL_ROOM, AVAILABLE_ROOM = P_AVAILABLE_ROOM FROM ROOM_TYPE AS RT WHERE ARH.HOTEL_ID = P_HOTEL_ID AND RT.ROOM_ID = ARH.ROOM_ID AND RT.ROOM_SIZE = P_ROOM_SIZE;
    END;
    $$  LANGUAGE PLPGSQL;