const express = require('express');
const router = express.Router();
const {
  getConversations,
  getOrCreateDirect,
  createConversation,
  getConversationById,
  pinMessage,
  unpinMessage,
  togglePinConversation,
  deleteConversationForUser,
  deleteMultipleConversations
} = require('../controllers/conversationController');
const { getMessages } = require('../controllers/messageController');
const { protect } = require('../middleware/auth');

router.get('/', protect, getConversations);
router.post('/', protect, createConversation);
router.post('/direct', protect, getOrCreateDirect);
router.post('/delete-multiple', protect, deleteMultipleConversations);
router.get('/:id', protect, getConversationById);
router.delete('/:id', protect, deleteConversationForUser);
router.post('/:id/pin', protect, togglePinConversation);
router.get('/:conversationId/messages', protect, getMessages);
router.post('/:id/pin/:messageId', protect, pinMessage);
router.delete('/:id/pin/:messageId', protect, unpinMessage);

module.exports = router;
