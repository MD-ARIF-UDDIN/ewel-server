const mongoose = require('mongoose');

const testAssignmentRequestSchema = new mongoose.Schema({
    test: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Test',
        required: true
    },
    hcs: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'HealthcareCenter',
        required: true
    },
    requestedPrice: {
        type: Number,
        required: true,
        min: [0, 'Price cannot be negative']
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    },
    requestedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    notes: {
        type: String,
        maxlength: [500, 'Notes cannot be more than 500 characters']
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('TestAssignmentRequest', testAssignmentRequestSchema);