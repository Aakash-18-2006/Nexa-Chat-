const express = require('express');
const router = express.Router();
const {
  chatWithAI,
  getSuggestions,
  summarizeChat,
  translateText
} = require('../controllers/aiController');
const { protect } = require('../middleware/auth');
const aiRateLimiter = require('../middleware/aiRateLimiter');

// Free-Tier Nexa AI Chat Endpoint
router.post('/chat', protect, aiRateLimiter, chatWithAI);

// Existing AI features
router.post('/suggest-replies', protect, getSuggestions);
router.post('/reply', protect, getSuggestions);
router.post('/summarize', protect, summarizeChat);
router.post('/summary', protect, summarizeChat);
router.post('/translate', protect, translateText);

module.exports = router;
