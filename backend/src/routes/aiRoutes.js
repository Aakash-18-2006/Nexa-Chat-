const express = require('express');
const router = express.Router();
const {
  getSuggestions,
  summarizeChat,
  translateText
} = require('../controllers/aiController');
const { protect } = require('../middleware/auth');

router.post('/suggest-replies', protect, getSuggestions);
router.post('/reply', protect, getSuggestions);
router.post('/summarize', protect, summarizeChat);
router.post('/summary', protect, summarizeChat);
router.post('/translate', protect, translateText);

module.exports = router;
