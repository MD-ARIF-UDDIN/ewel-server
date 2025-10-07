const express = require('express');
const {
    getReviews,
    getReview,
    createReview,
    updateReview,
    deleteReview,
    getMyReview,
    getPublicReviews
} = require('../controllers/reviewController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const { activityLoggers } = require('../middleware/activityLogMiddleware');

const router = express.Router();

// Public routes (no authentication required)
router.get('/public', getPublicReviews);

// All other routes require authentication
router.use(protect);

// Public routes for authenticated users
router.route('/my-review')
    .get(authorize('Customer'), getMyReview);

router.route('/')
    .get(authorize('Superadmin'), getReviews)
    .post(authorize('Customer'), activityLoggers.reviewCreate, createReview);

router.route('/:id')
    .get(getReview)
    .put(activityLoggers.reviewUpdate, updateReview)
    .delete(activityLoggers.reviewDelete, deleteReview);

module.exports = router;