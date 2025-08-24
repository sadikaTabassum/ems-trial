const router = require("express").Router();
const dashboardController = require("../controllers/dashboardController");
const authMiddleware = require("../middleware/authMiddleware");

router.get("/dashboard", authMiddleware, dashboardController.dashboardPage);

// ----------------------
// Admin Hotel Routes
// ----------------------
router.get("/hotel", authMiddleware, dashboardController.hotelPage);
router.get("/add-hotel", authMiddleware, dashboardController.addHotelPage);
router.post("/add-hotel", authMiddleware, dashboardController.registerHotel);

router.get(
  "/add-rooms/:hotel_id",
  authMiddleware,
  dashboardController.addHotelRoomsPage
);
router.post(
  "/add-rooms/:hotel_id",
  authMiddleware,
  dashboardController.registerRoomsToHotel
);

router.get(
  "/view-rooms/:hotel_id",
  authMiddleware,
  dashboardController.hotelRoomsPage
);

router.get(
  "/update-rooms/:hotel_id",
  authMiddleware,
  dashboardController.updateHotelRoomsPage
);
router.post(
  "/update-rooms/:hotel_id",
  authMiddleware,
  dashboardController.updateHotelRooms
);

// ----------------------
// Admin Guest Routes
// ----------------------
router.get("/guests", authMiddleware, dashboardController.guestsPage);

// Show Update Guest Form
router.get(
  "/update-guest",
  authMiddleware,
  dashboardController.updateGuestsPage
);

router.post("/delete-guest", authMiddleware, dashboardController.deleteGuest);

// Submit Updated Guest Data
router.post("/update-guest", authMiddleware, dashboardController.updateGuest);

// ----------------------
// Client Routes
// ----------------------
router.get("/events", authMiddleware, dashboardController.eventsPage);

router.get(
  "/reserve-event",
  authMiddleware,
  dashboardController.reserveEventPage
);
router.post(
  "/reserve-event",
  authMiddleware,
  dashboardController.reserveEventRegister
);

// View rooms for a reservation
router.get(
  "/event-rooms/:reservation_id",
  authMiddleware,
  dashboardController.eventRoomsPage
);

// Show add-room form
router.get(
  "/event-rooms/:reservation_id/add-room",
  authMiddleware,
  dashboardController.addRoomsPage
);

// Submit add-room
router.post(
  "/add-room/:reservation_id",
  authMiddleware,
  dashboardController.addExtraRoom
);

module.exports = router;
