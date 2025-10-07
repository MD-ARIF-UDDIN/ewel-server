const mongoose = require('mongoose');

const testSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Test title is required'],
        trim: true,
        maxlength: [100, 'Title cannot be more than 100 characters']
    },
    description: {
        type: String,
        required: [true, 'Test description is required'],
        maxlength: [500, 'Description cannot be more than 500 characters']
    },
    type: {
        type: String,
        required: [true, 'Test type is required'],
        enum: ['Blood Test', 'X-Ray', 'MRI', 'CT Scan', 'Ultrasound', 'ECG', 'Other'],
        default: 'Blood Test'
    },
    // Base price for the test (can be overridden by HCS-specific pricing)
    price: {
        type: Number,
        required: [true, 'Test price is required'],
        min: [0, 'Price cannot be negative']
    },
    // HCS-specific pricing
    hcsPricing: [{
        hcs: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'HealthcareCenter',
            required: true
        },
        price: {
            type: Number,
            required: true,
            min: [0, 'Price cannot be negative']
        },
        // Status of the assignment (pending approval, approved, rejected)
        status: {
            type: String,
            enum: ['pending', 'approved', 'rejected'],
            default: 'approved'
        }
    }],
    duration: {
        type: Number,
        required: [true, 'Test duration is required'],
        min: [1, 'Duration must be at least 1 minute']
    },
    extraFields: {
        type: Map,
        of: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Test', testSchema);