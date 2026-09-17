const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema(
    {
        msgId: {
            type: String,
            required: true,
            unique: true,
            index: true
        },
        chatId: {
            type: String,
            required: true,
            index: true
        },
        chatType: {
            type: String,
            enum: ['global', 'room', 'direct'],
            default: 'global',
            index: true
        },
        senderId: {
            type: String,
            required: true
        },
        senderClerkId: {
            type: String,
            index: true
        },
        senderName: {
            type: String,
            default: 'User'
        },
        senderAvatar: {
            type: String,
            default: ''
        },
        recipientId: {
            type: String,
            default: null
        },
        recipientClerkId: {
            type: String,
            default: null
        },
        room: {
            type: String,
            default: null
        },
        text: {
            type: String,
            default: ''
        },
        attachment: {
            url: { type: String, default: null },
            fileId: { type: String, default: null },
            name: { type: String, default: null },
            fileType: { type: String, default: null }
        },
        reactions: [
            {
                emoji: { type: String, required: true },
                userId: { type: String, required: true },
                clerkId: { type: String, default: '' }
            }
        ],
        status: {
            type: String,
            enum: ['sent', 'delivered', 'read'],
            default: 'sent'
        },
        timestamp: {
            type: Date,
            default: Date.now,
            index: true
        }
    },
    {
        timestamps: true
    }
);

// Index to quickly fetch chronologically sorted chat history
MessageSchema.index({ chatId: 1, timestamp: 1 });

module.exports = mongoose.model('Message', MessageSchema);
