const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const aiService = require('../services/aiService');
const geminiService = require('../services/geminiService');

// @desc    Chat with Nexa AI assistant (Google Gemini Free Tier only)
// @route   POST /api/ai/chat
const chatWithAI = async (req, res) => {
  try {
    const { message, history } = req.body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Message cannot be empty.',
        code: 'AI_INVALID_INPUT'
      });
    }

    if (message.trim().length > 4000) {
      return res.status(400).json({
        success: false,
        message: 'Message is too long. Please keep questions under 4,000 characters.',
        code: 'AI_MESSAGE_TOO_LONG'
      });
    }

    const reply = await geminiService.generateChatResponse({
      message: message.trim(),
      history: Array.isArray(history) ? history : []
    });

    return res.status(200).json({
      success: true,
      message: reply
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    const code = error.code || 'AI_ERROR';

    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Nexa AI was unable to generate a response. Please try again.',
      code
    });
  }
};

// @desc    Get 3 AI reply suggestions
// @route   POST /api/ai/suggest-replies
const getSuggestions = async (req, res) => {
  try {
    const { conversationId } = req.body;

    if (!conversationId) {
      return res.status(400).json({ success: false, message: 'Conversation ID is required' });
    }

    const messages = await Message.find({ conversation: conversationId, isDeleted: false })
      .populate('sender', 'name')
      .sort({ createdAt: -1 })
      .limit(15);

    const chronological = messages.reverse();
    const suggestions = await aiService.getReplySuggestions(chronological);

    return res.status(200).json({
      success: true,
      suggestions
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Summarize conversation
// @route   POST /api/ai/summarize
const summarizeChat = async (req, res) => {
  try {
    const { conversationId } = req.body;

    if (!conversationId) {
      return res.status(400).json({ success: false, message: 'Conversation ID is required' });
    }

    const messages = await Message.find({ conversation: conversationId, isDeleted: false })
      .populate('sender', 'name')
      .sort({ createdAt: -1 })
      .limit(50);

    const chronological = messages.reverse();
    const summary = await aiService.summarizeChat(chronological);

    return res.status(200).json({
      success: true,
      summary
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Translate text between languages
// @route   POST /api/ai/translate
const translateText = async (req, res) => {
  try {
    const { text, sourceLang = 'en', targetLang = 'ta' } = req.body;

    if (text === undefined || text === null || !String(text).trim()) {
      return res.status(400).json({ success: false, message: 'Text to translate is required' });
    }

    const cleanSourceLang = String(sourceLang || 'en').toLowerCase().trim();
    const cleanTargetLang = String(targetLang || 'ta').toLowerCase().trim();

    const translatedText = await aiService.translateText({
      text: String(text).trim(),
      sourceLang: cleanSourceLang,
      targetLang: cleanTargetLang
    });

    return res.status(200).json({
      success: true,
      translatedText,
      sourceLang: cleanSourceLang,
      targetLang: cleanTargetLang
    });
  } catch (error) {
    console.error('Translation error:', error);
    const statusCode = error.status || (error.message?.includes('Unsupported') ? 400 : 500);
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Translation failed. Please try again.'
    });
  }
};

module.exports = {
  chatWithAI,
  getSuggestions,
  summarizeChat,
  translateText
};
