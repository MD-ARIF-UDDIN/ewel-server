const ActivityLog = require('../models/ActivityLog');

// Middleware to log user activities
const logActivity = (action, resource, options = {}) => {
    return async (req, res, next) => {
        const startTime = Date.now();

        // Store original res.json and res.send methods
        const originalJson = res.json;
        const originalSend = res.send;

        let responseSent = false;

        // Override res.json to capture response and log activity
        res.json = function (body) {
            if (!responseSent) {
                responseSent = true;
                logActivityData(req, res, action, resource, options, body, startTime);
            }
            return originalJson.call(this, body);
        };

        // Override res.send to capture response and log activity
        res.send = function (body) {
            if (!responseSent) {
                responseSent = true;
                logActivityData(req, res, action, resource, options, body, startTime);
            }
            return originalSend.call(this, body);
        };

        // Continue to next middleware
        next();
    };
};

// Helper function to log activity data
const logActivityData = async (req, res, action, resource, options, responseBody, startTime) => {
    try {
        const endTime = Date.now();
        const duration = endTime - startTime;

        // Skip logging for certain routes to avoid spam
        const skipRoutes = ['/api/health', '/favicon.ico'];
        if (skipRoutes.some(route => req.path.includes(route))) {
            return;
        }

        // Determine if the request was successful
        const success = res.statusCode >= 200 && res.statusCode < 400;

        // Extract user information
        const user = req.user ? req.user._id : null;

        // Skip logging if no user (for public routes)
        if (!user && !options.logPublic) {
            return;
        }

        // Generate description
        const description = options.description ||
            generateDescription(action, resource, req, res);

        // Extract resource ID from various sources
        let resourceId = options.resourceId;
        if (!resourceId) {
            resourceId = req.params.id ||
                req.body._id ||
                responseBody?.data?._id ||
                responseBody?.data?.id;
        }

        // Determine severity
        const severity = determineSeverity(action, resource, success, res.statusCode);

        // Create log entry (without IP, user agent, and metadata as requested)
        const logData = {
            user,
            action,
            resource,
            resourceId,
            description,
            success,
            errorMessage: success ? null : extractErrorMessage(responseBody),
            duration,
            severity
        };

        // Log the activity
        await ActivityLog.logActivity(logData);

    } catch (error) {
        console.error('Error in activity logging middleware:', error);
        // Don't throw error to prevent breaking the main functionality
    }
};

// Helper function to generate description
const generateDescription = (action, resource, req, res) => {
    const user = req.user ? req.user.name : 'Anonymous';
    const method = req.method;
    const resourceName = resource.toLowerCase().replace('_', ' ');

    switch (action) {
        case 'LOGIN':
            return `${user} logged in`;
        case 'LOGOUT':
            return `${user} logged out`;
        case 'REGISTER':
            return `New user registered: ${req.body.name || 'Unknown'}`;
        case 'PASSWORD_RESET':
            return `${user} requested password reset`;
        case 'PASSWORD_CHANGE':
            return `${user} changed password`;
        case 'DASHBOARD_VIEW':
            return `${user} viewed ${resourceName} dashboard`;
        case 'PROFILE_VIEW':
            return `${user} viewed profile`;
        case 'PROFILE_UPDATE':
            return `${user} updated profile`;
        default:
            const actionName = action.toLowerCase().replace('_', ' ');
            return `${user} performed ${actionName} on ${resourceName}`;
    }
};

// Helper function to determine severity
const determineSeverity = (action, resource, success, statusCode) => {
    if (!success) {
        if (statusCode >= 500) return 'CRITICAL';
        if (statusCode >= 400) return 'HIGH';
        return 'MEDIUM';
    }

    // High severity actions
    const highSeverityActions = [
        'USER_DELETE', 'HCS_DELETE', 'TEST_DELETE',
        'PASSWORD_RESET', 'PASSWORD_CHANGE'
    ];

    if (highSeverityActions.includes(action)) {
        return 'HIGH';
    }

    // Medium severity actions
    const mediumSeverityActions = [
        'USER_CREATE', 'USER_UPDATE', 'HCS_CREATE', 'HCS_UPDATE',
        'TEST_CREATE', 'TEST_UPDATE', 'BOOKING_STATUS_CHANGE',
        'REVIEW_STATUS_CHANGE'
    ];

    if (mediumSeverityActions.includes(action)) {
        return 'MEDIUM';
    }

    return 'LOW';
};

// Helper function to extract error message
const extractErrorMessage = (responseBody) => {
    if (!responseBody) return null;

    if (typeof responseBody === 'string') {
        return responseBody;
    }

    if (typeof responseBody === 'object') {
        return responseBody.message ||
            responseBody.error ||
            responseBody.details ||
            'Unknown error';
    }

    return null;
};

// Predefined middleware for common actions
const activityLoggers = {
    // Authentication
    login: logActivity('LOGIN', 'AUTH', { description: 'User login attempt' }),
    logout: logActivity('LOGOUT', 'AUTH', { description: 'User logout' }),
    register: logActivity('REGISTER', 'AUTH', { logPublic: true }),
    passwordChange: logActivity('PASSWORD_CHANGE', 'USER'),

    // Dashboard views
    dashboardView: (dashboardType) => logActivity('DASHBOARD_VIEW', 'DASHBOARD', {
        description: `Viewed ${dashboardType} dashboard`
    }),

    // User management
    userView: logActivity('USER_VIEW', 'USER'),
    userCreate: logActivity('USER_CREATE', 'USER'),
    userUpdate: logActivity('USER_UPDATE', 'USER'),
    userDelete: logActivity('USER_DELETE', 'USER'),

    // Booking management
    bookingView: logActivity('BOOKING_VIEW', 'BOOKING'),
    bookingCreate: logActivity('BOOKING_CREATE', 'BOOKING'),
    bookingUpdate: logActivity('BOOKING_UPDATE', 'BOOKING'),
    bookingDelete: logActivity('BOOKING_DELETE', 'BOOKING'),
    bookingStatusChange: logActivity('BOOKING_STATUS_CHANGE', 'BOOKING'),

    // Healthcare Center management
    hcsView: logActivity('HCS_VIEW', 'HEALTHCARE_CENTER'),
    hcsCreate: logActivity('HCS_CREATE', 'HEALTHCARE_CENTER'),
    hcsUpdate: logActivity('HCS_UPDATE', 'HEALTHCARE_CENTER'),
    hcsDelete: logActivity('HCS_DELETE', 'HEALTHCARE_CENTER'),

    // Test management
    testView: logActivity('TEST_VIEW', 'TEST'),
    testCreate: logActivity('TEST_CREATE', 'TEST'),
    testUpdate: logActivity('TEST_UPDATE', 'TEST'),
    testDelete: logActivity('TEST_DELETE', 'TEST'),

    // Review management
    reviewView: logActivity('REVIEW_VIEW', 'REVIEW'),
    reviewCreate: logActivity('REVIEW_CREATE', 'REVIEW'),
    reviewUpdate: logActivity('REVIEW_UPDATE', 'REVIEW'),
    reviewDelete: logActivity('REVIEW_DELETE', 'REVIEW'),
    reviewStatusChange: logActivity('REVIEW_STATUS_CHANGE', 'REVIEW'),

    // Profile management
    profileView: logActivity('PROFILE_VIEW', 'PROFILE'),
    profileUpdate: logActivity('PROFILE_UPDATE', 'PROFILE'),

    // Reports
    reportView: logActivity('REPORT_VIEW', 'REPORT'),
    reportExport: logActivity('REPORT_EXPORT', 'REPORT'),

    // Generic
    view: (resource) => logActivity('VIEW', resource),
    create: (resource) => logActivity('CREATE', resource),
    update: (resource) => logActivity('UPDATE', resource),
    delete: (resource) => logActivity('DELETE', resource)
};

module.exports = {
    logActivity,
    activityLoggers
};