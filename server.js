const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files from 'public' folder
app.use(express.static('public'));

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Send the user their own socket ID so they know it for 1-to-1 messaging
    socket.emit('your-id', socket.id);

    // 1. BROADCAST: Send to everyone
    socket.on('send-broadcast', (message) => {
        // io.emit sends to EVERYONE including the sender
        io.emit('receive-broadcast', { sender: socket.id, message: message });
    });

    // 2. JOIN ROOM: User joins a specific room
    socket.on('join-room', (room) => {
        socket.join(room);
        console.log(`Socket ${socket.id} joined room: ${room}`);
        // Notify others in the room
        socket.to(room).emit('room-message', { sender: 'System', message: `User ${socket.id} joined the room.` });
    });

    // 3. ROOM MESSAGE: Send to a specific room
    socket.on('send-room-message', ({ room, message }) => {
        // io.to(room).emit sends to EVERYONE in the room including the sender.
        // If you used socket.to(room).emit, it would send to everyone EXCEPT the sender.
        io.to(room).emit('room-message', { sender: socket.id, message: message });
    });

    // 4. DIRECT MESSAGE (1 to 1)
    socket.on('send-direct-message', ({ recipientId, message }) => {
        // socket.to(id).emit sends a message directly to that specific socket id
        socket.to(recipientId).emit('direct-message', { sender: socket.id, message: message });
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
    });
});

const PORT = 4000;
server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
