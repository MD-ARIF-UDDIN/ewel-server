const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'User is required']
    },
    test: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Test',
        required: [true, 'Test is required']
    },
    hcs: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'HealthcareCenter',
        required: [true, 'Healthcare center is required']
    },
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'completed', 'canceled'],
        default: 'pending'
    },
    scheduledAt: {
        type: Date,
        required: [true, 'Scheduled date is required']
    },
    // Store the price at the time of booking
    priceAtBooking: {
        type: Number
        // Removed required validation since it's set automatically in pre-save hook
    },
    extraFields: {
        type: Map,
        of: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, {
    timestamps: true
});

// Before saving, set the price at booking
bookingSchema.pre('save', async function (next) {
    if (this.isNew) {
        // Get the test and HCS to determine the price
        const Test = require('./Test');
        const test = await Test.findById(this.test);
        if (test) {
            // Find the price for this HCS
            const hcsPricing = test.hcsPricing.find(
                pricing => pricing.hcs.toString() === this.hcs.toString() && pricing.status === 'approved'
            );
            this.priceAtBooking = hcsPricing ? hcsPricing.price : test.price;
        } else {
            this.priceAtBooking = 0;
        }
    }
    next();
});

module.exports = mongoose.model('Booking', bookingSchema);