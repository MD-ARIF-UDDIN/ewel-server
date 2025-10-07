const mongoose = require('mongoose');

const healthcareCenterSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Healthcare center name is required'],
        trim: true,
        maxlength: [100, 'Name cannot be more than 100 characters']
    },
    address: {
        type: String,
        required: [true, 'Address is required'],
        maxlength: [200, 'Address cannot be more than 200 characters']
    },
    contact: {
        type: String,
        required: [true, 'Contact number is required'],
        match: [/^\+?[\d\s-()]+$/, 'Please enter a valid contact number']
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        lowercase: true,
        match: [
            /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
            'Please enter a valid email'
        ]
    },
    admin: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Admin is required']
    },
    // Available slots per day (number of bookings allowed per day)
    // This will be deprecated in favor of test-specific slots
    availableSlotsPerDay: {
        type: Number,
        default: 10, // Default to 10 slots per day
        min: [0, 'Available slots cannot be negative'],
        max: [100, 'Available slots cannot exceed 100 per day']
    },
    // Test-specific slot management
    testSlots: [{
        test: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Test',
            required: true
        },
        slotsPerDay: {
            type: Number,
            default: 10,
            min: [0, 'Available slots cannot be negative'],
            max: [100, 'Available slots cannot exceed 100 per day']
        }
    }],
    extraFields: {
        type: Map,
        of: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, {
    timestamps: true
});

// Method to get slots for a specific test
healthcareCenterSchema.methods.getSlotsForTest = function (testId) {
    const testSlot = this.testSlots.find(slot => slot.test.toString() === testId.toString());
    return testSlot ? testSlot.slotsPerDay : this.availableSlotsPerDay;
};

// Method to set slots for a specific test
healthcareCenterSchema.methods.setSlotsForTest = function (testId, slots) {
    const testSlotIndex = this.testSlots.findIndex(slot => slot.test.toString() === testId.toString());
    if (testSlotIndex >= 0) {
        this.testSlots[testSlotIndex].slotsPerDay = slots;
    } else {
        this.testSlots.push({ test: testId, slotsPerDay: slots });
    }
};

module.exports = mongoose.model('HealthcareCenter', healthcareCenterSchema);