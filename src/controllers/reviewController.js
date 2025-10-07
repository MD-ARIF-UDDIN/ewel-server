const Review = require('../models/Review');
const User = require('../models/User');

// @desc    Get public approved reviews
// @route   GET /api/reviews/public
// @access  Public
exports.getPublicReviews = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 5;
        const sortBy = req.query.sortBy || 'createdAt';
        const order = req.query.order === 'asc' ? 1 : -1;

        // Build sort query
        const sortQuery = {};
        sortQuery[sortBy] = order;

        const reviews = await Review.find({
            status: 'approved',
            review: { $ne: '' } // Only reviews with actual text content
        })
            .populate('user', 'name role')
            .sort(sortQuery)
            .limit(limit)
            .select('rating review createdAt user');

        res.status(200).json({
            success: true,
            data: reviews
        });
    } catch (error) {
        console.error('Error fetching public reviews:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching reviews',
            error: error.message
        });
    }
};

// @desc    Get all reviews
// @route   GET /api/reviews
// @access  Private (Superadmin only)
exports.getReviews = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const status = req.query.status;
        const rating = req.query.rating;
        const sortBy = req.query.sortBy || 'createdAt';
        const order = req.query.order === 'asc' ? 1 : -1;

        const skip = (page - 1) * limit;

        // Build filter query
        let filterQuery = {};
        if (status) {
            filterQuery.status = status;
        }
        if (rating) {
            filterQuery.rating = parseInt(rating);
        }

        // Build sort query
        const sortQuery = {};
        sortQuery[sortBy] = order;

        const [reviews, totalReviews] = await Promise.all([
            Review.find(filterQuery)
                .populate('user', 'name email role')
                .populate('reviewedBy', 'name email')
                .sort(sortQuery)
                .skip(skip)
                .limit(limit),
            Review.countDocuments(filterQuery)
        ]);

        // Calculate pagination info
        const totalPages = Math.ceil(totalReviews / limit);
        const hasNext = page < totalPages;
        const hasPrev = page > 1;

        // Calculate statistics
        const stats = await Review.aggregate([
            {
                $group: {
                    _id: null,
                    totalReviews: { $sum: 1 },
                    averageRating: { $avg: '$rating' },
                    ratingDistribution: {
                        $push: '$rating'
                    },
                    statusDistribution: {
                        $push: '$status'
                    }
                }
            }
        ]);

        let reviewStats = {
            totalReviews: 0,
            averageRating: 0,
            ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
            statusDistribution: { pending: 0, approved: 0, rejected: 0 }
        };

        if (stats.length > 0) {
            const stat = stats[0];
            reviewStats.totalReviews = stat.totalReviews;
            reviewStats.averageRating = Math.round(stat.averageRating * 10) / 10;

            // Count rating distribution
            stat.ratingDistribution.forEach(rating => {
                reviewStats.ratingDistribution[rating]++;
            });

            // Count status distribution
            stat.statusDistribution.forEach(status => {
                reviewStats.statusDistribution[status]++;
            });
        }

        res.status(200).json({
            success: true,
            data: reviews,
            pagination: {
                page,
                limit,
                totalPages,
                totalReviews,
                hasNext,
                hasPrev
            },
            stats: reviewStats
        });
    } catch (error) {
        console.error('Error fetching reviews:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching reviews',
            error: error.message
        });
    }
};

// @desc    Get single review
// @route   GET /api/reviews/:id
// @access  Private
exports.getReview = async (req, res) => {
    try {
        const review = await Review.findById(req.params.id)
            .populate('user', 'name email role phone address')
            .populate('reviewedBy', 'name email');

        if (!review) {
            return res.status(404).json({
                success: false,
                message: 'Review not found'
            });
        }

        res.status(200).json({
            success: true,
            data: review
        });
    } catch (error) {
        console.error('Error fetching review:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching review',
            error: error.message
        });
    }
};

// @desc    Create new review
// @route   POST /api/reviews
// @access  Private (Customer only)
exports.createReview = async (req, res) => {
    try {
        const { rating, review } = req.body;

        // Check if user already has a review
        const existingReview = await Review.findOne({ user: req.user._id });
        if (existingReview) {
            return res.status(400).json({
                success: false,
                message: 'You have already submitted a review. You can update your existing review instead.'
            });
        }

        const newReview = await Review.create({
            user: req.user._id,
            rating: parseInt(rating),
            review: review ? review.trim() : ''
        });

        const populatedReview = await Review.findById(newReview._id)
            .populate('user', 'name email role');

        res.status(201).json({
            success: true,
            data: populatedReview,
            message: 'Review submitted successfully'
        });
    } catch (error) {
        console.error('Error creating review:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating review',
            error: error.message
        });
    }
};

// @desc    Update review
// @route   PUT /api/reviews/:id
// @access  Private (Customer can update own review, Superadmin can update any)
exports.updateReview = async (req, res) => {
    try {
        const review = await Review.findById(req.params.id);

        if (!review) {
            return res.status(404).json({
                success: false,
                message: 'Review not found'
            });
        }

        // Check permissions
        if (req.user.role !== 'Superadmin' && review.user.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to update this review'
            });
        }

        const updateData = {};

        // Customer can update rating and review text
        if (req.user.role === 'Customer') {
            if (req.body.rating) updateData.rating = parseInt(req.body.rating);
            if (req.body.review !== undefined) updateData.review = req.body.review ? req.body.review.trim() : '';
        }

        // Superadmin can update status and admin response
        if (req.user.role === 'Superadmin') {
            if (req.body.status) {
                updateData.status = req.body.status;
                updateData.reviewedBy = req.user._id;
                updateData.reviewedAt = new Date();
            }
            if (req.body.adminResponse !== undefined) {
                updateData.adminResponse = req.body.adminResponse.trim();
            }
        }

        const updatedReview = await Review.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true }
        ).populate('user', 'name email role')
            .populate('reviewedBy', 'name email');

        res.status(200).json({
            success: true,
            data: updatedReview,
            message: 'Review updated successfully'
        });
    } catch (error) {
        console.error('Error updating review:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating review',
            error: error.message
        });
    }
};

// @desc    Delete review
// @route   DELETE /api/reviews/:id
// @access  Private (Customer can delete own review, Superadmin can delete any)
exports.deleteReview = async (req, res) => {
    try {
        const review = await Review.findById(req.params.id);

        if (!review) {
            return res.status(404).json({
                success: false,
                message: 'Review not found'
            });
        }

        // Check permissions
        if (req.user.role !== 'Superadmin' && review.user.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to delete this review'
            });
        }

        await Review.findByIdAndDelete(req.params.id);

        res.status(200).json({
            success: true,
            message: 'Review deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting review:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting review',
            error: error.message
        });
    }
};

// @desc    Get user's own review
// @route   GET /api/reviews/my-review
// @access  Private (Customer only)
exports.getMyReview = async (req, res) => {
    try {
        const review = await Review.findOne({ user: req.user._id })
            .populate('user', 'name email role')
            .populate('reviewedBy', 'name email');

        if (!review) {
            return res.status(404).json({
                success: false,
                message: 'No review found for this user'
            });
        }

        res.status(200).json({
            success: true,
            data: review
        });
    } catch (error) {
        console.error('Error fetching user review:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching user review',
            error: error.message
        });
    }
};