exports.authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Not authorized, user not found'
            });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: `User role ${req.user.role} is not authorized to access this route`
            });
        }

        next();
    };
};

exports.superadminOnly = (req, res, next) => {
    if (!req.user || req.user.role !== 'Superadmin') {
        return res.status(403).json({
            success: false,
            message: 'Access denied. Superadmin role required.'
        });
    }
    next();
};

exports.hcsAdminOrSuperadmin = (req, res, next) => {
    if (!req.user || !['HCS Admin', 'Superadmin'].includes(req.user.role)) {
        return res.status(403).json({
            success: false,
            message: 'Access denied. HCS Admin or Superadmin role required.'
        });
    }
    next();
};


