const HealthcareCenter = require('../models/HealthcareCenter');
const User = require('../models/User');
const Booking = require('../models/Booking');
const Test = require('../models/Test');
const TestAssignmentRequest = require('../models/TestAssignmentRequest');

// Helper function to count bookings for a specific date at an HCS
const countBookingsForDate = async (hcsId, date) => {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return await Booking.countDocuments({
        hcs: hcsId,
        scheduledAt: {
            $gte: startOfDay,
            $lte: endOfDay
        },
        status: { $ne: 'canceled' } // Don't count canceled bookings
    });
};

// @desc    Get all healthcare centers
// @route   GET /api/hcs
// @access  Public
exports.getHealthcareCenters = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const skip = (page - 1) * limit;

        const [hcs, totalHCS] = await Promise.all([
            HealthcareCenter.find()
                .populate('admin', 'name email')
                .select('+testSlots') // Include testSlots in the response
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            HealthcareCenter.countDocuments()
        ]);

        // Calculate pagination info
        const totalPages = Math.ceil(totalHCS / limit);
        const hasNext = page < totalPages;
        const hasPrev = page > 1;

        res.status(200).json({
            success: true,
            count: hcs.length,
            data: hcs,
            pagination: {
                page,
                limit,
                totalPages,
                totalHCS,
                hasNext,
                hasPrev
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get single healthcare center
// @route   GET /api/hcs/:id
// @access  Public
exports.getHealthcareCenter = async (req, res, next) => {
    try {
        const hcs = await HealthcareCenter.findById(req.params.id)
            .populate('admin', 'name email')
            .select('+testSlots'); // Include testSlots in the response

        if (!hcs) {
            return res.status(404).json({
                success: false,
                message: 'Healthcare center not found'
            });
        }

        res.status(200).json({
            success: true,
            data: hcs
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Create new healthcare center
// @route   POST /api/hcs
// @access  Private (Superadmin)
exports.createHealthcareCenter = async (req, res, next) => {
    try {
        const hcs = await HealthcareCenter.create(req.body);

        const populatedHCS = await HealthcareCenter.findById(hcs._id)
            .populate('admin', 'name email');

        res.status(201).json({
            success: true,
            data: populatedHCS
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Update healthcare center
// @route   PUT /api/hcs/:id
// @access  Private (Superadmin, HCS Admin)
exports.updateHealthcareCenter = async (req, res, next) => {
    try {
        let hcs = await HealthcareCenter.findById(req.params.id);

        if (!hcs) {
            return res.status(404).json({
                success: false,
                message: 'Healthcare center not found'
            });
        }

        // Check if user is HCS Admin and owns this HCS
        if (req.user.role === 'HCS Admin') {
            if (hcs.admin.toString() !== req.user.id) {
                return res.status(403).json({
                    success: false,
                    message: 'Not authorized to update this healthcare center'
                });
            }
        }

        hcs = await HealthcareCenter.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        }).populate('admin', 'name email');

        res.status(200).json({
            success: true,
            data: hcs
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete healthcare center
// @route   DELETE /api/hcs/:id
// @access  Private (Superadmin)
exports.deleteHealthcareCenter = async (req, res, next) => {
    try {
        const hcs = await HealthcareCenter.findById(req.params.id);

        if (!hcs) {
            return res.status(404).json({
                success: false,
                message: 'Healthcare center not found'
            });
        }

        // Remove this HCS from all tests
        await Test.updateMany(
            { 'hcsPricing.hcs': hcs._id },
            { $pull: { hcsPricing: { hcs: hcs._id } } }
        );

        // Remove all test assignment requests for this HCS
        await TestAssignmentRequest.deleteMany({ hcs: hcs._id });

        // Delete all bookings for this HCS
        await Booking.deleteMany({ hcs: hcs._id });

        await HealthcareCenter.findByIdAndDelete(req.params.id);

        res.status(200).json({
            success: true,
            message: 'Healthcare center deleted successfully'
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get current user's HCS (for HCS Admins)
// @route   GET /api/hcs/my-hcs
// @access  Private (HCS Admin)
exports.getMyHCS = async (req, res, next) => {
    try {
        const hcs = await HealthcareCenter.findOne({ admin: req.user.id })
            .populate('admin', 'name email')
            .select('+testSlots'); // Include testSlots in the response

        if (!hcs) {
            return res.status(404).json({
                success: false,
                message: 'Healthcare center not found for this admin'
            });
        }

        res.status(200).json({
            success: true,
            data: hcs
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Check availability for a specific date at an HCS
// @route   GET /api/hcs/:id/availability
// @access  Public
exports.checkAvailability = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { date, test } = req.query; // Added test parameter

        if (!date) {
            return res.status(400).json({
                success: false,
                message: 'Date parameter is required'
            });
        }

        // Validate date format
        const selectedDate = new Date(date);
        if (isNaN(selectedDate.getTime())) {
            return res.status(400).json({
                success: false,
                message: 'Invalid date format'
            });
        }

        // Check if date is in the past
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (selectedDate < today) {
            return res.status(400).json({
                success: false,
                message: 'Cannot check availability for past dates'
            });
        }

        // Get HCS to check available slots
        const hcs = await HealthcareCenter.findById(id);
        if (!hcs) {
            return res.status(404).json({
                success: false,
                message: 'Healthcare center not found'
            });
        }

        // Count existing bookings for the date
        const bookingCount = await countBookingsForDate(id, selectedDate);

        // Get slots based on test-specific or global setting
        let availableSlots;
        if (test) {
            availableSlots = hcs.getSlotsForTest(test);
        } else {
            availableSlots = hcs.availableSlotsPerDay || 10;
        }

        const available = Math.max(0, availableSlots - bookingCount);

        res.status(200).json({
            success: true,
            data: {
                date: selectedDate.toISOString().split('T')[0],
                total: availableSlots,
                booked: bookingCount,
                available: available
            }
        });
    } catch (error) {
        console.error('Error in checkAvailability:', error);
        next(error);
    }
};

// @desc    Check availability for a specific date across all HCS
// @route   GET /api/hcs/availability
// @access  Public
exports.checkAllAvailability = async (req, res, next) => {
    try {
        const { date, test } = req.query;

        if (!date) {
            return res.status(400).json({
                success: false,
                message: 'Date parameter is required'
            });
        }

        // Validate date format
        const selectedDate = new Date(date);
        if (isNaN(selectedDate.getTime())) {
            return res.status(400).json({
                success: false,
                message: 'Invalid date format'
            });
        }

        // Check if date is in the past
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (selectedDate < today) {
            return res.status(400).json({
                success: false,
                message: 'Cannot check availability for past dates'
            });
        }

        // Get all healthcare centers
        const hcsList = await HealthcareCenter.find();

        let totalSlots = 0;
        let totalBooked = 0;

        // Process each HCS
        for (const hcs of hcsList) {
            // If a specific test is requested, check if this HCS offers that test
            if (test) {
                const testDoc = await Test.findById(test);
                if (!testDoc) {
                    return res.status(404).json({
                        success: false,
                        message: 'Test not found'
                    });
                }

                // Check if this HCS offers the requested test
                const hcsOffersTest = testDoc.hcsPricing.some(pricing =>
                    pricing.hcs.toString() === hcs._id.toString() && pricing.status === 'approved'
                );

                // Skip this HCS if it doesn't offer the test
                if (!hcsOffersTest) {
                    continue;
                }
            }

            // Count existing bookings for the date at this HCS
            const bookingCount = await countBookingsForDate(hcs._id, selectedDate);

            // Get slots based on test-specific or global setting
            let availableSlots;
            if (test && hcs.testSlots) {
                availableSlots = hcs.getSlotsForTest(test);
            } else {
                availableSlots = hcs.availableSlotsPerDay || 10;
            }

            totalSlots += availableSlots;
            totalBooked += bookingCount;
        }

        const totalAvailable = Math.max(0, totalSlots - totalBooked);

        res.status(200).json({
            success: true,
            data: {
                date: selectedDate.toISOString().split('T')[0],
                total: totalSlots,
                booked: totalBooked,
                available: totalAvailable
            }
        });
    } catch (error) {
        console.error('Error in checkAllAvailability:', error);
        next(error);
    }
};
