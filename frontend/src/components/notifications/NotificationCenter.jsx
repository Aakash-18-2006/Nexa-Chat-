import React, { useState, useEffect, useRef } from 'react';
import { useNotifications } from '../../context/NotificationContext';
import { useChat } from '../../context/ChatContext';
import { followApi, chatApi } from '../../api/endpoints';
import { Avatar } from '../ui/Avatar';
import AnimatedSendIcon from '../common/AnimatedSendIcon';
import {
  Bell,
  BellOff,
  Check,
  CheckCheck,
  Trash2,
  X,
  MessageSquare,
  CornerUpLeft,
  Smile,
  Users,
  AtSign,
  UserPlus,
  UserCheck,
  UserX,
  Loader2
} from 'lucide-react';

const formatTimeAgo = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffInSec = Math.max(0, Math.floor((now - date) / 1000));

  if (diffInSec < 60) return 'Just now';
  const diffInMin = Math.floor(diffInSec / 60);
  if (diffInMin < 60) return `${diffInMin}m ago`;
  const diffInHours = Math.floor(diffInMin / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays === 1) return 'Yesterday';
  if (diffInDays < 7) return `${diffInDays}d ago`;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const getTypeConfig = (type) => {
  switch (type) {
    case 'follow_request':
      return {
        icon: UserPlus,
        label: 'sent you a follow request',
        badgeColor: 'bg-[#ff1744]/20 text-[#ff1744] border-[#ff1744]/30'
      };
    case 'follow_accepted':
      return {
        icon: UserCheck,
        label: 'accepted your follow request',
        badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
      };
    case 'follow_declined':
      return {
        icon: UserX,
        label: 'declined follow request',
        badgeColor: 'bg-rose-500/20 text-rose-400 border-rose-500/30'
      };
    case 'reply':
      return {
        icon: CornerUpLeft,
        label: 'replied to you',
        badgeColor: 'bg-[#d3121f]/20 text-[#ff1744] border-[#ff1744]/30'
      };
    case 'reaction':
      return {
        icon: Smile,
        label: 'reacted to your message',
        badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
      };
    case 'group_invite':
      return {
        icon: Users,
        label: 'added you to a group',
        badgeColor: 'bg-[#ff1744]/20 text-[#ff1744] border-[#ff1744]/30'
      };
    case 'mention':
      return {
        icon: AtSign,
        label: 'mentioned you',
        badgeColor: 'bg-[#ff1744]/20 text-[#ff1744] border-[#ff1744]/30'
      };
    case 'message':
    default:
      return {
        icon: MessageSquare,
        label: 'sent you a message',
        badgeColor: 'bg-[#ff1744]/20 text-[#ff1744] border-[#ff1744]/30'
      };
  }
};

export const NotificationCenter = () => {
  const {
    notifications,
    unreadCount,
    loading,
    isOpen,
    setIsOpen,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification
  } = useNotifications();

  const { conversations, setActiveConversation, selectConversation, fetchConversations } = useChat();

  const [filter, setFilter] = useState('all'); // 'all' | 'unread'
  const [actionLoading, setActionLoading] = useState({});
  const panelRef = useRef(null);

  // Close when pressing ESC
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, setIsOpen]);

  if (!isOpen) return null;

  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'unread') return !n.read;
    return true;
  });

  const handleNotificationClick = (notif) => {
    if (!notif.read) {
      markAsRead(notif._id);
    }

    if (notif.conversation) {
      const convId = typeof notif.conversation === 'object' ? notif.conversation._id : notif.conversation;
      const found = conversations.find((c) => c._id === convId);
      if (found) {
        setActiveConversation(found);
      }
      if (window.innerWidth < 768) {
        setIsOpen(false);
      }
    }
  };

  const handleAcceptFollow = async (e, notif) => {
    e.stopPropagation();
    const requestId = notif.followRequest?._id || notif.followRequest;
    if (!requestId) return;

    try {
      setActionLoading((prev) => ({ ...prev, [notif._id]: 'accept' }));
      const res = await followApi.acceptRequest(requestId);
      if (res.data.success) {
        await fetchNotifications();
        await fetchConversations();
      }
    } catch (err) {
      console.error('Accept error:', err);
      alert(err.response?.data?.message || 'Failed to accept follow request');
    } finally {
      setActionLoading((prev) => ({ ...prev, [notif._id]: null }));
    }
  };

  const handleFollowBack = async (e, notif) => {
    e.stopPropagation();
    const senderId = notif.sender?._id || notif.sender;
    if (!senderId) return;

    try {
      setActionLoading((prev) => ({ ...prev, [notif._id]: 'follow_back' }));
      const res = await followApi.followBack(senderId);
      if (res.data.success) {
        await fetchNotifications();
        await fetchConversations();
      }
    } catch (err) {
      console.error('Follow back error:', err);
      alert(err.response?.data?.message || 'Failed to follow back');
    } finally {
      setActionLoading((prev) => ({ ...prev, [notif._id]: null }));
    }
  };

  const handleDeclineFollow = async (e, notif) => {
    e.stopPropagation();
    const requestId = notif.followRequest?._id || notif.followRequest;
    if (!requestId) return;

    try {
      setActionLoading((prev) => ({ ...prev, [notif._id]: 'decline' }));
      const res = await followApi.declineRequest(requestId);
      if (res.data.success) {
        await fetchNotifications();
      }
    } catch (err) {
      console.error('Decline error:', err);
      alert(err.response?.data?.message || 'Failed to decline follow request');
    } finally {
      setActionLoading((prev) => ({ ...prev, [notif._id]: null }));
    }
  };

  const handleOpenDirectChat = async (e, targetUserId) => {
    e.stopPropagation();
    try {
      setActionLoading((prev) => ({ ...prev, [`chat-${targetUserId}`]: true }));
      const res = await chatApi.getDirectConversation(targetUserId);
      if (res.data.success) {
        await fetchConversations();
        selectConversation(res.data.conversation);
        setIsOpen(false);
      }
    } catch (err) {
      console.error('Open chat error:', err);
      alert(err.response?.data?.message || 'Could not open conversation');
    } finally {
      setActionLoading((prev) => ({ ...prev, [`chat-${targetUserId}`]: false }));
    }
  };

  return (
    <>
      {/* Backdrop to close panel when clicking outside */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={() => setIsOpen(false)}
        aria-hidden="true"
      />

      {/* Slide-out Left Notification Panel */}
      <aside
        ref={panelRef}
        className="fixed top-0 bottom-0 left-0 md:left-16 w-full sm:w-96 z-50 bg-[#0a0a0f] border-r border-[#ff1744]/20 shadow-[0_0_35px_rgba(255,23,68,0.08),0_0_65px_rgba(153,27,27,0.05)] flex flex-col animate-in slide-in-from-left duration-200"
      >
        {/* Header */}
        <div className="p-4 border-b border-[#ff1744]/15 flex items-center justify-between bg-[#050505]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#ff1744] via-[#d3121f] to-[#991b1b] text-white flex items-center justify-center shadow-[0_0_12px_rgba(255,23,68,0.3)]">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight leading-tight">
                Notifications
              </h2>
              <p className="text-[11px] text-slate-400">
                {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                title="Mark all as read"
                className="p-1.5 rounded-lg text-slate-400 hover:text-[#ff1744] hover:bg-white/5 transition-colors cursor-pointer text-xs flex items-center gap-1"
              >
                <CheckCheck className="w-4 h-4" />
                <span className="hidden sm:inline text-[11px] font-semibold">Mark all read</span>
              </button>
            )}
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              title="Close Notification Center"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center px-4 py-2.5 border-b border-[#ff1744]/10 bg-[#050505] gap-2 text-xs">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              filter === 'all'
                ? 'bg-gradient-to-r from-[#ff1744] via-[#d3121f] to-[#991b1b] text-white shadow-[0_0_12px_rgba(255,23,68,0.3)]'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <span>All</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/10 text-slate-300">
              {notifications.length}
            </span>
          </button>

          <button
            onClick={() => setFilter('unread')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              filter === 'unread'
                ? 'bg-gradient-to-r from-[#ff1744] via-[#d3121f] to-[#991b1b] text-white shadow-[0_0_12px_rgba(255,23,68,0.3)]'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <span>Unread</span>
            {unreadCount > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-gradient-to-r from-[#ff1744] to-[#991b1b] text-white font-bold">
                {unreadCount}
              </span>
            )}
          </button>
        </div>

        {/* Notification List */}
        <div className="flex-1 overflow-y-auto divide-y divide-white/5 scrollbar-thin scrollbar-thumb-white/10">
          {filteredNotifications.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center">
              <div className="w-14 h-14 rounded-2xl bg-white/5 border border-[#ff1744]/20 flex items-center justify-center text-slate-400 mb-3 shadow-[0_0_15px_rgba(255,23,68,0.06)]">
                <BellOff className="w-7 h-7 text-[#ff1744]/60" />
              </div>
              <h3 className="text-sm font-semibold text-white mb-1">
                {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
              </h3>
              <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
                {filter === 'unread'
                  ? 'All notifications have been read. Switch to "All" to view past activity.'
                  : 'Follow requests, messages, and mentions will appear here in real time.'}
              </p>
            </div>
          ) : (
            filteredNotifications.map((notif) => {
              const typeConfig = getTypeConfig(notif.type);
              const TypeIcon = typeConfig.icon;
              const isFollowRequest = notif.type === 'follow_request';
              const isFollowAccepted = notif.type === 'follow_accepted';
              const reqStatus = notif.followRequest?.status;

              return (
                <div
                  key={notif._id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`relative p-3.5 flex items-start gap-3 transition-colors cursor-pointer group select-none ${
                    notif.read
                      ? 'hover:bg-white/[0.03] opacity-85'
                      : 'bg-[#ff1744]/[0.05] hover:bg-[#ff1744]/[0.09] border-l-2 border-[#ff1744] shadow-[inset_0_0_15px_rgba(255,23,68,0.04)]'
                  }`}
                >
                  {/* Sender Profile Picture with Type Badge */}
                  <div className="relative flex-shrink-0">
                    <Avatar
                      src={notif.sender?.avatar}
                      name={notif.sender?.name || 'User'}
                      size="md"
                      showStatus={false}
                    />
                    <span
                      className={`absolute -bottom-1 -right-1 p-1 rounded-full border ${typeConfig.badgeColor} bg-[#0a0a0f] shadow-sm`}
                      title={typeConfig.label}
                    >
                      <TypeIcon className="w-2.5 h-2.5" />
                    </span>
                  </div>

                  {/* Notification Content & Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <div className="flex items-center gap-1.5 truncate">
                        <h4 className="text-xs font-bold text-white truncate">
                          {notif.sender?.name || 'Someone'}
                        </h4>
                        {notif.sender?.username && (
                          <span className="text-[11px] text-slate-400 truncate">
                            @{notif.sender.username}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 flex-shrink-0">
                        {formatTimeAgo(notif.createdAt)}
                      </span>
                    </div>

                    <p className="text-[11px] text-[#ff1744] font-medium mb-1 truncate">
                      {typeConfig.label}
                    </p>

                    {/* Follow Request Interactive Accept / Decline Block */}
                    {isFollowRequest && (
                      <div className="mt-2.5 pt-2 border-t border-white/5">
                        {reqStatus === 'accepted' ? (
                          <div className="flex items-center justify-between gap-1 flex-wrap">
                            <div className="flex items-center gap-1.5">
                              {notif.iFollowSender ? (
                                <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                                  <UserCheck className="w-3.5 h-3.5" /> Following
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  disabled={actionLoading[notif._id] === 'follow_back'}
                                  onClick={(e) => handleFollowBack(e, notif)}
                                  className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-[#ff1744] via-[#d3121f] to-[#991b1b] text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-all shadow-[0_0_10px_rgba(255,23,68,0.3)] hover:brightness-110"
                                >
                                  {actionLoading[notif._id] === 'follow_back' ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <UserPlus className="w-3 h-3" />
                                  )}
                                  <span>Follow Back</span>
                                </button>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={(e) => handleOpenDirectChat(e, notif.sender?._id)}
                              className="group px-2.5 py-1 rounded-lg bg-[#ff1744]/10 hover:bg-[#ff1744]/20 text-[#ff1744] border border-[#ff1744]/30 font-semibold text-[11px] flex items-center gap-1 cursor-pointer transition-all"
                            >
                              <AnimatedSendIcon className="w-3 h-3 text-[#ff1744]" /> Message
                            </button>
                          </div>
                        ) : reqStatus === 'declined' ? (
                          <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                            <UserX className="w-3.5 h-3.5" /> Request Declined
                          </span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={!!actionLoading[notif._id]}
                              onClick={(e) => handleAcceptFollow(e, notif)}
                              className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#ff1744] to-[#991b1b] text-white font-bold text-xs flex items-center gap-1.5 shadow-[0_0_12px_rgba(255,23,68,0.3)] hover:brightness-110 transition-all cursor-pointer disabled:opacity-50"
                            >
                              {actionLoading[notif._id] === 'accept' ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Check className="w-3.5 h-3.5" />
                              )}
                              <span>Accept</span>
                            </button>

                            <button
                              type="button"
                              disabled={!!actionLoading[notif._id]}
                              onClick={(e) => handleDeclineFollow(e, notif)}
                              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 border border-white/10 hover:border-rose-500/30 font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                            >
                              {actionLoading[notif._id] === 'decline' ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <X className="w-3.5 h-3.5" />
                              )}
                              <span>Decline</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Follow Accepted Notification Quick Message Action */}
                    {isFollowAccepted && (
                      <div className="mt-2 flex items-center justify-between gap-1 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          {notif.iFollowSender ? (
                            <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                              <UserCheck className="w-3.5 h-3.5" /> Following
                            </span>
                          ) : (
                            <button
                              type="button"
                              disabled={actionLoading[notif._id] === 'follow_back'}
                              onClick={(e) => handleFollowBack(e, notif)}
                              className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-[#ff1744] via-[#d3121f] to-[#991b1b] text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-all shadow-[0_0_10px_rgba(255,23,68,0.3)] hover:brightness-110"
                            >
                              {actionLoading[notif._id] === 'follow_back' ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <UserPlus className="w-3 h-3" />
                              )}
                              <span>Follow Back</span>
                            </button>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={(e) => handleOpenDirectChat(e, notif.sender?._id)}
                          className="group px-2.5 py-1 rounded-lg bg-[#ff1744]/10 hover:bg-[#ff1744]/20 text-[#ff1744] border border-[#ff1744]/30 font-semibold text-[11px] flex items-center gap-1 cursor-pointer transition-all"
                        >
                          <AnimatedSendIcon className="w-3 h-3 text-[#ff1744]" /> Message
                        </button>
                      </div>
                    )}

                    {/* Standard text content if not follow request */}
                    {!isFollowRequest && notif.content && (
                      <p className="text-xs text-slate-200 line-clamp-2 leading-relaxed bg-white/[0.03] rounded-lg p-1.5 border border-white/5">
                        {notif.content}
                      </p>
                    )}
                  </div>

                  {/* Actions & Read Indicator */}
                  <div className="flex flex-col items-end gap-2 flex-shrink-0 self-center">
                    {!notif.read && (
                      <span
                        className="w-2 h-2 rounded-full bg-[#ff1744] shadow-[0_0_8px_#ff1744]"
                        title="Unread"
                      />
                    )}

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!notif.read && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            markAsRead(notif._id);
                          }}
                          className="p-1 rounded-lg text-slate-400 hover:text-[#ff1744] hover:bg-white/10 transition-colors"
                          title="Mark as read"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNotification(notif._id);
                        }}
                        className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-white/10 transition-colors"
                        title="Dismiss notification"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>
    </>
  );
};
