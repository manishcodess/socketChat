// Get the tools we need to make our web server
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

// Set up the basic server parts
const app = express(); // Makes the web app
const server = http.createServer(app); // Creates the server
const io = new Server(server); // Adds real-time chat magic (Socket.io) to the server

// Tell the server to share the files inside the 'public' folder so people can see the website
app.use(express.static('public'));

// Listen for when someone connects to our chat server
//"Whenever a new user connects, run this function."
io.on('connection', (socket) => {
    // We see a new user! Let's print their unique ID
    console.log(`User connected: ${socket.id}`);

    // Give the user their own ID so they can tell others to message them directly
    socket.emit('your-id', socket.id);

    // 1. BROADCAST: When a user wants to yell a message to everyone
    socket.on('send-broadcast', (message) => {
        // We use 'io.emit' to send the message to EVERY single person online
        io.emit('receive-broadcast', { sender: socket.id, message: message });
    });

    // 2. JOIN ROOM: When a user wants to enter a special group chat (a room)
    socket.on('join-room', (room) => {
        // Add the user to that specific room
        socket.join(room);
        console.log(`Socket ${socket.id} joined room: ${room}`);
        
        // Tell everyone else in that room that a new person joined
        socket.to(room).emit('room-message', { sender: 'System', message: `User ${socket.id} joined the room.` });
    });

    // 3. ROOM MESSAGE: When a user sends a message inside a group chat (room)
    socket.on('send-room-message', ({ room, message }) => {
        // Send the message to everyone inside that specific room, including the person who sent it
        io.to(room).emit('room-message', { sender: socket.id, message: message });
    });

    // 4. DIRECT MESSAGE: When a user wants to send a secret message to just one person
    socket.on('send-direct-message', ({ recipientId, message }) => {
        // Send the message directly to the person with that specific ID
        socket.to(recipientId).emit('direct-message', { sender: socket.id, message: message });
    });

    // Listen for when a user leaves our chat server
    socket.on('disconnect', () => {
        // Print that they left
        console.log(`User disconnected: ${socket.id}`);
    });
});

// Set the port number where our server will run
const PORT = 4000;

// Start the server and wait for people to visit
server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
