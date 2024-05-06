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
        $$   DECLARE ROOM_ALREADY_EXIST EXCEPTION;
        S_ID INT;
        M_ID INT;
        L_ID INT;
    BEGIN
        IF EXISTS (
            SELECT
                1
            FROM
                AVAILABLE_ROOM_PER_HOTEL
            WHERE
                HOTEL_ID = P_H_ID
        ) THEN
            RAISE ROOM_ALREADY_EXIST;
        ELSE
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
        END IF;
    EXCEPTION
        WHEN ROOM_ALREADY_EXIST THEN
            RAISE NOTICE 'Rooms already exist!...';
        WHEN OTHERS THEN
            RAISE NOTICE 'Please contact your administrator!...';
    END;

    $$        LANGUAGE PLPGSQL  ;