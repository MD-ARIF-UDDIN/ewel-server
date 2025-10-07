const Notification = require('../models/Notification');
const Booking = require('../models/Booking');

// @desc    Get user notifications
// @route   GET /api/notifications
// @access  Private (Customer)
exports.getNotifications = async (req, res, next) => {
    try {
        // Only fetch notifications for Customer users
        if (req.user.role !== 'Customer') {
            return res.status(200).json({
                success: true,
                count: 0,
                data: []
            });
        }

        // Fetch real bookings data
        const bookings = await Booking.find({ user: req.user.id })
            .populate('test', 'title')
            .populate('hcs', 'name')
            .sort({ createdAt: -1 });

        // Generate real notifications based on booking data
        const notifications = [];
        const now = new Date();

        for (const booking of bookings) {
            const scheduledDate = new Date(booking.scheduledAt);
            const timeDiff = scheduledDate.getTime() - now.getTime();
            const hoursDiff = timeDiff / (1000 * 3600);
            const daysDiff = timeDiff / (1000 * 3600 * 24);

            // Booking confirmation notification
            if (booking.status === 'confirmed') {
                notifications.push({
                    user: req.user.id,
                    title: 'Booking Confirmed',
                    message: `Your ${booking.test.title} appointment has been confirmed for ${scheduledDate.toLocaleDateString()}`,
                    type: 'success',
                    read: false,
                    relatedResource: {
                        type: 'booking',
                        id: booking._id
                    },
                    timestamp: booking.updatedAt
                });

                // Add reminder notifications for upcoming appointments
                if (daysDiff <= 1 && daysDiff > 0) {
                    notifications.push({
                        user: req.user.id,
                        title: 'Appointment Tomorrow',
                        message: `Reminder: You have a ${booking.test.title} appointment tomorrow at ${booking.hcs.name}`,
                        type: 'info',
                        read: false,
                        relatedResource: {
                            type: 'booking',
                            id: booking._id
                        },
                        timestamp: new Date(now.getTime() - (24 - hoursDiff) * 3600000)
                    });
                }

                if (hoursDiff <= 2 && hoursDiff > 0) {
                    notifications.push({
                        user: req.user.id,
                        title: 'Appointment Soon',
                        message: `Your ${booking.test.title} appointment is in ${Math.ceil(hoursDiff)} hour(s) at ${booking.hcs.name}`,
                        type: 'warning',
                        read: false,
                        relatedResource: {
                            type: 'booking',
                            id: booking._id
                        },
                        timestamp: new Date(now.getTime() - (2 - hoursDiff) * 3600000)
                    });
                }
            }

            // Completed appointment notification
            if (booking.status === 'completed') {
                notifications.push({
                    user: req.user.id,
                    title: 'Appointment Completed',
                    message: `Your ${booking.test.title} appointment has been completed. Results will be available soon.`,
                    type: 'success',
                    read: true, // Completed notifications are marked as read by default
                    relatedResource: {
                        type: 'booking',
                        id: booking._id
                    },
                    timestamp: booking.updatedAt
                });
            }

            // Cancelled appointment notification
            if (booking.status === 'canceled') {
                notifications.push({
                    user: req.user.id,
                    title: 'Appointment Cancelled',
                    message: `Your ${booking.test.title} appointment has been cancelled.`,
                    type: 'error',
                    read: false,
                    relatedResource: {
                        type: 'booking',
                        id: booking._id
                    },
                    timestamp: booking.updatedAt
                });
            }

            // Pending booking notification
            if (booking.status === 'pending') {
                notifications.push({
                    user: req.user.id,
                    title: 'Booking Under Review',
                    message: `Your ${booking.test.title} booking is being reviewed. You will be notified once confirmed.`,
                    type: 'info',
                    read: false,
                    relatedResource: {
                        type: 'booking',
                        id: booking._id
                    },
                    timestamp: booking.createdAt
                });
            }
        }

        // Sort notifications by timestamp (newest first)
        notifications.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        // Save notifications to database (if they don't already exist)
        const savedNotifications = [];
        for (const notificationData of notifications) {
            // Check if notification already exists
            const existingNotification = await Notification.findOne({
                user: notificationData.user,
                title: notificationData.title,
                message: notificationData.message,
                'relatedResource.id': notificationData.relatedResource.id
            });

            if (existingNotification) {
                savedNotifications.push(existingNotification);
            } else {
                const newNotification = new Notification(notificationData);
                const savedNotification = await newNotification.save();
                savedNotifications.push(savedNotification);
            }
        }

        res.status(200).json({
            success: true,
            count: savedNotifications.length,
            data: savedNotifications
        });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching notifications',
            error: error.message
        });
    }
};

// @desc    Mark a notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private (Customer)
exports.markAsRead = async (req, res, next) => {
    try {
        const notification = await Notification.findById(req.params.id);

        if (!notification) {
            return res.status(404).json({
                success: false,
                message: 'Notification not found'
            });
        }

        // Check if user is authorized to mark this notification as read
        if (notification.user.toString() !== req.user.id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to mark this notification as read'
            });
        }

        notification.read = true;
        await notification.save();

        res.status(200).json({
            success: true,
            data: notification
        });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({
            success: false,
            message: 'Error marking notification as read',
            error: error.message
        });
    }
};

// @desc    Mark all notifications as read
// @route   PUT /api/notifications/mark-all-read
// @access  Private (Customer)
exports.markAllAsRead = async (req, res, next) => {
    try {
        // Update all unread notifications for the user
        const result = await Notification.updateMany(
            {
                user: req.user.id,
                read: false
            },
            {
                read: true
            }
        );

        res.status(200).json({
            success: true,
            message: `Marked ${result.modifiedCount} notifications as read`,
            modifiedCount: result.modifiedCount
        });
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        res.status(500).json({
            success: false,
            message: 'Error marking all notifications as read',
            error: error.message
        });
    }
};