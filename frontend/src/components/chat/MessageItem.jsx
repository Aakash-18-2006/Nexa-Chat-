import React, { useState, useRef } from 'react';
import { Avatar } from '../ui/Avatar';
import { useCall } from '../../context/CallContext';
import { formatTime, formatFileSize, formatDuration } from '../../utils/formatters';
import { resolveMediaUrl } from '../../utils/urlConfig';
import {
  Check,
  CheckCheck,
  Reply,
  Pin,
  Edit2,
  Trash2,
  Copy,
  Smile,
  Play,
  Pause,
  FileText,
  Download,
  Phone,
  PhoneIncoming,
  PhoneMissed,
  PhoneOff,
  Video
} from 'lucide-react';

const COMMON_EMOJIS = ['👍', '❤️', '🔥', '😂', '🎉', '😮'];

export const MessageItem = React.memo(({
  message,
  isOwn,
  showAvatar,
  onReply,
  onEdit,
  onDelete,
  onPin,
  onReact,
  onCopy
}) => {
  const { startCall } = useCall();
  const [showReactionsPicker, setShowReactionsPicker] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const audioRef = useRef(null);

  if (message.type === 'system') {
    return (
      <div className="flex justify-center my-3">
        <span className="px-3.5 py-1 rounded-full bg-white/5 border border-white/5 text-[11px] font-medium text-slate-400 select-none">
          {message.content}
        </span>
      </div>
    );
  }

  // Call Event Message Card
  if (message.type === 'call') {
    const details = message.callDetails || {};
    const isVideo = details.callType === 'video';
    const status = details.status || 'ended';
    const duration = details.duration || 0;

    const isMissed = status === 'missed' || status === 'timeout';
    const isDeclined = status === 'declined' || status === 'rejected' || status === 'busy';
    const isCompleted = status === 'ended' || status === 'completed';

    const getStatusText = () => {
      if (isCompleted) {
        return duration > 0 ? `${formatDuration(duration)}` : 'Completed';
      }
      if (isMissed) return 'Missed call';
      if (isDeclined) return 'Declined';
      return status;
    };

    return (
      <div className={`flex my-2 select-none ${isOwn ? 'justify-end' : 'justify-start'}`}>
        <div
          className={`relative max-w-xs sm:max-w-sm p-3.5 rounded-2xl border transition-all ${
            isMissed
              ? 'bg-rose-950/20 border-rose-500/25 text-rose-300'
              : isDeclined
              ? 'bg-amber-950/20 border-amber-500/25 text-amber-300'
              : 'bg-[#0d0d18] border-white/10 text-slate-200 shadow-md'
          }`}
        >
          <div className="flex items-center gap-3">
            {/* Call Icon Badge */}
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                isMissed
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  : isDeclined
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              }`}
            >
              {isMissed ? (
                <PhoneMissed className="w-5 h-5" />
              ) : isDeclined ? (
                <PhoneOff className="w-5 h-5" />
              ) : isVideo ? (
                <Video className="w-5 h-5" />
              ) : (
                <Phone className="w-5 h-5" />
              )}
            </div>

            {/* Call Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-xs sm:text-sm font-bold truncate text-white">
                  {isVideo ? 'Video Call' : 'Audio Call'}
                </h4>
                <span className="text-[10px] text-slate-400 flex-shrink-0">
                  {formatTime(message.createdAt)}
                </span>
              </div>
              <p className="text-xs font-medium opacity-80 mt-0.5">
                {getStatusText()}
              </p>
            </div>
          </div>

          {/* Quick Callback Button if not own */}
          {!isOwn && (
            <div className="mt-2.5 pt-2 border-t border-white/10 flex justify-end">
              <button
                onClick={() =>
                  startCall({
                    conversationId: message.conversation,
                    receiver: message.sender,
                    callType: isVideo ? 'video' : 'audio'
                  })
                }
                className="text-[11px] font-semibold text-[#ff1744] hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {isVideo ? <Video className="w-3.5 h-3.5" /> : <Phone className="w-3.5 h-3.5" />}
                <span>Call back</span>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Audio Playback
  const toggleAudio = (url) => {
    if (!audioRef.current) {
      audioRef.current = new Audio(url);
      audioRef.current.onended = () => {
        setIsPlayingAudio(false);
        setAudioProgress(0);
      };
      audioRef.current.ontimeupdate = () => {
        if (audioRef.current && audioRef.current.duration) {
          setAudioProgress((audioRef.current.currentTime / audioRef.current.duration) * 100);
        }
      };
    }

    if (isPlayingAudio) {
      audioRef.current.pause();
      setIsPlayingAudio(false);
    } else {
      audioRef.current.play();
      setIsPlayingAudio(true);
    }
  };

  const isRead = message.readBy && message.readBy.length > 1;
  const isDelivered = message.deliveredTo && message.deliveredTo.length > 1;

  // Scroll to replied message and briefly highlight
  const scrollToReply = (replyId) => {
    if (!replyId) return;
    const target = document.getElementById(`msg-${replyId}`);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target.classList.add('ring-2', 'ring-[#ff1744]', 'ring-offset-2', 'ring-offset-black', 'rounded-2xl');
      setTimeout(() => {
        target.classList.remove('ring-2', 'ring-[#ff1744]', 'ring-offset-2', 'ring-offset-black', 'rounded-2xl');
      }, 2000);
    }
  };

  // Group reactions by emoji: { '🔥': [userIds] }
  const reactionCounts = (message.reactions || []).reduce((acc, r) => {
    acc[r.emoji] = (acc[r.emoji] || 0) + 1;
    return acc;
  }, {});

  return (
    <div
      id={`msg-${message._id}`}
      className={`group relative flex gap-2.5 my-1.5 transition-all duration-300 ${
        isOwn ? 'justify-end' : 'justify-start'
      }`}
    >
      {/* Recipient Avatar */}
      {!isOwn && (
        <div className="w-8 flex-shrink-0 self-end mb-1">
          {showAvatar && (
            <Avatar
              src={message.sender?.avatar}
              name={message.sender?.name || 'User'}
              size="sm"
              showStatus={false}
            />
          )}
        </div>
      )}

      {/* Message Content Container */}
      <div className={`relative max-w-[88%] sm:max-w-[70%] md:max-w-[60%] min-w-0`}>
        {/* Sender Name in group */}
        {!isOwn && showAvatar && (
          <span className="block text-[11px] font-semibold text-[#ff1744] mb-1 pl-1">
            {message.sender?.name || 'Member'}
          </span>
        )}

        {/* Reply Quote Banner */}
        {message.replyTo && !message.isDeleted && (
          <div
            onClick={() => scrollToReply(message.replyTo._id || message.replyTo)}
            title="Jump to original message"
            className={`mb-1 p-2 rounded-xl text-xs border-l-2 bg-black/40 cursor-pointer hover:bg-black/60 transition-colors ${
              isOwn
                ? 'border-[#ff1744] text-slate-200 font-medium'
                : 'border-[#991b1b] text-slate-300'
            }`}
          >
            <span className={`font-semibold block text-[11px] ${isOwn ? 'text-[#ff1744]' : 'text-[#ff2a55]'}`}>
              {message.replyTo.sender?.name || 'Replying to'}
            </span>
            <p className="truncate text-[11px] opacity-85">
              {message.replyTo.content || '[Attachment]'}
            </p>
          </div>
        )}

        {/* Bubble */}
        <div
          className={`relative px-4 py-2.5 rounded-2xl text-sm shadow-sm transition-all min-w-0 ${
            message.isDeleted
              ? 'bg-[#0d0d14] text-slate-400 italic border border-white/5'
              : isOwn
              ? 'nexa-message-sent bg-[#0d0f18] text-white font-medium rounded-br-sm border border-[#ff1744]/40 shadow-[0_0_15px_rgba(255,23,68,0.15)]'
              : 'nexa-message-received bg-[#0d0d14] text-slate-200 border border-white/10 rounded-bl-sm'
          }`}
        >
          {/* Pinned Tag */}
          {message.isPinned && (
            <div className="flex items-center gap-1 text-[10px] text-[#ff1744] font-semibold mb-1">
              <Pin className="w-2.5 h-2.5" /> Pinned
            </div>
          )}

          {/* Attachments */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="space-y-2 mb-2">
              {message.attachments.map((att, idx) => {
                const mediaUrl = resolveMediaUrl(att.url);
                if (message.type === 'image' || att.mimeType?.startsWith('image/')) {
                  return (
                    <a
                      key={idx}
                      href={mediaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block overflow-hidden rounded-xl border border-white/10 hover:opacity-95 transition-opacity"
                    >
                      <img
                        src={mediaUrl}
                        alt={att.name || 'Image'}
                        loading="lazy"
                        decoding="async"
                        className="max-h-72 max-w-full w-auto object-contain rounded-xl"
                      />
                    </a>
                  );
                }

                if (message.type === 'audio' || att.mimeType?.startsWith('audio/')) {
                  return (
                    <div
                      key={idx}
                      className="flex items-center gap-3 p-2.5 rounded-xl bg-black/40 border border-white/10"
                    >
                      <button
                        type="button"
                        onClick={() => toggleAudio(mediaUrl)}
                        className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#ff1744] via-[#d3121f] to-[#991b1b] text-white flex items-center justify-center cursor-pointer shadow-[0_0_10px_rgba(255,23,68,0.4)] hover:scale-105 transition-transform"
                      >
                        {isPlayingAudio ? (
                          <Pause className="w-4 h-4" />
                        ) : (
                          <Play className="w-4 h-4 ml-0.5" />
                        )}
                      </button>
                      <div className="flex-1 min-w-[80px] sm:min-w-[120px]">
                        <div className="h-1.5 w-full bg-black/40 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-[#ff1744] to-[#991b1b] transition-all"
                            style={{ width: `${audioProgress}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                          <span>Voice Note</span>
                          <span>{formatDuration(att.duration || 0)}</span>
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-black/25 border border-white/10 gap-3"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileText className="w-5 h-5 text-amber-400 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold truncate text-white">
                          {att.name}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {formatFileSize(att.size)}
                        </p>
                      </div>
                    </div>
                    <a
                      href={mediaUrl}
                      download={att.name}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                      title="Download"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  </div>
                );
              })}
            </div>
          )}

          {/* Text Content */}
          {message.content && (
            <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere] leading-relaxed text-[13.5px]">
              {message.content}
            </p>
          )}

          {/* Footer Time & Status */}
          <div className="flex items-center justify-end gap-1.5 mt-1 text-[10px] opacity-75">
            {message.isEdited && <span className="italic">(edited)</span>}
            <span>{formatTime(message.createdAt)}</span>
            {isOwn && (
              <span>
                {isRead ? (
                  <CheckCheck className="w-3.5 h-3.5 text-[#ff1744]" title="Read" />
                ) : isDelivered ? (
                  <CheckCheck className="w-3.5 h-3.5 text-slate-300" title="Delivered" />
                ) : (
                  <Check className="w-3.5 h-3.5 text-slate-300" title="Sent" />
                )}
              </span>
            )}
          </div>
        </div>

        {/* Reactions Badges */}
        {Object.keys(reactionCounts).length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {Object.entries(reactionCounts).map(([emoji, count]) => (
              <button
                key={emoji}
                onClick={() => onReact(message._id, emoji)}
                className="px-2 py-0.5 rounded-full bg-[#0a0a0f] border border-[#ff1744]/25 text-xs text-white hover:border-[#ff1744]/60 hover:shadow-[0_0_10px_rgba(255,23,68,0.2)] flex items-center gap-1 shadow-sm transition-all cursor-pointer"
              >
                <span>{emoji}</span>
                <span className="text-[10px] font-semibold text-slate-400">{count}</span>
              </button>
            ))}
          </div>
        )}

        {/* Hover Action Floating Bar */}
        {!message.isDeleted && (
          <div
            className={`absolute top-0 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-20 flex items-center gap-1 bg-[#0a0a0f]/95 border border-[#ff1744]/30 backdrop-blur-md rounded-full py-1 px-1.5 shadow-[0_0_15px_rgba(255,23,68,0.15)] ${
              isOwn ? 'right-2' : 'left-2'
            }`}
          >
            {/* Quick Reaction Emojis */}
            <div className="flex items-center gap-0.5 border-r border-white/10 pr-1">
              {COMMON_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => onReact(message._id, emoji)}
                  className="hover:scale-125 transition-transform text-xs p-1 cursor-pointer"
                >
                  {emoji}
                </button>
              ))}
            </div>

            <button
              onClick={() => onReply(message)}
              title="Reply"
              className="p-1 rounded-full text-slate-400 hover:text-[#ff1744] hover:bg-white/10 cursor-pointer"
            >
              <Reply className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => onPin(message._id)}
              title={message.isPinned ? 'Unpin' : 'Pin'}
              className={`p-1 rounded-full hover:bg-white/10 cursor-pointer ${
                message.isPinned ? 'text-[#ff1744]' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Pin className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => onCopy(message.content)}
              title="Copy Text"
              className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>

            {isOwn && (
              <button
                onClick={() => onEdit(message)}
                title="Edit"
                className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            )}

            {isOwn && (
              <button
                onClick={() => onDelete(message._id)}
                title="Delete"
                className="p-1 rounded-full text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

MessageItem.displayName = 'MessageItem';
