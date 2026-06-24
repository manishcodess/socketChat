// Connect to the socket.io server
const socket = io();

// DOM Elements
const myIdSpan = document.getElementById('my-id');

// Broadcast Elements
const broadcastMsgInput = document.getElementById('broadcast-msg');
const btnBroadcast = document.getElementById('btn-broadcast');
const boxBroadcast = document.getElementById('box-broadcast');

// Room Elements
const roomNameInput = document.getElementById('room-name');
const btnJoinRoom = document.getElementById('btn-join-room');
const roomMsgInput = document.getElementById('room-msg');
const btnRoomMsg = document.getElementById('btn-room-msg');
const boxRoom = document.getElementById('box-room');

// DM Elements
const recipientIdInput = document.getElementById('recipient-id');
const dmMsgInput = document.getElementById('dm-msg');
const btnDm = document.getElementById('btn-dm');
const boxDm = document.getElementById('box-dm');

// Keep track of the current room
let currentRoom = null;

// --- Helper function to display messages ---
function appendMessage(box, sender, message, type) {
    const msgElement = document.createElement('div');
    msgElement.classList.add('message', type); // type can be 'self', 'other', 'system'
    
    if (type !== 'system') {
        const senderElement = document.createElement('div');
        senderElement.classList.add('sender-id');
        senderElement.textContent = sender;
        msgElement.appendChild(senderElement);
    }

    const textElement = document.createElement('div');
    textElement.textContent = message;
    msgElement.appendChild(textElement);

    box.appendChild(msgElement);
    box.scrollTop = box.scrollHeight; // Scroll to bottom
}

// --- Connection Events ---

// Receive our own socket ID from server
socket.on('your-id', (id) => {
    myIdSpan.textContent = id;
});

// --- 1. Broadcast Feature ---

btnBroadcast.addEventListener('click', () => {
    const msg = broadcastMsgInput.value;
    if (msg) {
        // Emit to server
        socket.emit('send-broadcast', msg);
        broadcastMsgInput.value = '';
    }
});

// Receive broadcast
socket.on('receive-broadcast', (data) => {
    const type = data.sender === socket.id ? 'self' : 'other';
    appendMessage(boxBroadcast, data.sender === socket.id ? 'You' : data.sender, data.message, type);
});

// --- 2. Room Feature ---

btnJoinRoom.addEventListener('click', () => {
    const room = roomNameInput.value;
    if (room) {
        socket.emit('join-room', room);
        currentRoom = room;
        appendMessage(boxRoom, 'System', `You joined room: ${room}`, 'system');
    }
});

btnRoomMsg.addEventListener('click', () => {
    const msg = roomMsgInput.value;
    if (msg && currentRoom) {
        socket.emit('send-room-message', { room: currentRoom, message: msg });
        roomMsgInput.value = '';
    } else if (!currentRoom) {
        alert("Please join a room first!");
    }
});

// Receive room message
socket.on('room-message', (data) => {
    let type = 'other';
    let displaySender = data.sender;
    
    if (data.sender === socket.id) {
        type = 'self';
        displaySender = 'You';
    } else if (data.sender === 'System') {
        type = 'system';
    }

    appendMessage(boxRoom, displaySender, data.message, type);
});

// --- 3. Direct Message (1-to-1) Feature ---

btnDm.addEventListener('click', () => {
    const msg = dmMsgInput.value;
    const recipientId = recipientIdInput.value;
    if (msg && recipientId) {
        socket.emit('send-direct-message', { recipientId: recipientId, message: msg });
        // Show message in our own box (direct messages aren't bounced back to the sender by default)
        appendMessage(boxDm, `To: ${recipientId}`, msg, 'self');
        dmMsgInput.value = '';
    } else {
        alert("Please enter both a Recipient ID and a message.");
    }
});

// Receive direct message
socket.on('direct-message', (data) => {
    appendMessage(boxDm, `From: ${data.sender}`, data.message, 'other');
});
