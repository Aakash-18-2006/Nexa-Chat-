import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Avatar } from '../ui/Avatar';
import { NexaSearchBar } from '../ui/NexaSearchBar';
import { searchApi, chatApi, followApi } from '../../api/endpoints';
import { useChat } from '../../context/ChatContext';
import { useSocket } from '../../context/SocketContext';
import { useNotifications } from '../../context/NotificationContext';
import { formatDate, formatTime } from '../../utils/formatters';
import AnimatedSendIcon from '../common/AnimatedSendIcon';
import {
  Search,
  MessageSquare,
  Users,
  User,
  ArrowRight,
  UserPlus,
  Clock,
  Check,
  X,
  Loader2,
  SlidersHorizontal
} from 'lucide-react';

export const GlobalSearchModal = ({ isOpen, onClose }) => {
  const { selectConversation, fetchConversations } = useChat();
  const { socket } = useSocket();
  const { fetchNotifications } = useNotifications();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState({ users: [], conversations: [], messages: [] });
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState({});
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'people' | 'conversations' | 'messages'
  const [showFilterBar, setShowFilterBar] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults({ users: [], conversations: [], messages: [] });
      setLoading(false);
      return;
    }

    const abortController = new AbortController();

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await searchApi.globalSearch(trimmed, {
          signal: abortController.signal
        });
        if (res.data?.success) {
          setResults(res.data.results || { users: [], conversations: [], messages: [] });
        }
      } catch (err) {
        if (err.name !== 'CanceledError' && err.name !== 'AbortError' && err.code !== 'ERR_CANCELED') {
          console.error('Search error:', err);
        }
      } finally {
        if (!abortController.signal.aborted) {
          setLoading(false);
        }
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      abortController.abort();
    };
  }, [query]);

  // Real-time synchronization of relationship statuses while search modal is open
  useEffect(() => {
    if (!socket) return;

    const handleRelationshipChanged = ({ userId, status }) => {
      setResults((prev) => ({
        ...prev,
        users: (prev.users || []).map((u) =>
          u._id === userId ? { ...u, relationshipStatus: status } : u
        )
      }));
    };

    socket.on('relationship_changed', handleRelationshipChanged);
    return () => {
      socket.off('relationship_changed', handleRelationshipChanged);
    };
  }, [socket]);

  // Click on "Message" when users are connected
  const handleOpenChat = async (userId) => {
    try {
      setActionLoading((prev) => ({ ...prev, [userId]: true }));
      const res = await chatApi.getDirectConversation(userId);
      if (res.data.success) {
        await fetchConversations();
        selectConversation(res.data.conversation);
        onClose();
      }
    } catch (err) {
      console.error('Failed to open chat:', err);
      alert(err.response?.data?.message || 'Could not open conversation');
    } finally {
      setActionLoading((prev) => ({ ...prev, [userId]: false }));
    }
  };

  // Click on "Follow to Message"
  const handleFollowRequest = async (e, userId) => {
    e.stopPropagation();
    try {
      setActionLoading((prev) => ({ ...prev, [userId]: true }));
      const res = await followApi.sendRequest(userId);
      if (res.data.success) {
        setResults((prev) => ({
          ...prev,
          users: (prev.users || []).map((u) =>
            u._id === userId
              ? { ...u, relationshipStatus: 'pending_sent', requestId: res.data.requestId }
              : u
          )
        }));
      }
    } catch (err) {
      console.error('Follow error:', err);
      alert(err.response?.data?.message || 'Could not send follow request');
    } finally {
      setActionLoading((prev) => ({ ...prev, [userId]: false }));
    }
  };

  // Accept incoming follow request from search
  const handleAcceptRequest = async (e, user) => {
    e.stopPropagation();
    if (!user.requestId) return;
    try {
      setActionLoading((prev) => ({ ...prev, [user._id]: true }));
      const res = await followApi.acceptRequest(user.requestId);
      if (res.data.success) {
        setResults((prev) => ({
          ...prev,
          users: (prev.users || []).map((u) =>
            u._id === user._id ? { ...u, relationshipStatus: 'follow_back' } : u
          )
        }));
        await fetchNotifications();
        await fetchConversations();
      }
    } catch (err) {
      console.error('Accept error:', err);
      alert(err.response?.data?.message || 'Failed to accept follow request');
    } finally {
      setActionLoading((prev) => ({ ...prev, [user._id]: false }));
    }
  };

  // Follow back a user from search
  const handleFollowBack = async (e, user) => {
    e.stopPropagation();
    try {
      setActionLoading((prev) => ({ ...prev, [user._id]: true }));
      const res = await followApi.followBack(user._id);
      if (res.data.success) {
        setResults((prev) => ({
          ...prev,
          users: (prev.users || []).map((u) =>
            u._id === user._id ? { ...u, relationshipStatus: 'following' } : u
          )
        }));
        await fetchNotifications();
        await fetchConversations();
      }
    } catch (err) {
      console.error('Follow back error:', err);
      alert(err.response?.data?.message || 'Failed to follow back');
    } finally {
      setActionLoading((prev) => ({ ...prev, [user._id]: false }));
    }
  };

  // Decline incoming follow request from search
  const handleDeclineRequest = async (e, user) => {
    e.stopPropagation();
    if (!user.requestId) return;
    try {
      setActionLoading((prev) => ({ ...prev, [user._id]: true }));
      const res = await followApi.declineRequest(user.requestId);
      if (res.data.success) {
        setResults((prev) => ({
          ...prev,
          users: (prev.users || []).map((u) =>
            u._id === user._id ? { ...u, relationshipStatus: 'declined' } : u
          )
        }));
        await fetchNotifications();
      }
    } catch (err) {
      console.error('Decline error:', err);
      alert(err.response?.data?.message || 'Failed to decline follow request');
    } finally {
      setActionLoading((prev) => ({ ...prev, [user._id]: false }));
    }
  };

  // Click on conversation
  const handleConversationClick = (conv) => {
    selectConversation(conv);
    onClose();
  };

  // Click on message
  const handleMessageClick = (msg) => {
    if (msg.conversation) {
      selectConversation(msg.conversation);
      onClose();
      setTimeout(() => {
        const el = document.getElementById(`msg-${msg._id}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('ring-2', 'ring-[#ff1744]', 'rounded-2xl', 'shadow-[0_0_20px_rgba(255,23,68,0.5)]');
          setTimeout(() => el.classList.remove('ring-2', 'ring-[#ff1744]', 'rounded-2xl', 'shadow-[0_0_20px_rgba(255,23,68,0.5)]'), 1500);
        }
      }, 350);
    }
  };

  const totalResults =
    (results.users?.length || 0) +
    (results.conversations?.length || 0) +
    (results.messages?.length || 0);

  const showUsers = activeFilter === 'all' || activeFilter === 'people';
  const showMessages = activeFilter === 'all' || activeFilter === 'messages';
  const showConversations = activeFilter === 'all' || activeFilter === 'conversations';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Search NEXA" maxWidth="max-w-2xl">
      <div className="space-y-4">
        {/* Animated Uiverse Glowing Search Bar */}
        <NexaSearchBar
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onClear={() => setQuery('')}
          placeholder="Search messages, people, groups..."
          autoFocus
          showFilter={true}
          isFilterActive={activeFilter !== 'all' || showFilterBar}
          onFilterClick={() => setShowFilterBar((prev) => !prev)}
          filterTitle="Toggle Search Filters"
          isLoading={loading}
        />

        {/* Filter Pills Bar */}
        {(showFilterBar || query.trim()) && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5 scrollbar-none animate-fadeIn">
            {[
              { id: 'all', label: 'All', count: totalResults },
              { id: 'people', label: 'People', count: results.users?.length || 0 },
              { id: 'conversations', label: 'Groups', count: results.conversations?.length || 0 },
              { id: 'messages', label: 'Messages', count: results.messages?.length || 0 }
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveFilter(tab.id)}
                className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeFilter === tab.id
                    ? 'bg-gradient-to-r from-[#ff1744] via-[#d3121f] to-[#991b1b] text-white shadow-[0_0_15px_rgba(255,23,68,0.4)]'
                    : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 border border-white/5'
                }`}
              >
                <span>{tab.label}</span>
                {query.trim() && tab.count > 0 && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      activeFilter === tab.id ? 'bg-black/40 text-white' : 'bg-white/10 text-slate-300'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        <div className="max-h-96 overflow-y-auto space-y-4 pr-1">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-xs text-[#ff1744] animate-pulse">
              <Loader2 className="w-5 h-5 animate-spin text-[#ff1744]" />
              <span className="font-semibold">Searching NEXA...</span>
            </div>
          ) : query.trim() && totalResults === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500">
              No results found
            </div>
          ) : (
            <>
              {/* Users Results */}
              {showUsers && results.users?.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-[#ff1744]" />
                    <span>People ({results.users.length})</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {Array.from(new Map(results.users.map((u) => [u._id, u])).values()).map((u) => {
                      const status = u.relationshipStatus || 'none';
                      const isLoading = !!actionLoading[u._id];

                      return (
                        <div
                          key={u._id}
                          className="nexa-search-result-row flex items-center justify-between p-2.5 rounded-xl bg-[#0a0a0f] border border-[#ff1744]/20 text-xs transition-all hover:border-[#ff1744]/50 shadow-[0_0_15px_rgba(255,23,68,0.04)]"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 pr-2">
                            <Avatar src={u.avatar} name={u.name} size="sm" isOnline={u.isOnline} />
                            <div className="truncate">
                              <span className="font-semibold text-white truncate block">{u.name}</span>
                              <span className="text-[11px] text-[#ff1744] block truncate">@{u.username}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {status === 'follow_back' ? (
                              <button
                                type="button"
                                disabled={isLoading}
                                onClick={(e) => handleFollowBack(e, u)}
                                className="px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-[#ff1744] via-[#d3121f] to-[#991b1b] hover:brightness-110 active:scale-95 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-[0_0_10px_rgba(255,23,68,0.3)] transition-all"
                              >
                                {isLoading ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <UserPlus className="w-3.5 h-3.5" />
                                )}
                                <span>Follow Back</span>
                              </button>
                            ) : (status === 'connected' || status === 'following') ? (
                              <button
                                type="button"
                                disabled={isLoading}
                                onClick={() => handleOpenChat(u._id)}
                                className="group px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-[#ff1744] via-[#d3121f] to-[#991b1b] hover:brightness-110 active:scale-95 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-[0_0_10px_rgba(255,23,68,0.3)] transition-all"
                              >
                                {isLoading ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <AnimatedSendIcon className="w-3.5 h-3.5" />
                                )}
                                <span>Message</span>
                              </button>
                            ) : status === 'pending_sent' ? (
                              <div
                                title="Follow request is pending acceptance"
                                className="px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-400 font-semibold text-xs flex items-center gap-1.5 cursor-default select-none"
                              >
                                <Clock className="w-3.5 h-3.5 text-[#ff1744]" />
                                <span>Request Sent</span>
                              </div>
                            ) : status === 'pending_received' ? (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  disabled={isLoading}
                                  onClick={(e) => handleAcceptRequest(e, u)}
                                  className="px-2 py-1 rounded-lg bg-gradient-to-r from-[#ff1744] to-[#d3121f] hover:brightness-110 active:scale-95 text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer shadow-[0_0_10px_rgba(255,23,68,0.3)]"
                                  title="Accept Request"
                                >
                                  <Check className="w-3 h-3" /> Accept
                                </button>
                                <button
                                  type="button"
                                  disabled={isLoading}
                                  onClick={(e) => handleDeclineRequest(e, u)}
                                  className="px-2 py-1 rounded-lg bg-white/10 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 font-medium text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
                                  title="Decline Request"
                                >
                                  <X className="w-3 h-3" /> Decline
                                </button>
                              </div>
                            ) : status === 'declined' ? (
                              <button
                                type="button"
                                disabled={isLoading}
                                onClick={(e) => handleFollowRequest(e, u._id)}
                                className="px-2.5 py-1.5 rounded-lg bg-[#ff1744]/15 hover:bg-[#ff1744]/25 border border-[#ff1744]/30 text-[#ff1744] font-semibold text-xs flex items-center gap-1.5 cursor-pointer transition-all"
                                title="Request declined. Click to follow again"
                              >
                                {isLoading ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <UserPlus className="w-3.5 h-3.5" />
                                )}
                                <span>Follow Again</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={isLoading}
                                onClick={(e) => handleFollowRequest(e, u._id)}
                                className="px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-[#ff1744] via-[#d3121f] to-[#991b1b] hover:brightness-110 active:scale-95 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-[0_0_10px_rgba(255,23,68,0.3)] transition-all"
                                title="Send follow request to enable messaging"
                              >
                                {isLoading ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <UserPlus className="w-3.5 h-3.5" />
                                )}
                                <span>Follow to Message</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Messages Results */}
              {showMessages && results.messages?.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-[#ff1744]" />
                    <span>Messages ({results.messages.length})</span>
                  </h4>
                  <div className="space-y-1.5">
                    {results.messages.map((m) => (
                      <div
                        key={m._id}
                        onClick={() => handleMessageClick(m)}
                        className="nexa-search-result-row p-3 rounded-xl bg-[#0a0a0f] hover:bg-white/5 border border-[#ff1744]/20 transition-all cursor-pointer text-xs shadow-[0_0_15px_rgba(255,23,68,0.04)]"
                      >
                        <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                          <span className="font-semibold text-[#ff1744]">
                            {m.sender?.name || 'Member'}
                          </span>
                          <span>{formatDate(m.createdAt)} {formatTime(m.createdAt)}</span>
                        </div>
                        <p className="text-white line-clamp-2">{m.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Conversations / Groups */}
              {showConversations && results.conversations?.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Groups ({results.conversations.length})</span>
                  </h4>
                  <div className="space-y-1.5">
                    {results.conversations.map((c) => (
                      <div
                        key={c._id}
                        onClick={() => handleConversationClick(c)}
                        className="nexa-search-result-row flex items-center justify-between p-2.5 rounded-xl bg-[#0a0a0f] hover:bg-white/5 border border-[#ff1744]/20 hover:border-[#ff1744]/50 cursor-pointer text-xs shadow-[0_0_15px_rgba(255,23,68,0.04)] transition-all"
                      >
                        <div className="flex items-center gap-2.5">
                          <Avatar
                            src={c.groupInfo?.avatar}
                            name={c.groupInfo?.name || 'Group'}
                            size="sm"
                            showStatus={false}
                          />
                          <span className="font-semibold text-white">
                            {c.groupInfo?.name || 'Group Chat'}
                          </span>
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-500" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Modal>
  );
};
