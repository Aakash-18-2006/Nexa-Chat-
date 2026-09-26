const express = require('express');
const router = express.Router();
const {
  getMessages,
  sendMessage,
  editMessage,
  deleteMessage,
  reactToMessage,
  markAsRead,
  getConversationMedia,
  searchMessages
} = require('../controllers/messageController');
const { protect } = require('../middleware/auth');

router.get('/search', protect, searchMessages);
router.get('/:conversationId', protect, getMessages);
router.post('/', protect, sendMessage);
router.put('/:id', protect, editMessage);
router.patch('/:id', protect, editMessage);
router.delete('/:id', protect, deleteMessage);
router.post('/:id/react', protect, reactToMessage);
router.post('/:id/reactions', protect, reactToMessage);
router.post('/:conversationId/read', protect, markAsRead);
router.get('/:conversationId/media', protect, getConversationMedia);

module.exports = router;
