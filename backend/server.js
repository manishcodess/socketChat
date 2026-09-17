// ==========================================================================
// WhatsApp Web Clone - Modular Backend Server
// Express REST API + Socket.IO + MongoDB (Mongoose) + ImageKit + Clerk Auth
// ==========================================================================

const express = require('express');
const cors = require('cors');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { Server } = require('socket.io');

require('dotenv').config({ path: path.resolve(__dirname, '.env') });

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

// Register API Routes
app.use('/api/auth', authRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/upload', uploadRoutes);

// Health Check API (for Render health monitoring)
app.get('/api/health', (req, res) => {
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

// Production Static Serving for Render / Docker
const distCandidates = [
    path.resolve(__dirname, '../frontend/dist'),
    path.resolve(process.cwd(), 'frontend/dist'),
    path.resolve(process.cwd(), 'dist'),
    path.resolve(__dirname, '../../frontend/dist'),
    path.resolve('/app/frontend/dist'),
    path.resolve(__dirname, './dist')
];
const distPath = distCandidates.find(p => fs.existsSync(p));

if (distPath) {
    console.log(`✓ Serving production frontend assets from: ${distPath}`);
    app.use(express.static(distPath));
    // SPA Fallback for client-side routing in Express 5
    app.use((req, res, next) => {
        if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/socket.io')) {
            return res.sendFile(path.join(distPath, 'index.html'));
        }
        next();
    });
} else {
    console.warn('! Warning: frontend/dist not found. Checked candidates:', distCandidates);
    // Fallback root when running backend standalone in development
    app.get('/', (req, res) => {
        res.json({
            status: 'online',
            service: 'WhatsApp Web Clone Real-Time Backend',
            database: 'MongoDB Atlas',
            storage: 'ImageKit CDN',
            auth: 'Clerk Authentication',
            port: process.env.PORT || 4000,
            note: 'Frontend dist was not found. Please ensure `npm run build` ran during deployment.',
            timestamp: new Date().toISOString()
        });
    });
}

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

// Start Server (Render injects process.env.PORT)
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
    console.log(`✓ WhatsApp Web Backend Server running at http://localhost:${PORT}`);
});
