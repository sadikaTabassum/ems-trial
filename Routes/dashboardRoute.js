const router = require('express').Router();
const dashboardController = require('../controllers/dashboardController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/dashboard', authMiddleware, dashboardController.dashboardPage);

module.exports = router;