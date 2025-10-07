const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

// Configure multer for memory storage
const storage = multer.memoryStorage();

// File filter for images only
const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Only image files are allowed!'), false);
    }
};

// Create multer upload middleware
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    }
});

// Image compression and save function
const compressAndSaveImage = async (buffer, filename, destination) => {
    try {
        // Ensure destination directory exists
        if (!fs.existsSync(destination)) {
            fs.mkdirSync(destination, { recursive: true });
        }

        const filepath = path.join(destination, filename);

        // Compress and resize image
        await sharp(buffer)
            .resize(300, 300, {
                fit: 'cover',
                position: 'center'
            })
            .jpeg({
                quality: 80,
                progressive: true
            })
            .toFile(filepath);

        return filename;
    } catch (error) {
        throw new Error(`Image processing failed: ${error.message}`);
    }
};

// Middleware to handle profile photo upload
const uploadProfilePhoto = upload.single('profilePhoto');

// Middleware to process uploaded image
const processProfilePhoto = async (req, res, next) => {
    try {
        if (!req.file) {
            return next();
        }

        // Generate unique filename
        const timestamp = Date.now();
        const randomString = Math.random().toString(36).substring(2, 8);
        const filename = `profile-${timestamp}-${randomString}.jpg`;

        // Save compressed image
        const uploadsDir = path.join(__dirname, '../../uploads/user');
        const savedFilename = await compressAndSaveImage(
            req.file.buffer,
            filename,
            uploadsDir
        );

        // Add filename to request for controller to use
        req.processedImage = savedFilename;

        next();
    } catch (error) {
        next(error);
    }
};

// Delete old profile photo
const deleteOldProfilePhoto = (filename) => {
    if (!filename) return;

    const filepath = path.join(__dirname, '../../uploads/user', filename);
    if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
    }
};

module.exports = {
    uploadProfilePhoto,
    processProfilePhoto,
    deleteOldProfilePhoto,
    compressAndSaveImage
};