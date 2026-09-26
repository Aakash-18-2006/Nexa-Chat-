import React, { useEffect, useRef } from 'react';
import { MessageItem } from './MessageItem';
import { formatDate } from '../../utils/formatters';
import { MessageSquare } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';

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
  const scrollEndRef = useRef(null);

  // Auto-scroll on new message
  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUsers]);

  // Typing users
  const currentTypers = (typingUsers[conversation?._id] || []).filter(
    (u) => u._id !== user?._id
  );

  // Group messages by date
  let lastDateStr = null;

  return (
    <div
      className="nexa-message-stream flex-1 overflow-y-auto px-4 sm:px-6 pt-4 pb-14 space-y-1 relative z-10"
      style={{
        scrollBehavior: 'smooth',
        overscrollBehavior: 'contain',
        WebkitOverflowScrolling: 'touch',
        willChange: 'scroll-position',
        transform: 'translateZ(0)',
      }}
    >
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
