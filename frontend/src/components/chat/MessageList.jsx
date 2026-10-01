import React, { useEffect, useRef, useState, useLayoutEffect } from 'react';
import { MessageItem } from './MessageItem';
import { formatDate } from '../../utils/formatters';
import { MessageSquare, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { useChat } from '../../context/ChatContext';

export const MessageList = ({
  messages = [],
  conversation,
  onReply,
  onEdit,
  onDelete,
  onPin,
  onReact,
  onCopy
}) => {
  const { user } = useAuth();
  const { typingUsers } = useSocket();
  const { hasMoreMessages, loadingOlder, loadOlderMessages } = useChat();

  const containerRef = useRef(null);
  const scrollEndRef = useRef(null);
  const prevScrollHeightRef = useRef(0);
  const isPrependingRef = useRef(false);
  const isInitialLoadRef = useRef(true);

  // Reset scroll and tracking when conversation changes
  useEffect(() => {
    isInitialLoadRef.current = true;
  }, [conversation?._id]);

  // Handle auto-scroll on new message vs preserving scroll on load older
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (isPrependingRef.current) {
      // User loaded older messages - restore relative scroll position
      const scrollDiff = container.scrollHeight - prevScrollHeightRef.current;
      container.scrollTop += scrollDiff;
      isPrependingRef.current = false;
    } else if (isInitialLoadRef.current) {
      // First load of conversation: scroll straight to the bottom
      scrollEndRef.current?.scrollIntoView({ behavior: 'auto' });
      isInitialLoadRef.current = false;
    } else {
      // Check if user is near bottom before auto-scrolling
      const isNearBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight < 180;
      if (isNearBottom) {
        scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [messages]);

  // Scroll listener for upward infinite loading
  const handleScroll = (e) => {
    const target = e.currentTarget;
    if (target.scrollTop < 60 && hasMoreMessages && !loadingOlder) {
      prevScrollHeightRef.current = target.scrollHeight;
      isPrependingRef.current = true;
      loadOlderMessages();
    }
  };

  // Typing users
  const currentTypers = (typingUsers[conversation?._id] || []).filter(
    (u) => u._id !== user?._id
  );

  // Group messages by date
  let lastDateStr = null;

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="nexa-message-stream flex-1 overflow-y-auto px-4 sm:px-6 pt-4 pb-14 space-y-1 relative z-10"
      style={{
        scrollBehavior: 'auto',
        overscrollBehavior: 'contain',
        WebkitOverflowScrolling: 'touch',
        willChange: 'scroll-position',
        transform: 'translateZ(0)',
      }}
    >
      {/* Top spinner when fetching older messages */}
      {loadingOlder && (
        <div className="flex justify-center py-2">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-slate-400 select-none shadow-sm">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#ff1744]" />
            Loading older messages...
          </span>
        </div>
      )}
      {messages.length === 0 ? (
        <div className="h-full flex flex-col items-center justify-center text-center p-6 select-none opacity-60">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mb-3">
            <MessageSquare className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-white">No messages yet</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-xs">
            Send a message, voice note, or photo to start this real-time conversation!
          </p>
        </div>
      ) : (
        messages.map((msg, index) => {
          const dateStr = formatDate(msg.createdAt);
          const showDateHeader = dateStr !== lastDateStr;
          lastDateStr = dateStr;

          const isOwn = (msg.sender?._id || msg.sender) === user?._id;
          const nextMsg = messages[index + 1];
          const isLastInSequence =
            !nextMsg || (nextMsg.sender?._id || nextMsg.sender) !== (msg.sender?._id || msg.sender);

          return (
            <React.Fragment key={msg._id || index}>
              {showDateHeader && (
                <div className="flex justify-center my-4">
                  <span className="px-3 py-1 rounded-full bg-white/5 border border-white/5 text-[11px] font-semibold text-slate-400 select-none shadow-sm">
                    {dateStr}
                  </span>
                </div>
              )}

              <MessageItem
                message={msg}
                isOwn={isOwn}
                showAvatar={conversation?.type === 'group' && isLastInSequence}
                onReply={onReply}
                onEdit={onEdit}
                onDelete={onDelete}
                onPin={onPin}
                onReact={onReact}
                onCopy={onCopy}
              />
            </React.Fragment>
          );
        })
      )}

      {/* Typing Bubble Animation */}
      {currentTypers.length > 0 && (
        <div className="flex items-center gap-2 py-2">
          <div className="px-4 py-2.5 rounded-2xl rounded-bl-sm bg-[#19202e] border border-white/5 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" />
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:0.2s]" />
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:0.4s]" />
          </div>
          <span className="text-xs text-slate-500">
            {currentTypers[0]?.name || 'Someone'} is typing...
          </span>
        </div>
      )}

      <div ref={scrollEndRef} />
    </div>
  );
};
