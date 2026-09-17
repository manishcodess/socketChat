const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');

router.get('/:chatId', messageController.getChatHistory);
router.delete('/:msgId', messageController.deleteMessage);

module.exports = router;
