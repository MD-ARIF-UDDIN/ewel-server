const express = require('express');
const router = express.Router();
const {
    getUsers,
    getUser,
    createUser,
    updateUser,
    deleteUser,
    getUserStats,
    getProfile,
    updateProfile,
    uploadProfilePhoto: uploadProfilePhotoController,
    changeUserPassword
} = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');
const { superadminOnly } = require('../middleware/roleMiddleware');
const { activityLoggers } = require('../middleware/activityLogMiddleware');
const { uploadProfilePhoto: uploadMiddleware, processProfilePhoto } = require('../middleware/uploadMiddleware');

// Profile routes (authenticated users can access their own profile)
router.get('/profile', protect, getProfile);
router.put('/profile', protect, uploadMiddleware, processProfilePhoto, activityLoggers.profileUpdate, updateProfile);
router.post('/profile/photo', protect, uploadMiddleware, processProfilePhoto, activityLoggers.profileUpdate, uploadProfilePhotoController);

// Admin-only routes
router.use(protect);
router.use(superadminOnly);

router.get('/', getUsers);
router.get('/stats', getUserStats);
router.get('/:id', getUser);
router.post('/', activityLoggers.userCreate, createUser);
router.put('/:id', activityLoggers.userUpdate, updateUser);
router.delete('/:id', activityLoggers.userDelete, deleteUser);
router.put('/:id/password', activityLoggers.passwordChange, changeUserPassword);

module.exports = router;