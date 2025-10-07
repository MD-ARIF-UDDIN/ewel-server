const express = require('express');
const router = express.Router();
const {
    getTests,
    getTest,
    createTest,
    updateTest,
    deleteTest,
    getTestTypes,
    assignTestToHCS,
    removeTestFromHCS,
    requestTestAssignment,
    getAssignmentRequests,
    reviewAssignmentRequest,
    getTestsNotAssignedToHCS
} = require('../controllers/testController');
const { protect } = require('../middleware/authMiddleware');
const { hcsAdminOrSuperadmin, superadminOnly } = require('../middleware/roleMiddleware');
const { activityLoggers } = require('../middleware/activityLogMiddleware');

// Public routes
router.get('/', getTests);
router.get('/types', getTestTypes);

// Specific routes that could conflict with parameterized routes
// These must come BEFORE the parameterized routes
router.get('/assignment-requests', protect, superadminOnly, getAssignmentRequests);
router.put('/assignment-requests/:id', protect, superadminOnly, reviewAssignmentRequest);
router.get('/not-assigned', protect, hcsAdminOrSuperadmin, getTestsNotAssignedToHCS);

// Parameterized routes (should come after specific routes)
router.get('/:id', getTest);
router.post('/:id/request-assignment', protect, hcsAdminOrSuperadmin, requestTestAssignment);
router.post('/:id/assign-hcs', protect, superadminOnly, assignTestToHCS);
router.delete('/:id/remove-hcs/:hcsId', protect, superadminOnly, removeTestFromHCS);

// Protected routes - General test management
router.post('/', protect, hcsAdminOrSuperadmin, activityLoggers.testCreate, createTest);
router.put('/:id', protect, hcsAdminOrSuperadmin, activityLoggers.testUpdate, updateTest);
router.delete('/:id', protect, superadminOnly, activityLoggers.testDelete, deleteTest);

module.exports = router;