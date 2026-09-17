const User = require('../models/User');
const Message = require('../models/Message');

// In-memory active sockets: socket.id -> userProfile
const activeUsers = new Map();

function broadcastUsers(io) {
    const userList = Array.from(activeUsers.values());
    io.emit('user-list-updated', userList);
}

function registerChatSocket(io) {
    io.on('connection', async (socket) => {
        const userProfile = socket.data.user;
        console.log(`✓ User connected: ${userProfile.name} (${socket.id}, Clerk: ${userProfile.clerkId})`);

        activeUsers.set(socket.id, userProfile);

        // Update online status in MongoDB
        try {
            await User.findOneAndUpdate(
                { clerkId: userProfile.clerkId },
                { isOnline: true, socketId: socket.id, lastSeen: new Date() }
            );
        } catch (e) {
            console.warn('Could not update user online status in MongoDB:', e.message);
        }

        // Send user their own profile info
        socket.emit('init-profile', userProfile);

        // Broadcast updated user presence list
        broadcastUsers(io);

        // 1. UPDATE PROFILE
        socket.on('update-profile', async ({ name, avatar, status }) => {
            const user = activeUsers.get(socket.id) || socket.data.user;
            if (name) user.name = name.trim();
            if (avatar) user.avatar = avatar;
            if (status) user.status = status.trim();
            activeUsers.set(socket.id, user);

            try {
                await User.findOneAndUpdate(
                    { clerkId: user.clerkId },
                    { name: user.name, avatar: user.avatar, status: user.status }
                );
            } catch (e) {
                console.warn('Could not update user profile in MongoDB:', e.message);
            }

            socket.emit('profile-updated', user);
            broadcastUsers(io);
        });

        // 2. GLOBAL BROADCAST MESSAGE
        socket.on('send-broadcast', async (data) => {
            const user = activeUsers.get(socket.id) || socket.data.user;
            const messageId = 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
            const timestamp = new Date();

            const payload = {
                id: messageId,
                msgId: messageId,
                chatId: 'global',
                chatType: 'global',
                senderId: socket.id,
                senderClerkId: user.clerkId,
                senderName: user.name,
                senderAvatar: user.avatar,
                text: data.text || '',
                attachment: data.attachment || null,
                reactions: [],
                status: 'sent',
                timestamp: timestamp.toISOString()
            };

            // Persist message in MongoDB
            try {
                await Message.create({
                    msgId: messageId,
                    chatId: 'global',
                    chatType: 'global',
                    senderId: socket.id,
                    senderClerkId: user.clerkId,
                    senderName: user.name,
                    senderAvatar: user.avatar,
                    text: data.text || '',
                    attachment: data.attachment || null,
                    timestamp: timestamp
                });
            } catch (dbErr) {
                console.warn('MongoDB message save error:', dbErr.message);
            }

            io.emit('receive-broadcast', payload);
        });

        // 3. JOIN ROOM (Group Chat)
        socket.on('join-room', (room) => {
            socket.join(room);
            const user = activeUsers.get(socket.id) || socket.data.user;
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
            const user = activeUsers.get(socket.id) || socket.data.user;
            socket.to(room).emit('room-system-message', {
                room: room,
                message: `${user.name} left the group`,
                timestamp: new Date().toISOString()
            });
        });

        // 4. GROUP ROOM MESSAGE
        socket.on('send-room-message', async ({ room, text, attachment }) => {
            const user = activeUsers.get(socket.id) || socket.data.user;
            const messageId = 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
            const timestamp = new Date();

            const payload = {
                id: messageId,
                msgId: messageId,
                chatId: room,
                chatType: 'room',
                room: room,
                senderId: socket.id,
                senderClerkId: user.clerkId,
                senderName: user.name,
                senderAvatar: user.avatar,
                text: text || '',
                attachment: attachment || null,
                reactions: [],
                status: 'sent',
                timestamp: timestamp.toISOString()
            };

            // Persist room message in MongoDB
            try {
                await Message.create({
                    msgId: messageId,
                    chatId: room,
                    chatType: 'room',
                    room: room,
                    senderId: socket.id,
                    senderClerkId: user.clerkId,
                    senderName: user.name,
                    senderAvatar: user.avatar,
                    text: text || '',
                    attachment: attachment || null,
                    timestamp: timestamp
                });
            } catch (dbErr) {
                console.warn('MongoDB message save error:', dbErr.message);
            }

            io.to(room).emit('receive-room-message', payload);
        });

        // 5. DIRECT 1-to-1 MESSAGE
        socket.on('send-direct-message', async ({ recipientId, text, attachment }) => {
            const user = activeUsers.get(socket.id) || socket.data.user;
            const recipient = activeUsers.get(recipientId);
            const messageId = 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
            const timestamp = new Date();

            // Unified chatId for 1-on-1 conversations
            const chatId = `direct_${socket.id}_${recipientId}`;

            const payload = {
                id: messageId,
                msgId: messageId,
                chatId: chatId,
                chatType: 'direct',
                senderId: socket.id,
                senderClerkId: user.clerkId,
                senderName: user.name,
                senderAvatar: user.avatar,
                recipientId: recipientId,
                recipientClerkId: recipient?.clerkId || null,
                text: text || '',
                attachment: attachment || null,
                reactions: [],
                status: 'sent',
                timestamp: timestamp.toISOString()
            };

            // Persist direct message in MongoDB
            try {
                await Message.create({
                    msgId: messageId,
                    chatId: chatId,
                    chatType: 'direct',
                    senderId: socket.id,
                    senderClerkId: user.clerkId,
                    senderName: user.name,
                    senderAvatar: user.avatar,
                    recipientId: recipientId,
                    recipientClerkId: recipient?.clerkId || null,
                    text: text || '',
                    attachment: attachment || null,
                    timestamp: timestamp
                });
            } catch (dbErr) {
                console.warn('MongoDB direct message save error:', dbErr.message);
            }

            // Deliver directly to recipient socket
            socket.to(recipientId).emit('receive-direct-message', payload);

            // Acknowledge back to sender
            socket.emit('direct-message-sent', payload);
        });

        // 6. TYPING INDICATORS
        socket.on('typing', ({ targetType, targetId }) => {
            const user = activeUsers.get(socket.id) || socket.data.user;
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
        socket.on('send-reaction', async ({ chatId, messageId, emoji, targetType, targetId }) => {
            const user = activeUsers.get(socket.id) || socket.data.user;
            const payload = {
                chatId,
                messageId,
                emoji,
                userId: socket.id,
                clerkId: user.clerkId
            };

            // Update reaction in MongoDB
            try {
                await Message.findOneAndUpdate(
                    { msgId: messageId },
                    {
                        $push: {
                            reactions: { emoji, userId: socket.id, clerkId: user.clerkId }
                        }
                    }
                );
            } catch (e) {
                console.warn('Could not persist reaction in MongoDB:', e.message);
            }

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
        socket.on('disconnect', async () => {
            const user = activeUsers.get(socket.id);
            console.log(`User disconnected: ${user?.name || socket.id}`);
            activeUsers.delete(socket.id);

            // Update offline status & lastSeen in MongoDB
            if (user?.clerkId) {
                try {
                    await User.findOneAndUpdate(
                        { clerkId: user.clerkId },
                        { isOnline: false, socketId: '', lastSeen: new Date() }
                    );
                } catch (e) {
                    console.warn('Could not update user offline status:', e.message);
                }
            }

            broadcastUsers(io);
        });
    });
}

module.exports = {
    registerChatSocket
};
