import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Avatar } from '../ui/Avatar';
import { NexaSearchBar } from '../ui/NexaSearchBar';
import { userApi, chatApi, followApi } from '../../api/endpoints';
import { useChat } from '../../context/ChatContext';
import { useSocket } from '../../context/SocketContext';
import { useNotifications } from '../../context/NotificationContext';
import AnimatedSendIcon from '../common/AnimatedSendIcon';
import {
  Search,
  MessageSquare,
  UserPlus,
  Clock,
  Check,
  X,
  Loader2
} from 'lucide-react';

export const NewChatModal = ({ isOpen, onClose }) => {
  const { selectConversation, fetchConversations } = useChat();
  const { socket } = useSocket();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState({});

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setLoading(false);
      return;
    }

    const abortController = new AbortController();

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await userApi.searchUsers(trimmed, {
          signal: abortController.signal
        });
        if (res.data?.success) {
          setResults(res.data.users || []);
        }
      } catch (err) {
        if (err.name !== 'CanceledError' && err.name !== 'AbortError' && err.code !== 'ERR_CANCELED') {
          console.error('Search failed:', err);
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

  // Synchronize relationship statuses via socket while modal is open
  useEffect(() => {
    if (!socket) return;

    const handleRelationshipChanged = ({ userId, status }) => {
      setResults((prev) =>
        prev.map((u) => (u._id === userId ? { ...u, relationshipStatus: status } : u))
      );
    };

    socket.on('relationship_changed', handleRelationshipChanged);
    return () => {
      socket.off('relationship_changed', handleRelationshipChanged);
    };
  }, [socket]);

  // Open direct conversation when connected
  const handleStartChat = async (participantId) => {
    try {
      setActionLoading((prev) => ({ ...prev, [participantId]: true }));
      const res = await chatApi.getDirectConversation(participantId);
      if (res.data.success) {
        await fetchConversations();
        selectConversation(res.data.conversation);
        onClose();
        setQuery('');
      }
    } catch (err) {
      console.error('Failed to start chat:', err);
      alert(err.response?.data?.message || 'Could not start conversation');
    } finally {
      setActionLoading((prev) => ({ ...prev, [participantId]: false }));
    }
  };

  // Send follow request
  const handleFollowRequest = async (e, userId) => {
    e.stopPropagation();
    try {
      setActionLoading((prev) => ({ ...prev, [userId]: true }));
      const res = await followApi.sendRequest(userId);
      if (res.data.success) {
        setResults((prev) =>
          prev.map((u) =>
            u._id === userId
              ? { ...u, relationshipStatus: 'pending_sent', requestId: res.data.requestId }
              : u
          )
        );
      }
    } catch (err) {
      console.error('Follow error:', err);
      alert(err.response?.data?.message || 'Could not send follow request');
    } finally {
      setActionLoading((prev) => ({ ...prev, [userId]: false }));
    }
  };

  // Accept incoming follow request
  const handleAcceptRequest = async (e, user) => {
    e.stopPropagation();
    if (!user.requestId) return;
    try {
      setActionLoading((prev) => ({ ...prev, [user._id]: true }));
      const res = await followApi.acceptRequest(user.requestId);
      if (res.data.success) {
        setResults((prev) =>
          prev.map((u) =>
            u._id === user._id ? { ...u, relationshipStatus: 'follow_back' } : u
          )
        );
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

  // Follow back user
  const handleFollowBack = async (e, user) => {
    e.stopPropagation();
    try {
      setActionLoading((prev) => ({ ...prev, [user._id]: true }));
      const res = await followApi.followBack(user._id);
      if (res.data.success) {
        setResults((prev) =>
          prev.map((u) =>
            u._id === user._id ? { ...u, relationshipStatus: 'following' } : u
          )
        );
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

  // Decline incoming follow request
  const handleDeclineRequest = async (e, user) => {
    e.stopPropagation();
    if (!user.requestId) return;
    try {
      setActionLoading((prev) => ({ ...prev, [user._id]: true }));
      const res = await followApi.declineRequest(user.requestId);
      if (res.data.success) {
        setResults((prev) =>
          prev.map((u) =>
            u._id === user._id ? { ...u, relationshipStatus: 'declined' } : u
          )
        );
        await fetchNotifications();
      }
    } catch (err) {
      console.error('Decline error:', err);
      alert(err.response?.data?.message || 'Failed to decline follow request');
    } finally {
      setActionLoading((prev) => ({ ...prev, [user._id]: false }));
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Start a New Chat">
      <div className="space-y-4">
        {/* Animated Uiverse Glowing Search Bar */}
        <NexaSearchBar
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onClear={() => setQuery('')}
          placeholder="Search by name or @username..."
          autoFocus
          showFilter={false}
        />

        <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
          {loading ? (
            <div className="py-8 text-center text-xs text-slate-500">Searching NEXA users...</div>
          ) : results.length > 0 ? (
            Array.from(new Map(results.map((u) => [u._id, u])).values()).map((u) => {
              const status = u.relationshipStatus || 'none';
              const isLoading = !!actionLoading[u._id];

              return (
                <div
                  key={u._id}
                  className="flex items-center justify-between p-3 rounded-xl bg-[#0a0a0f] border border-[#ff1744]/15 hover:border-[#ff1744]/40 shadow-[0_0_15px_rgba(255,23,68,0.05)] transition-all text-xs"
                >
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <Avatar
                      src={u.avatar}
                      name={u.name}
                      size="md"
                      isOnline={u.isOnline}
                    />
                    <div className="truncate">
                      <h4 className="text-sm font-semibold text-white truncate">{u.name}</h4>
                      <p className="text-xs text-[#ff1744] truncate">@{u.username}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {status === 'follow_back' ? (
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={(e) => handleFollowBack(e, u)}
                        className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#ff1744] via-[#d3121f] to-[#991b1b] hover:brightness-110 active:scale-95 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-[0_0_10px_rgba(255,23,68,0.3)] transition-all"
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
                        onClick={() => handleStartChat(u._id)}
                        className="group px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#ff1744] via-[#d3121f] to-[#991b1b] hover:brightness-110 active:scale-95 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-[0_0_10px_rgba(255,23,68,0.3)] transition-all"
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
                        title="Follow request sent. Waiting for user to accept"
                        className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-400 font-semibold text-xs flex items-center gap-1.5 cursor-default select-none"
                      >
                        <Clock className="w-3.5 h-3.5 text-[#ff1744]" />
                        <span>Request Sent</span>
                      </div>
                    ) : status === 'pending_received' ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={isLoading}
                          onClick={(e) => handleAcceptRequest(e, u)}
                          className="px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-[#ff1744] to-[#991b1b] hover:brightness-110 active:scale-95 text-white font-bold text-xs flex items-center gap-1 cursor-pointer shadow-[0_0_10px_rgba(255,23,68,0.3)]"
                        >
                          <Check className="w-3.5 h-3.5" /> Accept
                        </button>
                        <button
                          type="button"
                          disabled={isLoading}
                          onClick={(e) => handleDeclineRequest(e, u)}
                          className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 font-medium text-xs flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <X className="w-3.5 h-3.5" /> Decline
                        </button>
                      </div>
                    ) : status === 'declined' ? (
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={(e) => handleFollowRequest(e, u._id)}
                        className="px-3 py-1.5 rounded-lg bg-[#ff1744]/15 hover:bg-[#ff1744]/25 border border-[#ff1744]/30 text-[#ff1744] font-semibold text-xs flex items-center gap-1.5 cursor-pointer transition-all"
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
                        className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#ff1744] via-[#d3121f] to-[#991b1b] hover:brightness-110 active:scale-95 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-[0_0_10px_rgba(255,23,68,0.3)] transition-all"
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
            })
          ) : query.trim() ? (
            <div className="py-8 text-center text-xs text-slate-500">No users found</div>
          ) : (
            <div className="py-8 text-center text-xs text-slate-500">
              Type a name or username to find contacts
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
