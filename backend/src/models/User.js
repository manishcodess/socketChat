const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema(
    {
        clerkId: {
            type: String,
            required: true,
            unique: true,
            index: true
        },
        name: {
            type: String,
            required: true,
            default: 'WhatsApp User'
        },
        email: {
            type: String,
            default: ''
        },
        avatar: {
            type: String,
            default: ''
        },
        status: {
            type: String,
            default: 'Hey there! I am using WhatsApp Web.',
            maxLength: 120
        },
        isOnline: {
            type: Boolean,
            default: false
        },
        socketId: {
            type: String,
            default: ''
        },
        lastSeen: {
            type: Date,
            default: Date.now
        }
    },
    {
        timestamps: true
    }
);

// Helpful instance method to serialize safe public profile
UserSchema.methods.toProfile = function () {
    return {
        id: this.socketId || this._id.toString(),
        clerkId: this.clerkId,
        name: this.name,
        email: this.email,
        avatar: this.avatar,
        status: this.status,
        isOnline: this.isOnline,
        lastSeen: this.lastSeen
    };
};

module.exports = mongoose.model('User', UserSchema);
