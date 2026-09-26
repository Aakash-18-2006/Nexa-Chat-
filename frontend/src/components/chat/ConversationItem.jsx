import React, { useRef } from 'react';
import { Avatar } from '../ui/Avatar';
import { Users, Pin, Check } from 'lucide-react';
import { formatTime } from '../../utils/formatters';

export const ConversationItem = ({
  conversation,
  active,
  onClick,
  currentUserId,
  onlineUsers,
  isSelectionMode,
  isSelected,
  onToggleSelect,
  onContextMenu
}) => {
  const isGroup = conversation.type === 'group';
  const longPressTimerRef = useRef(null);
  const touchStartPosRef = useRef({ x: 0, y: 0 });

  // For direct chats, find the other participant
  const otherParticipant = !isGroup
    ? conversation.participants?.find((p) => (p._id || p) !== currentUserId)
    : null;

  const title = isGroup
    ? conversation.groupInfo?.name || 'Group Chat'
    : otherParticipant?.name || otherParticipant?.username || 'Chat';

  const avatar = isGroup
    ? conversation.groupInfo?.avatar
    : otherParticipant?.avatar;

  const isOnline = !isGroup && otherParticipant
    ? onlineUsers?.has(otherParticipant._id?.toString() || otherParticipant.toString())
    : false;

  const isPinned = conversation.pinnedBy?.some(
    (uid) => (uid._id || uid).toString() === currentUserId?.toString()
  );

  const lastMsg = conversation.lastMessage;
  const lastTime = lastMsg?.createdAt || conversation.updatedAt;

  let lastSnippet = 'No messages yet';
  if (lastMsg) {
    if (lastMsg.isDeleted) {
      lastSnippet = 'This message was deleted';
    } else if (lastMsg.type === 'audio') {
      lastSnippet = '🎙️ Voice message';
    } else if (lastMsg.type === 'image') {
      lastSnippet = '📷 Photo';
    } else if (lastMsg.type === 'file') {
      lastSnippet = '📎 Document';
    } else if (lastMsg.type === 'system') {
      lastSnippet = lastMsg.content;
    } else {
      lastSnippet = lastMsg.content || '';
    }
  }

  // Mobile long-press handlers
  const handleTouchStart = (e) => {
    if (isSelectionMode) return;
    const touch = e.touches[0];
    touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
    longPressTimerRef.current = setTimeout(() => {
      if (onContextMenu) {
        onContextMenu(
          {
            preventDefault: () => {},
            clientX: touch.clientX,
            clientY: touch.clientY
          },
          conversation
        );
      }
    }, 500);
  };

  const handleTouchMove = (e) => {
    if (!longPressTimerRef.current) return;
    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - touchStartPosRef.current.x);
    const dy = Math.abs(touch.clientY - touchStartPosRef.current.y);
    if (dx > 10 || dy > 10) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleClick = (e) => {
    if (isSelectionMode) {
      e.preventDefault();
      e.stopPropagation();
      if (onToggleSelect) {
        onToggleSelect(conversation._id);
      }
    } else {
      onClick?.(e);
    }
  };

  return (
    <div
      onClick={handleClick}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu?.(e, conversation);
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-2xl cursor-pointer transition-all select-none ${
        isSelected
          ? 'bg-[#ff1744]/15 border border-[#ff1744]/40 text-white shadow-[0_0_15px_rgba(255,23,68,0.2)]'
          : active && !isSelectionMode
          ? 'bg-[#ff1744]/10 border border-[#ff1744]/30 text-white shadow-[0_0_15px_rgba(255,23,68,0.12)]'
          : 'hover:bg-white/5 border border-transparent text-slate-300'
      }`}
    >
      {/* Active Conversation Indicator Bar */}
      {active && !isSelectionMode && !isSelected && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-gradient-to-b from-[#ff1744] to-[#991b1b] shadow-[0_0_10px_rgba(255,23,68,0.7)]" />
      )}

      {/* Select Mode Checkbox */}
      {isSelectionMode && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect?.(conversation._id);
          }}
          className="flex-shrink-0 flex items-center justify-center cursor-pointer"
        >
          <div
            className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-all ${
              isSelected
                ? 'bg-gradient-to-r from-[#ff1744] to-[#991b1b] border-transparent text-white shadow-[0_0_10px_rgba(255,23,68,0.5)]'
                : 'border-white/20 hover:border-[#ff1744]/60 bg-white/5'
            }`}
          >
            {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
          </div>
        </div>
      )}

      {/* Avatar & Online / Group Indicators */}
      <div className="relative flex-shrink-0">
        <Avatar
          src={avatar}
          name={title}
          size="md"
          isOnline={isOnline}
          showStatus={!isGroup}
        />
        {isGroup && (
          <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#0d0d14] border border-[#ff1744]/40 flex items-center justify-center text-[#ff1744]">
            <Users className="w-2.5 h-2.5" />
          </div>
        )}
      </div>

      {/* Title & Preview Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1 mb-0.5">
          <div className="flex items-center gap-1.5 truncate">
            <h4
              className={`text-sm font-semibold truncate ${
                isSelected || active
                  ? 'text-[#ff1744] font-bold'
                  : 'text-slate-200 group-hover:text-white'
              }`}
            >
              {title}
            </h4>
            {isPinned && (
              <span title="Pinned conversation" className="flex-shrink-0">
                <Pin className="w-3 h-3 text-[#ff1744] fill-[#ff1744]/30 rotate-45" />
              </span>
            )}
          </div>

          <span className="text-[11px] text-slate-500 flex-shrink-0">
            {formatTime(lastTime)}
          </span>
        </div>

        <p className="text-xs text-slate-400 truncate pr-2">
          {lastSnippet}
        </p>
      </div>
    </div>
  );
};
