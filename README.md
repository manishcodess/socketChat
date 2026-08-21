# Socketchat 👋

Welcome! This is a very simple guide to understanding how Socket.IO works. We will explain everything step-by-step in easy English.

## 🚀 How to Run the App

1. **Install everything:** Open your terminal and type `npm install`
2. **Start the server:** Type `node server.js`
3. **Open the app:** Open your web browser and go to: `http://localhost:4000`
4. **Test it:** Open the same link in a second tab or window so you can chat with yourself!

---

## 💡 What can this app do?

This app shows 3 ways to send messages using Socket.IO:
1. **Broadcast**: Send a message to **everyone** who is connected.
2. **Rooms**: Join a special room and only talk to people **in that room**.
3. **Direct Message**: Send a private message to **one specific person** using their ID.

---

## 📝 Understanding the Code (Very Easy)

Socket.IO works like a telephone.
* The **Server (`server.js`)** is the telephone operator connecting everyone.
* The **Client (`public/script.js`)** is your personal telephone in your browser.

### 1. `server.js` (The Server)
This file runs on your computer. It waits for people to connect and passes their messages around.

```javascript
// This runs when a new user connects to the server
io.on('connection', (socket) => {
    
    // 1. BROADCAST: When someone sends a broadcast message...
    socket.on('send-broadcast', (message) => {
        // 'io.emit()' sends it to EVERYONE
        io.emit('receive-broadcast', { sender: socket.id, message: message });
    });

    // 2. ROOMS: When someone wants to join a room...
    socket.on('join-room', (room) => {
        // 'socket.join()' puts them in that room
        socket.join(room); 
    });

    // When someone sends a message to a room...
    socket.on('send-room-message', ({ room, message }) => {
        // 'io.to(room).emit()' sends to EVERYONE inside that room
        io.to(room).emit('room-message', { sender: socket.id, message: message });
    });

    // 3. DIRECT MESSAGES: When someone sends a private message...
    socket.on('send-direct-message', ({ recipientId, message }) => {
        // 'socket.to(id).emit()' sends ONLY to that specific person
        socket.to(recipientId).emit('direct-message', { sender: socket.id, message: message });
    });
});
```

### 2. `public/script.js` (The Client / Browser)
This file runs in your web browser. It sends your typed messages to the server, and listens for new messages coming from the server.

```javascript
// Connect your browser to the server
const socket = io();


// --- HOW WE SEND MESSAGES TO THE SERVER ---

// 1. Send a broadcast message
socket.emit('send-broadcast', "Hello everyone!");

// 2. Join a room
socket.emit('join-room', "GamingRoom");

// 3. Send a message to the room
socket.emit('send-room-message', { room: "GamingRoom", message: "Hi gamers!" });

// 4. Send a private direct message
socket.emit('send-direct-message', { recipientId: "some-user-id", message: "Hello friend!" });


// --- HOW WE RECEIVE MESSAGES FROM THE SERVER ---

// 1. Listen for broadcast messages
socket.on('receive-broadcast', (data) => {
    console.log(data.sender + " says: " + data.message);
});

// 2. Listen for room messages
socket.on('room-message', (data) => {
    console.log(data.sender + " says: " + data.message);
});

// 3. Listen for private direct messages
socket.on('direct-message', (data) => {
    console.log("Private message from " + data.sender + ": " + data.message);
});
```

---

## 🔑 5 Key Words to Remember!

If you remember these, you understand Socket.IO!

1. `socket.emit(...)` 👉 **"I am sending a message."**
2. `socket.on(...)` 👉 **"I am listening for a message."**
3. `io.emit(...)` 👉 **"Server is sending a message to EVERYONE."**
4. `socket.join(...)` 👉 **"Server is putting this person in a room."**
5. `io.to(...).emit(...)` 👉 **"Server is sending a message to a specific room or person."**
