// WhatsApp Web Clone - Real-Time Chat Backend Server
// Powered by Express, Socket.IO & Clerk Authentication
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const { createClerkClient } = require('@clerk/backend');

const app = express();
const server = http.createServer(app);

// Enable CORS for all cross-origin requests from the frontend client
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// JSON body parser for configuration endpoints
app.use(express.json());

// Initialize Clerk Backend Client
const publishableKey = process.env.CLERK_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || '';
const secretKey = process.env.CLERK_SECRET_KEY || '';

let clerkClient = null;
if (secretKey && secretKey !== 'sk_test_placeholder') {
    try {
        clerkClient = createClerkClient({ secretKey, publishableKey });
        console.log('✓ Clerk Backend Client initialized successfully.');
    } catch (err) {
        console.warn('! Clerk Backend Client initialization warning:', err.message);
    }
} else {
    console.warn('! CLERK_SECRET_KEY not set in backend .env. Running in setup/fallback mode.');
}

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    maxHttpBufferSize: 5e6 // 5MB for image attachments
});

// Health check route
app.get('/', (req, res) => {
    res.json({
        status: 'online',
        service: 'WhatsApp Web Clone Real-Time Backend',
        port: process.env.PORT || 4000,
        timestamp: new Date().toISOString()
    });
});

// Public Auth Configuration Endpoint for Frontend
app.get('/api/auth/config', (req, res) => {
    const pubKey = process.env.CLERK_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || '';
    const secKey = process.env.CLERK_SECRET_KEY || '';
    const isConfigured = Boolean(
        pubKey && 
        pubKey !== 'pk_test_placeholder' &&
        secKey &&
        secKey !== 'sk_test_placeholder'
    );

    res.json({
        publishableKey: pubKey,
        isConfigured: isConfigured,
        serverTime: new Date().toISOString()
    });
});

// Key Save Endpoint (allows setting keys directly from setup modal in frontend)
app.post('/api/auth/config', (req, res) => {
    const { publishableKey: newPubKey, secretKey: newSecKey } = req.body;
    if (!newPubKey || !newSecKey) {
        return res.status(400).json({ error: 'Both publishableKey and secretKey are required.' });
    }

    try {
        process.env.CLERK_PUBLISHABLE_KEY = newPubKey.trim();
        process.env.CLERK_SECRET_KEY = newSecKey.trim();

        // Update backend .env file on disk
        const envContent = `# Clerk Authentication Configuration\nCLERK_PUBLISHABLE_KEY=${newPubKey.trim()}\nCLERK_SECRET_KEY=${newSecKey.trim()}\nPORT=${process.env.PORT || 4000}\n`;
        fs.writeFileSync(path.join(__dirname, '.env'), envContent, 'utf-8');

        // Re-initialize clerk client
        clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY, publishableKey: process.env.CLERK_PUBLISHABLE_KEY });
        console.log('✓ Updated Clerk keys and reinitialized backend client.');

        res.json({ success: true, message: 'Clerk configuration updated successfully!' });
    } catch (err) {
        console.error('Error saving keys:', err);
        res.status(500).json({ error: 'Failed to save configuration.' });
    }
});

// Store connected users: socket.id -> { id, clerkId, name, avatar, email, status }
const users = new Map();

// Helper to broadcast updated user list
function broadcastUsers() {
    const userList = Array.from(users.values());
    io.emit('user-list-updated', userList);
}

// Socket.IO Clerk Authentication Middleware
io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    const clientUser = socket.handshake.auth?.user;

    const isKeysConfigured = Boolean(
        process.env.CLERK_SECRET_KEY && 
        process.env.CLERK_SECRET_KEY !== 'sk_test_placeholder'
    );

    if (isKeysConfigured && clerkClient) {
        if (!token) {
            return next(new Error('Authentication error: Missing Clerk session token. Please sign in.'));
        }

        try {
            // Verify session token via Clerk
            const sessionClaims = await clerkClient.verifyToken(token);
            const clerkUserId = sessionClaims.sub;

            let clerkUser = null;
            try {
                clerkUser = await clerkClient.users.getUser(clerkUserId);
            } catch (userErr) {
                console.warn(`Could not fetch full profile for ${clerkUserId}:`, userErr.message);
            }

            const fullName = clerkUser
                ? `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || clerkUser.username || clerkUser.emailAddresses?.[0]?.emailAddress || 'User'
                : clientUser?.name || `Clerk User (${clerkUserId.substring(0, 6)})`;

            const avatar = clerkUser?.imageUrl || clientUser?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${clerkUserId}`;
            const email = clerkUser?.emailAddresses?.[0]?.emailAddress || clientUser?.email || '';

            socket.data.user = {
                id: socket.id,
                clerkId: clerkUserId,
                name: fullName,
                avatar: avatar,
                email: email,
                status: 'Hey there! I am using WhatsApp Web.'
            };

            return next();
        } catch (err) {
            console.error('Socket.IO Clerk token verification failed:', err.message);
            return next(new Error('Authentication error: Invalid or expired Clerk session token.'));
        }
    } else {
        // Fallback / Development Mode when keys are not yet configured in .env
        const defaultName = clientUser?.name || `Guest ${socket.id.substring(0, 4).toUpperCase()}`;
        const defaultAvatar = clientUser?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${socket.id}`;
        
        socket.data.user = {
            id: socket.id,
            clerkId: clientUser?.id || `demo_${socket.id}`,
            name: defaultName,
            avatar: defaultAvatar,
            email: clientUser?.email || '',
            status: 'Hey there! I am using WhatsApp Web.'
        };
        return next();
    }
});

io.on('connection', (socket) => {
    const userProfile = socket.data.user;
    console.log(`User connected: ${userProfile.name} (${socket.id}, Clerk: ${userProfile.clerkId})`);

    users.set(socket.id, userProfile);

    // Send the user their own profile info
    socket.emit('init-profile', userProfile);

    // Broadcast updated user list to everyone
    broadcastUsers();

    // 1. UPDATE PROFILE (Status / Name override)
    socket.on('update-profile', ({ name, avatar, status }) => {
        const user = users.get(socket.id) || socket.data.user;
        if (name) user.name = name.trim();
        if (avatar) user.avatar = avatar;
        if (status) user.status = status.trim();
        users.set(socket.id, user);

        socket.emit('profile-updated', user);
        broadcastUsers();
    });

    // 2. GLOBAL BROADCAST
    socket.on('send-broadcast', (data) => {
        const user = users.get(socket.id) || socket.data.user;
        const payload = {
            id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
            chatId: 'global',
            senderId: socket.id,
            senderClerkId: user.clerkId,
            senderName: user.name,
            senderAvatar: user.avatar,
            text: data.text || '',
            attachment: data.attachment || null,
            timestamp: new Date().toISOString()
        };
        io.emit('receive-broadcast', payload);
    });

    // 3. JOIN ROOM (Group Chat)
    socket.on('join-room', (room) => {
        socket.join(room);
        const user = users.get(socket.id) || socket.data.user;
        console.log(`Socket ${socket.id} (${user.name}) joined room: ${room}`);

        socket.to(room).emit('room-system-message', {
            room: room,
            message: `${user.name} joined the group`,
            timestamp: new Date().toISOString()
        });
    });

    // LEAVE ROOM
    socket.on('leave-room', (room) => {
        socket.leave(room);
        const user = users.get(socket.id) || socket.data.user;
        socket.to(room).emit('room-system-message', {
            room: room,
            message: `${user.name} left the group`,
            timestamp: new Date().toISOString()
        });
    });

    // 4. GROUP ROOM MESSAGE
    socket.on('send-room-message', ({ room, text, attachment }) => {
        const user = users.get(socket.id) || socket.data.user;
        const payload = {
            id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
            chatId: room,
            room: room,
            senderId: socket.id,
            senderClerkId: user.clerkId,
            senderName: user.name,
            senderAvatar: user.avatar,
            text: text || '',
            attachment: attachment || null,
            timestamp: new Date().toISOString()
        };
        io.to(room).emit('receive-room-message', payload);
    });

    // 5. DIRECT 1-to-1 MESSAGE
    socket.on('send-direct-message', ({ recipientId, text, attachment }) => {
        const user = users.get(socket.id) || socket.data.user;
        const messageId = 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
        const timestamp = new Date().toISOString();

        const payload = {
            id: messageId,
            senderId: socket.id,
            senderClerkId: user.clerkId,
            senderName: user.name,
            senderAvatar: user.avatar,
            recipientId: recipientId,
            text: text || '',
            attachment: attachment || null,
            timestamp: timestamp
        };

        // Deliver directly to recipient socket
        socket.to(recipientId).emit('receive-direct-message', payload);

        // Acknowledge back to sender with confirmation
        socket.emit('direct-message-sent', payload);
    });

    // 6. TYPING INDICATORS
    socket.on('typing', ({ targetType, targetId }) => {
        const user = users.get(socket.id) || socket.data.user;
        if (targetType === 'global') {
            socket.broadcast.emit('user-typing', {
                chatId: 'global',
                userId: socket.id,
                userName: user.name
            });
        } else if (targetType === 'room') {
            socket.to(targetId).emit('user-typing', {
                chatId: targetId,
                userId: socket.id,
                userName: user.name
            });
        } else if (targetType === 'direct') {
            socket.to(targetId).emit('user-typing', {
                chatId: socket.id,
                userId: socket.id,
                userName: user.name
            });
        }
    });

    socket.on('stop-typing', ({ targetType, targetId }) => {
        if (targetType === 'global') {
            socket.broadcast.emit('user-stop-typing', {
                chatId: 'global',
                userId: socket.id
            });
        } else if (targetType === 'room') {
            socket.to(targetId).emit('user-stop-typing', {
                chatId: targetId,
                userId: socket.id
            });
        } else if (targetType === 'direct') {
            socket.to(targetId).emit('user-stop-typing', {
                chatId: socket.id,
                userId: socket.id
            });
        }
    });

    // 7. MESSAGE REACTIONS
    socket.on('send-reaction', ({ chatId, messageId, emoji, targetType, targetId }) => {
        const payload = {
            chatId,
            messageId,
            emoji,
            userId: socket.id
        };

        if (targetType === 'global') {
            io.emit('message-reaction-updated', payload);
        } else if (targetType === 'room') {
            io.to(targetId).emit('message-reaction-updated', payload);
        } else if (targetType === 'direct') {
            socket.to(targetId).emit('message-reaction-updated', payload);
            socket.emit('message-reaction-updated', payload);
        }
    });

    // 8. DISCONNECT
    socket.on('disconnect', () => {
        const user = users.get(socket.id);
        console.log(`User disconnected: ${user?.name || socket.id}`);
        users.delete(socket.id);
        broadcastUsers();
    });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
    console.log(`✓ WhatsApp Web Backend Server running at http://localhost:${PORT}`);
});
