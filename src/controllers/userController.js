const User = require('../models/User');
const { deleteOldProfilePhoto } = require('../middleware/uploadMiddleware');

exports.getUsers = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50; // Max 50 per page
        const search = req.query.search || '';
        const role = req.query.role || '';
        const sortBy = req.query.sortBy || 'createdAt';
        const order = req.query.order === 'asc' ? 1 : -1;

        const skip = (page - 1) * limit;

        // Build filter query
        let filterQuery = {};
        if (search) {
            filterQuery.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }
        if (role) {
            filterQuery.role = role;
        }

        // Build sort query
        const sortQuery = {};
        sortQuery[sortBy] = order;

        const [users, totalUsers] = await Promise.all([
            User.find(filterQuery)
                .select('-password')
                .sort(sortQuery)
                .skip(skip)
                .limit(limit),
            User.countDocuments(filterQuery)
        ]);

        // Calculate pagination info
        const totalPages = Math.ceil(totalUsers / limit);
        const hasNext = page < totalPages;
        const hasPrev = page > 1;

        res.status(200).json({
            success: true,
            count: users.length,
            data: users,
            pagination: {
                page,
                limit,
                totalPages,
                totalUsers,
                hasNext,
                hasPrev
            }
        });
    } catch (error) {
        next(error);
    }
};

exports.getUser = async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id).select('-password');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.status(200).json({
            success: true,
            data: user
        });
    } catch (error) {
        next(error);
    }
};

exports.createUser = async (req, res, next) => {
    try {
        const { name, email, password, role, phone, address } = req.body;

        // Check for existing user with same email
        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({
                success: false,
                message: 'User with this email already exists'
            });
        }

        // Check for existing user with same phone number
        const phoneExists = await User.findOne({ phone });
        if (phoneExists) {
            return res.status(400).json({
                success: false,
                message: 'User with this phone number already exists'
            });
        }

        const user = await User.create({
            name,
            email,
            password,
            role,
            phone,
            address
        });

        res.status(201).json({
            success: true,
            data: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                phone: user.phone,
                address: user.address
            }
        });
    } catch (error) {
        // Handle validation errors specifically
        if (error.name === 'ValidationError') {
            const message = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({
                success: false,
                message: message.join(', ')
            });
        }

        // Handle duplicate key errors
        if (error.code === 11000) {
            const duplicateField = Object.keys(error.keyPattern)[0];
            return res.status(400).json({
                success: false,
                message: `User with this ${duplicateField} already exists`
            });
        }

        next(error);
    }
};

exports.updateUser = async (req, res, next) => {
    try {
        let user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Prevent password updates through this endpoint
        const { password, ...updateData } = req.body;

        // Validate required fields
        if (updateData.name !== undefined && updateData.name.trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'Name is required'
            });
        }

        if (updateData.email !== undefined && updateData.email.trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'Email is required'
            });
        }

        if (updateData.role !== undefined && !['Superadmin', 'HCS Admin', 'Doctor', 'Customer'].includes(updateData.role)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid role'
            });
        }

        if (updateData.phone !== undefined && updateData.phone.trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'Phone number is required'
            });
        }

        if (updateData.address !== undefined && updateData.address.trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'Address is required'
            });
        }

        // Check for duplicate email (if email is being updated)
        if (updateData.email !== undefined && updateData.email !== user.email) {
            const emailExists = await User.findOne({ email: updateData.email });
            if (emailExists) {
                return res.status(400).json({
                    success: false,
                    message: 'User with this email already exists'
                });
            }
        }

        // Check for duplicate phone (if phone is being updated)
        if (updateData.phone !== undefined && updateData.phone !== user.phone) {
            const phoneExists = await User.findOne({ phone: updateData.phone });
            if (phoneExists) {
                return res.status(400).json({
                    success: false,
                    message: 'User with this phone number already exists'
                });
            }
        }

        // Only update fields that are provided and not null/undefined
        Object.keys(updateData).forEach(key => {
            if (updateData[key] !== undefined && updateData[key] !== null) {
                user[key] = updateData[key];
            }
        });

        await user.save();

        const updatedUser = await User.findById(req.params.id).select('-password');

        res.status(200).json({
            success: true,
            data: updatedUser
        });
    } catch (error) {
        // Handle validation errors specifically
        if (error.name === 'ValidationError') {
            const message = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({
                success: false,
                message: message.join(', ')
            });
        }

        // Handle duplicate key errors
        if (error.code === 11000) {
            const duplicateField = Object.keys(error.keyPattern)[0];
            return res.status(400).json({
                success: false,
                message: `User with this ${duplicateField} already exists`
            });
        }

        next(error);
    }
};

exports.deleteUser = async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        await User.findByIdAndDelete(req.params.id);

        res.status(200).json({
            success: true,
            message: 'User deleted successfully'
        });
    } catch (error) {
        next(error);
    }
};

exports.getUserStats = async (req, res, next) => {
    try {
        const totalUsers = await User.countDocuments();
        const customers = await User.countDocuments({ role: 'Customer' });
        const hcsAdmins = await User.countDocuments({ role: 'HCS Admin' });
        const doctors = await User.countDocuments({ role: 'Doctor' });
        const superadmins = await User.countDocuments({ role: 'Superadmin' });

        res.status(200).json({
            success: true,
            data: {
                totalUsers,
                customers,
                hcsAdmins,
                doctors,
                superadmins
            }
        });
    } catch (error) {
        next(error);
    }
};

// Get current user's profile
exports.getProfile = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id).select('-password');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.status(200).json({
            success: true,
            data: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                phone: user.phone,
                address: user.address,
                profilePhoto: user.profilePhoto,
                createdAt: user.createdAt
            }
        });
    } catch (error) {
        next(error);
    }
};

// Update current user's profile
exports.updateProfile = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Update basic profile info from req.body
        if (req.body.name !== undefined && req.body.name !== null) user.name = req.body.name;
        if (req.body.address !== undefined && req.body.address !== null) user.address = req.body.address;

        // Handle profile photo update from middleware
        if (req.processedImage) {
            // Delete old profile photo if exists
            if (user.profilePhoto) {
                deleteOldProfilePhoto(user.profilePhoto);
            }
            user.profilePhoto = req.processedImage;
        }

        await user.save();

        res.status(200).json({
            success: true,
            data: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                phone: user.phone,
                address: user.address,
                profilePhoto: user.profilePhoto,
                createdAt: user.createdAt
            }
        });
    } catch (error) {
        next(error);
    }
};

// Upload/Update profile photo only
exports.uploadProfilePhoto = async (req, res, next) => {
    try {
        if (!req.processedImage) {
            return res.status(400).json({
                success: false,
                message: 'No image file provided'
            });
        }

        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Delete old profile photo if exists
        if (user.profilePhoto) {
            deleteOldProfilePhoto(user.profilePhoto);
        }

        // Update with new photo
        user.profilePhoto = req.processedImage;
        await user.save();

        res.status(200).json({
            success: true,
            message: 'Profile photo updated successfully',
            data: {
                profilePhoto: user.profilePhoto
            }
        });
    } catch (error) {
        next(error);
    }
};

// Superadmin can change any user's password
exports.changeUserPassword = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { newPassword } = req.body;

        // Validate input
        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters long'
            });
        }

        // Find the user to update
        const user = await User.findById(id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Update password
        user.password = newPassword;
        await user.save();

        res.status(200).json({
            success: true,
            message: 'Password updated successfully'
        });
    } catch (error) {
        next(error);
    }
};
