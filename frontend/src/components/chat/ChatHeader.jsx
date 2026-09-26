import React from 'react';
import { Avatar } from '../ui/Avatar';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { useChat } from '../../context/ChatContext';
import { useCall } from '../../context/CallContext';
import {
  Pin,
  ArrowLeft,
  Users,
  Phone,
  Video
} from 'lucide-react';
import { formatTime } from '../../utils/formatters';

export const ChatHeader = ({
  conversation,
  onBack,
  onOpenProfile
}) => {
  const { user } = useAuth();
  const { onlineUsers, typingUsers } = useSocket();
  const { startCall, callState } = useCall();

  const isGroup = conversation?.type === 'group';
  const otherParticipant = !isGroup
    ? conversation?.participants?.find((p) => (p._id || p) !== user?._id)
    : null;

  const title = isGroup
    ? conversation.groupInfo?.name || 'Group Chat'
    : otherParticipant?.name || otherParticipant?.username || 'Chat';

  const avatar = isGroup
    ? conversation.groupInfo?.avatar
    : otherParticipant?.avatar;

  const isOnline = !isGroup && otherParticipant
    ? onlineUsers.has(otherParticipant._id?.toString() || otherParticipant.toString())
    : false;

  // Typing status for this conversation
  const currentTypers = (typingUsers[conversation?._id] || []).filter(
    (u) => u._id !== user?._id
  );
  const isTyping = currentTypers.length > 0;
  const typingText = isTyping
    ? currentTypers.length === 1
      ? `${currentTypers[0].name || 'Someone'} is typing...`
      : 'Multiple people typing...'
    : null;

  const handleStartAudioCall = (e) => {
    e.stopPropagation();
    if (!otherParticipant) return;
    startCall({
      conversationId: conversation._id,
      receiver: otherParticipant,
      callType: 'audio'
    });
  };

  const handleStartVideoCall = (e) => {
    e.stopPropagation();
    if (!otherParticipant) return;
    startCall({
      conversationId: conversation._id,
      receiver: otherParticipant,
      callType: 'video'
    });
  };

  return (
    <div className="nexa-chat-header h-16 px-4 sm:px-6 bg-[#08080c]/90 backdrop-blur-md border-b border-white/10 flex items-center justify-between flex-shrink-0 z-10">
      <div className="flex items-center gap-3 min-w-0">
        {/* Mobile back button */}
        <button
          onClick={onBack}
          className="md:hidden p-1.5 -ml-1 text-slate-400 hover:text-white rounded-lg cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        {/* Clickable Profile Area */}
        <div
          onClick={onOpenProfile}
          className="flex items-center gap-3 min-w-0 cursor-pointer group select-none"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onOpenProfile?.();
            }
          }}
          title={isGroup ? 'View Group Info & Media' : 'View Profile & Info'}
        >
          <div className="transition-transform group-hover:scale-105 duration-200">
            <Avatar
              src={avatar}
              name={title}
              size="md"
              isOnline={isOnline}
              showStatus={!isGroup}
            />
          </div>

          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-bold text-white truncate group-hover:text-[#ff1744] transition-colors">
              {title}
            </h2>
            <div className="flex items-center gap-1.5 text-xs">
              {isTyping ? (
                <span className="text-[#ff1744] font-semibold animate-pulse">
                  {typingText}
                </span>
              ) : isGroup ? (
                <span className="text-slate-400">
                  {conversation.participants?.length || 0} members
                </span>
              ) : isOnline ? (
                <span className="text-emerald-400 flex items-center gap-1.5 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" /> Online
                </span>
              ) : (
                <span className="text-slate-500">
                  Offline
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Right Action Controls: 1-to-1 Calling Buttons */}
      {!isGroup && otherParticipant && (
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Audio Call Button */}
          <button
            onClick={handleStartAudioCall}
            disabled={callState !== 'idle'}
            title={isOnline ? 'Start Audio Call' : 'User is offline'}
            className="p-2 sm:p-2.5 rounded-xl text-slate-300 hover:text-[#ff1744] hover:bg-white/5 active:scale-95 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <Phone className="w-5 h-5" />
          </button>

          {/* Video Call Button */}
          <button
            onClick={handleStartVideoCall}
            disabled={callState !== 'idle'}
            title={isOnline ? 'Start Video Call' : 'User is offline'}
            className="p-2 sm:p-2.5 rounded-xl text-slate-300 hover:text-[#ff1744] hover:bg-white/5 active:scale-95 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <Video className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
};
