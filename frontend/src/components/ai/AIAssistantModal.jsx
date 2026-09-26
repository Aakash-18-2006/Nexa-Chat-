import React, { useState, useEffect } from 'react';
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
  MessageSquarePlus
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

export const AIAssistantModal = ({ isOpen, onClose, conversation, initialTab = 'summary' }) => {
  const { user } = useAuth();
  const [tab, setTab] = useState(initialTab || 'summary');
  const [summary, setSummary] = useState('');
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [summaryCopied, setSummaryCopied] = useState(false);

  // Sync tab with initialTab when opening modal
  useEffect(() => {
    if (isOpen && initialTab) {
      setTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Translator state
  const [sourceLang, setSourceLang] = useState('en');
  const [targetLang, setTargetLang] = useState('ta');
  const [inputText, setInputText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [loadingTranslation, setLoadingTranslation] = useState(false);
  const [translationError, setTranslationError] = useState('');
  const [translationCopied, setTranslationCopied] = useState(false);
  const [usedInChat, setUsedInChat] = useState(false);

  // Reset modal state when switching conversations
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

  const handleGenerateSummary = async () => {
    if (!conversation?._id) return;
    setLoadingSummary(true);
    try {
      const res = await aiApi.summarizeChat(conversation._id);
      if (res.data.success) {
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

  // Translator functions
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
        setTranslationError('Network error. Please check your internet connection and try again.');
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
    // Dispatch custom event listened by MessageComposer
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
    <Modal isOpen={isOpen} onClose={onClose} title="NEXA AI Assistant" maxWidth="max-w-xl">
      {/* Active Conversation Context Banner */}
      {conversation && (
        <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-[#0a0a0f] border border-[#ff1744]/25 shadow-[0_0_15px_rgba(255,23,68,0.08)] text-xs text-slate-300 mb-4 select-none">
          <div className="w-5 h-5 rounded-md bg-[#ff1744]/15 flex items-center justify-center shrink-0 border border-[#ff1744]/30">
            <Sparkles className="w-3 h-3 text-[#ff1744]" />
          </div>
          <span className="truncate">
            Conversation Context: <strong className="text-white font-semibold">{conversationName}</strong>
          </span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex bg-[#050505] p-1 rounded-xl mb-5 border border-[#ff1744]/20 text-xs">
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

      {/* Tab 1: Summarize */}
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

      {/* Tab 2: Translator */}
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
