const express = require('express');
const router = express.Router();
const {
    getBookings,
    getBooking,
    createBooking,
    updateBooking,
    cancelBooking
} = require('../controllers/bookingController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const { activityLoggers } = require('../middleware/activityLogMiddleware');

// All booking routes are protected
router.use(protect);

// Customer routes
router.get('/', getBookings);
router.get('/:id', getBooking);
router.post('/', authorize('Customer'), activityLoggers.bookingCreate, createBooking);
router.put('/:id/cancel', authorize('Customer', 'HCS Admin', 'Superadmin'), activityLoggers.bookingUpdate, cancelBooking);

// HCS Admin and Superadmin routes
router.put('/:id', authorize('HCS Admin', 'Superadmin'), activityLoggers.bookingUpdate, updateBooking);

module.exports = router;