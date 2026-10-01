const rateLimit = require('express-rate-limit');

/**
 * AI-specific rate limiter
 * Enforces per-user limit to protect Google Gemini Free Tier quotas.
 * Default: 20 AI requests per user per 15 minutes.
 */
const aiRateLimiter = rateLimit({
  windowMs: parseInt(process.env.AI_RATE_WINDOW_MS || '900000', 10), // 15 minutes default
  max: parseInt(process.env.AI_RATE_LIMIT || '20', 10), // 20 requests per window
  keyGenerator: (req) => {
    // Rate limit per authenticated user ID; fallback to client IP
    return req.user?._id ? `user_${req.user._id}` : `ip_${req.ip}`;
  },
  handler: (req, res) => {
    return res.status(429).json({
      success: false,
      message: 'Nexa AI usage limit reached. Please try again later.',
      code: 'AI_RATE_LIMIT'
    });
  },
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = aiRateLimiter;
