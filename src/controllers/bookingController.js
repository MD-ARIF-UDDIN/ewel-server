const Booking = require('../models/Booking');
const Test = require('../models/Test');
const HealthcareCenter = require('../models/HealthcareCenter');
const User = require('../models/User');

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

// @desc    Get all bookings
// @route   GET /api/bookings
// @access  Private
exports.getBookings = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50; // Max 50 per page
        const status = req.query.status || '';
        const sortBy = req.query.sortBy || 'createdAt';
        const order = req.query.order === 'asc' ? 1 : -1;
        const search = req.query.search || '';

        const skip = (page - 1) * limit;

        let query = {};

        // Filter by user if not superadmin
        if (req.user.role === 'Customer') {
            query.user = req.user.id;
        } else if (req.user.role === 'HCS Admin') {
            // Get HCS where user is admin
            const hcs = await HealthcareCenter.findOne({ admin: req.user.id });
            if (hcs) {
                query.hcs = hcs._id;
            } else {
                return res.status(200).json({
                    success: true,
                    count: 0,
                    data: []
                });
            }
        }

        // Add status filter
        if (status) {
            query.status = status;
        }

        // Add search filter
        if (search) {
            // We'll search in related fields through population
            // For now, we'll just add it to the query and handle it in the frontend
        }

        // Build sort query
        const sortQuery = {};
        sortQuery[sortBy] = order;

        const [bookings, totalBookings] = await Promise.all([
            Booking.find(query)
                .populate({
                    path: 'user',
                    select: 'name email phone',
                    options: { strictPopulate: false }
                })
                .populate({
                    path: 'test',
                    select: 'title type price duration hcsPricing',
                    options: { strictPopulate: false }
                })
                .populate({
                    path: 'hcs',
                    select: 'name address contact availableSlotsPerDay',
                    options: { strictPopulate: false }
                })
                .sort(sortQuery)
                .skip(skip)
                .limit(limit),
            Booking.countDocuments(query)
        ]);

        // Calculate pagination info
        const totalPages = Math.ceil(totalBookings / limit);
        const hasNext = page < totalPages;
        const hasPrev = page > 1;

        res.status(200).json({
            success: true,
            count: bookings.length,
            data: bookings,
            pagination: {
                page,
                limit,
                totalPages,
                totalBookings,
                hasNext,
                hasPrev
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get single booking
// @route   GET /api/bookings/:id
// @access  Private
exports.getBooking = async (req, res, next) => {
    try {
        const booking = await Booking.findById(req.params.id)
            .populate({
                path: 'user',
                select: 'name email phone',
                options: { strictPopulate: false }
            })
            .populate({
                path: 'test',
                select: 'title type price duration hcsPricing',
                options: { strictPopulate: false }
            })
            .populate({
                path: 'hcs',
                select: 'name address contact availableSlotsPerDay',
                options: { strictPopulate: false }
            });

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }

        // Check authorization
        if (req.user.role === 'Customer' && booking.user._id.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to access this booking'
            });
        }

        res.status(200).json({
            success: true,
            data: booking
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Create new booking
// @route   POST /api/bookings
// @access  Private (Customer)
exports.createBooking = async (req, res, next) => {
    try {
        const { test: testId, hcs: hcsId, scheduledAt, phone } = req.body;

        // Validate required fields
        if (!testId || !hcsId || !scheduledAt) {
            return res.status(400).json({
                success: false,
                message: 'Test, healthcare center, and scheduled date are required'
            });
        }

        // Verify test exists and get test details
        const testDoc = await Test.findById(testId);
        if (!testDoc) {
            return res.status(404).json({
                success: false,
                message: 'Test not found'
            });
        }

        // Use the provided HCS (no fallback to first available HCS)
        let hcsToUse = hcsId;

        // Verify HCS exists and test is available at that HCS
        const hcsDoc = await HealthcareCenter.findById(hcsToUse);
        if (!hcsDoc) {
            return res.status(404).json({
                success: false,
                message: 'Healthcare center not found'
            });
        }

        // Check if test is approved for this HCS
        const hcsPricing = testDoc.hcsPricing.find(
            pricing => pricing.hcs.toString() === hcsToUse && pricing.status === 'approved'
        );
        if (!hcsPricing) {
            return res.status(400).json({
                success: false,
                message: 'Test is not available at the selected healthcare center'
            });
        }

        // Check if scheduled time is in the future
        const scheduledDate = new Date(scheduledAt);
        if (isNaN(scheduledDate.getTime())) {
            return res.status(400).json({
                success: false,
                message: 'Invalid date format provided'
            });
        }

        if (scheduledDate <= new Date()) {
            return res.status(400).json({
                success: false,
                message: 'Scheduled time must be in the future'
            });
        }

        // Check if HCS has available slots for the selected date and test
        const bookingCount = await countBookingsForDate(hcsToUse, scheduledDate);
        const availableSlots = hcsDoc.getSlotsForTest(testId);

        if (bookingCount >= availableSlots) {
            return res.status(400).json({
                success: false,
                message: `No available slots for the selected date. Maximum ${availableSlots} bookings allowed per day for this test.`
            });
        }

        // Update user's phone number if provided
        if (phone) {
            await User.findByIdAndUpdate(req.user.id, { phone });
        }

        const booking = await Booking.create({
            user: req.user.id,
            test: testId,
            hcs: hcsToUse,
            scheduledAt
        });

        const populatedBooking = await Booking.findById(booking._id)
            .populate({
                path: 'user',
                select: 'name email phone',
                options: { strictPopulate: false }
            })
            .populate({
                path: 'test',
                select: 'title type price duration hcsPricing',
                options: { strictPopulate: false }
            })
            .populate({
                path: 'hcs',
                select: 'name address contact availableSlotsPerDay testSlots',
                options: { strictPopulate: false }
            });

        res.status(201).json({
            success: true,
            data: populatedBooking
        });
    } catch (error) {
        console.error('Error creating booking:', error);
        next(error);
    }
};

// @desc    Update booking status
// @route   PUT /api/bookings/:id
// @access  Private (HCS Admin, Superadmin)
exports.updateBooking = async (req, res, next) => {
    try {
        let booking = await Booking.findById(req.params.id);

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }

        // Check authorization for HCS Admin
        if (req.user.role === 'HCS Admin') {
            const hcs = await HealthcareCenter.findOne({ admin: req.user.id });
            if (!hcs || hcs._id.toString() !== booking.hcs.toString()) {
                return res.status(403).json({
                    success: false,
                    message: 'Not authorized to update this booking'
                });
            }
        }

        // Store previous status for slot management
        const previousStatus = booking.status;
        const newStatus = req.body.status;

        // If status is changing to confirmed, check slot availability
        if (newStatus === 'confirmed' && previousStatus !== 'confirmed') {
            // Check if HCS has available slots for the selected date and test
            const scheduledDate = new Date(booking.scheduledAt);
            const bookingCount = await countBookingsForDate(booking.hcs, scheduledDate);
            const hcsDoc = await HealthcareCenter.findById(booking.hcs);
            const availableSlots = hcsDoc.getSlotsForTest(booking.test);

            // If we're confirming and there are no slots available, reject the update
            if (bookingCount >= availableSlots) {
                return res.status(400).json({
                    success: false,
                    message: `No available slots for the selected date. Maximum ${availableSlots} bookings allowed per day for this test.`
                });
            }
        }

        // Update the booking
        booking = await Booking.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        })
            .populate({
                path: 'user',
                select: 'name email phone',
                options: { strictPopulate: false }
            })
            .populate({
                path: 'test',
                select: 'title type price duration hcsPricing',
                options: { strictPopulate: false }
            })
            .populate({
                path: 'hcs',
                select: 'name address contact availableSlotsPerDay testSlots',
                options: { strictPopulate: false }
            });

        res.status(200).json({
            success: true,
            data: booking
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Cancel booking
// @route   PUT /api/bookings/:id/cancel
// @access  Private (Customer, HCS Admin, Superadmin)
exports.cancelBooking = async (req, res, next) => {
    try {
        let booking = await Booking.findById(req.params.id);

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }

        // Check authorization
        if (req.user.role === 'Customer' && booking.user.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to cancel this booking'
            });
        }

        if (req.user.role === 'HCS Admin') {
            const hcs = await HealthcareCenter.findOne({ admin: req.user.id });
            if (!hcs || hcs._id.toString() !== booking.hcs.toString()) {
                return res.status(403).json({
                    success: false,
                    message: 'Not authorized to cancel this booking'
                });
            }
        }

        booking.status = 'canceled';
        await booking.save();

        const populatedBooking = await Booking.findById(booking._id)
            .populate('user', 'name email phone')
            .populate('test', 'title type price duration hcsPricing')
            .populate('hcs', 'name address contact availableSlotsPerDay');

        res.status(200).json({
            success: true,
            data: populatedBooking
        });
    } catch (error) {
        next(error);
    }
};