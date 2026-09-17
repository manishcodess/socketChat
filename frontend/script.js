// ==========================================================================
// WhatsApp Web Clone - Frontend Real-Time Logic with Clerk & Socket.IO
// ==========================================================================

// Dynamic Backend Server URL resolution
// 1. If explicitly set via window.BACKEND_URL or VITE_BACKEND_URL (for split frontend hosting like Vercel)
// 2. In local dev (port 3000 / 5173), dynamically points to backend on port 4000
// 3. In production full-stack (Render / Docker), uses same-origin relative paths ('')
const isLocalhost = Boolean(
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === '[::1]'
);

const BACKEND_URL = window.BACKEND_URL || 
    (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_BACKEND_URL) ||
    (isLocalhost && window.location.port !== '4000'
        ? `${window.location.protocol}//${window.location.hostname}:4000`
        : '');

// Global Application State
const state = {
    authConfig: {
        publishableKey: '',
        isConfigured: false
    },
    clerk: null,
    isGuest: false,
    socket: null,
    myProfile: {
        id: '',
        clerkId: '',
        name: 'You',
        email: '',
        avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=me',
        status: 'Hey there! I am using WhatsApp Web.'
    },
    activeChat: {
        type: 'global', // 'global' | 'room' | 'direct'
        id: 'global',
        name: 'General Lounge',
        avatar: '',
        status: 'Broadcast Channel'
    },
    chats: {
        'global': {
            id: 'global',
            type: 'global',
            name: 'General Lounge',
            avatar: '',
            status: 'Broadcast Channel',
            messages: [],
            unread: 0,
            lastMessage: 'Welcome to WhatsApp Web broadcast!',
            lastTime: ''
        },
        'room_general': {
            id: 'room_general',
            type: 'room',
            roomName: 'general',
            name: 'General Group',
            avatar: '',
            status: 'Public Group',
            messages: [],
            unread: 0,
            lastMessage: 'Tap to join the conversation',
            lastTime: ''
        }
    },
    onlineUsers: [],
    currentFilter: 'all',
    searchQuery: '',
    pendingAttachment: null,
    typingUsers: new Set(),
    isTyping: false,
    typingTimer: null
};

// ==========================================================================
// Sound Synthesis (Web Audio API - Self-Contained)
// ==========================================================================
class SoundEffects {
    constructor() {
        this.ctx = null;
    }

    init() {
        if (!this.ctx) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) this.ctx = new AudioCtx();
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    playSent() {
        try {
            this.init();
            if (!this.ctx) return;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(800, this.ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(1200, this.ctx.currentTime + 0.08);
            gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.08);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start();
            osc.stop(this.ctx.currentTime + 0.08);
        } catch (e) { }
    }

    playReceived() {
        try {
            this.init();
            if (!this.ctx) return;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(600, this.ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(950, this.ctx.currentTime + 0.12);
            gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.12);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start();
            osc.stop(this.ctx.currentTime + 0.12);
        } catch (e) { }
    }

    playRingtone() {
        try {
            this.init();
            if (!this.ctx) return null;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(440, this.ctx.currentTime);
            gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start();
            return { osc, gain };
        } catch (e) {
            return null;
        }
    }
}

const sounds = new SoundEffects();

// ==========================================================================
// DOM Element References
// ==========================================================================
const authPortal = document.getElementById('auth-portal');
const appContainer = document.getElementById('app-container');
const btnClerkSignin = document.getElementById('btn-clerk-signin');
const btnClerkSignup = document.getElementById('btn-clerk-signup');
const btnDemoGuest = document.getElementById('btn-demo-guest');
const btnOpenSetupModal = document.getElementById('btn-open-setup-modal');
const clerkUserButtonContainer = document.getElementById('clerk-user-button-container');
const clerkMountContainer = document.getElementById('clerk-sign-in-container');
const authQrFallback = document.getElementById('auth-qr-fallback');

// Sidebar and Chat Elements
const chatListEl = document.getElementById('chat-list');
const chatMessagesEl = document.getElementById('chat-messages');
const messageInputEl = document.getElementById('message-input');
const btnSendMessage = document.getElementById('btn-send-message');
const searchInputEl = document.getElementById('search-input');
const filterChips = document.querySelectorAll('.filter-chip');

// Active Chat Header
const activeChatTitleEl = document.getElementById('active-chat-title');
const activeChatStatusEl = document.getElementById('active-chat-status');
const activeChatAvatarWrapper = document.getElementById('active-chat-avatar-wrapper');
const typingIndicatorEl = document.getElementById('typing-indicator');
const typingUsernameEl = document.getElementById('typing-username');
const btnBackToList = document.getElementById('btn-back-to-list');

// Sidebar Profile
const sidebarMyNameEl = document.getElementById('sidebar-my-name');
const sidebarMyIdEl = document.getElementById('sidebar-my-id');
const sidebarMyAvatarEl = document.getElementById('sidebar-my-avatar');
const btnCopyId = document.getElementById('btn-copy-id');
const btnSidebarSignOut = document.getElementById('btn-sidebar-sign-out');

// Attachment & Emoji
const btnAttachFile = document.getElementById('btn-attach-file');
const fileInput = document.getElementById('file-input');
const attachmentPreviewBox = document.getElementById('attachment-preview-box');
const attachmentPreviewImg = document.getElementById('attachment-preview-img');
const btnRemoveAttachment = document.getElementById('btn-remove-attachment');
const btnToggleEmoji = document.getElementById('btn-toggle-emoji');
const emojiPicker = document.getElementById('emoji-picker');
const emojiGrid = document.getElementById('emoji-grid');
const emojiTabBtns = document.querySelectorAll('.emoji-tab-btn');

// Modals
const modalProfile = document.getElementById('modal-profile');
const modalClerkSetup = document.getElementById('modal-clerk-setup');
const modalGroup = document.getElementById('modal-group');
const modalDm = document.getElementById('modal-dm');
const modalCall = document.getElementById('modal-call');
const toastContainer = document.getElementById('toast-container');

// Forms & Inputs
const formProfile = document.getElementById('form-profile');
const inputProfileStatus = document.getElementById('input-profile-status');
const profileCardAvatar = document.getElementById('profile-card-avatar');
const profileCardName = document.getElementById('profile-card-name');
const profileCardEmail = document.getElementById('profile-card-email');
const profileCardClerkId = document.getElementById('profile-card-clerk-id');
const btnOpenClerkManage = document.getElementById('btn-open-clerk-manage');
const btnModalSignOut = document.getElementById('btn-modal-sign-out');

const formClerkKeys = document.getElementById('form-clerk-keys');
const inputClerkPubkey = document.getElementById('input-clerk-pubkey');
const inputClerkSeckey = document.getElementById('input-clerk-seckey');

const formGroup = document.getElementById('form-group');
const inputGroupName = document.getElementById('input-group-name');

const formDm = document.getElementById('form-dm');
const inputDmRecipient = document.getElementById('input-dm-recipient');

// Action Buttons
const btnOpenProfile = document.getElementById('btn-open-profile');
const btnOpenSettings = document.getElementById('btn-open-settings');
const btnOpenGroupModal = document.getElementById('btn-open-group-modal');
const btnOpenDmModal = document.getElementById('btn-open-dm-modal');
const btnVoiceCall = document.getElementById('btn-voice-call');
const btnVideoCall = document.getElementById('btn-video-call');
const btnEndCall = document.getElementById('btn-end-call');
const callAvatar = document.getElementById('call-avatar');
const callName = document.getElementById('call-name');
const callStatusText = document.getElementById('call-status-text');

// ==========================================================================
// Emoji Library Definition
// ==========================================================================
const EMOJI_CATEGORIES = {
    smileys: ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '🥲', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🥸', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🫣', '🤭', '🤫', '🫠', '🤐', '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '😷', '🤒', '🤕', '🤢', '🤮'],
    gestures: ['👍', '👎', '👌', '🤌', '🤏', '✌️', '🤞', '🫰', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '🫵', '👋', '🤚', '🖐️', '✋', '🖖', '🫱', '🫲', '🫸', '🫷', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪', '🦾', '🦿', '🦵', '🦶', '👂', '🦻', '👃', '👀', '👁️', '👅', '👄'],
    hearts: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❤️‍🔥', '❤️‍🩹', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '💌', '💋', '💯', '💢', '💥', '💫', '💦', '💨', '🕳️', '💣'],
    celebration: ['🎉', '🎊', '🎈', '🎂', '🍰', '🍾', '🥂', '🍻', '🍺', '🍹', '🍸', '🍕', '🍔', '🍟', '🌭', '🍿', '🍩', '🍦', '🔥', '✨', '🌟', '⭐', '⚡️', '🌈', '☀️', '🌙', '🚀', '🎯', '🏆', '🥇', '🎁']
};

function renderEmojis(category = 'smileys') {
    const list = EMOJI_CATEGORIES[category] || EMOJI_CATEGORIES.smileys;
    emojiGrid.innerHTML = '';
    list.forEach(char => {
        const item = document.createElement('div');
        item.classList.add('emoji-item');
        item.textContent = char;
        item.onclick = () => {
            messageInputEl.value += char;
            messageInputEl.focus();
            updateSendButtonState();
        };
        emojiGrid.appendChild(item);
    });
}

emojiTabBtns.forEach(btn => {
    btn.onclick = () => {
        emojiTabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderEmojis(btn.dataset.category);
    };
});

renderEmojis('smileys');

btnToggleEmoji.onclick = (e) => {
    e.stopPropagation();
    const isVisible = emojiPicker.style.display === 'flex';
    emojiPicker.style.display = isVisible ? 'none' : 'flex';
};

document.addEventListener('click', (e) => {
    if (!emojiPicker.contains(e.target) && e.target !== btnToggleEmoji) {
        emojiPicker.style.display = 'none';
    }
});

// ==========================================================================
// Helper Utility Functions
// ==========================================================================
function formatTime(dateInput) {
    if (!dateInput) return '';
    const d = new Date(dateInput);
    let hours = d.getHours();
    let minutes = d.getMinutes();
    const ampm = hours >= 12 ? 'pm' : 'am';
    hours = hours % 12;
    hours = hours ? hours : 12;
    minutes = minutes < 10 ? '0' + minutes : minutes;
    return `${hours}:${minutes} ${ampm}`;
}

function showToast(message) {
    const toast = document.createElement('div');
    toast.classList.add('toast');
    toast.innerHTML = `<span>💬</span><span>${message}</span>`;
    toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        setTimeout(() => toast.remove(), 300);
    }, 3200);
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// ==========================================================================
// Clerk Authentication & Initialization Lifecycle
// ==========================================================================

async function fetchAuthConfig() {
    try {
        const res = await fetch(`${BACKEND_URL}/api/auth/config`);
        const data = await res.json();
        state.authConfig = data;
        return data;
    } catch (err) {
        console.warn('Could not fetch auth config from server:', err);
        return { publishableKey: '', isConfigured: false };
    }
}

async function initClerkAuth() {
    const config = await fetchAuthConfig();
    const pubKey = config.publishableKey;

    if (pubKey && pubKey !== 'pk_test_placeholder') {
        try {
            // Wait for window.Clerk to be attached from browser script tag
            let clerk = window.Clerk;
            if (!clerk) {
                await new Promise((resolve) => {
                    let attempts = 0;
                    const timer = setInterval(() => {
                        attempts++;
                        if (window.Clerk || attempts > 60) {
                            clearInterval(timer);
                            resolve();
                        }
                    }, 50);
                });
                clerk = window.Clerk;
            }

            if (!clerk) {
                console.warn('Clerk SDK not loaded on window.');
                showAuthPortal();
                return;
            }

            if (typeof clerk === 'function') {
                clerk = new clerk(pubKey);
            }

            if (clerk && typeof clerk.load === 'function' && !clerk.loaded) {
                await clerk.load({
                    appearance: {
                        variables: {
                            colorPrimary: '#00a884',
                            colorBackground: '#111b21',
                            colorInputBackground: '#202c33',
                            colorInputText: '#e9edef',
                            colorText: '#e9edef',
                            colorTextSecondary: '#8696a0',
                            colorNeutral: '#222e35'
                        }
                    }
                });
            }
            state.clerk = clerk;

            // Handle Clerk state changes
            if (clerk && typeof clerk.addListener === 'function') {
                clerk.addListener(async ({ user }) => {
                    if (user) {
                        await handleUserSignedIn(user);
                    } else if (!state.isGuest) {
                        handleUserSignedOut();
                    }
                });
            }

            // Initial auth status
            if (clerk && clerk.user) {
                await handleUserSignedIn(clerk.user);
            } else {
                showAuthPortal();
            }
        } catch (err) {
            console.error('Clerk SDK initialization error:', err);
            showAuthPortal();
        }
    } else {
        console.log('Clerk Publishable Key is not configured yet. Ready in setup/demo mode.');
        showAuthPortal();
    }
}

function showAuthPortal() {
    authPortal.style.display = 'flex';
    appContainer.style.display = 'none';
    if (state.socket) {
        state.socket.disconnect();
        state.socket = null;
    }
}

async function handleUserSignedIn(clerkUser) {
    const fullName = clerkUser.fullName || `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || clerkUser.username || 'Clerk User';
    const email = clerkUser.primaryEmailAddress?.emailAddress || '';
    const avatar = clerkUser.imageUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${clerkUser.id}`;

    state.myProfile = {
        id: '',
        clerkId: clerkUser.id,
        name: fullName,
        email: email,
        avatar: avatar,
        status: 'Hey there! I am using WhatsApp Web.'
    };
    state.isGuest = false;

    // Get session token for Socket.IO authentication
    let token = null;
    if (state.clerk && state.clerk.session) {
        try {
            token = await state.clerk.session.getToken();
        } catch (tokErr) {
            console.warn('Could not acquire session token:', tokErr);
        }
    }

    // Connect real-time socket with auth
    connectSocket(token, state.myProfile);

    // Switch UI from Auth portal to main Chat Application
    authPortal.style.display = 'none';
    appContainer.style.display = 'flex';

    // Update Profile Modal and Sidebar Header
    updateProfileUI();

    // Mount Clerk User Button if container available
    if (state.clerk && clerkUserButtonContainer) {
        try {
            clerkUserButtonContainer.innerHTML = '';
            state.clerk.mountUserButton(clerkUserButtonContainer);
        } catch (e) {
            console.warn('UserButton mount error:', e);
        }
    }

    showToast(`Welcome, ${fullName}!`);
}

function handleUserSignedOut() {
    state.isGuest = false;
    state.myProfile = {
        id: '',
        clerkId: '',
        name: 'You',
        email: '',
        avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=me',
        status: 'Hey there! I am using WhatsApp Web.'
    };
    if (clerkUserButtonContainer) clerkUserButtonContainer.innerHTML = '';
    showAuthPortal();
    showToast('Signed out of WhatsApp Web');
}

function updateProfileUI() {
    sidebarMyNameEl.textContent = state.myProfile.name;
    sidebarMyAvatarEl.src = state.myProfile.avatar;
    sidebarMyIdEl.textContent = `ID: ${(state.myProfile.clerkId || state.myProfile.id).substring(0, 8)}...`;

    profileCardAvatar.src = state.myProfile.avatar;
    profileCardName.textContent = state.myProfile.name;
    profileCardEmail.textContent = state.myProfile.email || 'Guest / Local Session';
    profileCardClerkId.textContent = `Clerk ID: ${state.myProfile.clerkId || state.myProfile.id || 'N/A'}`;
    inputProfileStatus.value = state.myProfile.status;
}

// ==========================================================================
// Socket.IO Connection & Real-Time Event Handlers
// ==========================================================================

function connectSocket(token, userProfile) {
    if (state.socket) {
        state.socket.disconnect();
    }

    state.socket = io(BACKEND_URL || undefined, {
        auth: {
            token: token,
            user: userProfile
        }
    });

    const socket = state.socket;

    // 1. Initial Profile Received
    socket.on('init-profile', (user) => {
        state.myProfile = { ...state.myProfile, ...user };
        updateProfileUI();

        // Auto join default group and fetch MongoDB chat history
        socket.emit('join-room', 'general');
        loadChatHistory('global');
        renderChatList();
        renderActiveChat();
    });

    // 2. Profile Updated
    socket.on('profile-updated', (user) => {
        state.myProfile = { ...state.myProfile, ...user };
        updateProfileUI();
        showToast('Status updated successfully');
    });

    // 3. User Presence & Online Contacts
    socket.on('user-list-updated', (users) => {
        state.onlineUsers = users.filter(u => u.id !== socket.id);

        state.onlineUsers.forEach(u => {
            const chatId = `direct_${u.id}`;
            if (state.chats[chatId]) {
                state.chats[chatId].name = u.name;
                state.chats[chatId].avatar = u.avatar;
                state.chats[chatId].status = u.status || 'Online';
            }
        });

        renderChatList();
        if (state.activeChat.type === 'direct') {
            const activeUser = users.find(u => u.id === state.activeChat.recipientId);
            if (activeUser) {
                activeChatStatusEl.textContent = 'Online';
                activeChatStatusEl.classList.add('online');
            } else {
                activeChatStatusEl.textContent = 'Offline';
                activeChatStatusEl.classList.remove('online');
            }
        }
    });

    // 4. Global Broadcast Received
    socket.on('receive-broadcast', (msg) => {
        const isSelf = msg.senderId === socket.id || (msg.senderClerkId && msg.senderClerkId === state.myProfile.clerkId);
        const chat = state.chats['global'];
        if (!chat) return;

        chat.messages.push({
            ...msg,
            isSelf
        });
        chat.lastMessage = isSelf ? `You: ${msg.text || 'Photo'}` : `${msg.senderName}: ${msg.text || 'Photo'}`;
        chat.lastTime = formatTime(msg.timestamp);

        if (state.activeChat.id !== 'global') {
            chat.unread = (chat.unread || 0) + 1;
            sounds.playReceived();
        } else {
            if (!isSelf) sounds.playReceived();
            renderActiveMessages();
        }
        renderChatList();
    });

    // 5. Room Message Received
    socket.on('receive-room-message', (msg) => {
        const chatId = `room_${msg.room}`;
        let chat = state.chats[chatId];
        if (!chat) {
            chat = {
                id: chatId,
                type: 'room',
                roomName: msg.room,
                name: `${msg.room.charAt(0).toUpperCase() + msg.room.slice(1)} Group`,
                avatar: '',
                status: 'Group Chat',
                messages: [],
                unread: 0,
                lastMessage: '',
                lastTime: ''
            };
            state.chats[chatId] = chat;
        }

        const isSelf = msg.senderId === socket.id || (msg.senderClerkId && msg.senderClerkId === state.myProfile.clerkId);
        chat.messages.push({
            ...msg,
            isSelf
        });
        chat.lastMessage = isSelf ? `You: ${msg.text || 'Photo'}` : `${msg.senderName}: ${msg.text || 'Photo'}`;
        chat.lastTime = formatTime(msg.timestamp);

        if (state.activeChat.id !== chatId) {
            chat.unread = (chat.unread || 0) + 1;
            sounds.playReceived();
        } else {
            if (!isSelf) sounds.playReceived();
            renderActiveMessages();
        }
        renderChatList();
    });

    // Room System Notices
    socket.on('room-system-message', (data) => {
        const chatId = `room_${data.room}`;
        const chat = state.chats[chatId];
        if (chat) {
            chat.messages.push({
                id: 'sys_' + Date.now(),
                isSystem: true,
                text: data.message,
                timestamp: data.timestamp
            });
            if (state.activeChat.id === chatId) {
                renderActiveMessages();
            }
        }
    });

    // 6. Direct Message (1-to-1) Received
    socket.on('receive-direct-message', (msg) => {
        const chatId = `direct_${msg.senderId}`;
        let chat = state.chats[chatId];
        if (!chat) {
            chat = {
                id: chatId,
                type: 'direct',
                recipientId: msg.senderId,
                name: msg.senderName,
                avatar: msg.senderAvatar,
                status: 'Online',
                messages: [],
                unread: 0,
                lastMessage: '',
                lastTime: ''
            };
            state.chats[chatId] = chat;
        }

        chat.messages.push({
            ...msg,
            isSelf: false
        });
        chat.lastMessage = msg.text || 'Photo';
        chat.lastTime = formatTime(msg.timestamp);

        if (state.activeChat.id !== chatId) {
            chat.unread = (chat.unread || 0) + 1;
            sounds.playReceived();
            showToast(`New message from ${msg.senderName}`);
        } else {
            sounds.playReceived();
            renderActiveMessages();
        }
        renderChatList();
    });

    // Direct Message Sent Acknowledgment
    socket.on('direct-message-sent', (msg) => {
        const chatId = `direct_${msg.recipientId}`;
        let chat = state.chats[chatId];
        if (chat) {
            chat.messages.push({
                ...msg,
                isSelf: true
            });
            chat.lastMessage = `You: ${msg.text || 'Photo'}`;
            chat.lastTime = formatTime(msg.timestamp);
            if (state.activeChat.id === chatId) {
                renderActiveMessages();
            }
            renderChatList();
        }
    });

    // 7. Typing Event Handlers
    socket.on('user-typing', (data) => {
        if (state.activeChat.id === data.chatId) {
            state.typingUsers.add(data.userName);
            updateTypingIndicatorUI();
        }
        const item = document.querySelector(`.chat-item[data-id="${data.chatId}"] .chat-item-preview`);
        if (item) {
            item.textContent = 'typing...';
            item.classList.add('typing');
        }
    });

    socket.on('user-stop-typing', (data) => {
        if (state.activeChat.id === data.chatId) {
            state.typingUsers.clear();
            updateTypingIndicatorUI();
        }
        const chat = state.chats[data.chatId];
        const item = document.querySelector(`.chat-item[data-id="${data.chatId}"] .chat-item-preview`);
        if (item && chat) {
            item.textContent = chat.lastMessage || '';
            item.classList.remove('typing');
        }
    });

    // 8. Message Reactions Synced
    socket.on('message-reaction-updated', (data) => {
        const chat = state.chats[data.chatId];
        if (chat) {
            const msg = chat.messages.find(m => m.id === data.messageId);
            if (msg) {
                if (!msg.reactions) msg.reactions = {};
                msg.reactions[data.userId] = data.emoji;
                if (state.activeChat.id === data.chatId) {
                    renderActiveMessages();
                }
            }
        }
    });

    // Connect / Error Handling
    socket.on('connect_error', (err) => {
        console.warn('Socket connection warning:', err.message);
        showToast(err.message || 'Connection error');
    });
}

function updateTypingIndicatorUI() {
    if (state.typingUsers.size > 0) {
        const names = Array.from(state.typingUsers).join(', ');
        typingUsernameEl.textContent = `${names} is typing...`;
        typingIndicatorEl.style.display = 'flex';
        chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
    } else {
        typingIndicatorEl.style.display = 'none';
    }
}

// ==========================================================================
// UI Rendering Functions
// ==========================================================================

// Render Left Sidebar Chat List
function renderChatList() {
    chatListEl.innerHTML = '';

    let chatItems = Object.values(state.chats);

    // Online direct peers
    state.onlineUsers.forEach(u => {
        const directId = `direct_${u.id}`;
        if (!state.chats[directId]) {
            chatItems.push({
                id: directId,
                type: 'direct',
                recipientId: u.id,
                name: u.name,
                avatar: u.avatar,
                status: u.status || 'Online',
                messages: [],
                unread: 0,
                lastMessage: 'Tap to start chatting',
                lastTime: ''
            });
        }
    });

    // Filter Chips
    if (state.currentFilter === 'unread') {
        chatItems = chatItems.filter(c => c.unread > 0);
    } else if (state.currentFilter === 'groups') {
        chatItems = chatItems.filter(c => c.type === 'room' || c.type === 'global');
    } else if (state.currentFilter === 'direct') {
        chatItems = chatItems.filter(c => c.type === 'direct');
    }

    // Search
    if (state.searchQuery.trim()) {
        const q = state.searchQuery.toLowerCase();
        chatItems = chatItems.filter(c =>
            c.name.toLowerCase().includes(q) ||
            (c.lastMessage && c.lastMessage.toLowerCase().includes(q))
        );
    }

    if (chatItems.length === 0) {
        chatListEl.innerHTML = `
            <div style="text-align: center; color: var(--text-secondary); padding: 40px 20px; font-size: 0.9rem;">
                No chats found.
            </div>
        `;
        return;
    }

    chatItems.forEach(chat => {
        const itemEl = document.createElement('div');
        itemEl.classList.add('chat-item');
        itemEl.dataset.id = chat.id;
        if (state.activeChat.id === chat.id) {
            itemEl.classList.add('active');
        }

        let avatarMarkup = '';
        if (chat.type === 'global') {
            avatarMarkup = `
                <div class="chat-item-avatar">
                    <div class="broadcast-avatar-icon">
                        <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z"/></svg>
                    </div>
                </div>
            `;
        } else if (chat.type === 'room') {
            avatarMarkup = `
                <div class="chat-item-avatar">
                    <div class="group-avatar-icon">
                        <svg viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
                    </div>
                </div>
            `;
        } else {
            avatarMarkup = `
                <div class="chat-item-avatar">
                    <img src="${chat.avatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=' + chat.id}" alt="${chat.name}">
                    <span class="status-dot"></span>
                </div>
            `;
        }

        const unreadMarkup = chat.unread > 0 ? `<div class="unread-badge">${chat.unread}</div>` : '';

        itemEl.innerHTML = `
            ${avatarMarkup}
            <div class="chat-item-content">
                <div class="chat-item-top">
                    <span class="chat-item-name">${chat.name}</span>
                    <span class="chat-item-time">${chat.lastTime || ''}</span>
                </div>
                <div class="chat-item-bottom">
                    <span class="chat-item-preview">${chat.lastMessage || 'No messages yet'}</span>
                    ${unreadMarkup}
                </div>
            </div>
        `;

        itemEl.onclick = () => selectChat(chat);
        chatListEl.appendChild(itemEl);
    });
}

// Select Active Chat Window
function selectChat(chat) {
    state.activeChat = chat;
    if (!state.chats[chat.id]) {
        state.chats[chat.id] = chat;
    }
    state.chats[chat.id].unread = 0;
    state.typingUsers.clear();

    renderActiveChat();
    renderChatList();
    loadChatHistory(chat.id);

    // Mobile view switch
    appContainer.classList.add('show-chat');
}

// Fetch persistent chat history from MongoDB
async function loadChatHistory(chatId) {
    if (!chatId) return;
    try {
        const res = await fetch(`${BACKEND_URL}/api/messages/${encodeURIComponent(chatId)}`);
        const data = await res.json();
        if (data.messages && Array.isArray(data.messages)) {
            if (!state.chats[chatId]) {
                state.chats[chatId] = {
                    id: chatId,
                    name: chatId === 'global' ? 'General Lounge' : chatId,
                    messages: [],
                    unread: 0
                };
            }
            state.chats[chatId].messages = data.messages.map(m => {
                const isSelf = (m.senderId === state.socket?.id) ||
                    (m.senderClerkId && state.myProfile.clerkId && m.senderClerkId === state.myProfile.clerkId);
                const attUrl = typeof m.attachment === 'string' ? m.attachment : (m.attachment?.url || null);
                return {
                    id: m.msgId || m._id,
                    chatId: m.chatId,
                    senderId: m.senderId,
                    senderClerkId: m.senderClerkId,
                    senderName: m.senderName,
                    senderAvatar: m.senderAvatar,
                    isSelf: isSelf,
                    text: m.text,
                    attachment: attUrl,
                    reactions: m.reactions || [],
                    timestamp: m.timestamp
                };
            });

            if (data.messages.length > 0) {
                const lastMsg = data.messages[data.messages.length - 1];
                state.chats[chatId].lastMessage = lastMsg.text || (lastMsg.attachment ? '📷 Photo' : 'Message');
                state.chats[chatId].lastTime = formatTime(lastMsg.timestamp);
            }

            renderChatList();
            if (state.activeChat.id === chatId) {
                renderActiveMessages();
            }
        }
    } catch (err) {
        console.warn('Could not load chat history from MongoDB:', err.message);
    }
}

// Render Header & Metadata for Active Chat
function renderActiveChat() {
    const chat = state.activeChat;
    activeChatTitleEl.textContent = chat.name;

    if (chat.type === 'global') {
        activeChatStatusEl.textContent = 'Broadcast Channel (Everyone)';
        activeChatStatusEl.classList.remove('online');
        activeChatAvatarWrapper.innerHTML = `
            <div class="broadcast-avatar-icon" style="width: 40px; height: 40px;">
                <svg viewBox="0 0 24 24" style="width: 22px; height: 22px;"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z"/></svg>
            </div>
        `;
    } else if (chat.type === 'room') {
        activeChatStatusEl.textContent = 'Group Room';
        activeChatStatusEl.classList.remove('online');
        activeChatAvatarWrapper.innerHTML = `
            <div class="group-avatar-icon" style="width: 40px; height: 40px;">
                <svg viewBox="0 0 24 24" style="width: 22px; height: 22px;"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
            </div>
        `;
    } else {
        const isOnline = state.onlineUsers.some(u => u.id === chat.recipientId);
        activeChatStatusEl.textContent = isOnline ? 'Online' : 'Offline';
        if (isOnline) activeChatStatusEl.classList.add('online');
        else activeChatStatusEl.classList.remove('online');

        activeChatAvatarWrapper.innerHTML = `
            <img src="${chat.avatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=' + chat.id}" alt="${chat.name}" class="avatar-img">
            ${isOnline ? '<span class="status-dot"></span>' : ''}
        `;
    }

    renderActiveMessages();
}

// Render Messages in Active Canvas
function renderActiveMessages() {
    const chat = state.chats[state.activeChat.id];
    const messages = chat ? chat.messages : [];

    chatMessagesEl.innerHTML = `
        <div class="system-notice">
            <svg viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>
            <span>Messages are verified with Clerk identity and transmitted over Socket.IO.</span>
        </div>
        <div class="date-divider">Today</div>
    `;

    messages.forEach(msg => {
        if (msg.isSystem) {
            const sysEl = document.createElement('div');
            sysEl.classList.add('system-notice');
            sysEl.textContent = msg.text;
            chatMessagesEl.appendChild(sysEl);
            return;
        }

        const isSelf = msg.isSelf || (msg.senderId === state.socket?.id) || (msg.senderClerkId && state.myProfile.clerkId && msg.senderClerkId === state.myProfile.clerkId);
        const row = document.createElement('div');
        row.classList.add('msg-row', isSelf ? 'sent' : 'received');
        row.dataset.msgId = msg.id;

        const textMarkup = msg.text ? `<div class="message-text">${escapeHtml(msg.text)}</div>` : '';
        const attUrl = typeof msg.attachment === 'string' ? msg.attachment : (msg.attachment?.url || null);
        const attachmentMarkup = attUrl ? `
            <div class="message-attachment">
                <img src="${attUrl}" alt="ImageKit Shared Image" onclick="window.open('${attUrl}', '_blank')">
            </div>
        ` : '';

        let reactionsBadge = '';
        if (msg.reactions && Object.keys(msg.reactions).length > 0) {
            const emojis = Array.from(new Set(Object.values(msg.reactions))).join(' ');
            reactionsBadge = `<div class="reactions-badge">${emojis} ${Object.keys(msg.reactions).length > 1 ? Object.keys(msg.reactions).length : ''}</div>`;
        }

        const ticksMarkup = msg.isSelf ? `
            <span class="msg-ticks" title="Read">
                <svg viewBox="0 0 16 15"><path d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.877 5.978 6.74a.364.364 0 0 0-.51-.063l-.478.372a.364.364 0 0 0-.063.51l3.327 3.869a.728.728 0 0 0 1.077.02l5.742-7.622a.365.365 0 0 0-.063-.51zm-4.07 0l-.478-.372a.365.365 0 0 0-.51.063L4.596 9.877 2.978 8.01a.364.364 0 0 0-.51-.063l-.478.372a.364.364 0 0 0-.063.51l2.327 2.6a.728.728 0 0 0 1.077.02l5.656-7.622a.365.365 0 0 0-.063-.51z"/></svg>
            </span>
        ` : '';

        row.innerHTML = `
            <div class="reaction-bar">
                <button class="reaction-btn" data-emoji="👍">👍</button>
                <button class="reaction-btn" data-emoji="❤️">❤️</button>
                <button class="reaction-btn" data-emoji="😂">😂</button>
                <button class="reaction-btn" data-emoji="😮">😮</button>
                <button class="reaction-btn" data-emoji="😢">😢</button>
                <button class="reaction-btn" data-emoji="🙏">🙏</button>
            </div>

            <div class="message-bubble">
                <div class="sender-name-tag">${escapeHtml(msg.senderName || '')}</div>
                ${attachmentMarkup}
                ${textMarkup}
                <div class="message-meta">
                    <span class="message-time">${formatTime(msg.timestamp)}</span>
                    ${ticksMarkup}
                </div>
                ${reactionsBadge}
            </div>
        `;

        row.querySelectorAll('.reaction-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                sendReaction(msg.id, btn.dataset.emoji);
            };
        });

        chatMessagesEl.appendChild(row);
    });

    chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
}

// ==========================================================================
// Messaging & Event Dispatching
// ==========================================================================

function sendMessage() {
    const text = messageInputEl.value.trim();
    const attachment = state.pendingAttachment;

    if (!text && !attachment) return;
    if (!state.socket) {
        showToast('You are not connected to the chat server.');
        return;
    }

    const chat = state.activeChat;

    if (chat.type === 'global') {
        state.socket.emit('send-broadcast', {
            text: text,
            attachment: attachment
        });
    } else if (chat.type === 'room') {
        state.socket.emit('send-room-message', {
            room: chat.roomName,
            text: text,
            attachment: attachment
        });
    } else if (chat.type === 'direct') {
        state.socket.emit('send-direct-message', {
            recipientId: chat.recipientId,
            text: text,
            attachment: attachment
        });
    }

    sounds.playSent();

    messageInputEl.value = '';
    clearAttachment();
    updateSendButtonState();
    stopTyping();
}

function sendReaction(messageId, emoji) {
    if (!state.socket) return;
    const chat = state.activeChat;
    state.socket.emit('send-reaction', {
        chatId: chat.id,
        messageId: messageId,
        emoji: emoji,
        targetType: chat.type,
        targetId: chat.type === 'room' ? chat.roomName : (chat.type === 'direct' ? chat.recipientId : null)
    });
}

// Typing Event Emitters
messageInputEl.addEventListener('input', () => {
    updateSendButtonState();

    if (!state.isTyping && state.socket) {
        state.isTyping = true;
        const chat = state.activeChat;
        state.socket.emit('typing', {
            targetType: chat.type,
            targetId: chat.type === 'room' ? chat.roomName : (chat.type === 'direct' ? chat.recipientId : null)
        });
    }

    clearTimeout(state.typingTimer);
    state.typingTimer = setTimeout(() => {
        stopTyping();
    }, 1500);
});

function stopTyping() {
    if (state.isTyping && state.socket) {
        state.isTyping = false;
        const chat = state.activeChat;
        state.socket.emit('stop-typing', {
            targetType: chat.type,
            targetId: chat.type === 'room' ? chat.roomName : (chat.type === 'direct' ? chat.recipientId : null)
        });
    }
}

function updateSendButtonState() {
    const hasText = messageInputEl.value.trim().length > 0 || state.pendingAttachment !== null;
    if (hasText) {
        btnSendMessage.classList.add('active-send');
    } else {
        btnSendMessage.classList.remove('active-send');
    }
}

messageInputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

btnSendMessage.onclick = sendMessage;

// ==========================================================================
// Image & Attachment Handling via ImageKit
// ==========================================================================
btnAttachFile.onclick = () => fileInput.click();

fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
        showToast('Image size should be under 8MB');
        return;
    }

    showToast('Uploading image to ImageKit...');
    try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('fileName', file.name);

        const res = await fetch(`${BACKEND_URL}/api/upload`, {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        if (data.success && data.url) {
            state.pendingAttachment = data.url;
            attachmentPreviewImg.src = data.url;
            attachmentPreviewBox.style.display = 'block';
            updateSendButtonState();
            showToast('✓ Image uploaded to ImageKit');
        } else {
            showToast('Upload failed: ' + (data.error || 'Server error'));
        }
    } catch (err) {
        console.error('ImageKit upload error:', err);
        showToast('Error uploading image to ImageKit');
    }
});

btnRemoveAttachment.onclick = clearAttachment;

function clearAttachment() {
    state.pendingAttachment = null;
    attachmentPreviewBox.style.display = 'none';
    attachmentPreviewImg.src = '';
    fileInput.value = '';
    updateSendButtonState();
}

// ==========================================================================
// Search & Filter Listeners
// ==========================================================================
searchInputEl.addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    renderChatList();
});

filterChips.forEach(chip => {
    chip.onclick = () => {
        filterChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        state.currentFilter = chip.dataset.filter;
        renderChatList();
    };
});

// Copy User / Socket ID
btnCopyId.onclick = (e) => {
    e.stopPropagation();
    const idToCopy = state.myProfile.clerkId || state.myProfile.id;
    if (navigator.clipboard && idToCopy) {
        navigator.clipboard.writeText(idToCopy);
        showToast('User ID copied to clipboard!');
    }
};

// Mobile Back Button
btnBackToList.onclick = () => {
    appContainer.classList.remove('show-chat');
};

// ==========================================================================
// Modal Event Management
// ==========================================================================

function openModal(modalEl) {
    modalEl.style.display = 'flex';
}

function closeModal(modalEl) {
    modalEl.style.display = 'none';
}

document.querySelectorAll('.modal-close').forEach(btn => {
    btn.onclick = () => {
        const targetId = btn.dataset.close;
        const targetModal = document.getElementById(targetId);
        if (targetModal) closeModal(targetModal);
    };
});

// Profile Modal
btnOpenProfile.onclick = () => openModal(modalProfile);
btnOpenSettings.onclick = () => openModal(modalProfile);

formProfile.onsubmit = (e) => {
    e.preventDefault();
    const status = inputProfileStatus.value.trim();
    state.myProfile.status = status;
    if (state.socket) {
        state.socket.emit('update-profile', { status });
    }
    closeModal(modalProfile);
    showToast('Status saved!');
};

// Manage Clerk Account button
btnOpenClerkManage.onclick = () => {
    if (state.clerk && state.clerk.openUserProfile) {
        state.clerk.openUserProfile();
    } else {
        showToast('Clerk User Profile is only available when signed in with Clerk.');
    }
};

// Sign Out triggers
async function performSignOut() {
    if (state.clerk && state.clerk.user) {
        try {
            await state.clerk.signOut();
        } catch (e) {
            console.warn('Sign out error:', e);
        }
    }
    closeModal(modalProfile);
    handleUserSignedOut();
}

btnSidebarSignOut.onclick = performSignOut;
btnModalSignOut.onclick = performSignOut;

// Create / Join Group Modal
btnOpenGroupModal.onclick = () => openModal(modalGroup);

formGroup.onsubmit = (e) => {
    e.preventDefault();
    const roomName = inputGroupName.value.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '');
    if (!roomName) return;

    if (state.socket) {
        state.socket.emit('join-room', roomName);
    }

    const chatId = `room_${roomName}`;
    if (!state.chats[chatId]) {
        state.chats[chatId] = {
            id: chatId,
            type: 'room',
            roomName: roomName,
            name: `${roomName.charAt(0).toUpperCase() + roomName.slice(1)} Group`,
            avatar: '',
            status: 'Group Chat',
            messages: [],
            unread: 0,
            lastMessage: 'You joined the group',
            lastTime: formatTime(new Date())
        };
    }

    selectChat(state.chats[chatId]);
    inputGroupName.value = '';
    closeModal(modalGroup);
    showToast(`Joined group: ${roomName}`);
};

// Start Direct Chat Modal
btnOpenDmModal.onclick = () => openModal(modalDm);

formDm.onsubmit = (e) => {
    e.preventDefault();
    const recipientId = inputDmRecipient.value.trim();
    if (!recipientId) return;

    if (state.socket && (recipientId === state.socket.id || recipientId === state.myProfile.clerkId)) {
        showToast('You cannot start a direct chat with yourself');
        return;
    }

    const peer = state.onlineUsers.find(u => u.id === recipientId || u.clerkId === recipientId);
    const resolvedSocketId = peer ? peer.id : recipientId;
    const chatId = `direct_${resolvedSocketId}`;

    if (!state.chats[chatId]) {
        state.chats[chatId] = {
            id: chatId,
            type: 'direct',
            recipientId: resolvedSocketId,
            name: peer ? peer.name : `User (${resolvedSocketId.substring(0, 5)})`,
            avatar: peer ? peer.avatar : '',
            status: peer ? 'Online' : 'Direct Message',
            messages: [],
            unread: 0,
            lastMessage: 'Started direct chat',
            lastTime: formatTime(new Date())
        };
    }

    selectChat(state.chats[chatId]);
    inputDmRecipient.value = '';
    closeModal(modalDm);
};

// Voice & Video Call Simulation
let callInterval = null;
let ringAudio = null;

function startCallSimulation(isVideo = false) {
    const chat = state.activeChat;
    callName.textContent = chat.name;
    callAvatar.src = chat.avatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=' + chat.id;
    callStatusText.textContent = isVideo ? 'Starting video call...' : 'Calling...';
    openModal(modalCall);

    ringAudio = sounds.playRingtone();

    setTimeout(() => {
        if (ringAudio && ringAudio.osc) {
            try { ringAudio.osc.stop(); } catch (e) { }
        }
        callStatusText.textContent = '00:01';
        let seconds = 1;
        callInterval = setInterval(() => {
            seconds++;
            const m = Math.floor(seconds / 60);
            const s = seconds % 60;
            callStatusText.textContent = `${m < 10 ? '0' + m : m}:${s < 10 ? '0' + s : s}`;
        }, 1000);
    }, 2800);
}

btnVoiceCall.onclick = () => startCallSimulation(false);
btnVideoCall.onclick = () => startCallSimulation(true);

btnEndCall.onclick = () => {
    if (callInterval) clearInterval(callInterval);
    if (ringAudio && ringAudio.osc) {
        try { ringAudio.osc.stop(); } catch (e) { }
    }
    closeModal(modalCall);
    showToast('Call ended');
};

// ==========================================================================
// Auth Portal Button Handlers & Clerk Triggers
// ==========================================================================

btnClerkSignin.onclick = () => {
    if (state.clerk) {
        state.clerk.openSignIn();
    } else {
        openModal(modalClerkSetup);
    }
};

btnClerkSignup.onclick = () => {
    if (state.clerk) {
        state.clerk.openSignUp();
    } else {
        openModal(modalClerkSetup);
    }
};

btnDemoGuest.onclick = () => {
    state.isGuest = true;
    const guestId = `guest_${Math.random().toString(36).substr(2, 6)}`;
    state.myProfile = {
        id: '',
        clerkId: guestId,
        name: `Guest ${guestId.substring(6).toUpperCase()}`,
        email: 'guest@demo.local',
        avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${guestId}`,
        status: 'Hey there! I am using WhatsApp Web (Demo Mode).'
    };

    connectSocket(null, state.myProfile);
    authPortal.style.display = 'none';
    appContainer.style.display = 'flex';
    updateProfileUI();
    showToast(`Connected as ${state.myProfile.name}`);
};

btnOpenSetupModal.onclick = () => openModal(modalClerkSetup);

// Clerk Keys Save Form
formClerkKeys.onsubmit = async (e) => {
    e.preventDefault();
    const pubKey = inputClerkPubkey.value.trim();
    const secKey = inputClerkSeckey.value.trim();

    if (!pubKey || !secKey) {
        showToast('Please provide both keys');
        return;
    }

    try {
        const res = await fetch(`${BACKEND_URL}/api/auth/config`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ publishableKey: pubKey, secretKey: secKey })
        });
        const data = await res.json();
        if (data.success) {
            showToast('Clerk configuration saved! Reinitializing...');
            closeModal(modalClerkSetup);
            setTimeout(() => window.location.reload(), 800);
        } else {
            showToast(data.error || 'Failed to save configuration');
        }
    } catch (err) {
        console.error('Error saving keys:', err);
        showToast('Error saving configuration');
    }
};

// ==========================================================================
// Bootstrap on Window Load
// ==========================================================================
window.addEventListener('DOMContentLoaded', () => {
    // Check if Clerk SDK script is loaded
    if (window.Clerk) {
        initClerkAuth();
    } else {
        // Wait briefly for async script load
        const clerkCheckTimer = setInterval(() => {
            if (window.Clerk) {
                clearInterval(clerkCheckTimer);
                initClerkAuth();
            }
        }, 100);
        // Timeout after 3 seconds fallback
        setTimeout(() => {
            clearInterval(clerkCheckTimer);
            if (!state.clerk) {
                initClerkAuth();
            }
        }, 3000);
    }
});
