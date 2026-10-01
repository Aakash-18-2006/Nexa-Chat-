import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { useSocket } from '../../context/SocketContext';
import { useNotifications } from '../../context/NotificationContext';
import { ConversationItem } from './ConversationItem';
import { Avatar } from '../ui/Avatar';
import { Modal } from '../ui/Modal';
import { NexaSearchBar } from '../ui/NexaSearchBar';
import { AnimatedGlowButton } from '../ui/AnimatedGlowButton';
import { chatApi } from '../../api/endpoints';
import {
  MessageSquare,
  MessageSquarePlus,
  Bell,
  Search,
  Users,
  Clock,
  Settings,
  LogOut,
  MessageCircle,
  CheckSquare,
  Pin,
  PinOff,
  Trash2,
  X,
  AlertTriangle,
  Loader2,
  Check,
  Smartphone
} from 'lucide-react';

export const Sidebar = ({
  activeSection = 'all',
  onChangeSection,
  onOpenSearch,
  onOpenNewChat,
  onOpenNewGroup,
  onOpenTempRoom,
  onOpenSettings,
  onOpenMyProfile
}) => {
  const { user, logout } = useAuth();
  const {
    conversations,
    activeConversation,
    selectConversation,
    setActiveConversation,
    fetchConversations
  } = useChat();
  const { onlineUsers } = useSocket();
  const { unreadCount = 0, toggleNotifications } = useNotifications() || {};

  const [localSearch, setLocalSearch] = useState('');

  // Context Menu State
  const [contextMenu, setContextMenu] = useState({
    isOpen: false,
    x: 0,
    y: 0,
    conversation: null
  });

  // Multi-select Mode State
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Delete Confirmation Modal State
  const [deleteConfirmModal, setDeleteConfirmModal] = useState({
    isOpen: false,
    conversationIds: [],
    count: 0,
    isDeleting: false
  });

  const contextMenuRef = useRef(null);

  const currentTab = activeSection || 'all';
  const handleTabSelect = (tab) => {
    if (onChangeSection) {
      onChangeSection(tab);
    }
  };

  // Close context menu on outside click or escape
  useEffect(() => {
    if (!contextMenu.isOpen) return;

    const handleOutsideClick = (e) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target)) {
        setContextMenu({ isOpen: false, x: 0, y: 0, conversation: null });
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setContextMenu({ isOpen: false, x: 0, y: 0, conversation: null });
      }
    };

    window.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('touchstart', handleOutsideClick);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('touchstart', handleOutsideClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [contextMenu.isOpen]);

  const filteredConversations = conversations.filter((conv) => {
    // Tab filter
    if (currentTab === 'direct' && conv.type !== 'direct') return false;
    if (currentTab === 'groups' && conv.type !== 'group') return false;

    // Search query filter
    if (!localSearch.trim()) return true;
    const q = localSearch.toLowerCase();
    if (conv.type === 'group') {
      return conv.groupInfo?.name?.toLowerCase().includes(q);
    }
    const other = conv.participants?.find((p) => (p._id || p) !== user?._id);
    return (
      other?.name?.toLowerCase().includes(q) ||
      other?.username?.toLowerCase().includes(q)
    );
  });

  // Open Context Menu on Right-Click or Long-Press
  const handleContextMenu = (e, conversation) => {
    if (isSelectionMode) return;

    const menuWidth = 190;
    const menuHeight = 155;
    const posX = Math.min(e.clientX, window.innerWidth - menuWidth - 12);
    const posY = Math.min(e.clientY, window.innerHeight - menuHeight - 12);

    setContextMenu({
      isOpen: true,
      x: Math.max(10, posX),
      y: Math.max(10, posY),
      conversation
    });
  };

  // Context Menu Action: Select
  const handleSelectFromMenu = () => {
    const conv = contextMenu.conversation;
    setContextMenu({ isOpen: false, x: 0, y: 0, conversation: null });
    if (!conv) return;

    setIsSelectionMode(true);
    setSelectedIds(new Set([conv._id]));
  };

  // Context Menu Action: Pin / Unpin
  const handleTogglePinFromMenu = async () => {
    const conv = contextMenu.conversation;
    setContextMenu({ isOpen: false, x: 0, y: 0, conversation: null });
    if (!conv) return;

    try {
      await chatApi.pinConversation(conv._id);
      await fetchConversations();
    } catch (err) {
      console.error('Pin error:', err);
      alert(err.response?.data?.message || 'Failed to update conversation pin');
    }
  };

  // Context Menu Action: Delete single conversation
  const handleDeleteFromMenu = () => {
    const conv = contextMenu.conversation;
    setContextMenu({ isOpen: false, x: 0, y: 0, conversation: null });
    if (!conv) return;

    setDeleteConfirmModal({
      isOpen: true,
      conversationIds: [conv._id],
      count: 1,
      isDeleting: false
    });
  };

  // Selection Mode: Toggle Item Selection
  const handleToggleSelect = (convId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(convId)) {
        next.delete(convId);
      } else {
        next.add(convId);
      }
      return next;
    });
  };

  // Selection Mode: Select All / Deselect All
  const handleToggleSelectAll = () => {
    if (selectedIds.size === filteredConversations.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredConversations.map((c) => c._id)));
    }
  };

  // Selection Mode: Cancel / Exit
  const handleCancelSelection = () => {
    setIsSelectionMode(false);
    setSelectedIds(new Set());
  };

  // Selection Mode: Trigger Delete on Selected
  const handleDeleteSelected = () => {
    if (selectedIds.size === 0) return;
    setDeleteConfirmModal({
      isOpen: true,
      conversationIds: Array.from(selectedIds),
      count: selectedIds.size,
      isDeleting: false
    });
  };

  // Confirm Delete Action (Single or Multiple)
  const handleConfirmDelete = async () => {
    const ids = deleteConfirmModal.conversationIds;
    if (!ids || ids.length === 0) return;

    try {
      setDeleteConfirmModal((prev) => ({ ...prev, isDeleting: true }));

      if (ids.length === 1) {
        await chatApi.deleteConversation(ids[0]);
      } else {
        await chatApi.deleteMultipleConversations(ids);
      }

      // If active conversation was deleted, deselect it
      if (activeConversation && ids.includes(activeConversation._id)) {
        setActiveConversation(null);
      }

      await fetchConversations();

      setDeleteConfirmModal({
        isOpen: false,
        conversationIds: [],
        count: 0,
        isDeleting: false
      });

      // Exit selection mode if active
      setIsSelectionMode(false);
      setSelectedIds(new Set());
    } catch (err) {
      console.error('Delete error:', err);
      alert(err.response?.data?.message || 'Failed to delete conversation');
      setDeleteConfirmModal((prev) => ({ ...prev, isDeleting: false }));
    }
  };

  const isCurrentMenuPinned = contextMenu.conversation?.pinnedBy?.some(
    (uid) => (uid._id || uid).toString() === user?._id?.toString()
  );

  return (
    <>
      <aside className="nexa-sidebar w-full md:w-80 lg:w-96 h-full bg-[#08080d] border-r border-white/10 flex flex-col flex-shrink-0 select-none">
        {/* Top Brand Bar */}
        <div className="nexa-sidebar-brand px-4 sm:px-5 py-3.5 sm:py-4 flex items-center justify-between border-b border-white/10 min-h-[60px] sm:min-h-[69px] bg-white/[0.01]">
          <div className="flex items-center gap-2.5">
            {/* Mobile avatar / profile button */}
            <button
              type="button"
              onClick={onOpenMyProfile}
              className="md:hidden flex-shrink-0 cursor-pointer focus:outline-none"
              title="My Profile"
            >
              <Avatar user={user} size="sm" showOnline={false} />
            </button>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white leading-none">NEXA</h1>
              <span className="text-xs bg-gradient-to-r from-[#ff1744] via-[#d3121f] to-[#ff2a55] bg-clip-text text-transparent font-semibold tracking-wide uppercase">
                Conversations
              </span>
            </div>
          </div>

          {/* Mobile Action Icons (hidden on desktop because NavigationRail provides them) */}
          <div className="flex md:hidden items-center gap-0.5">
            <a
              href="https://nexa-chat-tau.vercel.app/download"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-xl text-slate-300 hover:text-[#ff1744] hover:bg-white/5 transition-colors cursor-pointer"
              title="Download NEXA for Android"
              aria-label="Download NEXA for Android"
            >
              <Smartphone className="w-5 h-5 text-slate-300 hover:text-[#ff1744]" />
            </a>

            <button
              type="button"
              onClick={onOpenNewChat}
              className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              title="New Direct Chat"
            >
              <MessageSquarePlus className="w-5 h-5 text-[#ff1744]" />
            </button>

            <button
              type="button"
              onClick={onOpenSearch}
              className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              title="Search"
            >
              <Search className="w-5 h-5 text-slate-300" />
            </button>

            <button
              type="button"
              onClick={toggleNotifications}
              className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/5 transition-colors cursor-pointer relative"
              title="Notifications"
            >
              <Bell className="w-5 h-5 text-slate-300" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 min-w-[15px] h-3.5 px-1 rounded-full bg-[#ff1744] text-[9px] font-bold text-white flex items-center justify-center border border-black shadow-[0_0_8px_#ff1744]">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => onOpenSettings && onOpenSettings('account')}
              className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              title="Settings"
            >
              <Settings className="w-5 h-5 text-slate-300" />
            </button>
          </div>
        </div>

        {/* Selection Toolbar (Shown when in Select Mode) */}
        {isSelectionMode ? (
          <div className="px-4 py-3 bg-[#ff1744]/10 border-b border-[#ff1744]/30 flex items-center justify-between animate-in fade-in duration-150">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#ff1744]">
                {selectedIds.size} selected
              </span>
              <button
                type="button"
                onClick={handleToggleSelectAll}
                className="text-[11px] text-slate-400 hover:text-white underline cursor-pointer ml-1"
              >
                {selectedIds.size === filteredConversations.length ? 'Deselect all' : 'Select all'}
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={selectedIds.size === 0}
                onClick={handleDeleteSelected}
                className="px-2.5 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>

              <button
                type="button"
                onClick={handleCancelSelection}
                className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-medium text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Action Shortcut Buttons (New Group & Temp Room) */}
            <div className="p-3 border-b border-white/5 grid grid-cols-2 gap-2.5">
              <AnimatedGlowButton
                onClick={onOpenNewGroup}
                icon={Users}
                title="Create a new group chat"
              >
                New Group
              </AnimatedGlowButton>

              <AnimatedGlowButton
                onClick={onOpenTempRoom}
                icon={Clock}
                title="Create or join a temporary room"
              >
                Temp Room
              </AnimatedGlowButton>
            </div>

            {/* Filter Tabs */}
            <div className="nexa-sidebar-tabs px-4 pt-3 flex items-center gap-2">
              {[
                { id: 'all', label: 'All' },
                { id: 'direct', label: 'Direct' },
                { id: 'groups', label: 'Groups' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => handleTabSelect(tab.id)}
                  className={`px-3 py-1 text-xs font-medium rounded-lg capitalize transition-all cursor-pointer ${
                    currentTab === tab.id
                      ? 'bg-gradient-to-r from-[#ff1744] via-[#d3121f] to-[#991b1b] text-white font-bold shadow-[0_0_15px_rgba(255,23,68,0.35)]'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Quick Filter Input with Uiverse Animated Glow */}
            <div className="px-4 py-2.5">
              <NexaSearchBar
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                onClear={() => setLocalSearch('')}
                placeholder="Search conversations..."
                showFilter={false}
              />
            </div>
          </>
        )}

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto px-2 py-1 space-y-1">
          {filteredConversations.length > 0 ? (
            filteredConversations.map((conv) => (
              <ConversationItem
                key={conv._id}
                conversation={conv}
                active={activeConversation?._id === conv._id}
                onClick={() => selectConversation(conv)}
                currentUserId={user?._id}
                onlineUsers={onlineUsers}
                isSelectionMode={isSelectionMode}
                isSelected={selectedIds.has(conv._id)}
                onToggleSelect={handleToggleSelect}
                onContextMenu={handleContextMenu}
              />
            ))
          ) : (
            <div className="py-12 px-4 text-center">
              <MessageCircle className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-xs font-medium text-slate-400">No conversations found</p>
              <button
                onClick={onOpenNewChat}
                className="mt-3 text-xs text-[#ff1744] hover:text-[#ff2a55] font-semibold cursor-pointer"
              >
                Start a conversation &rarr;
              </button>
            </div>
          )}
        </div>

        {/* User Profile Bar Footer */}
        <div className="nexa-sidebar-footer p-3 border-t border-white/10 bg-[#050505]/80 flex items-center justify-between">
          <div
            onClick={onOpenMyProfile}
            className="flex items-center gap-2.5 min-w-0 cursor-pointer hover:opacity-90 transition-opacity group"
            title="My Profile"
          >
            <Avatar
              src={user?.avatar}
              name={user?.name || 'User'}
              size="sm"
              isOnline={true}
            />
            <div className="min-w-0">
              <h4 className="text-sm font-semibold text-white group-hover:text-[#ff1744] transition-colors truncate">{user?.name}</h4>
              <p className="text-xs text-slate-400 truncate">@{user?.username}</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={onOpenSettings}
              title="Settings"
              className="p-1.5 rounded-lg text-slate-400 hover:text-[#ff1744] hover:bg-white/5 transition-colors cursor-pointer"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              onClick={logout}
              title="Sign Out"
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Floating Right-Click Context Menu */}
      {contextMenu.isOpen && (
        <div
          ref={contextMenuRef}
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          className="fixed z-50 w-48 bg-[#0a0a0f]/95 border border-[#ff1744]/30 rounded-2xl shadow-[0_0_25px_rgba(255,23,68,0.15)] py-1.5 text-xs text-slate-200 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100 divide-y divide-white/5 select-none"
        >
          <div className="py-1">
            {/* Select Action */}
            <button
              type="button"
              onClick={handleSelectFromMenu}
              className="w-full px-3.5 py-2 flex items-center gap-2.5 hover:bg-white/5 hover:text-white transition-colors cursor-pointer text-left"
            >
              <CheckSquare className="w-4 h-4 text-[#ff1744]" />
              <span>Select</span>
            </button>

            {/* Pin / Unpin Action */}
            <button
              type="button"
              onClick={handleTogglePinFromMenu}
              className="w-full px-3.5 py-2 flex items-center gap-2.5 hover:bg-white/5 hover:text-white transition-colors cursor-pointer text-left"
            >
              {isCurrentMenuPinned ? (
                <>
                  <PinOff className="w-4 h-4 text-[#ff1744]" />
                  <span>Unpin</span>
                </>
              ) : (
                <>
                  <Pin className="w-4 h-4 text-[#ff1744]" />
                  <span>Pin</span>
                </>
              )}
            </button>
          </div>

          <div className="py-1">
            {/* Delete Action */}
            <button
              type="button"
              onClick={handleDeleteFromMenu}
              className="w-full px-3.5 py-2 flex items-center gap-2.5 hover:bg-rose-500/10 text-rose-400 hover:text-rose-300 transition-colors cursor-pointer text-left"
            >
              <Trash2 className="w-4 h-4 text-rose-400" />
              <span>Delete</span>
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Modal
        isOpen={deleteConfirmModal.isOpen}
        onClose={() => {
          if (!deleteConfirmModal.isDeleting) {
            setDeleteConfirmModal({
              isOpen: false,
              conversationIds: [],
              count: 0,
              isDeleting: false
            });
          }
        }}
        title={
          deleteConfirmModal.count > 1
            ? 'Delete selected conversations?'
            : 'Delete conversation?'
        }
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex-shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">
                {deleteConfirmModal.count > 1
                  ? `Delete ${deleteConfirmModal.count} conversations?`
                  : 'Delete conversation?'}
              </p>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                The selected conversations will be removed from your chat list.
              </p>
              <p className="text-[11px] text-slate-500 mt-2">
                This will not affect other participants' chat history or messages.
              </p>
            </div>
          </div>

          <div className="pt-3 border-t border-white/10 flex items-center justify-end gap-2.5">
            <button
              type="button"
              disabled={deleteConfirmModal.isDeleting}
              onClick={() =>
                setDeleteConfirmModal({
                  isOpen: false,
                  conversationIds: [],
                  count: 0,
                  isDeleting: false
                })
              }
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-medium text-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={deleteConfirmModal.isDeleting}
              onClick={handleConfirmDelete}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-rose-600/20 disabled:opacity-50"
            >
              {deleteConfirmModal.isDeleting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Deleting...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
};
