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

        const hotelQuery = "select * from hotel"
        const hotelQueryResult = await pool.query(hotelQuery);
        const existingHotels = hotelQueryResult.rows;

        res.status(200).render('dashboard/hotel.ejs', {
            title: 'Hotel',
            user: userInfo,
            hotels: existingHotels,
        });
    }

    addHotelPage = async (req, res) => {
        const { userInfo } = req;

        res.status(200).render('dashboard/add-hotel.ejs', {
            title: 'Add Hotel',
            user: userInfo,
            error: "",
        });
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

            // Check if the hotel already exists
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

}

module.exports = new DashboardController();