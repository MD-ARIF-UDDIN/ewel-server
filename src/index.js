const path = require('path');
const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./lib/db');
const errorHandler = require('./middleware/errorMiddleware');

// Load env vars
dotenv.config({ path: './.env' });

// Connect to database
connectDB();

const app = express();

// Enable CORS
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    optionsSuccessStatus: 200,
    preflightContinue: false
}));

app.options('*', cors());

app.use(express.json());

// Serve static files for uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/api/auth', require('./api/auth'));
app.use('/api/tests', require('./api/tests'));
app.use('/api/hcs', require('./api/hcs'));
app.use('/api/bookings', require('./api/bookings'));
app.use('/api/users', require('./api/users'));
app.use('/api/reviews', require('./api/reviews'));
app.use('/api/activity-logs', require('./api/activityLogs'));
app.use('/api/notifications', require('./api/notifications'));

app.get('/api/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Server is running',
        timestamp: new Date().toISOString()
    });
});

app.get('/', (req, res) => {
    res.send(`
        <h1>Welcome to EWEL-HCS API</h1>
    `);
});

app.use(errorHandler);

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
    console.log(`Environment variables loaded:`, process.env.NODE_ENV ? 'Yes' : 'No');
});

process.on('unhandledRejection', (err, promise) => {
    console.log(`Error: ${err.message}`);
    server.close(() => process.exit(1));
});