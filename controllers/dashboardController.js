const pool = require('../config/db');
const formidable = require('formidable');


class DashboardController {
    dashboardPage = (req, res) => {
        const { userInfo } = req;

        res.status(200).render('dashboard/index.ejs', {
            title: 'Dashboard',
            user: userInfo
        });
    }

    hotelPage = async (req, res) => {
        const { userInfo } = req;

        try {
            const query = `
            SELECT DISTINCT
            H.*,
                CASE
            WHEN ARH.HOTEL_ID IS NOT NULL THEN TRUE
            ELSE FALSE
            END AS has_rooms_assigned
            FROM
            HOTEL H
            LEFT JOIN
            AVAILABLE_ROOM_PER_HOTEL ARH ON H.HOTEL_ID = ARH.HOTEL_ID;
        `;

            const { rows } = await pool.query(query);

            res.status(200).render('dashboard/hotel.ejs', {
                title: 'Hotel',
                user: userInfo,
                hotels: rows,
            });
        } catch (error) {
            console.error('Error fetching hotels with room assignment status:', error);
            res.status(500).render('dashboard/error.ejs', {
                status: 500,
                title: 'Error',
                message: 'Internal server error',
                error: error,
            });
        }
    };


    addHotelPage = async (req, res) => {
        const { userInfo } = req;

        res.status(200).render('dashboard/add-hotel.ejs', {
            title: 'Add Hotel',
            user: userInfo,
            error: "",
        });
    }

    addHotelRoomsPage = async (req, res) => {
        const { userInfo } = req;
        const { hotel_id } = req.params;

        const hotelQuery = `SELECT * FROM hotel WHERE hotel_id = $1`;
        const hotelQueryResult = await pool.query(hotelQuery, [hotel_id]);
        const hotel = hotelQueryResult.rows[0];

        res.status(200).render('dashboard/add-rooms.ejs', {
            title: 'Add Rooms',
            user: userInfo,
            error: "",
            hotel: hotel,
        });
    }

    hotelRoomsPage = async (req, res) => {
        const { userInfo } = req;
        const { hotel_id } = req.params;

        try {
            const { rows } = await pool.query('SELECT * FROM GET_HOTEL_ROOMS($1)', [hotel_id]);

            res.status(200).render('dashboard/hotel-rooms.ejs', {
                title: 'Hotel Rooms',
                user: userInfo,
                hotelId: hotel_id,
                rooms: rows,
            });
        } catch (error) {
            console.error('Error fetching hotel rooms:', error);
            res.status(500).render('dashboard/error.ejs', {
                status: 500,
                title: 'Error',
                message: 'Internal server error',
                error: error,
            });
        }
    };

    updateHotelRoomsPage = async (req, res) => {
        const { userInfo } = req;
        const { hotel_id } = req.params;

        try {
            const { rows } = await pool.query('SELECT * FROM GET_HOTEL_ROOMS($1)', [hotel_id]);

            res.status(200).render('dashboard/update-rooms.ejs', {
                title: 'Update Rooms',
                user: userInfo,
                hotelId: hotel_id,
                rooms: rows,
                error: "",
            });
        } catch (error) {
            console.error('Error fetching hotel rooms:', error);
            res.status(500).render('dashboard/error.ejs', {
                status: 500,
                title: 'Error',
                message: 'Internal server error',
                error: error,
            });
        }
    }


    registerHotel = async (req, res) => {
        const { userInfo } = req;
        const form = new formidable.IncomingForm();

        try {
            const { fields } = await new Promise((resolve, reject) => {
                form.parse(req, (err, fields) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({ fields });
                    }
                });
            });

            const { hotel_name, address, state, zip_code, website, phone } = fields;

            const hotelCheckQuery = `SELECT COUNT(*) AS count FROM hotel WHERE hotel_name = $1`;
            const hotelExistsResult = await pool.query(hotelCheckQuery, [hotel_name]);
            const hotelExists = hotelExistsResult.rows[0].count > 0;

            if (hotelExists) {
                return res.status(400).render('dashboard/add-hotel.ejs', {
                    title: 'Add Hotel',
                    user: userInfo,
                    error: 'Hotel with this name already exists',
                });
            }

            const createHotelQuery = `CALL CREATE_HOTEL('${hotel_name}', '${address}', '${state}', '${zip_code}', '${website}', '${phone}')`;
            await pool.query(createHotelQuery);

            return res.status(200).redirect('/hotel');

        } catch (error) {
            return res.status(500).render('dashboard/error.ejs', {
                status: 500,
                title: 'Error',
                message: 'Internal server error',
                error: error
            });
        }
    }


    registerRoomsToHotel = async (req, res) => {
        const { userInfo } = req;
        const { hotel_id } = req.params;

        const form = new formidable.IncomingForm();

        try {
            const { fields } = await new Promise((resolve, reject) => {
                form.parse(req, (err, fields) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({ fields });
                    }
                });
            });

            const { t_s_room, t_m_room, t_l_room, a_s_room, a_m_room, a_l_room } = fields;

            const totalSmallRooms = parseInt(t_s_room);
            const totalMediumRooms = parseInt(t_m_room);
            const totalLargeRooms = parseInt(t_l_room);
            const availableSmallRooms = parseInt(a_s_room);
            const availableMediumRooms = parseInt(a_m_room);
            const availableLargeRooms = parseInt(a_l_room);

            const addHotelRoomsQuery = `CALL CREATE_HOTEL_ROOM('${hotel_id}', '${totalSmallRooms}', '${totalMediumRooms}', '${totalLargeRooms}', '${availableSmallRooms}', '${availableMediumRooms}', '${availableLargeRooms}')`;
            await pool.query(addHotelRoomsQuery);

            return res.status(200).redirect(`/hotel/${hotel_id}/rooms`);

        } catch (error) {
            return res.status(500).render('dashboard/error.ejs', {
                status: 500,
                title: 'Error',
                message: 'Internal server error',
                error: error
            });
        }
    }


    updateHotelRooms = async (req, res) => {
        const { userInfo } = req;
        const { hotel_id } = req.params;

        const form = new formidable.IncomingForm();

        try {
            const { fields } = await new Promise((resolve, reject) => {
                form.parse(req, (err, fields) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({ fields });
                    }
                });
            });

            const { t_small_hall_room, t_medium_hall_room, t_large_hall_room, a_small_hall_room, a_medium_hall_room, a_large_hall_room } = fields;

            const totalSmallRooms = parseInt(t_small_hall_room);
            const totalMediumRooms = parseInt(t_medium_hall_room);
            const totalLargeRooms = parseInt(t_large_hall_room);
            const availableSmallRooms = parseInt(a_small_hall_room);
            const availableMediumRooms = parseInt(a_medium_hall_room);
            const availableLargeRooms = parseInt(a_large_hall_room);


            const updateHotelRoomsQuery = `
            SELECT UPDATE_HOTEL_ROOM(
                ${hotel_id},
                'small_hall',
                ${totalSmallRooms},
                ${availableSmallRooms}
            );

            SELECT UPDATE_HOTEL_ROOM(
                ${hotel_id},
                'medium_hall',
                ${totalMediumRooms},
                ${availableMediumRooms}
            );

            SELECT UPDATE_HOTEL_ROOM(
                ${hotel_id},
                'large_hall',
                ${totalLargeRooms},
                ${availableLargeRooms}
            );
        `;
            await pool.query(updateHotelRoomsQuery);

            return res.status(200).redirect(`/view-rooms/${hotel_id}`);

        } catch (error) {
            return res.status(500).render('dashboard/error.ejs', {
                status: 500,
                title: 'Error',
                message: 'Internal server error',
                error: error
            });
        }
    };



}

module.exports = new DashboardController();