const express = require('express');
const router = express.Router();
const {
    register,
    login,
    getMe,
    forgotPassword,
    resetPassword
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { activityLoggers } = require('../middleware/activityLogMiddleware');
const { uploadProfilePhoto, processProfilePhoto } = require('../middleware/uploadMiddleware');

router.post('/register', uploadProfilePhoto, processProfilePhoto, activityLoggers.register, register);
router.post('/login', activityLoggers.login, login);
router.post('/forgot-password', forgotPassword);
router.put('/reset-password/:resettoken', resetPassword);

router.get('/me', protect, getMe);

module.exports = router;