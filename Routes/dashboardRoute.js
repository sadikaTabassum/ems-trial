const router = require('express').Router();
const dashboardController = require('../controllers/dashboardController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/dashboard', authMiddleware, dashboardController.dashboardPage);
router.get('/hotel', authMiddleware, dashboardController.hotelPage);
router.get('/add-hotel', authMiddleware, dashboardController.addHotelPage);
router.post('/add-hotel', authMiddleware, dashboardController.registerHotel);

module.exports = router;