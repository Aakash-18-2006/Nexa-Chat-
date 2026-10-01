const { GoogleGenAI } = require('@google/genai');

const SYSTEM_INSTRUCTION =
  'You are Nexa AI, the built-in AI assistant of NEXA Real-time Chat. Be helpful, friendly, concise, and accurate. Answer questions naturally. Help with coding, learning, translation, rewriting, summaries, brainstorming, and general questions. Never claim to have performed an action that you did not actually perform.';

class GeminiService {
  constructor() {
    this.client = null;
    this.currentApiKey = null;
  }

  /**
   * Lazily initializes and returns the singleton GoogleGenAI client instance.
   * Does NOT initialize during server startup or block the database.
   */
  getClient() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || !apiKey.trim()) {
      return null;
    }
    const cleanKey = apiKey.trim();
    if (!this.client || this.currentApiKey !== cleanKey) {
      this.client = new GoogleGenAI({ apiKey: cleanKey });
      this.currentApiKey = cleanKey;
    }
    return this.client;
  }

  /**
   * Retrieves the configured Gemini model name.
   * STRICT FREE-TIER: defaults to gemini-3.5-flash-lite, with no automatic paid fallbacks.
   */
  getModelName() {
    return (process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite').trim();
  }

  /**
   * Checks if an error is a Gemini free-tier rate limit or quota exhaustion.
   */
  isQuotaOrRateLimitError(err) {
    if (!err) return false;
    const status = err.status || err.statusCode || (err.error && err.error.code);
    if (status === 429) return true;

    const message = (err.message || '').toLowerCase();
    const details = JSON.stringify(err.error || err.details || '').toLowerCase();
    const combined = `${message} ${details}`;

    return (
      combined.includes('resource_exhausted') ||
      combined.includes('quota') ||
      combined.includes('rate limit') ||
      combined.includes('rate_limit') ||
      combined.includes('too many requests') ||
      combined.includes('daily limit') ||
      combined.includes('exhausted')
    );
  }

  /**
   * Checks if an error is due to an invalid or malformed API key / config.
   */
  isAuthOrConfigError(err) {
    if (!err) return false;
    const status = err.status || err.statusCode || (err.error && err.error.code);
    const msg = (err.message || '').toLowerCase();
    const details = JSON.stringify(err.error || err.details || '').toLowerCase();
    const combined = `${msg} ${details}`;

    if (status === 400 || status === 401) {
      if (
        combined.includes('api key') ||
        combined.includes('api_key') ||
        combined.includes('credential') ||
        combined.includes('invalid_argument') ||
        combined.includes('api_key_invalid') ||
        combined.includes('key not valid')
      ) {
        return true;
      }
    }
    return false;
  }

  /**
   * Checks if an error is due to permission/access restriction.
   */
  isPermissionError(err) {
    if (!err) return false;
    const status = err.status || err.statusCode || (err.error && err.error.code);
    if (status === 403) return true;
    const msg = (err.message || '').toLowerCase();
    const details = JSON.stringify(err.error || err.details || '').toLowerCase();
    const combined = `${msg} ${details}`;
    return combined.includes('permission_denied') || combined.includes('permission denied') || combined.includes('forbidden') || combined.includes('access denied');
  }

  /**
   * Checks if Google's response explicitly indicates that the configured model is unavailable or unsupported.
   * Does NOT treat generic HTTP 404s (e.g., unknown route) as model-unavailable.
   */
  isModelUnavailableError(err, modelName) {
    if (!err) return false;
    const msg = (err.message || '').toLowerCase();
    const details = JSON.stringify(err.error || err.details || '').toLowerCase();
    const combined = `${msg} ${details}`;

    const cleanModel = (modelName || '').toLowerCase().replace(/^models\//, '');
    const modelMentioned = combined.includes(cleanModel) || combined.includes('model');

    const explicitUnavailable =
      combined.includes('not found for api version') ||
      combined.includes('not supported for generatecontent') ||
      combined.includes('unsupported model') ||
      combined.includes('model not found') ||
      combined.includes('is not supported') ||
      combined.includes('model is deprecated') ||
      combined.includes('model was shut down');

    return modelMentioned && explicitUnavailable;
  }

  /**
   * Checks if the error is a temporary Google service failure.
   */
  isServiceUnavailableError(err) {
    if (!err) return false;
    const status = err.status || err.statusCode || (err.error && err.error.code);
    if (status === 503 || status === 504) return true;
    const msg = (err.message || '').toLowerCase();
    const details = JSON.stringify(err.error || err.details || '').toLowerCase();
    const combined = `${msg} ${details}`;
    return (
      combined.includes('unavailable') ||
      combined.includes('service unavailable') ||
      combined.includes('backend error') ||
      combined.includes('internal server error') ||
      combined.includes('deadline exceeded') ||
      combined.includes('gateway timeout') ||
      combined.includes('overloaded')
    );
  }

  /**
   * Generates a conversational response using the Google Gemini Free Tier.
   * Enforces zero paid usage, no model hopping, and no paid fallback providers.
   *
   * @param {Object} params
   * @param {string} params.message - Current user question/prompt.
   * @param {Array} params.history - Array of recent conversational turns [{ role, content }].
   * @returns {Promise<string>} Clean markdown/text response.
   */
  async generateChatResponse({ message, history = [] }) {
    const client = this.getClient();
    if (!client) {
      const error = new Error('Nexa AI is not configured yet.');
      error.code = 'AI_NOT_CONFIGURED';
      error.statusCode = 503;
      throw error;
    }

    const modelName = this.getModelName();

    // Prepare contents: take only the latest 10-20 messages for free-tier token safety
    const contents = [];
    if (Array.isArray(history) && history.length > 0) {
      const recentHistory = history.slice(-20);
      for (const item of recentHistory) {
        const text = typeof item.content === 'string' ? item.content : (item.text || '');
        if (!text || !text.trim()) continue;
        const role = item.role === 'model' || item.role === 'assistant' ? 'model' : 'user';
        contents.push({
          role,
          parts: [{ text: text.trim() }]
        });
      }
    }

    // Append the current user prompt
    contents.push({
      role: 'user',
      parts: [{ text: message.trim() }]
    });

    try {
      const response = await client.models.generateContent({
        model: modelName,
        contents,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          temperature: 0.7
        }
      });

      const replyText = response?.text || '';
      if (!replyText.trim()) {
        throw new Error('Empty response received from AI model.');
      }

      return replyText.trim();
    } catch (err) {
      // 1. Quota / Rate limit error: immediately halt without retrying or switching models
      if (this.isQuotaOrRateLimitError(err)) {
        const quotaError = new Error("Nexa AI's free usage limit has been reached. Please try again later.");
        quotaError.code = 'AI_FREE_LIMIT_REACHED';
        quotaError.statusCode = 429;
        throw quotaError;
      }

      // 2. Authentication / API key configuration error
      if (this.isAuthOrConfigError(err)) {
        const authError = new Error('Nexa AI configuration is invalid. Please contact administrator.');
        authError.code = 'AI_CONFIG_ERROR';
        authError.statusCode = 500;
        throw authError;
      }

      // 3. Permission / access restriction error
      if (this.isPermissionError(err)) {
        const permError = new Error('Access to Nexa AI is denied. Please check project permissions.');
        permError.code = 'AI_PERMISSION_DENIED';
        permError.statusCode = 403;
        throw permError;
      }

      // 4. Configured model explicitly unavailable or not supported
      if (this.isModelUnavailableError(err, modelName)) {
        const modelError = new Error(`Configured Gemini model '${modelName}' is unavailable on the Free Tier.`);
        modelError.code = 'AI_MODEL_UNAVAILABLE';
        modelError.statusCode = 500;
        throw modelError;
      }

      // 5. Temporary Google service failure
      if (this.isServiceUnavailableError(err)) {
        const tempError = new Error('Google AI service is temporarily unavailable. Please try again shortly.');
        tempError.code = 'AI_SERVICE_UNAVAILABLE';
        tempError.statusCode = 503;
        throw tempError;
      }

      // 6. Other general service errors
      const genericError = new Error('Nexa AI was unable to generate a response. Please try again.');
      genericError.code = 'AI_SERVICE_ERROR';
      genericError.statusCode = 500;
      throw genericError;
    }
  }
}

module.exports = new GeminiService();
