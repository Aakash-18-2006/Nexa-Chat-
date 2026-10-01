import React, { useState, useEffect, useRef } from 'react';
import { Modal } from '../ui/Modal';
import { aiApi } from '../../api/endpoints';
import { useAuth } from '../../context/AuthContext';
import {
  Sparkles,
  FileText,
  Languages,
  Copy,
  Check,
  RefreshCw,
  ArrowLeftRight,
  MessageSquarePlus,
  Send,
  Trash2,
  AlertCircle,
  Bot,
  User,
  ShieldCheck
} from 'lucide-react';

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'ta', name: 'Tamil' },
  { code: 'hi', name: 'Hindi' },
  { code: 'te', name: 'Telugu' },
  { code: 'ml', name: 'Malayalam' },
  { code: 'kn', name: 'Kannada' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'ar', name: 'Arabic' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ru', name: 'Russian' },
  { code: 'it', name: 'Italian' },
  { code: 'nl', name: 'Dutch' },
  { code: 'tr', name: 'Turkish' },
  { code: 'vi', name: 'Vietnamese' },
  { code: 'id', name: 'Indonesian' }
];

const INITIAL_AI_MESSAGE = {
  id: 'welcome',
  role: 'model',
  content:
    "Hello! I am Nexa AI, powered by Google's Gemini Free Tier. Ask me anything—from coding and problem solving to learning, translations, summaries, and creative brainstorming!"
};

const STARTER_PROMPTS = [
  'Explain how WebSocket real-time rooms work',
  'Help me review and debug a code snippet',
  'Draft a polite message to reschedule a call',
  'Summarize key ideas for high-performance React'
];

export const AIAssistantModal = ({ isOpen, onClose, conversation, initialTab = 'chat' }) => {
  const { user } = useAuth();
  const [tab, setTab] = useState(initialTab || 'chat');

  // Nexa AI Chat state
  const [chatMessages, setChatMessages] = useState([INITIAL_AI_MESSAGE]);
  const [chatInput, setChatInput] = useState('');
  const [loadingChat, setLoadingChat] = useState(false);
  const [chatError, setChatError] = useState('');
  const [copiedMsgId, setCopiedMsgId] = useState(null);
  const chatScrollRef = useRef(null);

  // Sync tab with initialTab when opening modal
  useEffect(() => {
    if (isOpen && initialTab) {
      setTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (tab === 'chat' && chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages, loadingChat, tab]);

  // Summarize state
  const [summary, setSummary] = useState('');
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [summaryCopied, setSummaryCopied] = useState(false);

  // Translator state
  const [sourceLang, setSourceLang] = useState('en');
  const [targetLang, setTargetLang] = useState('ta');
  const [inputText, setInputText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [loadingTranslation, setLoadingTranslation] = useState(false);
  const [translationError, setTranslationError] = useState('');
  const [translationCopied, setTranslationCopied] = useState(false);
  const [usedInChat, setUsedInChat] = useState(false);

  // Reset conversation summary when conversation changes
  const convId = conversation?._id;
  useEffect(() => {
    setSummary('');
  }, [convId]);

  const isGroup = conversation?.type === 'group';
  const otherParticipant = !isGroup
    ? conversation?.participants?.find((p) => (p._id || p) !== user?._id)
    : null;
  const conversationName = isGroup
    ? conversation?.groupInfo?.name || 'Group Chat'
    : otherParticipant?.name || otherParticipant?.username || 'Current Chat';

  // ---------------------------------------------------------
  // Chat Handlers
  // ---------------------------------------------------------
  const handleSendChatMessage = async (promptToSend) => {
    const text = (promptToSend || chatInput).trim();
    if (!text || loadingChat) return;

    setChatError('');
    const userMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: text
    };

    const nextMessages = [...chatMessages, userMessage];
    setChatMessages(nextMessages);
    if (!promptToSend) {
      setChatInput('');
    }
    setLoadingChat(true);

    try {
      // Build safe recent history (max 20 messages) excluding welcome greeting
      const historyPayload = nextMessages
        .filter((m) => m.id !== 'welcome')
        .slice(-20)
        .map((m) => ({
          role: m.role === 'model' ? 'model' : 'user',
          content: m.content
        }));

      // Send to backend with conversation history (excluding the current prompt itself)
      const res = await aiApi.chat({
        message: text,
        history: historyPayload.slice(0, -1)
      });

      if (res?.data?.success && res.data.message) {
        const aiMessage = {
          id: `model_${Date.now()}`,
          role: 'model',
          content: res.data.message
        };
        setChatMessages((prev) => [...prev, aiMessage]);
      } else {
        setChatError(res?.data?.message || 'Nexa AI was unable to generate a response. Please try again.');
      }
    } catch (err) {
      console.error('Nexa AI Chat error:', err);
      const serverCode = err.response?.data?.code;
      const serverMessage = err.response?.data?.message;

      if (serverCode === 'AI_FREE_LIMIT_REACHED' || err.response?.status === 429) {
        setChatError("Nexa AI's free usage limit has been reached. Please try again later.");
      } else if (serverCode === 'AI_NOT_CONFIGURED') {
        setChatError('Nexa AI is not configured yet.');
      } else if (!navigator.onLine || err.code === 'ERR_NETWORK') {
        setChatError('Network error. Please check your internet connection.');
      } else {
        setChatError(serverMessage || "Nexa AI's free usage limit has been reached. Please try again later.");
      }
    } finally {
      setLoadingChat(false);
    }
  };

  const handleClearChat = () => {
    setChatMessages([INITIAL_AI_MESSAGE]);
    setChatError('');
  };

  const handleCopyMessage = (id, text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedMsgId(id);
    setTimeout(() => setCopiedMsgId(null), 2000);
  };

  // ---------------------------------------------------------
  // Summary Handlers
  // ---------------------------------------------------------
  const handleGenerateSummary = async () => {
    if (!conversation?._id) return;
    setLoadingSummary(true);
    try {
      const res = await aiApi.summarizeChat(conversation._id);
      if (res.data?.success) {
        setSummary(res.data.summary);
      }
    } catch (err) {
      console.error('AI summary error:', err);
      setSummary('Unable to generate summary. Please ensure there are messages in this chat.');
    } finally {
      setLoadingSummary(false);
    }
  };

  const copySummary = () => {
    if (summary) {
      navigator.clipboard.writeText(summary);
      setSummaryCopied(true);
      setTimeout(() => setSummaryCopied(false), 2000);
    }
  };

  // ---------------------------------------------------------
  // Translator Handlers
  // ---------------------------------------------------------
  const handleSwapLanguages = () => {
    setSourceLang(targetLang);
    setTargetLang(sourceLang);
    setTranslationError('');
    if (translatedText) {
      setInputText(translatedText);
      setTranslatedText(inputText);
    }
  };

  const handleTranslate = async (e) => {
    e?.preventDefault?.();
    if (loadingTranslation) return;

    const trimmedInput = inputText.trim();
    if (!trimmedInput) {
      setTranslationError('Please enter text to translate.');
      return;
    }

    const validSource = LANGUAGES.some((l) => l.code === sourceLang);
    const validTarget = LANGUAGES.some((l) => l.code === targetLang);
    if (!validSource || !validTarget) {
      setTranslationError('Unsupported language selected.');
      return;
    }

    setLoadingTranslation(true);
    setTranslationError('');

    try {
      const res = await aiApi.translateText({
        text: trimmedInput,
        sourceLang,
        targetLang
      });

      if (res?.data?.success && typeof res.data.translatedText === 'string') {
        const result = res.data.translatedText;
        if (!result.trim() && trimmedInput) {
          setTranslationError('Translation failed. Please try again.');
        } else {
          setTranslatedText(result);
        }
      } else {
        setTranslationError(res?.data?.message || 'Translation failed. Please try again.');
      }
    } catch (err) {
      console.error('Translation error:', err);
      const serverMessage = err.response?.data?.message;
      if (err.response?.status === 400 && serverMessage) {
        setTranslationError(serverMessage);
      } else if (!navigator.onLine || err.code === 'ERR_NETWORK') {
        setTranslationError('Network error. Please check your internet connection.');
      } else {
        setTranslationError(serverMessage || 'Translation failed. Please try again.');
      }
    } finally {
      setLoadingTranslation(false);
    }
  };

  const handleCopyTranslation = () => {
    if (translatedText) {
      navigator.clipboard.writeText(translatedText);
      setTranslationCopied(true);
      setTimeout(() => setTranslationCopied(false), 2000);
    }
  };

  const handleUseInChat = () => {
    if (!translatedText) return;
    window.dispatchEvent(
      new CustomEvent('nexa:insert-chat-input', {
        detail: { text: translatedText }
      })
    );
    setUsedInChat(true);
    setTimeout(() => {
      setUsedInChat(false);
      onClose();
    }, 600);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="NEXA AI Assistant" maxWidth="max-w-2xl">
      {/* Active Conversation Context Banner */}
      {conversation && tab !== 'chat' && (
        <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-[#0a0a0f] border border-[#ff1744]/25 shadow-[0_0_15px_rgba(255,23,68,0.08)] text-xs text-slate-300 mb-3 select-none">
          <div className="w-5 h-5 rounded-md bg-[#ff1744]/15 flex items-center justify-center shrink-0 border border-[#ff1744]/30">
            <Sparkles className="w-3 h-3 text-[#ff1744]" />
          </div>
          <span className="truncate">
            Conversation Context: <strong className="text-white font-semibold">{conversationName}</strong>
          </span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex bg-[#050505] p-1 rounded-xl mb-4 border border-[#ff1744]/20 text-xs">
        <button
          type="button"
          onClick={() => setTab('chat')}
          className={`flex-1 py-2 font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            tab === 'chat'
              ? 'bg-gradient-to-r from-[#ff1744] via-[#d3121f] to-[#991b1b] text-white shadow-[0_0_15px_rgba(255,23,68,0.3)]'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Nexa AI Chat</span>
        </button>

        <button
          type="button"
          onClick={() => setTab('summary')}
          className={`flex-1 py-2 font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            tab === 'summary'
              ? 'bg-gradient-to-r from-[#ff1744] via-[#d3121f] to-[#991b1b] text-white shadow-[0_0_15px_rgba(255,23,68,0.3)]'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Summarize Chat</span>
        </button>

        <button
          type="button"
          onClick={() => setTab('translator')}
          className={`flex-1 py-2 font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            tab === 'translator'
              ? 'bg-gradient-to-r from-[#ff1744] via-[#d3121f] to-[#991b1b] text-white shadow-[0_0_15px_rgba(255,23,68,0.3)]'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Languages className="w-3.5 h-3.5" />
          <span>Translator</span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: NEXA AI CONVERSATIONAL CHAT (Gemini Free Tier)     */}
      {/* ========================================================= */}
      {tab === 'chat' && (
        <div className="flex flex-col h-[460px] bg-[#07070a] rounded-2xl border border-[#ff1744]/20 overflow-hidden">
          {/* Free Tier Indicator Header Bar */}
          <div className="flex items-center justify-between px-3.5 py-2 bg-[#050505] border-b border-white/5 text-[11px] text-slate-400 select-none">
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-semibold">
                <ShieldCheck className="w-3 h-3" />
                Google Gemini Free Tier
              </span>
              <span className="text-slate-500 hidden sm:inline">• Free usage only</span>
            </div>

            <button
              type="button"
              onClick={handleClearChat}
              title="Clear Conversation"
              className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors cursor-pointer text-[10px]"
            >
              <Trash2 className="w-3 h-3 text-[#ff1744]" />
              <span>Clear</span>
            </button>
          </div>

          {/* Messages Stream */}
          <div
            ref={chatScrollRef}
            className="flex-1 overflow-y-auto p-4 space-y-3.5 select-text text-xs leading-relaxed"
          >
            {chatMessages.map((msg) => {
              const isAI = msg.role === 'model';
              const isCopied = copiedMsgId === msg.id;

              return (
                <div
                  key={msg.id}
                  className={`flex gap-2.5 ${isAI ? 'justify-start' : 'justify-end'}`}
                >
                  {isAI && (
                    <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-[#ff1744] via-[#d3121f] to-[#991b1b] flex items-center justify-center shrink-0 shadow-[0_0_10px_rgba(255,23,68,0.3)] mt-0.5">
                      <Sparkles className="w-3.5 h-3.5 text-white" />
                    </div>
                  )}

                  <div
                    className={`group relative max-w-[85%] rounded-2xl p-3.5 ${
                      isAI
                        ? 'bg-[#0f1016] text-slate-200 border border-[#ff1744]/20 shadow-sm'
                        : 'bg-gradient-to-tr from-[#ff1744] via-[#d3121f] to-[#991b1b] text-white shadow-[0_0_15px_rgba(255,23,68,0.2)]'
                    }`}
                  >
                    {isAI && (
                      <div className="flex items-center justify-between gap-2 mb-1.5 pb-1 border-b border-white/5">
                        <span className="text-[10px] font-bold text-[#ff1744] uppercase tracking-wider">
                          Nexa AI
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyMessage(msg.id, msg.content)}
                          title="Copy message"
                          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-opacity cursor-pointer"
                        >
                          {isCopied ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    )}

                    <div className="whitespace-pre-wrap font-normal select-text break-words">
                      {msg.content}
                    </div>
                  </div>

                  {!isAI && (
                    <div className="w-7 h-7 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center shrink-0 mt-0.5">
                      <User className="w-3.5 h-3.5 text-slate-200" />
                    </div>
                  )}
                </div>
              );
            })}

            {/* Quick Starter Chips (Displayed when conversation is fresh) */}
            {chatMessages.length === 1 && !loadingChat && (
              <div className="pt-2">
                <p className="text-[11px] font-medium text-slate-500 mb-2">Try asking Nexa AI:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {STARTER_PROMPTS.map((prompt, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSendChatMessage(prompt)}
                      className="text-left p-2.5 rounded-xl bg-[#0d0e14] hover:bg-[#ff1744]/10 border border-white/5 hover:border-[#ff1744]/30 text-[11px] text-slate-300 hover:text-white transition-all cursor-pointer shadow-sm"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* AI Typing Pulse State */}
            {loadingChat && (
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-[#ff1744] via-[#d3121f] to-[#991b1b] flex items-center justify-center shrink-0 animate-pulse">
                  <Sparkles className="w-3.5 h-3.5 text-white" />
                </div>
                <div className="flex items-center gap-1.5 px-3 py-2 bg-[#0f1016] border border-[#ff1744]/20 rounded-2xl">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#ff1744] animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#ff1744] animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#ff1744] animate-bounce" style={{ animationDelay: '300ms' }} />
                  <span className="text-[11px] text-slate-400 ml-1">Nexa AI is thinking...</span>
                </div>
              </div>
            )}

            {/* Error Banner */}
            {chatError && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 text-[#ff1744] mt-0.5" />
                <span>{chatError}</span>
              </div>
            )}
          </div>

          {/* Bottom Chat Input Form */}
          <form
            onSubmit={(e) => handleSendChatMessage()}
            className="p-3 bg-[#050505] border-t border-white/5 flex flex-col gap-1.5"
          >
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendChatMessage();
                  }
                }}
                disabled={loadingChat}
                placeholder="Ask Nexa AI anything (Enter to send)..."
                className="flex-1 bg-[#0c0d12] border border-[#ff1744]/25 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-[#ff1744] focus:shadow-[0_0_15px_rgba(255,23,68,0.2)] transition-all"
              />

              <button
                type="submit"
                disabled={loadingChat || !chatInput.trim()}
                className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#ff1744] via-[#d3121f] to-[#991b1b] hover:brightness-110 active:scale-95 disabled:opacity-40 text-white flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(255,23,68,0.3)] transition-all cursor-pointer"
                title="Send to Nexa AI"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center justify-between px-1 text-[10px] text-slate-500 select-none">
              <span>Strictly Free-Tier Only • Zero Paid Usage</span>
              <span>20 requests / 15 min limit</span>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: SUMMARIZE CHAT                                     */}
      {/* ========================================================= */}
      {tab === 'summary' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-slate-400 leading-relaxed">
              Synthesize recent discussion points, decisions, and action items into a clean summary.
            </p>
            <button
              onClick={handleGenerateSummary}
              disabled={loadingSummary}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#ff1744] via-[#d3121f] to-[#991b1b] hover:brightness-110 active:scale-95 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 shadow-[0_0_15px_rgba(255,23,68,0.25)] cursor-pointer flex-shrink-0 transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingSummary ? 'animate-spin' : ''}`} />
              <span>{summary ? 'Regenerate' : 'Generate'}</span>
            </button>
          </div>

          {loadingSummary ? (
            <div className="p-8 text-center bg-[#0a0a0f] rounded-2xl border border-[#ff1744]/20 shadow-[0_0_20px_rgba(255,23,68,0.06)]">
              <Sparkles className="w-6 h-6 text-[#ff1744] animate-spin mx-auto mb-2" />
              <p className="text-xs text-slate-300">Analyzing conversation messages...</p>
            </div>
          ) : summary ? (
            <div className="relative p-4 rounded-2xl bg-[#0a0a0f] border border-[#ff1744]/30 shadow-[0_0_25px_rgba(255,23,68,0.08)] text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">
              <button
                onClick={copySummary}
                className="absolute top-3 right-3 p-1.5 rounded-lg bg-white/5 hover:bg-[#ff1744]/20 text-slate-400 hover:text-[#ff1744] border border-white/10 hover:border-[#ff1744]/30 transition-all cursor-pointer"
                title="Copy Summary"
              >
                {summaryCopied ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
              {summary}
            </div>
          ) : (
            <div className="p-6 text-center bg-[#0a0a0f]/60 rounded-2xl border border-white/5">
              <p className="text-xs text-slate-500">
                Click "Generate" to synthesize an AI summary of this chat.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: TRANSLATOR                                         */}
      {/* ========================================================= */}
      {tab === 'translator' && (
        <div className="space-y-4">
          {/* Language Selection Row */}
          <div className="grid grid-cols-[1fr,auto,1fr] items-center gap-2">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                <span>From:</span>
              </label>
              <select
                value={sourceLang}
                onChange={(e) => setSourceLang(e.target.value)}
                className="w-full bg-[#050505] border border-[#ff1744]/25 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#ff1744] focus:shadow-[0_0_12px_rgba(255,23,68,0.2)] transition-all cursor-pointer font-medium"
              >
                {LANGUAGES.map((l) => (
                  <option key={`src-${l.code}`} value={l.code} className="bg-[#0a0a0f] text-white">
                    {l.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleSwapLanguages}
              title="Swap Languages"
              className="mt-5 p-2 rounded-xl border border-white/10 hover:border-[#ff1744]/40 bg-white/5 hover:bg-[#ff1744]/10 text-slate-400 hover:text-[#ff1744] transition-all cursor-pointer"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
            </button>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                <span>To:</span>
              </label>
              <select
                value={targetLang}
                onChange={(e) => setTargetLang(e.target.value)}
                className="w-full bg-[#050505] border border-[#ff1744]/25 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#ff1744] focus:shadow-[0_0_12px_rgba(255,23,68,0.2)] transition-all cursor-pointer font-medium"
              >
                {LANGUAGES.map((l) => (
                  <option key={`tgt-${l.code}`} value={l.code} className="bg-[#0a0a0f] text-white">
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Input Text Area */}
          <div className="space-y-1">
            <textarea
              rows={3}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleTranslate();
                }
              }}
              placeholder="Enter text to translate..."
              className="w-full bg-[#050505] border border-[#ff1744]/25 rounded-xl p-3 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-[#ff1744] focus:shadow-[0_0_15px_rgba(255,23,68,0.25)] transition-all resize-none leading-relaxed"
            />
            {inputText && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setInputText('');
                    setTranslatedText('');
                    setTranslationError('');
                  }}
                  className="text-[11px] text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                >
                  Clear input
                </button>
              </div>
            )}
          </div>

          {/* Translate Button */}
          <div className="flex justify-center">
            <button
              type="button"
              onClick={handleTranslate}
              disabled={loadingTranslation || !inputText.trim()}
              className="w-full sm:w-auto px-8 py-2.5 bg-gradient-to-r from-[#ff1744] via-[#d3121f] to-[#991b1b] hover:brightness-110 active:scale-95 disabled:opacity-50 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(255,23,68,0.3)] cursor-pointer transition-all"
            >
              {loadingTranslation ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Translating...</span>
                </>
              ) : (
                <>
                  <Languages className="w-4 h-4" />
                  <span>Translate</span>
                </>
              )}
            </button>
          </div>

          {/* Error Message */}
          {translationError && (
            <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-xs text-rose-300 text-center font-medium">
              {translationError}
            </div>
          )}

          {/* Translation Result Box */}
          {translatedText && (
            <div className="relative p-4 rounded-2xl bg-[#0a0a0f] border border-[#ff1744]/35 shadow-[0_0_25px_rgba(255,23,68,0.1)] text-xs text-slate-100 space-y-3">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-[#ff1744] uppercase tracking-wider">
                    Translation:
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    <Check className="w-2.5 h-2.5" />
                    Translation successful
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyTranslation}
                    className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-[#ff1744]/15 text-slate-300 hover:text-white border border-white/10 hover:border-[#ff1744]/30 text-[11px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    {translationCopied ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3 text-[#ff1744]" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>

                  {conversation && (
                    <button
                      type="button"
                      onClick={handleUseInChat}
                      className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-[#ff1744]/20 to-[#991b1b]/20 hover:from-[#ff1744]/30 hover:to-[#991b1b]/30 text-white border border-[#ff1744]/40 text-[11px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-[0_0_10px_rgba(255,23,68,0.2)]"
                    >
                      {usedInChat ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400">Inserted into Chat</span>
                        </>
                      ) : (
                        <>
                          <MessageSquarePlus className="w-3.5 h-3.5 text-[#ff1744]" />
                          <span>Use in Chat</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

              <p className="whitespace-pre-wrap text-sm font-medium leading-relaxed select-text text-slate-100">
                {translatedText}
              </p>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};
