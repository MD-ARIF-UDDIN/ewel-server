const express = require('express');
const router = express.Router();
const {
    getHealthcareCenters,
    getHealthcareCenter,
    createHealthcareCenter,
    updateHealthcareCenter,
    deleteHealthcareCenter,
    getMyHCS,
    checkAvailability,
    checkAllAvailability
} = require('../controllers/hcsController');
const { protect } = require('../middleware/authMiddleware');
const { superadminOnly, hcsAdminOrSuperadmin } = require('../middleware/roleMiddleware');
const { activityLoggers } = require('../middleware/activityLogMiddleware');

// Public routes
router.get('/', getHealthcareCenters);

// Protected routes - Specific routes must come before parameterized routes
router.get('/my-hcs', protect, hcsAdminOrSuperadmin, getMyHCS);
router.get('/availability', checkAllAvailability);
router.get('/:id/availability', checkAvailability);
router.get('/:id', getHealthcareCenter);

router.post('/', protect, superadminOnly, activityLoggers.hcsCreate, createHealthcareCenter);
router.put('/:id', protect, hcsAdminOrSuperadmin, activityLoggers.hcsUpdate, updateHealthcareCenter);
router.delete('/:id', protect, superadminOnly, activityLoggers.hcsDelete, deleteHealthcareCenter);

module.exports = router;