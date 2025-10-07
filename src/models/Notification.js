const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'User is required']
    },
    title: {
        type: String,
        required: [true, 'Title is required'],
        trim: true,
        maxlength: [100, 'Title cannot be more than 100 characters']
    },
    message: {
        type: String,
        required: [true, 'Message is required'],
        trim: true,
        maxlength: [500, 'Message cannot be more than 500 characters']
    },
    type: {
        type: String,
        enum: ['success', 'warning', 'error', 'info'],
        default: 'info'
    },
    read: {
        type: Boolean,
        default: false
    },
    relatedResource: {
        type: {
            type: String,
            enum: ['booking', 'test', 'hcs', 'review']
        },
        id: {
            type: mongoose.Schema.Types.ObjectId,
            refPath: 'relatedResource.type'
        }
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Indexes for efficient queries
notificationSchema.index({ user: 1 });
notificationSchema.index({ read: 1 });
notificationSchema.index({ timestamp: -1 });

// Virtual for notification age
notificationSchema.virtual('notificationAge').get(function () {
    const now = new Date();
    const diffTime = Math.abs(now - this.timestamp);
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

// Ensure virtual fields are serialized
notificationSchema.set('toJSON', { virtuals: true });
notificationSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Notification', notificationSchema);