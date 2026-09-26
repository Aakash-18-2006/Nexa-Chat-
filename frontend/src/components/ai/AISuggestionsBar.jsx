import React, { useState, useEffect } from 'react';
import { aiApi } from '../../api/endpoints';
import { Sparkles, RefreshCw } from 'lucide-react';

export const AISuggestionsBar = ({ conversationId, onSelectSuggestion, lastMessageId }) => {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchSuggestions = async () => {
    if (!conversationId) return;
    setLoading(true);
    try {
      const res = await aiApi.getSuggestions(conversationId);
      if (res.data.success && res.data.suggestions) {
        setSuggestions(res.data.suggestions);
      }
    } catch (err) {
      console.warn('Failed to fetch AI suggestions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuggestions();
  }, [conversationId, lastMessageId]);

  if (!suggestions || suggestions.length === 0) return null;

  return (
    <div className="px-4 py-2 border-t border-white/10 bg-[#08080c]/80 backdrop-blur-md flex items-center gap-2 overflow-x-auto select-none">
      <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#ff1744] flex-shrink-0">
        <Sparkles className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">AI Replies:</span>
      </div>

      <div className="flex items-center gap-1.5 flex-1 overflow-x-auto no-scrollbar">
        {suggestions.map((text, idx) => (
          <button
            key={idx}
            onClick={() => onSelectSuggestion(text)}
            className="text-xs px-3 py-1 rounded-full bg-[#0a0a0f] hover:bg-[#ff1744]/15 hover:border-[#ff1744]/60 border border-[#ff1744]/20 text-slate-200 hover:text-white transition-all whitespace-nowrap cursor-pointer shadow-sm hover:shadow-[0_0_12px_rgba(255,23,68,0.2)]"
          >
            "{text}"
          </button>
        ))}
      </div>

      <button
        onClick={fetchSuggestions}
        disabled={loading}
        title="Refresh AI suggestions"
        className="p-1 rounded-lg text-slate-500 hover:text-[#ff1744] hover:bg-white/5 transition-colors flex-shrink-0 cursor-pointer"
      >
        <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
      </button>
    </div>
  );
};
