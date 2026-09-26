import React, { useState, useRef, useEffect } from 'react';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { chatApi } from '../../api/endpoints';
import { ChatHeader } from './ChatHeader';
import { PinnedBanner } from './PinnedBanner';
import { MessageList } from './MessageList';
import { MessageComposer } from './MessageComposer';
import { RightPanel } from './RightPanel';
import { UserProfileModal } from '../profile/UserProfileModal';
import { RadiantSunshineBackground } from '../ui/RadiantSunshineBackground';
import { RedBlackPulseBackground } from '../ui/RedBlackPulseBackground';
import { PainThemeBackground } from '../ui/PainThemeBackground';
import { ChatSpaceBackground } from './ChatSpaceBackground';
import { AnimatedGlowCircleButton } from '../ui/AnimatedGlowCircleButton';
import { Sparkles, FileText, Languages } from 'lucide-react';

export const ChatWindow = ({ onBack, onOpenAI, onOpenAddMember }) => {
  const { user } = useAuth();
  const { theme, backgroundTheme } = useTheme();
  const isLightTheme = theme === 'light';
  const [profileModalUserId, setProfileModalUserId] = useState(null);
  const [isSpeedDialOpen, setIsSpeedDialOpen] = useState(false);
  const speedDialRef = useRef(null);

  const {
    activeConversation,
    setActiveConversation,
    messages,
    setMessages,
    setReplyingTo,
    setEditingMessage,
    sendMessage,
    rightPanelTab,
    setRightPanelTab,
    getChatTheme
  } = useChat();

  // Speed-dial outside click and Escape key handling
  useEffect(() => {
    if (!isSpeedDialOpen) return;
    const handleOutsideClick = (e) => {
      if (speedDialRef.current && speedDialRef.current.contains(e.target)) {
        return;
      }
      setIsSpeedDialOpen(false);
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsSpeedDialOpen(false);
      }
    };
    window.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isSpeedDialOpen]);

  // Close speed dial when conversation changes
  useEffect(() => {
    setIsSpeedDialOpen(false);
  }, [activeConversation?._id]);

  const speedDialOptions = [
    {
      id: 'summary',
      label: 'Summarize Chat',
      icon: FileText,
      action: () => {
        setIsSpeedDialOpen(false);
        onOpenAI?.('summary');
      },
      delayOpen: '0.10s',
      delayClose: '0s'
    },
    {
      id: 'translator',
      label: 'Translator',
      icon: Languages,
      action: () => {
        setIsSpeedDialOpen(false);
        onOpenAI?.('translator');
      },
      delayOpen: '0.05s',
      delayClose: '0.05s'
    }
  ];

  if (!activeConversation) {
    const isCustomBg = backgroundTheme === 'red_black_pulse' || backgroundTheme === 'pain_theme';
    return (
      <div className={`nexa-chat-window nexa-chat-empty flex-1 h-full flex flex-col items-center justify-center text-slate-400 p-6 select-none relative overflow-hidden ${isCustomBg ? 'bg-transparent' : 'bg-[#050505] bg-[radial-gradient(circle_at_50%_40%,rgba(255,23,68,0.08),transparent_50%),radial-gradient(circle_at_80%_80%,rgba(153,27,27,0.06),transparent_40%)]'}`}>
        {backgroundTheme === 'red_black_pulse' && <RedBlackPulseBackground className="is-contained" />}
        {backgroundTheme === 'pain_theme' && <PainThemeBackground className="is-contained" />}
        <div className="relative z-10 flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-[#991b1b]/20 via-[#d3121f]/20 to-[#ff1744]/20 border border-[#ff1744]/40 text-[#ff1744] flex items-center justify-center mb-4 shadow-[0_0_25px_rgba(255,23,68,0.25)]">
            <span className="text-2xl font-black text-white">N</span>
          </div>
          <h3 className="text-lg font-bold text-white mb-1 tracking-tight">Select a Conversation</h3>
          <p className="text-xs text-slate-400 max-w-sm text-center leading-relaxed">
            Choose a contact from the sidebar, start a direct message, create a group, or join a temporary room.
          </p>
        </div>
      </div>
    );
  }

  // Reply handler
  const handleReply = (message) => {
    setReplyingTo(message);
  };

  // Edit handler
  const handleEdit = (message) => {
    setEditingMessage(message);
  };

  // Delete handler
  const handleDelete = async (messageId) => {
    if (!confirm('Delete this message?')) return;
    try {
      const res = await chatApi.deleteMessage(messageId);
      if (res.data.success) {
        setMessages((prev) =>
          prev.map((m) =>
            m._id === messageId
              ? { ...m, isDeleted: true, content: 'This message was deleted', attachments: [] }
              : m
          )
        );
      }
    } catch (err) {
      console.error('Failed to delete message:', err);
    }
  };

  // Pin / Unpin handler
  const handlePin = async (messageId) => {
    const isPinned = activeConversation.pinnedMessages?.some(
      (pm) => (pm._id || pm) === messageId
    );

    try {
      if (isPinned) {
        await chatApi.unpinMessage(activeConversation._id, messageId);
        setActiveConversation((prev) => ({
          ...prev,
          pinnedMessages: prev.pinnedMessages.filter((pm) => (pm._id || pm) !== messageId)
        }));
      } else {
        await chatApi.pinMessage(activeConversation._id, messageId);
        const msg = messages.find((m) => m._id === messageId);
        setActiveConversation((prev) => ({
          ...prev,
          pinnedMessages: [...(prev.pinnedMessages || []), msg || messageId]
        }));
      }
    } catch (err) {
      console.error('Failed to pin/unpin:', err);
    }
  };

  // Emoji reaction handler
  const handleReact = async (messageId, emoji) => {
    try {
      const res = await chatApi.reactToMessage(messageId, emoji);
      if (res.data.success) {
        setMessages((prev) =>
          prev.map((m) => (m._id === messageId ? { ...m, reactions: res.data.reactions } : m))
        );
      }
    } catch (err) {
      console.error('Failed to react:', err);
    }
  };

  // Copy handler
  const handleCopy = (content) => {
    if (content) {
      navigator.clipboard.writeText(content);
    }
  };

  // Jump to message
  const handleJumpToMessage = (messageId) => {
    const el = document.getElementById(`msg-${messageId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-[#ff1744]', 'rounded-2xl');
      setTimeout(() => {
        el.classList.remove('ring-2', 'ring-[#ff1744]', 'rounded-2xl');
      }, 1500);
    }
  };

  const lastMessage = messages[messages.length - 1];

  const isGroup = activeConversation.type === 'group';
  const otherParticipant = !isGroup
    ? activeConversation.participants?.find((p) => (p._id || p) !== user?._id)
    : null;
  const otherUserId = otherParticipant?._id || otherParticipant;
  const conversationId = activeConversation._id;

  // Selected chat background for this conversation / user
  const currentMode = isLightTheme ? 'light' : 'dark';
  const defaultBg = backgroundTheme === 'red_black_pulse'
    ? 'red_black_pulse'
    : backgroundTheme === 'pain_theme'
    ? 'pain_theme'
    : isLightTheme
    ? 'radiant_sunshine'
    : 'dark_background';

  const customChatTheme =
    (otherUserId ? getChatTheme(otherUserId, currentMode) : null) ||
    (conversationId ? getChatTheme(conversationId, currentMode) : null);

  const effectiveTheme = customChatTheme || defaultBg;
  const isTransparentBg = effectiveTheme === 'radiant_sunshine' || effectiveTheme === 'red_black_pulse' || effectiveTheme === 'pain_theme';

  return (
    <div className={`nexa-chat-window flex-1 h-full flex overflow-hidden relative ${isTransparentBg ? 'bg-transparent' : 'bg-[#050505]'}`}>
      {/* Selected Theme Background Layer (behind entire chat content, pointer-events: none) */}
      <div className="absolute inset-0 w-full h-full pointer-events-none z-0 overflow-hidden">
        {effectiveTheme === 'radiant_sunshine' ? (
          <RadiantSunshineBackground className="is-contained" />
        ) : effectiveTheme === 'red_black_pulse' ? (
          <RedBlackPulseBackground className="is-contained" />
        ) : effectiveTheme === 'pain_theme' ? (
          <PainThemeBackground className="is-contained" />
        ) : (
          <ChatSpaceBackground />
        )}
      </div>

      {/* Chat UI (Stacked above the selected background: z-10) */}
      <div className="relative z-10 flex-1 h-full flex flex-col min-w-0">
        <ChatHeader
          conversation={activeConversation}
          onBack={onBack}
          onOpenProfile={() => {
            if (activeConversation.type === 'group') {
              setRightPanelTab((prev) => (prev ? null : 'info'));
            } else {
              if (otherParticipant) {
                setProfileModalUserId(otherUserId);
              }
            }
          }}
        />

        <PinnedBanner
          conversation={activeConversation}
          onJumpToMessage={handleJumpToMessage}
          onUnpin={(msgId) => handlePin(msgId)}
        />

        {/* Message scroll area with floating Nexa AI button */}
        <div className="flex-1 min-h-0 relative flex flex-col overflow-hidden">
          <div className="relative z-10 flex-1 min-h-0 flex flex-col">
            <MessageList
              messages={messages}
              conversation={activeConversation}
              onReply={handleReply}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onPin={handlePin}
              onReact={handleReact}
              onCopy={handleCopy}
            />
          </div>

          {/* Subtle Backdrop for Nexa AI Speed-Dial Menu */}
          <div
            onClick={() => setIsSpeedDialOpen(false)}
            aria-hidden="true"
            className={`absolute inset-0 z-20 transition-opacity duration-300 ${
              isSpeedDialOpen
                ? 'opacity-100 pointer-events-auto bg-black/40 backdrop-blur-[2px]'
                : 'opacity-0 pointer-events-none'
            }`}
          />

          {/* Floating Nexa AI Speed-Dial Container (Lower Right Anchored) */}
          <div
            ref={speedDialRef}
            className="absolute bottom-1 right-4 sm:bottom-1.5 sm:right-6 z-30 pointer-events-auto flex flex-col items-end"
          >
            {/* Speed-Dial Sub-Options */}
            <div
              className={`flex flex-col items-end gap-2.5 mb-2.5 ${
                isSpeedDialOpen ? 'pointer-events-auto' : 'pointer-events-none'
              }`}
              role="menu"
              aria-orientation="vertical"
              aria-hidden={!isSpeedDialOpen}
            >
              {speedDialOptions.map((opt) => {
                const Icon = opt.icon;
                return (
                  <div
                    key={opt.id}
                    onClick={opt.action}
                    role="menuitem"
                    tabIndex={isSpeedDialOpen ? 0 : -1}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        opt.action();
                      }
                    }}
                    style={{
                      transition:
                        'opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1), transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                      transitionDelay: isSpeedDialOpen ? opt.delayOpen : opt.delayClose
                    }}
                    className={`group flex items-center gap-2.5 cursor-pointer select-none ${
                      isSpeedDialOpen
                        ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto'
                        : 'opacity-0 translate-y-5 scale-80 pointer-events-none'
                    }`}
                  >
                    {/* Label Pill */}
                    <span className="nexa-speed-dial-label px-3 py-1.5 rounded-xl text-xs font-semibold shadow-sm transition-all duration-200">
                      {opt.label}
                    </span>

                    {/* Sub-Option Round Button */}
                    <div className="nexa-speed-dial-btn w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 group-hover:scale-110 active:scale-95 shadow-md">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-[#ff1744] via-[#d3121f] to-[#991b1b] text-white flex items-center justify-center shadow-[0_0_8px_rgba(255,23,68,0.4)] group-hover:rotate-12 transition-transform duration-300">
                        <Icon className="w-3.5 h-3.5 text-white" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Main Nexa AI Button */}
            <AnimatedGlowCircleButton
              id="floating-nexa-ai-btn"
              onClick={() => setIsSpeedDialOpen((prev) => !prev)}
              icon={Sparkles}
              ariaLabel="Nexa AI Assistant"
              isOpen={isSpeedDialOpen}
            />
          </div>
        </div>

        <MessageComposer />
      </div>

      {rightPanelTab && (
        <RightPanel
          conversation={activeConversation}
          onClose={() => setRightPanelTab(null)}
          onOpenAddMember={onOpenAddMember}
        />
      )}

      {profileModalUserId && (
        <UserProfileModal
          userId={profileModalUserId}
          isOpen={!!profileModalUserId}
          onClose={() => setProfileModalUserId(null)}
          onOpenInfoMedia={() => {
            setProfileModalUserId(null);
            setRightPanelTab('info');
          }}
        />
      )}
    </div>
  );
};
