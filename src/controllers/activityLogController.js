const ActivityLog = require('../models/ActivityLog');
const User = require('../models/User');

// @desc    Get activity logs with filtering
// @route   GET /api/activity-logs
// @access  Private (Superadmin only)
exports.getActivityLogs = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 50, 50); // Max 50 as requested
        const skip = (page - 1) * limit;

        // Build filter query
        let filterQuery = {};

        // Filter by user
        if (req.query.userId) {
            filterQuery.user = req.query.userId;
        }

        // Filter by action
        if (req.query.action) {
            filterQuery.action = req.query.action;
        }

        // Filter by resource
        if (req.query.resource) {
            filterQuery.resource = req.query.resource;
        }

        // Filter by success status
        if (req.query.success !== undefined) {
            filterQuery.success = req.query.success === 'true';
        }

        // Filter by severity
        if (req.query.severity) {
            filterQuery.severity = req.query.severity;
        }

        // Filter by date range
        if (req.query.startDate || req.query.endDate) {
            filterQuery.createdAt = {};
            if (req.query.startDate) {
                filterQuery.createdAt.$gte = new Date(req.query.startDate);
            }
            if (req.query.endDate) {
                filterQuery.createdAt.$lte = new Date(req.query.endDate);
            }
        }

        // Filter by search term (search in description)
        if (req.query.search) {
            filterQuery.description = {
                $regex: req.query.search,
                $options: 'i'
            };
        }

        // Build sort query
        const sortBy = req.query.sortBy || 'createdAt';
        const order = req.query.order === 'asc' ? 1 : -1;
        const sortQuery = {};
        sortQuery[sortBy] = order;

        // Execute queries in parallel
        const [logs, totalLogs, stats] = await Promise.all([
            ActivityLog.find(filterQuery)
                .populate('user', 'name email role')
                .sort(sortQuery)
                .skip(skip)
                .limit(limit)
                .lean(),
            ActivityLog.countDocuments(filterQuery),
            ActivityLog.getStats(filterQuery)
        ]);

        // Calculate pagination info
        const totalPages = Math.ceil(totalLogs / limit);
        const hasNext = page < totalPages;
        const hasPrev = page > 1;

        res.status(200).json({
            success: true,
            data: logs,
            pagination: {
                page,
                limit,
                totalPages,
                totalLogs,
                hasNext,
                hasPrev
            },
            stats
        });
    } catch (error) {
        console.error('Error fetching activity logs:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching activity logs',
            error: error.message
        });
    }
};

// @desc    Get single activity log
// @route   GET /api/activity-logs/:id
// @access  Private (Superadmin only)
exports.getActivityLog = async (req, res) => {
    try {
        const log = await ActivityLog.findById(req.params.id)
            .populate('user', 'name email role phone address')
            .lean();

        if (!log) {
            return res.status(404).json({
                success: false,
                message: 'Activity log not found'
            });
        }

        res.status(200).json({
            success: true,
            data: log
        });
    } catch (error) {
        console.error('Error fetching activity log:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching activity log',
            error: error.message
        });
    }
};

// @desc    Get activity statistics
// @route   GET /api/activity-logs/stats
// @access  Private (Superadmin only)
exports.getActivityStats = async (req, res) => {
    try {
        // Build filter query from request params
        let filterQuery = {};

        if (req.query.startDate || req.query.endDate) {
            filterQuery.createdAt = {};
            if (req.query.startDate) {
                filterQuery.createdAt.$gte = new Date(req.query.startDate);
            }
            if (req.query.endDate) {
                filterQuery.createdAt.$lte = new Date(req.query.endDate);
            }
        }

        // Get comprehensive stats
        const [
            generalStats,
            activityTrends,
            topUsers,
            recentErrors
        ] = await Promise.all([
            ActivityLog.getStats(filterQuery),
            getActivityTrends(filterQuery),
            getTopActiveUsers(filterQuery),
            getRecentErrors()
        ]);

        res.status(200).json({
            success: true,
            data: {
                general: generalStats,
                trends: activityTrends,
                topUsers,
                recentErrors
            }
        });
    } catch (error) {
        console.error('Error fetching activity statistics:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching activity statistics',
            error: error.message
        });
    }
};

// @desc    Delete old activity logs (cleanup)
// @route   DELETE /api/activity-logs/cleanup
// @access  Private (Superadmin only)
exports.cleanupOldLogs = async (req, res) => {
    try {
        const daysToKeep = parseInt(req.query.days) || 90; // Default 90 days
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

        const result = await ActivityLog.deleteMany({
            createdAt: { $lt: cutoffDate }
        });

        res.status(200).json({
            success: true,
            message: `Deleted ${result.deletedCount} old activity logs`,
            deletedCount: result.deletedCount
        });
    } catch (error) {
        console.error('Error cleaning up old logs:', error);
        res.status(500).json({
            success: false,
            message: 'Error cleaning up old logs',
            error: error.message
        });
    }
};

// @desc    Export activity logs
// @route   GET /api/activity-logs/export
// @access  Private (Superadmin only)
exports.exportActivityLogs = async (req, res) => {
    try {
        // Build filter query
        let filterQuery = {};

        if (req.query.startDate || req.query.endDate) {
            filterQuery.createdAt = {};
            if (req.query.startDate) {
                filterQuery.createdAt.$gte = new Date(req.query.startDate);
            }
            if (req.query.endDate) {
                filterQuery.createdAt.$lte = new Date(req.query.endDate);
            }
        }

        // Limit export to 1000 records for performance
        const logs = await ActivityLog.find(filterQuery)
            .populate('user', 'name email role')
            .sort({ createdAt: -1 })
            .limit(1000)
            .lean();

        // Format for CSV export
        const csvData = logs.map(log => ({
            timestamp: log.createdAt.toISOString(),
            user: log.user ? `${log.user.name} (${log.user.email})` : 'System',
            role: log.user?.role || 'System',
            action: log.action,
            resource: log.resource,
            description: log.description,
            success: log.success ? 'Yes' : 'No',
            severity: log.severity,
            ipAddress: log.ipAddress || 'N/A',
            duration: log.duration ? `${log.duration}ms` : 'N/A',
            errorMessage: log.errorMessage || 'N/A'
        }));

        res.status(200).json({
            success: true,
            data: csvData,
            count: csvData.length,
            message: `Exported ${csvData.length} activity logs`
        });
    } catch (error) {
        console.error('Error exporting activity logs:', error);
        res.status(500).json({
            success: false,
            message: 'Error exporting activity logs',
            error: error.message
        });
    }
};

// Helper function to get activity trends
const getActivityTrends = async (filterQuery) => {
    try {
        const trends = await ActivityLog.aggregate([
            { $match: filterQuery },
            {
                $group: {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' },
                        day: { $dayOfMonth: '$createdAt' }
                    },
                    count: { $sum: 1 },
                    successCount: { $sum: { $cond: ['$success', 1, 0] } },
                    errorCount: { $sum: { $cond: ['$success', 0, 1] } }
                }
            },
            {
                $sort: { '_id.year': -1, '_id.month': -1, '_id.day': -1 }
            },
            { $limit: 30 } // Last 30 days
        ]);

        return trends.map(trend => ({
            date: new Date(trend._id.year, trend._id.month - 1, trend._id.day),
            totalActivities: trend.count,
            successfulActivities: trend.successCount,
            failedActivities: trend.errorCount
        }));
    } catch (error) {
        console.error('Error getting activity trends:', error);
        return [];
    }
};

// Helper function to get top active users
const getTopActiveUsers = async (filterQuery) => {
    try {
        const topUsers = await ActivityLog.aggregate([
            { $match: filterQuery },
            {
                $group: {
                    _id: '$user',
                    activityCount: { $sum: 1 },
                    lastActivity: { $max: '$createdAt' },
                    actions: { $addToSet: '$action' }
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'userInfo'
                }
            },
            { $unwind: '$userInfo' },
            {
                $project: {
                    user: {
                        _id: '$userInfo._id',
                        name: '$userInfo.name',
                        email: '$userInfo.email',
                        role: '$userInfo.role'
                    },
                    activityCount: 1,
                    lastActivity: 1,
                    uniqueActions: { $size: '$actions' }
                }
            },
            { $sort: { activityCount: -1 } },
            { $limit: 10 }
        ]);

        return topUsers;
    } catch (error) {
        console.error('Error getting top active users:', error);
        return [];
    }
};

// Helper function to get recent errors
const getRecentErrors = async () => {
    try {
        const recentErrors = await ActivityLog.find({
            success: false,
            createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
        })
            .populate('user', 'name email role')
            .sort({ createdAt: -1 })
            .limit(10)
            .lean();

        return recentErrors;
    } catch (error) {
        console.error('Error getting recent errors:', error);
        return [];
    }
};

// @desc    Delete all activity logs
// @route   DELETE /api/activity-logs
// @access  Private (Superadmin only)
exports.deleteAllLogs = async (req, res) => {
    try {
        // Count total logs before deletion
        const totalLogs = await ActivityLog.countDocuments();

        // Delete all activity logs
        const result = await ActivityLog.deleteMany({});

        res.status(200).json({
            success: true,
            message: `Deleted ${result.deletedCount} activity logs`,
            deletedCount: result.deletedCount,
            totalLogsBefore: totalLogs
        });
    } catch (error) {
        console.error('Error deleting all logs:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting all activity logs',
            error: error.message
        });
    }
};
