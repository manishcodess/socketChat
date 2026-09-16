// WhatsApp Web Clone - Real-Time Chat Server with Socket.IO
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    maxHttpBufferSize: 5e6 // 5MB for image attachments
});

// Serve static files from 'public'
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Store connected users: socket.id -> { id, name, avatar, status }
const users = new Map();

// Helper to broadcast updated user list
function broadcastUsers() {
    const userList = Array.from(users.values());
    io.emit('user-list-updated', userList);
}

// Generate friendly default username
function generateDefaultName(socketId) {
    return `User ${socketId.substring(0, 4).toUpperCase()}`;
}

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Default user profile
    const defaultUser = {
        id: socket.id,
        name: generateDefaultName(socket.id),
        avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${socket.id}`,
        status: 'Hey there! I am using WhatsApp Web.'
    };
    users.set(socket.id, defaultUser);

    // Send the user their own profile info
    socket.emit('init-profile', defaultUser);

    // Broadcast updated user list to everyone
    broadcastUsers();

    // 1. UPDATE PROFILE (Name / Avatar / Status)
    socket.on('update-profile', ({ name, avatar, status }) => {
        const user = users.get(socket.id) || { id: socket.id };
        if (name) user.name = name.trim();
        if (avatar) user.avatar = avatar;
        if (status) user.status = status.trim();
        users.set(socket.id, user);

        socket.emit('profile-updated', user);
        broadcastUsers();
    });

    // 2. GLOBAL BROADCAST
    socket.on('send-broadcast', (data) => {
        const user = users.get(socket.id) || { name: 'Anonymous', avatar: '' };
        const payload = {
            id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
            chatId: 'global',
            senderId: socket.id,
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
        const user = users.get(socket.id) || { name: 'User' };
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
        const user = users.get(socket.id) || { name: 'User' };
        socket.to(room).emit('room-system-message', {
            room: room,
            message: `${user.name} left the group`,
            timestamp: new Date().toISOString()
        });
    });

    // 4. GROUP ROOM MESSAGE
    socket.on('send-room-message', ({ room, text, attachment }) => {
        const user = users.get(socket.id) || { name: 'User', avatar: '' };
        const payload = {
            id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
            chatId: room,
            room: room,
            senderId: socket.id,
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
        const user = users.get(socket.id) || { name: 'User', avatar: '' };
        const messageId = 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
        const timestamp = new Date().toISOString();

        const payload = {
            id: messageId,
            senderId: socket.id,
            senderName: user.name,
            senderAvatar: user.avatar,
            recipientId: recipientId,
            text: text || '',
            attachment: attachment || null,
            timestamp: timestamp
        };

        // Deliver directly to recipient
        socket.to(recipientId).emit('receive-direct-message', payload);

        // Acknowledge back to sender with confirmation
        socket.emit('direct-message-sent', payload);
    });

    // 6. TYPING INDICATORS
    socket.on('typing', ({ targetType, targetId }) => {
        const user = users.get(socket.id) || { name: 'Someone' };
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
                chatId: socket.id, // for recipient, the chat is keyed by sender's socket.id
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
        console.log(`User disconnected: ${socket.id}`);
        users.delete(socket.id);
        broadcastUsers();
    });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
    console.log(`WhatsApp Web Clone running at http://localhost:${PORT}`);
});
