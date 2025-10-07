const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'User is required']
    },
    action: {
        type: String,
        required: [true, 'Action is required'],
        enum: [
            // Authentication actions
            'LOGIN', 'LOGOUT', 'REGISTER', 'PASSWORD_RESET', 'PASSWORD_CHANGE',

            // User management actions
            'USER_CREATE', 'USER_UPDATE', 'USER_DELETE', 'USER_VIEW',

            // Booking actions
            'BOOKING_CREATE', 'BOOKING_UPDATE', 'BOOKING_DELETE', 'BOOKING_VIEW', 'BOOKING_STATUS_CHANGE',

            // Healthcare Center actions
            'HCS_CREATE', 'HCS_UPDATE', 'HCS_DELETE', 'HCS_VIEW',

            // Test actions
            'TEST_CREATE', 'TEST_UPDATE', 'TEST_DELETE', 'TEST_VIEW',

            // Review actions
            'REVIEW_CREATE', 'REVIEW_UPDATE', 'REVIEW_DELETE', 'REVIEW_VIEW', 'REVIEW_STATUS_CHANGE',

            // Report actions
            'REPORT_VIEW', 'REPORT_EXPORT',

            // Dashboard actions
            'DASHBOARD_VIEW',

            // Profile actions
            'PROFILE_VIEW', 'PROFILE_UPDATE',

            // Generic actions
            'VIEW', 'CREATE', 'UPDATE', 'DELETE', 'EXPORT'
        ]
    },
    resource: {
        type: String,
        required: [true, 'Resource is required'],
        enum: [
            'USER', 'BOOKING', 'HEALTHCARE_CENTER', 'TEST', 'REVIEW',
            'DASHBOARD', 'PROFILE', 'REPORT', 'AUTH', 'SYSTEM'
        ]
    },
    resourceId: {
        type: mongoose.Schema.Types.ObjectId,
        required: false // Some actions might not have a specific resource ID
    },
    description: {
        type: String,
        required: [true, 'Description is required'],
        maxlength: [500, 'Description cannot be more than 500 characters']
    },
    success: {
        type: Boolean,
        default: true
    },
    errorMessage: {
        type: String,
        required: false,
        maxlength: [1000, 'Error message cannot be more than 1000 characters']
    },
    duration: {
        type: Number, // in milliseconds
        required: false,
        min: [0, 'Duration cannot be negative']
    },
    severity: {
        type: String,
        enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
        default: 'LOW'
    }
}, {
    timestamps: true
});

// Indexes for efficient queries
activityLogSchema.index({ user: 1 });
activityLogSchema.index({ action: 1 });
activityLogSchema.index({ resource: 1 });
activityLogSchema.index({ createdAt: -1 });
activityLogSchema.index({ success: 1 });
activityLogSchema.index({ severity: 1 });
activityLogSchema.index({ user: 1, createdAt: -1 });
activityLogSchema.index({ action: 1, resource: 1 });

// Virtual for activity age
activityLogSchema.virtual('activityAge').get(function () {
    const now = new Date();
    const diffTime = Math.abs(now - this.createdAt);
    const diffMinutes = Math.ceil(diffTime / (1000 * 60));

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes} minutes ago`;

    const diffHours = Math.ceil(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours} hours ago`;

    const diffDays = Math.ceil(diffHours / 24);
    if (diffDays < 7) return `${diffDays} days ago`;

    const diffWeeks = Math.ceil(diffDays / 7);
    if (diffWeeks < 4) return `${diffWeeks} weeks ago`;

    const diffMonths = Math.ceil(diffDays / 30);
    return `${diffMonths} months ago`;
});

// Static method to log activity
activityLogSchema.statics.logActivity = async function (logData) {
    try {
        const log = new this(logData);
        await log.save();
        return log;
    } catch (error) {
        console.error('Error logging activity:', error);
        // Don't throw error to prevent breaking the main functionality
        return null;
    }
};

// Static method to get activity statistics
activityLogSchema.statics.getStats = async function (filter = {}) {
    try {
        const stats = await this.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: null,
                    totalActivities: { $sum: 1 },
                    successfulActivities: {
                        $sum: { $cond: ['$success', 1, 0] }
                    },
                    failedActivities: {
                        $sum: { $cond: ['$success', 0, 1] }
                    },
                    actionDistribution: { $push: '$action' },
                    resourceDistribution: { $push: '$resource' },
                    severityDistribution: { $push: '$severity' },
                    uniqueUsers: { $addToSet: '$user' }
                }
            }
        ]);

        if (stats.length === 0) {
            return {
                totalActivities: 0,
                successfulActivities: 0,
                failedActivities: 0,
                uniqueUsersCount: 0,
                actionDistribution: {},
                resourceDistribution: {},
                severityDistribution: {}
            };
        }

        const stat = stats[0];

        // Count distributions
        const actionDistribution = {};
        stat.actionDistribution.forEach(action => {
            actionDistribution[action] = (actionDistribution[action] || 0) + 1;
        });

        const resourceDistribution = {};
        stat.resourceDistribution.forEach(resource => {
            resourceDistribution[resource] = (resourceDistribution[resource] || 0) + 1;
        });

        const severityDistribution = {};
        stat.severityDistribution.forEach(severity => {
            severityDistribution[severity] = (severityDistribution[severity] || 0) + 1;
        });

        return {
            totalActivities: stat.totalActivities,
            successfulActivities: stat.successfulActivities,
            failedActivities: stat.failedActivities,
            uniqueUsersCount: stat.uniqueUsers.length,
            actionDistribution,
            resourceDistribution,
            severityDistribution
        };
    } catch (error) {
        console.error('Error getting activity stats:', error);
        return {
            totalActivities: 0,
            successfulActivities: 0,
            failedActivities: 0,
            uniqueUsersCount: 0,
            actionDistribution: {},
            resourceDistribution: {},
            severityDistribution: {}
        };
    }
};

// Ensure virtual fields are serialized
activityLogSchema.set('toJSON', { virtuals: true });
activityLogSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('ActivityLog', activityLogSchema);