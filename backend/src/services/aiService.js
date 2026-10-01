/**
 * AI Service for NEXA
 * Uses Google Gemini Free Tier API with clean contextual synthesis
 */

class AIService {
  constructor() {
    this.geminiKey = process.env.GEMINI_API_KEY || process.env.AI_API_KEY || '';
    this.bingConfig = null;
  }

  // Format messages into clean text context
  formatContext(messages = []) {
    return messages
      .slice(-25)
      .map((m) => {
        const sender = m.sender?.name || m.senderName || 'User';
        const text = m.content || (m.attachments?.length ? '[Attachment]' : '');
        return `${sender}: ${text}`;
      })
      .filter((line) => line.trim().length > 0)
      .join('\n');
  }

  // Generate 3 contextual reply suggestions
  async getReplySuggestions(messages = []) {
    if (!messages.length) {
      return ['Hi!', 'Hello there', 'How are you?'];
    }

    const lastMsg = messages[messages.length - 1];
    const lastText = (lastMsg.content || '').toLowerCase().trim();
    const context = this.formatContext(messages);

    // Try Gemini API if available
    if (this.geminiKey) {
      try {
        const prompt = `You are an AI assistant in the NEXA chat app. Given the conversation context below, suggest exactly 3 short, natural, concise reply options for the recipient to reply to the latest message.
Return ONLY a valid JSON array of 3 strings, with no markdown formatting and no extra text. Example: ["Yes, absolutely", "Let me check and get back to you", "Sounds great!"]

Context:
${context}`;

        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.geminiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });

        if (res.ok) {
          const data = await res.json();
          const raw = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
          const cleanJson = raw.replace(/^```json\s*/, '').replace(/```$/, '').trim();
          const parsed = JSON.parse(cleanJson);
          if (Array.isArray(parsed) && parsed.length >= 3) {
            return parsed.slice(0, 3);
          }
        }
      } catch (err) {
        console.warn('[AI Service] Gemini suggestions failed, using intelligent fallback:', err.message);
      }
    }

    // Contextual heuristic fallback
    return this.generateSmartSuggestions(lastText, lastMsg);
  }

  generateSmartSuggestions(text, lastMsg) {
    // Questions about meeting / availability / time
    if (text.includes('meet') || text.includes('when') || text.includes('time') || text.includes('available')) {
      return ["Yes, I'll be there on time!", 'Could we push it by 15 minutes?', 'I am free whenever works for you.'];
    }
    // Questions with 'are you' / 'will you' / 'can you'
    if (text.startsWith('are you') || text.startsWith('can you') || text.includes('can you help')) {
      return ['Yes, definitely!', "I'm working on it right now.", "Let me check and confirm shortly."];
    }
    // Greetings
    if (text.includes('hi') || text.includes('hello') || text.includes('hey') || text.includes('morning')) {
      return ['Hey! How is everything going?', 'Hello! Good to hear from you.', 'Hey there! What are you working on?'];
    }
    // Gratitude
    if (text.includes('thanks') || text.includes('thank you') || text.includes('appreciate')) {
      return ["You're very welcome!", 'Glad I could help!', 'Anytime! Let me know if you need anything else.'];
    }
    // Status or update queries
    if (text.includes('status') || text.includes('progress') || text.includes('done') || text.includes('update')) {
      return ["Almost finished, sharing the update shortly!", 'Making great progress, on track.', 'Just reviewing the final details now.'];
    }
    // Agreement / Confirmation
    if (text.includes('okay') || text.includes('ok') || text.includes('sure') || text.includes('cool')) {
      return ['Sounds like a plan!', 'Great, looking forward to it.', 'Perfect!'];
    }

    // Default high-quality conversational replies
    return [
      'Got it, thanks for letting me know!',
      'Sounds good to me!',
      'Let me review this and get right back to you.'
    ];
  }

  // Summarize the chat
  async summarizeChat(messages = []) {
    if (!messages.length) {
      return 'No messages found in this conversation to summarize.';
    }

    const context = this.formatContext(messages);

    // Try Gemini API if available
    if (this.geminiKey) {
      try {
        const prompt = `You are an AI assistant in NEXA messaging platform. Summarize the following chat conversation into concise, readable bullet points highlighting key decisions, updates, tasks, and discussions.
Format as clear markdown bullet points with a short bold topic header.

Conversation:
${context}`;

        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.geminiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });

        if (res.ok) {
          const data = await res.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          if (text) return text;
        }
      } catch (err) {
        console.warn('[AI Service] Gemini summary failed, using intelligent fallback:', err.message);
      }
    }

    // Intelligent contextual synthesis fallback
    return this.generateSmartSummary(messages);
  }

  generateSmartSummary(messages) {
    const participants = new Set();
    const actionItems = [];
    const topics = [];

    messages.forEach((m) => {
      const name = m.sender?.name || m.senderName || 'Participant';
      participants.add(name);
      const text = m.content || '';

      if (text.toLowerCase().includes('handle') || text.toLowerCase().includes('will do') || text.toLowerCase().includes('assigned')) {
        actionItems.push(`${name}: ${text}`);
      } else if (text.length > 20) {
        topics.push(text);
      }
    });

    const participantList = Array.from(participants).join(', ');
    const bullets = [];

    bullets.push(`• **Active Participants**: ${participantList}`);
    bullets.push(`• **Activity**: Total ${messages.length} messages exchanged in this session.`);

    if (actionItems.length > 0) {
      bullets.push(`• **Key Action Items & Assignments**:`);
      actionItems.slice(-3).forEach(item => bullets.push(`  - ${item}`));
    }

    if (topics.length > 0) {
      bullets.push(`• **Recent Discussion Highlights**:`);
      topics.slice(-4).forEach(t => bullets.push(`  - "${t.length > 80 ? t.substring(0, 80) + '...' : t}"`));
    } else {
      bullets.push(`• **Recent Activity**: Quick check-ins and general messaging.`);
    }

    return bullets.join('\n');
  }

  // Bing configuration helper
  async getBingConfig() {
    if (this.bingConfig && (Date.now() - this.bingConfig.tokenTs < this.bingConfig.tokenExpiryInterval - 60000)) {
      return this.bingConfig;
    }

    const websiteRes = await fetch('https://www.bing.com/translator', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      signal: AbortSignal.timeout(8000)
    });

    if (!websiteRes.ok) {
      throw new Error(`Bing website returned status ${websiteRes.status}`);
    }

    const html = await websiteRes.text();
    const igMatch = html.match(/IG:"([^"]+)"/);
    const iidMatch = html.match(/data-iid="([^"]+)"/);
    const paramsMatch = html.match(/params_AbusePreventionHelper\s*=\s*(\[[^\]]+\])/);

    if (!igMatch || !paramsMatch) {
      throw new Error('Failed to extract Bing translator security parameters');
    }

    const [key, token, tokenExpiryInterval] = JSON.parse(paramsMatch[1]);
    const IG = igMatch[1];
    const IID = iidMatch ? iidMatch[1] : 'translator.5023';

    this.bingConfig = {
      IG,
      IID,
      key,
      token,
      tokenTs: Date.now(),
      tokenExpiryInterval: tokenExpiryInterval || 3600000
    };
    return this.bingConfig;
  }

  // Google translation engine
  async translateWithGoogle(text, from, to) {
    const endpoints = [
      'https://clients5.google.com/translate_a/t',
      'https://clients4.google.com/translate_a/t'
    ];

    const translateChunk = async (chunk) => {
      let lastErr = null;
      for (const base of endpoints) {
        try {
          const url = `${base}?client=dict-chrome-ex&sl=${encodeURIComponent(from)}&tl=${encodeURIComponent(to)}&q=${encodeURIComponent(chunk)}`;
          const res = await fetch(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
            },
            signal: AbortSignal.timeout(7000)
          });

          if (!res.ok) {
            throw new Error(`Google endpoint ${base} status ${res.status}`);
          }

          const data = await res.json();
          let translated = '';
          if (Array.isArray(data)) {
            translated = data.join('');
          } else if (typeof data === 'string') {
            translated = data;
          }

          if (typeof translated === 'string' && translated.trim().length > 0) {
            return translated;
          }
        } catch (err) {
          lastErr = err;
        }
      }
      throw lastErr || new Error('Google translation failed');
    };

    if (text.length <= 1400) {
      return await translateChunk(text);
    }

    // Split large text by paragraphs or lines
    const paragraphs = text.split('\n');
    const translatedParagraphs = [];
    for (const p of paragraphs) {
      if (!p.trim()) {
        translatedParagraphs.push(p);
      } else {
        translatedParagraphs.push(await translateChunk(p));
      }
    }
    return translatedParagraphs.join('\n');
  }

  // Microsoft Bing translation engine
  async translateWithBing(text, from, to) {
    const config = await this.getBingConfig();
    const apiUrl = `https://www.bing.com/ttranslatev3?isVertical=1&&IG=${config.IG}&IID=${config.IID}`;

    const fromCode = from === 'zh' ? 'zh-Hans' : from;
    const toCode = to === 'zh' ? 'zh-Hans' : to;

    const formBody = new URLSearchParams({
      fromLang: fromCode,
      to: toCode,
      text: text.trim(),
      token: config.token,
      key: String(config.key)
    });

    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Referer': 'https://www.bing.com/translator'
      },
      body: formBody.toString(),
      signal: AbortSignal.timeout(8000)
    });

    if (!res.ok) {
      throw new Error(`Bing translation status: ${res.status}`);
    }

    const data = await res.json();
    const translated = data?.[0]?.translations?.[0]?.text;
    if (typeof translated === 'string' && translated.trim().length > 0) {
      return translated;
    }
    throw new Error('Bing returned empty translation');
  }

  // Translate text between languages
  async translateText({ text, sourceLang = 'en', targetLang = 'ta' }) {
    if (text === undefined || text === null) {
      throw new Error('Text to translate is required');
    }

    const trimmedText = String(text).trim();
    if (!trimmedText) {
      return '';
    }

    const SUPPORTED_LANGUAGES = {
      en: 'English',
      ta: 'Tamil',
      hi: 'Hindi',
      te: 'Telugu',
      ml: 'Malayalam',
      kn: 'Kannada',
      es: 'Spanish',
      fr: 'French',
      de: 'German',
      ar: 'Arabic',
      zh: 'Chinese',
      ja: 'Japanese',
      ko: 'Korean',
      pt: 'Portuguese',
      ru: 'Russian',
      it: 'Italian',
      nl: 'Dutch',
      tr: 'Turkish',
      vi: 'Vietnamese',
      id: 'Indonesian'
    };

    const from = (sourceLang || 'en').toLowerCase().trim();
    const to = (targetLang || 'ta').toLowerCase().trim();

    if (!SUPPORTED_LANGUAGES[from]) {
      const err = new Error(`Unsupported source language: '${sourceLang}'`);
      err.status = 400;
      throw err;
    }

    if (!SUPPORTED_LANGUAGES[to]) {
      const err = new Error(`Unsupported target language: '${targetLang}'`);
      err.status = 400;
      throw err;
    }

    // Only return the exact original text when the user explicitly selected the same source and target language
    if (from === to) {
      return trimmedText;
    }

    // Tier 1: Try Google Gemini API if key is present
    if (this.geminiKey) {
      try {
        const fromName = SUPPORTED_LANGUAGES[from] || from;
        const toName = SUPPORTED_LANGUAGES[to] || to;
        const prompt = `You are a professional, accurate translator. Translate the following text from language "${fromName}" (${from}) into language "${toName}" (${to}).
Return ONLY the direct translated text. Do NOT add any extra notes, explanations, or quotes.

Text to translate:
${trimmedText}`;

        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
            signal: AbortSignal.timeout(8000)
          }
        );

        if (res.ok) {
          const data = await res.json();
          const translated = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          if (translated) return translated;
        }
      } catch (err) {
        console.warn('[AI Service] Gemini translation failed, using high-speed translation engine:', err.message);
      }
    }

    // Tier 2: Free Translation Engine
    try {
      const translated = await this.translateWithGoogle(trimmedText, from, to);
      if (translated && translated.trim().length > 0) {
        return translated.trim();
      }
    } catch (err) {
      console.warn('[AI Service] Google translation engine failed:', err.message);
    }

    // Tier 4: Microsoft Bing Translation Engine
    try {
      const translated = await this.translateWithBing(trimmedText, from, to);
      if (translated && translated.trim().length > 0) {
        return translated.trim();
      }
    } catch (err) {
      console.warn('[AI Service] Bing translation engine failed:', err.message);
    }

    // Tier 5: Do NOT silently return the input text when translation fails
    throw new Error('Translation failed. Please try again.');
  }
}

module.exports = new AIService();

