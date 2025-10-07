const express = require('express');
const {
    getActivityLogs,
    getActivityLog,
    getActivityStats,
    cleanupOldLogs,
    exportActivityLogs,
    deleteAllLogs
} = require('../controllers/activityLogController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

const router = express.Router();

// All routes require authentication and superadmin role
router.use(protect);
router.use(authorize('Superadmin'));

// Activity logs routes
router.route('/')
    .get(getActivityLogs)
    .delete(deleteAllLogs);

router.route('/stats')
    .get(getActivityStats);

router.route('/export')
    .get(exportActivityLogs);

router.route('/cleanup')
    .delete(cleanupOldLogs);

router.route('/:id')
    .get(getActivityLog);

module.exports = router;