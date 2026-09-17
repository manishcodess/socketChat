// ==========================================================================
// WhatsApp Web Clone - Modular Backend Server
// Express REST API + Socket.IO + MongoDB (Mongoose) + ImageKit + Clerk Auth
// ==========================================================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

// Config & Database
const connectDB = require('./src/config/db');
require('./src/config/clerk');
require('./src/config/imagekit');

// Routes
const authRoutes = require('./src/routes/authRoutes');
const messageRoutes = require('./src/routes/messageRoutes');
const uploadRoutes = require('./src/routes/uploadRoutes');

// Sockets
const socketAuthMiddleware = require('./src/sockets/socketAuth');
const { registerChatSocket } = require('./src/sockets/chatSocket');

const app = express();
const server = http.createServer(app);

// Connect to MongoDB Atlas
connectDB();

// Global Middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health Check Endpoint
app.get('/', (req, res) => {
    res.json({
        status: 'online',
        service: 'WhatsApp Web Clone Real-Time Backend',
        database: 'MongoDB Atlas',
        storage: 'ImageKit CDN',
        auth: 'Clerk Authentication',
        port: process.env.PORT || 4000,
        timestamp: new Date().toISOString()
    });
});

// Register API Routes
app.use('/api/auth', authRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/upload', uploadRoutes);

// Initialize Socket.IO Server
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    },
    maxHttpBufferSize: 1e7 // 10MB
});

// Socket Middleware & Event Registration
io.use(socketAuthMiddleware);
registerChatSocket(io);

// Start Server
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
    console.log(`✓ WhatsApp Web Backend Server running at http://localhost:${PORT}`);
});
