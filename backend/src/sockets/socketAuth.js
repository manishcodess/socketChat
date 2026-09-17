const { verifyToken } = require('@clerk/backend');
const { getClerkClient } = require('../config/clerk');
const User = require('../models/User');

const socketAuthMiddleware = async (socket, next) => {
    const token = socket.handshake.auth?.token;
    const clientUser = socket.handshake.auth?.user;

    const isKeysConfigured = Boolean(
        process.env.CLERK_SECRET_KEY && 
        process.env.CLERK_SECRET_KEY !== 'sk_test_placeholder'
    );

    const clerkClient = getClerkClient();

    // 1. Authenticated Clerk Session (when token is provided)
    if (token && isKeysConfigured) {
        try {
            // Verify session token via Clerk Backend SDK standalone verifyToken
            const secretKey = process.env.CLERK_SECRET_KEY;
            const sessionClaims = await verifyToken(token, { secretKey });
            const clerkUserId = sessionClaims.sub;

            let clerkUser = null;
            if (clerkClient) {
                try {
                    clerkUser = await clerkClient.users.getUser(clerkUserId);
                } catch (userErr) {
                    console.warn(`Could not fetch full profile for ${clerkUserId}:`, userErr.message);
                }
            }

            const fullName = clerkUser
                ? `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || clerkUser.username || clerkUser.emailAddresses?.[0]?.emailAddress || 'User'
                : clientUser?.name || `Clerk User (${clerkUserId.substring(0, 6)})`;

            const avatar = clerkUser?.imageUrl || clientUser?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${clerkUserId}`;
            const email = clerkUser?.emailAddresses?.[0]?.emailAddress || clientUser?.email || '';

            const userProfile = {
                id: socket.id,
                clerkId: clerkUserId,
                name: fullName,
                avatar: avatar,
                email: email,
                status: clientUser?.status || 'Hey there! I am using SocketChat.'
            };

            socket.data.user = userProfile;

            // Persist / update User in MongoDB
            try {
                await User.findOneAndUpdate(
                    { clerkId: clerkUserId },
                    {
                        clerkId: clerkUserId,
                        name: fullName,
                        avatar: avatar,
                        email: email,
                        socketId: socket.id,
                        isOnline: true,
                        lastSeen: new Date()
                    },
                    { upsert: true, new: true }
                );
            } catch (dbErr) {
                console.warn('Could not persist user to MongoDB:', dbErr.message);
            }

            return next();
        } catch (err) {
            console.error('Socket.IO Clerk token verification failed:', err.message);

            // Fallback gracefully if clientUser profile is attached
            if (clientUser && (clientUser.clerkId || clientUser.id)) {
                console.warn('Falling back to client-provided profile for socket connection.');
                const fallbackId = clientUser.clerkId || clientUser.id;
                socket.data.user = {
                    id: socket.id,
                    clerkId: fallbackId,
                    name: clientUser.name || 'User',
                    avatar: clientUser.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${fallbackId}`,
                    email: clientUser.email || '',
                    status: clientUser.status || 'Hey there! I am using SocketChat.'
                };
                return next();
            }

            return next(new Error('Authentication error: Invalid or expired Clerk session token.'));
        }
    } else {
        // 2. Guest / Demo Mode (or fallback when token is not provided)
        const defaultName = clientUser?.name || `Guest ${socket.id.substring(0, 4).toUpperCase()}`;
        const defaultAvatar = clientUser?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${socket.id}`;
        const clerkId = clientUser?.clerkId || clientUser?.id || `demo_${socket.id}`;

        const guestEmail = clientUser?.email || `${clerkId}@guest.local`;
        const userProfile = {
            id: socket.id,
            clerkId: clerkId,
            name: defaultName,
            avatar: defaultAvatar,
            email: guestEmail,
            status: 'Hey there! I am using SocketChat.'
        };

        socket.data.user = userProfile;

        // Persist guest in MongoDB
        try {
            await User.findOneAndUpdate(
                { clerkId: clerkId },
                {
                    clerkId: clerkId,
                    name: defaultName,
                    avatar: defaultAvatar,
                    email: guestEmail,
                    socketId: socket.id,
                    isOnline: true,
                    lastSeen: new Date()
                },
                { upsert: true, new: true }
            );
        } catch (dbErr) {
            console.warn('Could not persist guest to MongoDB:', dbErr.message);
        }

        return next();
    }
};

module.exports = socketAuthMiddleware;
