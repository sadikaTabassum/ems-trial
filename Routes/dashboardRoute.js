const router = require('express').Router();
const dashboardController = require('../controllers/dashboardController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/dashboard', authMiddleware, dashboardController.dashboardPage);
router.get('/hotel', authMiddleware, dashboardController.hotelPage);
router.get('/add-hotel', authMiddleware, dashboardController.addHotelPage);
router.post('/add-hotel', authMiddleware, dashboardController.registerHotel);
router.get('/add-rooms/:hotel_id', authMiddleware, dashboardController.addHotelRoomsPage);
router.post('/add-rooms/:hotel_id', authMiddleware, dashboardController.registerRoomsToHotel);
router.get('/view-rooms/:hotel_id', authMiddleware, dashboardController.hotelRoomsPage);
router.get('/update-rooms/:hotel_id', authMiddleware, dashboardController.updateHotelRoomsPage);
router.post('/update-rooms/:hotel_id', authMiddleware, dashboardController.updateHotelRooms);


module.exports = router;