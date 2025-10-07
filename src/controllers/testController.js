const Test = require('../models/Test');
const HealthcareCenter = require('../models/HealthcareCenter');
const TestAssignmentRequest = require('../models/TestAssignmentRequest');
const User = require('../models/User');

// @desc    Get all tests
// @route   GET /api/tests
// @access  Public
exports.getTests = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50; // Max 50 per page
        const type = req.query.type || '';
        const hcs = req.query.hcs || '';
        const search = req.query.search || '';
        const sortBy = req.query.sortBy || 'createdAt';
        const order = req.query.order === 'asc' ? 1 : -1;

        const skip = (page - 1) * limit;

        // Build filter query
        let filterQuery = {};

        // Filter by type
        if (type) {
            filterQuery.type = type;
        }

        // Filter by healthcare center
        if (hcs) {
            filterQuery['hcsPricing.hcs'] = hcs;
            filterQuery['hcsPricing.status'] = 'approved';
        }

        // Filter by search term
        if (search) {
            filterQuery.$or = [
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }

        // Build sort query
        const sortQuery = {};
        sortQuery[sortBy] = order;

        const [tests, totalTests] = await Promise.all([
            Test.find(filterQuery)
                .populate('hcsPricing.hcs', 'name address contact email availableSlotsPerDay')
                .sort(sortQuery)
                .skip(skip)
                .limit(limit),
            Test.countDocuments(filterQuery)
        ]);

        // Calculate pagination info
        const totalPages = Math.ceil(totalTests / limit);
        const hasNext = page < totalPages;
        const hasPrev = page > 1;

        res.status(200).json({
            success: true,
            count: tests.length,
            data: tests,
            pagination: {
                page,
                limit,
                totalPages,
                totalTests,
                hasNext,
                hasPrev
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get single test
// @route   GET /api/tests/:id
// @access  Public
exports.getTest = async (req, res, next) => {
    try {
        const test = await Test.findById(req.params.id)
            .populate('hcsPricing.hcs', 'name address contact email availableSlotsPerDay');

        if (!test) {
            return res.status(404).json({
                success: false,
                message: 'Test not found'
            });
        }

        res.status(200).json({
            success: true,
            data: test
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Create new test
// @route   POST /api/tests
// @access  Private (HCS Admin, Superadmin)
exports.createTest = async (req, res, next) => {
    try {
        const test = await Test.create(req.body);

        const populatedTest = await Test.findById(test._id)
            .populate('hcsPricing.hcs', 'name address contact email availableSlotsPerDay');

        res.status(201).json({
            success: true,
            data: populatedTest
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Update test
// @route   PUT /api/tests/:id
// @access  Private (HCS Admin, Superadmin)
exports.updateTest = async (req, res, next) => {
    try {
        let test = await Test.findById(req.params.id);

        if (!test) {
            return res.status(404).json({
                success: false,
                message: 'Test not found'
            });
        }

        test = await Test.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        }).populate('hcsPricing.hcs', 'name address contact email availableSlotsPerDay');

        res.status(200).json({
            success: true,
            data: test
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete test
// @route   DELETE /api/tests/:id
// @access  Private (Superadmin)
exports.deleteTest = async (req, res, next) => {
    try {
        const test = await Test.findById(req.params.id);

        if (!test) {
            return res.status(404).json({
                success: false,
                message: 'Test not found'
            });
        }

        await Test.findByIdAndDelete(req.params.id);

        res.status(200).json({
            success: true,
            message: 'Test deleted successfully'
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get test types
// @route   GET /api/tests/types
// @access  Public
exports.getTestTypes = async (req, res, next) => {
    try {
        const types = await Test.distinct('type');

        res.status(200).json({
            success: true,
            data: types
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get tests not assigned to a specific HCS
// @route   GET /api/tests/not-assigned
// @access  Private (HCS Admin)
exports.getTestsNotAssignedToHCS = async (req, res, next) => {
    try {
        const hcsId = req.user.hcs; // Get HCS from authenticated user
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const type = req.query.type || '';
        const search = req.query.search || '';
        const sortBy = req.query.sortBy || 'createdAt';
        const order = req.query.order === 'asc' ? 1 : -1;

        const skip = (page - 1) * limit;

        // Build filter query for tests NOT assigned to this HCS
        let filterQuery = {
            $or: [
                { 'hcsPricing.hcs': { $ne: hcsId } },
                { 'hcsPricing': { $size: 0 } },
                {
                    'hcsPricing': {
                        $elemMatch: {
                            hcs: hcsId,
                            status: { $ne: 'approved' }
                        }
                    }
                }
            ]
        };

        // Filter by type
        if (type) {
            filterQuery.type = type;
        }

        // Filter by search term
        if (search) {
            filterQuery.$or = [
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }

        // Build sort query
        const sortQuery = {};
        sortQuery[sortBy] = order;

        const [tests, totalTests] = await Promise.all([
            Test.find(filterQuery)
                .populate('hcsPricing.hcs', 'name address contact email availableSlotsPerDay')
                .sort(sortQuery)
                .skip(skip)
                .limit(limit),
            Test.countDocuments(filterQuery)
        ]);

        // Calculate pagination info
        const totalPages = Math.ceil(totalTests / limit);
        const hasNext = page < totalPages;
        const hasPrev = page > 1;

        res.status(200).json({
            success: true,
            count: tests.length,
            data: tests,
            pagination: {
                page,
                limit,
                totalPages,
                totalTests,
                hasNext,
                hasPrev
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Assign test to HCS with specific price and update slot information
// @route   POST /api/tests/:id/assign-hcs
// @access  Private (Superadmin)
exports.assignTestToHCS = async (req, res, next) => {
    try {
        const { hcs, price, slots } = req.body;
        const testId = req.params.id;

        // Validate HCS exists
        const healthcareCenter = await HealthcareCenter.findById(hcs);
        if (!healthcareCenter) {
            return res.status(404).json({
                success: false,
                message: 'Healthcare center not found'
            });
        }

        // Find the test
        const test = await Test.findById(testId);
        if (!test) {
            return res.status(404).json({
                success: false,
                message: 'Test not found'
            });
        }

        // Check if HCS is already assigned
        const existingAssignment = test.hcsPricing.find(item => item.hcs.toString() === hcs);
        if (existingAssignment) {
            // Update existing assignment
            existingAssignment.price = price;
            existingAssignment.status = 'approved';
        } else {
            // Add new assignment
            test.hcsPricing.push({
                hcs,
                price,
                status: 'approved'
            });
        }

        await test.save();

        // Update HCS slot information for this specific test if provided
        if (slots !== undefined) {
            healthcareCenter.setSlotsForTest(testId, slots);
            await healthcareCenter.save();
        }

        const populatedTest = await Test.findById(testId)
            .populate('hcsPricing.hcs', 'name address contact email availableSlotsPerDay testSlots');

        res.status(200).json({
            success: true,
            message: 'Test assigned to HCS successfully',
            data: {
                test: populatedTest,
                hcs: healthcareCenter
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Remove test assignment from HCS
// @route   DELETE /api/tests/:id/remove-hcs/:hcsId
// @access  Private (Superadmin)
exports.removeTestFromHCS = async (req, res, next) => {
    try {
        const { id: testId, hcsId } = req.params;

        // Find the test
        const test = await Test.findById(testId);
        if (!test) {
            return res.status(404).json({
                success: false,
                message: 'Test not found'
            });
        }

        // Remove HCS from hcsPricing array
        test.hcsPricing = test.hcsPricing.filter(item => item.hcs.toString() !== hcsId);

        await test.save();

        const populatedTest = await Test.findById(testId)
            .populate('hcsPricing.hcs', 'name address contact email availableSlotsPerDay');

        res.status(200).json({
            success: true,
            message: 'Test removed from HCS successfully',
            data: populatedTest
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Create test assignment request (HCS requests to be assigned a test)
// @route   POST /api/tests/:id/request-assignment
// @access  Private (HCS Admin)
exports.requestTestAssignment = async (req, res, next) => {
    try {
        const { price, notes } = req.body;
        const testId = req.params.id;
        const hcsId = req.user.hcs; // Get HCS from authenticated user
        const userId = req.user.id; // Get requesting user

        // Validate HCS exists
        const healthcareCenter = await HealthcareCenter.findById(hcsId);
        if (!healthcareCenter) {
            return res.status(404).json({
                success: false,
                message: 'Healthcare center not found'
            });
        }

        // Find the test
        const test = await Test.findById(testId);
        if (!test) {
            return res.status(404).json({
                success: false,
                message: 'Test not found'
            });
        }

        // Check if HCS already has an approved assignment
        const existingApprovedAssignment = test.hcsPricing.find(
            item => item.hcs.toString() === hcsId && item.status === 'approved'
        );
        if (existingApprovedAssignment) {
            return res.status(400).json({
                success: false,
                message: 'Test is already assigned to this HCS'
            });
        }

        // Check if there's already a pending request from this HCS
        const existingRequest = await TestAssignmentRequest.findOne({
            test: testId,
            hcs: hcsId,
            status: 'pending'
        });
        if (existingRequest) {
            return res.status(400).json({
                success: false,
                message: 'There is already a pending request for this test from your HCS'
            });
        }

        // Create assignment request
        const assignmentRequest = await TestAssignmentRequest.create({
            test: testId,
            hcs: hcsId,
            requestedPrice: price,
            requestedBy: userId,
            notes
        });

        const populatedRequest = await TestAssignmentRequest.findById(assignmentRequest._id)
            .populate('test', 'title description')
            .populate('hcs', 'name')
            .populate('requestedBy', 'name');

        res.status(201).json({
            success: true,
            message: 'Test assignment request submitted successfully',
            data: populatedRequest
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get test assignment requests (for Superadmin)
// @route   GET /api/tests/assignment-requests
// @access  Private (Superadmin)
exports.getAssignmentRequests = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const status = req.query.status || '';
        const skip = (page - 1) * limit;

        // Build filter query
        let filterQuery = {};

        if (status) {
            filterQuery.status = status;
        }

        const [requests, totalRequests] = await Promise.all([
            TestAssignmentRequest.find(filterQuery)
                .populate('test', 'title description')
                .populate('hcs', 'name address availableSlotsPerDay')
                .populate('requestedBy', 'name')
                .populate('reviewedBy', 'name')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            TestAssignmentRequest.countDocuments(filterQuery)
        ]);

        // Calculate pagination info
        const totalPages = Math.ceil(totalRequests / limit);
        const hasNext = page < totalPages;
        const hasPrev = page > 1;

        res.status(200).json({
            success: true,
            count: requests.length,
            data: requests,
            pagination: {
                page,
                limit,
                totalPages,
                totalRequests,
                hasNext,
                hasPrev
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Approve/reject test assignment request
// @route   PUT /api/tests/assignment-requests/:id
// @access  Private (Superadmin)
exports.reviewAssignmentRequest = async (req, res, next) => {
    try {
        const { status, notes } = req.body; // status: 'approved' or 'rejected'
        const requestId = req.params.id;
        const reviewerId = req.user.id;

        // Find the request
        const request = await TestAssignmentRequest.findById(requestId);
        if (!request) {
            return res.status(404).json({
                success: false,
                message: 'Assignment request not found'
            });
        }

        // Update request status
        request.status = status;
        request.reviewedBy = reviewerId;
        if (notes) request.notes = notes;

        await request.save();

        // If approved, update the test
        if (status === 'approved') {
            const test = await Test.findById(request.test);
            if (test) {
                // Check if HCS is already assigned
                const existingAssignment = test.hcsPricing.find(
                    item => item.hcs.toString() === request.hcs.toString()
                );
                if (existingAssignment) {
                    // Update existing assignment
                    existingAssignment.price = request.requestedPrice;
                    existingAssignment.status = 'approved';
                } else {
                    // Add new assignment
                    test.hcsPricing.push({
                        hcs: request.hcs,
                        price: request.requestedPrice,
                        status: 'approved'
                    });
                }
                await test.save();
            }
        }

        const populatedRequest = await TestAssignmentRequest.findById(requestId)
            .populate('test', 'title description')
            .populate('hcs', 'name address availableSlotsPerDay')
            .populate('requestedBy', 'name')
            .populate('reviewedBy', 'name');

        res.status(200).json({
            success: true,
            message: `Test assignment request ${status} successfully`,
            data: populatedRequest
        });
    } catch (error) {
        next(error);
    }
};