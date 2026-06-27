// Connect to the chat server using Socket.io
const socket = io();

// Find the HTML element where we will show our own ID
const myIdSpan = document.getElementById('my-id');

// Find the HTML elements for the "Broadcast" (send to everyone) feature
const broadcastMsgInput = document.getElementById('broadcast-msg'); // The text box
const btnBroadcast = document.getElementById('btn-broadcast'); // The send button
const boxBroadcast = document.getElementById('box-broadcast'); // The chat box

// Find the HTML elements for the "Room" (group chat) feature
const roomNameInput = document.getElementById('room-name'); // Room name text box
const btnJoinRoom = document.getElementById('btn-join-room'); // Join room button
const roomMsgInput = document.getElementById('room-msg'); // Room message text box
const btnRoomMsg = document.getElementById('btn-room-msg'); // Room send button
const boxRoom = document.getElementById('box-room'); // Room chat box

// Find the HTML elements for the "Direct Message" (1-to-1) feature
const recipientIdInput = document.getElementById('recipient-id'); // Who to send to
const dmMsgInput = document.getElementById('dm-msg'); // DM message text box
const btnDm = document.getElementById('btn-dm'); // DM send button
const boxDm = document.getElementById('box-dm'); // DM chat box

// Remember which room we are currently inside
let currentRoom = null;

// --- A helpful tool to show messages on the screen ---
function appendMessage(box, sender, message, type) {
    // Create a new container for the message
    const msgElement = document.createElement('div');
    // Add some styling based on whether it's our message, someone else's, or a system message
    msgElement.classList.add('message', type); 
    
    // If it's a real person (not the system), show their name or ID
    if (type !== 'system') {
        const senderElement = document.createElement('div');
        senderElement.classList.add('sender-id');
        senderElement.textContent = sender;
        msgElement.appendChild(senderElement);
    }

    // Create a spot for the actual message text and add it to our container
    const textElement = document.createElement('div');
    textElement.textContent = message;
    msgElement.appendChild(textElement);

    // Put our finished message container onto the screen inside the right chat box
    box.appendChild(msgElement);
    
    // Make sure we always scroll down to see the newest message
    box.scrollTop = box.scrollHeight; 
}

// --- What happens when we talk to the server ---

// When the server tells us what our special ID is
socket.on('your-id', (id) => {
    // Show our ID on the web page
    myIdSpan.textContent = id;
});

// --- 1. Broadcast Feature (Yelling to everyone) ---

// When we click the "Send to Everyone" button
btnBroadcast.addEventListener('click', () => {
    const msg = broadcastMsgInput.value; // Get the text we typed
    if (msg) { // If it's not empty
        // Tell the server to broadcast our message
        socket.emit('send-broadcast', msg);
        // Clear the text box so we can type a new one
        broadcastMsgInput.value = '';
    }
});

// When we receive a broadcast message from someone (or ourselves)
socket.on('receive-broadcast', (data) => {
    // Figure out if we sent it or someone else did
    const type = data.sender === socket.id ? 'self' : 'other';
    // Show "You" if we sent it, otherwise show their ID
    const senderName = data.sender === socket.id ? 'You' : data.sender;
    
    // Show the message in the broadcast chat box
    appendMessage(boxBroadcast, senderName, data.message, type);
});

// --- 2. Room Feature (Group Chats) ---

// When we click the "Join Room" button
btnJoinRoom.addEventListener('click', () => {
    const room = roomNameInput.value; // Get the room name we typed
    if (room) { // If it's not empty
        // Tell the server we want to join this room
        socket.emit('join-room', room);
        // Remember that we are in this room now
        currentRoom = room;
        // Show a little system message to ourselves that we joined
        appendMessage(boxRoom, 'System', `You joined room: ${room}`, 'system');
    }
});

// When we click the "Send in Room" button
btnRoomMsg.addEventListener('click', () => {
    const msg = roomMsgInput.value; // Get the message text
    
    if (msg && currentRoom) { // If we typed something AND we are inside a room
        // Tell the server to send this message only to people in our room
        socket.emit('send-room-message', { room: currentRoom, message: msg });
        // Clear the text box
        roomMsgInput.value = '';
    } else if (!currentRoom) { // If we forgot to join a room first
        alert("Please join a room first!");
    }
});

// When we receive a message inside our room
socket.on('room-message', (data) => {
    let type = 'other'; // Assume someone else sent it
    let displaySender = data.sender;
    
    // Check if we actually sent it ourselves
    if (data.sender === socket.id) {
        type = 'self';
        displaySender = 'You';
    } else if (data.sender === 'System') {
        // Check if it's a message from the server itself
        type = 'system';
    }

    // Show the message in the room chat box
    appendMessage(boxRoom, displaySender, data.message, type);
});

// --- 3. Direct Message (Secret 1-to-1 Chat) ---

// When we click the "Send Direct" button
btnDm.addEventListener('click', () => {
    const msg = dmMsgInput.value; // Get the message text
    const recipientId = recipientIdInput.value; // Get the ID of the person we want to message
    
    if (msg && recipientId) { // If we typed both a message and an ID
        // Tell the server to secretly deliver this message
        socket.emit('send-direct-message', { recipientId: recipientId, message: msg });
        
        // Show what we sent on our own screen (because direct messages are a secret and the server doesn't send them back to us)
        appendMessage(boxDm, `To: ${recipientId}`, msg, 'self');
        // Clear the text box
        dmMsgInput.value = '';
    } else { // If we forgot something
        alert("Please enter both a Recipient ID and a message.");
    }
});

// When someone sends us a secret direct message
socket.on('direct-message', (data) => {
    // Show their message in the direct message chat box
    appendMessage(boxDm, `From: ${data.sender}`, data.message, 'other');
});
