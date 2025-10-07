const mongoose = require('mongoose');
const HealthcareCenter = require('../models/HealthcareCenter');
const Test = require('../models/Test');
require('dotenv').config();

// Connect to database
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

const initializeTestSlots = async () => {
    try {
        console.log('Starting test slots initialization...');

        // Get all healthcare centers
        const hcsList = await HealthcareCenter.find();
        console.log(`Found ${hcsList.length} healthcare centers`);

        // Get all tests
        const tests = await Test.find();
        console.log(`Found ${tests.length} tests`);

        // For each HCS, initialize testSlots with default values
        for (const hcs of hcsList) {
            console.log(`Processing ${hcs.name}...`);

            // Create testSlots entries for all tests with default slot count
            const testSlots = tests.map(test => ({
                test: test._id,
                slotsPerDay: hcs.availableSlotsPerDay || 10 // Use existing global value as default
            }));

            // Update the HCS with testSlots
            await HealthcareCenter.findByIdAndUpdate(hcs._id, {
                $set: { testSlots }
            });

            console.log(`Updated ${hcs.name} with ${testSlots.length} test slot entries`);
        }

        console.log('Test slots initialization completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Error initializing test slots:', error);
        process.exit(1);
    }
};

initializeTestSlots();