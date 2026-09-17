const Message = require('../models/Message');

// Get message history for a specific chatId ('global', room name, or 1-to-1 conversation)
exports.getChatHistory = async (req, res) => {
    try {
        const { chatId } = req.params;
        const limit = parseInt(req.query.limit) || 100;

        let query = { chatId };

        // For direct message chats, match messages in both directions if not matching exact chatId
        if (chatId.startsWith('direct_') || chatId.startsWith('dm_')) {
            const parts = chatId.replace(/^(direct_|dm_)/, '').split('_');
            if (parts.length === 2) {
                const [userA, userB] = parts;
                query = {
                    $or: [
                        { chatId: chatId },
                        { chatId: `direct_${userB}_${userA}` },
                        { chatId: `dm_${userB}_${userA}` },
                        {
                            chatType: 'direct',
                            $or: [
                                { senderId: userA, recipientId: userB },
                                { senderId: userB, recipientId: userA },
                                { senderClerkId: userA, recipientClerkId: userB },
                                { senderClerkId: userB, recipientClerkId: userA }
                            ]
                        }
                    ]
                };
            }
        }

        const messages = await Message.find(query)
            .sort({ timestamp: 1 })
            .limit(limit);

        res.json({
            chatId,
            count: messages.length,
            messages
        });
    } catch (err) {
        console.error('Error fetching chat history:', err);
        res.status(500).json({ error: 'Failed to retrieve messages' });
    }
};

// Delete a message by msgId
exports.deleteMessage = async (req, res) => {
    try {
        const { msgId } = req.params;
        await Message.findOneAndDelete({ msgId });
        res.json({ success: true, message: 'Message deleted successfully' });
    } catch (err) {
        console.error('Error deleting message:', err);
        res.status(500).json({ error: 'Failed to delete message' });
    }
};
