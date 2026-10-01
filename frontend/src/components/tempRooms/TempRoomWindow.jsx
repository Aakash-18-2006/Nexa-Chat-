import React, { useState, useEffect, useRef } from 'react';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Avatar } from '../ui/Avatar';
import { formatTime } from '../../utils/formatters';
import { ChatSpaceBackground } from '../chat/ChatSpaceBackground';
import { RedBlackPulseBackground } from '../ui/RedBlackPulseBackground';
import { PainThemeBackground } from '../ui/PainThemeBackground';
import {
  Clock,
  Copy,
  Check,
  LogOut,
  Send,
  Sparkles,
  Users,
  ShieldAlert,
  ArrowLeft
} from 'lucide-react';

export const TempRoomWindow = ({ onBack }) => {
  const { user } = useAuth();
  const { theme, backgroundTheme } = useTheme();
  const isLightTheme = theme === 'light';
  const { activeTempRoom, tempMessages, sendTempMessage, leaveTempRoom } = useChat();

  const [text, setText] = useState('');
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState('');
  const scrollEndRef = useRef(null);

  // Auto-scroll
  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [tempMessages]);

  // Live countdown timer
  useEffect(() => {
    if (!activeTempRoom?.expiresAt) return;

    const updateTimer = () => {
      const now = new Date().getTime();
      const expiry = new Date(activeTempRoom.expiresAt).getTime();
      const diff = expiry - now;

      if (diff <= 0) {
        setTimeLeft('Expired');
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeft(`${hours > 0 ? hours + 'h ' : ''}${minutes}m ${seconds}s`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [activeTempRoom?.expiresAt]);

  const copyCode = () => {
    if (activeTempRoom?.code) {
      navigator.clipboard.writeText(activeTempRoom.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSend = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    sendTempMessage(text);
    setText('');
  };

  if (!activeTempRoom) return null;

  return (
    <div className="nexa-chat-window flex-1 h-full flex flex-col bg-[#050505]">
      {/* Header */}
      <div className="h-16 px-3 sm:px-6 bg-[#08080d]/90 backdrop-blur-md border-b border-[#ff1744]/15 flex items-center justify-between flex-shrink-0 z-10 gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {onBack && (
            <button
              onClick={onBack}
              className="md:hidden p-1.5 -ml-1 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer shrink-0"
              title="Back to conversations"
              aria-label="Back to conversations"
            >
              <ArrowLeft className="w-5 h-5 text-[#ff1744]" />
            </button>
          )}
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-[#ff1744] via-[#d3121f] to-[#991b1b] text-white flex items-center justify-center font-bold shadow-[0_0_12px_rgba(255,23,68,0.3)] shrink-0">
            <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <h2 className="text-sm sm:text-base font-bold text-white truncate">
                {activeTempRoom.name || 'Temporary Room'}
              </h2>
              <span className="px-1.5 sm:px-2 py-0.5 rounded-md bg-[#ff1744]/15 text-[#ff1744] font-mono text-[10px] sm:text-xs border border-[#ff1744]/30 shrink-0">
                #{activeTempRoom.code}
              </span>
            </div>
            <div className="flex items-center gap-1 sm:gap-1.5 text-[11px] sm:text-xs text-[#ff1744]">
              <Clock className="w-3 h-3 shrink-0" />
              <span className="truncate">Expires in: {timeLeft || 'Calculating...'}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Share Room Code Button */}
          <button
            onClick={copyCode}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-white/5 hover:bg-[#ff1744]/20 border border-white/10 hover:border-[#ff1744]/30 text-xs font-semibold text-slate-200 transition-colors cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400 hidden xs:inline">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-[#ff1744]" />
                <span className="hidden xs:inline">Copy Code</span>
              </>
            )}
          </button>

          {/* Leave Room Button */}
          <button
            onClick={leaveTempRoom}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-semibold transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Leave Room</span>
          </button>
        </div>
      </div>

      {/* Info Banner */}
      <div className="px-3 sm:px-6 py-2 bg-[#0a0a0f] border-b border-[#ff1744]/15 text-[11px] sm:text-xs text-[#ff1744] flex items-center justify-between">
        <span className="flex items-center gap-1.5 leading-snug">
          <ShieldAlert className="w-4 h-4 text-[#ff1744] shrink-0" />
          <span>Messages in this room are ephemeral and delete automatically upon expiration.</span>
        </span>
      </div>

      {/* Message List */}
      <div className="flex-1 min-h-0 relative flex flex-col overflow-hidden">
        {/* Animated background layer */}
        {backgroundTheme === 'red_black_pulse' ? (
          <RedBlackPulseBackground className="is-contained" />
        ) : backgroundTheme === 'pain_theme' ? (
          <PainThemeBackground className="is-contained" />
        ) : !isLightTheme ? (
          <ChatSpaceBackground />
        ) : null}

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-2 relative z-10">
          {tempMessages.map((msg, idx) => {
            if (msg.type === 'system') {
              return (
                <div key={idx} className="flex justify-center my-2">
                  <span className="px-3 py-1 rounded-full bg-white/5 border border-white/5 text-[11px] text-slate-400">
                    {msg.content}
                  </span>
                </div>
              );
            }

            const isOwn = (msg.senderId?._id || msg.senderId) === user?._id;

            return (
              <div
                key={idx}
                className={`flex items-start gap-2.5 my-1.5 ${
                  isOwn ? 'justify-end' : 'justify-start'
                }`}
              >
                {!isOwn && (
                  <Avatar
                    src={msg.senderAvatar}
                    name={msg.senderName || 'Member'}
                    size="sm"
                    showStatus={false}
                  />
                )}

                <div className="max-w-[85%] sm:max-w-[75%] min-w-0">
                  {!isOwn && (
                    <span className="block text-[11px] font-semibold text-[#ff1744] mb-0.5 truncate">
                      {msg.senderName || 'Member'}
                    </span>
                  )}
                  <div
                    className={`px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-2xl text-xs sm:text-sm break-words [overflow-wrap:anywhere] ${
                      isOwn
                        ? 'nexa-message-sent bg-[#0d0f18] text-white border border-[#ff1744]/40 shadow-[0_0_15px_rgba(255,23,68,0.15)] rounded-br-sm'
                        : 'nexa-message-received bg-[#0d0d14] text-slate-200 border border-white/10 rounded-bl-sm'
                    }`}
                  >
                    <p className="whitespace-pre-wrap leading-relaxed break-words [overflow-wrap:anywhere]">{msg.content}</p>
                    <span className="block text-[10px] text-right mt-1 opacity-75">
                      {formatTime(msg.createdAt)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={scrollEndRef} />
        </div>
      </div>

      {/* Temp Composer */}
      <form
        onSubmit={handleSend}
        className="p-3 sm:p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-[#08080d]/90 backdrop-blur-md border-t border-[#ff1744]/15 flex items-center gap-2"
      >
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Send a temporary message..."
          className="flex-1 bg-[#050505] border border-[#ff1744]/25 rounded-2xl px-3.5 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#ff1744] focus:shadow-[0_0_12px_rgba(255,23,68,0.25)] transition-all min-w-0"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          className="p-2 sm:p-2.5 rounded-2xl bg-gradient-to-r from-[#ff1744] via-[#d3121f] to-[#991b1b] hover:brightness-110 active:scale-95 disabled:opacity-40 text-white shadow-[0_0_15px_rgba(255,23,68,0.3)] transition-all cursor-pointer shrink-0"
        >
          <Send className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>
      </form>
    </div>
  );
};
