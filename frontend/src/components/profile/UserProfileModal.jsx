import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Avatar } from '../ui/Avatar';
import { userApi, chatApi, followApi } from '../../api/endpoints';
import { useChat } from '../../context/ChatContext';
import { useSocket } from '../../context/SocketContext';
import { useNotifications } from '../../context/NotificationContext';
import AnimatedSendIcon from '../common/AnimatedSendIcon';
import {
  MessageSquare,
  UserPlus,
  UserMinus,
  UserCheck,
  Ban,
  Clock,
  Check,
  X,
  Loader2,
  Info,
  ShieldCheck,
  ArrowLeft,
  Pencil,
  Users,
  Palette
} from 'lucide-react';
import { ChatThemeSelector } from '../chat/ChatThemeSelector';

export const UserProfileModal = ({
  userId,
  isOpen,
  onClose,
  onOpenInfoMedia,
  onEditProfile
}) => {
  const { selectConversation, fetchConversations, activeConversation, setRightPanelTab } = useChat();
  const { socket } = useSocket();
  const { fetchNotifications } = useNotifications();

  const [activeUserId, setActiveUserId] = useState(userId);
  const [userHistory, setUserHistory] = useState([]);
  const [view, setView] = useState('profile'); // 'profile' | 'followers' | 'following'

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null); // 'unfollow' | 'block' | null

  // Followers & Following list state
  const [followList, setFollowList] = useState([]);
  const [loadingFollowList, setLoadingFollowList] = useState(false);
  const [actionTargetId, setActionTargetId] = useState(null);

  // Reset to initial userId whenever opened
  useEffect(() => {
    if (isOpen) {
      setActiveUserId(userId);
      setUserHistory([]);
      setView('profile');
      setConfirmAction(null);
    }
  }, [isOpen, userId]);

  // Load user profile
  const loadProfile = async () => {
    if (!activeUserId) return;
    setLoading(true);
    try {
      const res = await userApi.getProfile(activeUserId);
      if (res.data.success) {
        setProfile(res.data.user);
      }
    } catch (err) {
      console.error('Failed to load user profile:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen || !activeUserId) {
      setProfile(null);
      return;
    }
    loadProfile();
  }, [isOpen, activeUserId]);

  // Load Followers / Following list
  useEffect(() => {
    if (!isOpen || !activeUserId) return;
    if (view === 'followers' || view === 'following') {
      const fetchList = async () => {
        setLoadingFollowList(true);
        try {
          const res =
            view === 'followers'
              ? await followApi.getFollowers(activeUserId)
              : await followApi.getFollowing(activeUserId);
          if (res.data.success) {
            setFollowList(res.data.users || []);
          }
        } catch (err) {
          console.error(`Failed to load ${view}:`, err);
        } finally {
          setLoadingFollowList(false);
        }
      };
      fetchList();
    }
  }, [isOpen, activeUserId, view]);

  // Real-time synchronization
  useEffect(() => {
    if (!socket || !activeUserId) return;

    const handleRelationshipChanged = ({ userId: uId, status, isBlocker }) => {
      if (uId === activeUserId) {
        setProfile((prev) => (prev ? {
          ...prev,
          relationshipStatus: status,
          isBlocker: isBlocker !== undefined ? isBlocker : prev.isBlocker
        } : prev));
      }
    };

    socket.on('relationship_changed', handleRelationshipChanged);
    return () => {
      socket.off('relationship_changed', handleRelationshipChanged);
    };
  }, [socket, activeUserId]);

  const handleOpenChat = async () => {
    if (!profile) return;
    try {
      setActionLoading(true);
      const res = await chatApi.getDirectConversation(profile._id);
      if (res.data.success) {
        await fetchConversations();
        selectConversation(res.data.conversation);
        onClose();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Could not open conversation');
    } finally {
      setActionLoading(false);
    }
  };

  const handleInfoMedia = async () => {
    if (!profile) return;
    if (onOpenInfoMedia) {
      onOpenInfoMedia();
    } else {
      if (activeConversation && activeConversation.participants?.some((p) => (p._id || p)?.toString() === profile._id?.toString())) {
        setRightPanelTab('info');
        onClose();
      } else {
        try {
          setActionLoading(true);
          const res = await chatApi.getDirectConversation(profile._id);
          if (res.data.success) {
            await fetchConversations();
            selectConversation(res.data.conversation);
            setRightPanelTab('info');
            onClose();
          }
        } catch (err) {
          console.error(err);
        } finally {
          setActionLoading(false);
        }
      }
    }
  };

  const handleFollow = async () => {
    if (!profile) return;
    try {
      setActionLoading(true);
      const res = await followApi.sendRequest(profile._id);
      if (res.data.success) {
        setProfile((prev) => ({
          ...prev,
          relationshipStatus: 'pending_sent',
          requestId: res.data.requestId
        }));
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to send follow request');
    } finally {
      setActionLoading(false);
    }
  };

  const handleFollowBack = async () => {
    if (!profile) return;
    try {
      setActionLoading(true);
      const res = await followApi.followBack(profile._id);
      if (res.data.success) {
        setProfile((prev) => ({
          ...prev,
          relationshipStatus: 'following',
          followingCount: (prev.followingCount || 0) + 1
        }));
        await loadProfile();
        await fetchNotifications();
        await fetchConversations();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to follow back');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!profile?.requestId) return;
    try {
      setActionLoading(true);
      const res = await followApi.acceptRequest(profile.requestId);
      if (res.data.success) {
        setProfile((prev) => ({
          ...prev,
          relationshipStatus: 'follow_back',
          followersCount: (prev.followersCount || 0) + 1
        }));
        await loadProfile();
        await fetchNotifications();
        await fetchConversations();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to accept follow request');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDecline = async () => {
    if (!profile?.requestId) return;
    try {
      setActionLoading(true);
      const res = await followApi.declineRequest(profile.requestId);
      if (res.data.success) {
        setProfile((prev) => ({ ...prev, relationshipStatus: 'declined' }));
        await fetchNotifications();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to decline follow request');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnfollowConfirm = async () => {
    if (!profile) return;
    try {
      setActionLoading(true);
      const res = await followApi.unfollow(profile._id);
      if (res.data.success) {
        setProfile((prev) => ({
          ...prev,
          relationshipStatus: res.data.status || 'none',
          requestId: null
        }));
        setConfirmAction(null);
        await loadProfile();
        await fetchConversations();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to unfollow user');
    } finally {
      setActionLoading(false);
    }
  };

  const handleBlockConfirm = async () => {
    if (!profile) return;
    try {
      setActionLoading(true);
      const res = await followApi.block(profile._id);
      if (res.data.success) {
        setProfile((prev) => ({
          ...prev,
          relationshipStatus: 'blocked',
          isBlocker: true,
          requestId: null
        }));
        setConfirmAction(null);
        await fetchConversations();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to block user');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnblock = async () => {
    if (!profile) return;
    try {
      setActionLoading(true);
      const res = await followApi.unblock(profile._id);
      if (res.data.success) {
        setProfile((prev) => ({
          ...prev,
          relationshipStatus: 'none',
          isBlocker: false
        }));
        await fetchConversations();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to unblock user');
    } finally {
      setActionLoading(false);
    }
  };

  const handleListFollow = async (targetUser) => {
    try {
      setActionTargetId(targetUser._id);
      const res = await followApi.sendRequest(targetUser._id);
      if (res.data.success) {
        setFollowList((prev) =>
          prev.map((u) =>
            u._id === targetUser._id
              ? { ...u, relationshipStatus: 'pending_sent', requestId: res.data.requestId }
              : u
          )
        );
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to send follow request');
    } finally {
      setActionTargetId(null);
    }
  };

  const handleListFollowBack = async (targetUser) => {
    try {
      setActionTargetId(targetUser._id);
      const res = await followApi.followBack(targetUser._id);
      if (res.data.success) {
        setFollowList((prev) =>
          prev.map((u) =>
            u._id === targetUser._id ? { ...u, relationshipStatus: 'following' } : u
          )
        );
        await fetchConversations();
        loadProfile();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to follow back');
    } finally {
      setActionTargetId(null);
    }
  };

  const handleListAccept = async (targetUser) => {
    if (!targetUser.requestId) return;
    try {
      setActionTargetId(targetUser._id);
      const res = await followApi.acceptRequest(targetUser.requestId);
      if (res.data.success) {
        setFollowList((prev) =>
          prev.map((u) =>
            u._id === targetUser._id ? { ...u, relationshipStatus: 'follow_back' } : u
          )
        );
        await fetchConversations();
        loadProfile();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to accept follow request');
    } finally {
      setActionTargetId(null);
    }
  };

  const handleListMessage = async (targetUser) => {
    try {
      setActionTargetId(targetUser._id);
      const res = await chatApi.getDirectConversation(targetUser._id);
      if (res.data.success) {
        await fetchConversations();
        selectConversation(res.data.conversation);
        onClose();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Could not open conversation');
    } finally {
      setActionTargetId(null);
    }
  };

  // Navigate to an account from followers/following list
  const handleSelectAccountFromList = (targetUserId) => {
    setUserHistory((prev) => [...prev, activeUserId]);
    setActiveUserId(targetUserId);
    setView('profile');
  };

  // Navigate back to previous user profile
  const handleBackToPreviousProfile = () => {
    if (userHistory.length === 0) return;
    setUserHistory((prev) => {
      const copy = [...prev];
      const prevId = copy.pop();
      setActiveUserId(prevId);
      return copy;
    });
    setView('profile');
  };

  if (!isOpen) return null;

  const status = profile?.relationshipStatus || 'none';

  const modalTitle =
    view === 'followers'
      ? `Followers (${followList.length})`
      : view === 'following'
      ? `Following (${followList.length})`
      : status === 'self'
      ? 'My Profile'
      : 'User Profile';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={modalTitle} maxWidth="max-w-md">
      {loading ? (
        <div className="py-12 flex flex-col items-center justify-center text-slate-500 gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-[#ff1744]" />
          <span className="text-xs">Loading profile...</span>
        </div>
      ) : profile ? (
        <div className="space-y-5">
          {/* Breadcrumb Back Button when navigating other users from lists */}
          {view === 'profile' && userHistory.length > 0 && (
            <button
              type="button"
              onClick={handleBackToPreviousProfile}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer pb-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to previous profile</span>
            </button>
          )}

          {view === 'profile' ? (
            /* Main Profile View */
            <div className="space-y-5">
              <div className="flex flex-col items-center text-center pt-2">
                <Avatar
                  src={profile.avatar}
                  name={profile.name}
                  size="xl"
                  isOnline={profile.isOnline}
                />
                <h3 className="text-lg font-bold text-white mt-3.5 tracking-tight">
                  {profile.name}
                </h3>
                <p className="text-xs text-[#ff1744] font-medium">@{profile.username}</p>

                {profile.bio && (
                  <p className="text-xs text-slate-300 mt-3 px-4 leading-relaxed max-w-sm bg-white/[0.02] py-2 rounded-xl border border-white/5">
                    {profile.bio}
                  </p>
                )}

                {/* Real Followers & Following Counts from Database (Clickable) */}
                <div className="grid grid-cols-2 gap-3 w-full max-w-xs mt-3.5">
                  <button
                    type="button"
                    onClick={() => setView('followers')}
                    className="nexa-profile-stat-box flex flex-col items-center justify-center p-3 rounded-2xl bg-[#050505] border border-[#ff1744]/20 hover:border-[#ff1744]/50 hover:shadow-[0_0_15px_rgba(255,23,68,0.15)] hover:bg-white/[0.02] transition-all cursor-pointer shadow-xs active:scale-98 group"
                    title="View accounts that follow this user"
                  >
                    <span className="text-base font-extrabold text-white group-hover:text-[#ff1744] transition-colors">
                      {profile.followersCount ?? 0}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-400 group-hover:text-slate-300 uppercase tracking-wider mt-0.5">
                      Followers
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setView('following')}
                    className="nexa-profile-stat-box flex flex-col items-center justify-center p-3 rounded-2xl bg-[#050505] border border-[#ff1744]/20 hover:border-[#ff1744]/50 hover:shadow-[0_0_15px_rgba(255,23,68,0.15)] hover:bg-white/[0.02] transition-all cursor-pointer shadow-xs active:scale-98 group"
                    title="View accounts this user follows"
                  >
                    <span className="text-base font-extrabold text-white group-hover:text-[#ff1744] transition-colors">
                      {profile.followingCount ?? 0}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-400 group-hover:text-slate-300 uppercase tracking-wider mt-0.5">
                      Following
                    </span>
                  </button>
                </div>

                {/* Edit Profile Option for My Profile */}
                {status === 'self' && (
                  <div className="w-full max-w-xs pt-3">
                    <button
                      type="button"
                      onClick={() => {
                        if (onEditProfile) {
                          onEditProfile();
                        }
                      }}
                      className="w-full py-2.5 rounded-xl bg-[#ff1744]/10 hover:bg-[#ff1744]/20 border border-[#ff1744]/30 text-white font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all shadow-[0_0_12px_rgba(255,23,68,0.1)]"
                    >
                      <Pencil className="w-3.5 h-3.5 text-[#ff1744]" />
                      <span>Edit Profile</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Relationship Action & Conversation Controls Area for Other Users */}
              {status !== 'self' && (
                <div className="pt-2 border-t border-white/10 flex flex-col gap-2.5">
                  {status === 'blocked' ? (
                    profile.isBlocker ? (
                      <div className="space-y-3">
                        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-center">
                          <p className="text-xs font-semibold text-rose-400">You blocked this user</p>
                          <p className="text-[11px] text-slate-400 mt-1">
                            They cannot message you or send follow requests.
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={actionLoading}
                          onClick={handleUnblock}
                          className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all"
                        >
                          {actionLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <ShieldCheck className="w-4 h-4 text-amber-400" />
                          )}
                          <span>Unblock User</span>
                        </button>
                      </div>
                    ) : (
                      <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 text-center">
                        <p className="text-xs font-semibold text-slate-400">User is unavailable</p>
                        <p className="text-[11px] text-slate-500 mt-1">
                          You cannot communicate with this user.
                        </p>
                      </div>
                    )
                  ) : (status === 'connected' || status === 'following') ? (
                    <>
                      {/* Primary Chat Action */}
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={handleOpenChat}
                        className="group w-full py-2.5 rounded-xl bg-gradient-to-r from-[#ff1744] via-[#d3121f] to-[#991b1b] hover:brightness-110 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_15px_rgba(255,23,68,0.3)] transition-all"
                      >
                        {actionLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <AnimatedSendIcon className="w-4 h-4" />
                        )}
                        <span>Message</span>
                      </button>

                      {/* 1. Conversation Info & Media */}
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={handleInfoMedia}
                        className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-[#ff1744]/15 border border-white/10 hover:border-[#ff1744]/30 text-slate-200 hover:text-white font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all"
                      >
                        <Info className="w-4 h-4 text-[#ff1744]" />
                        <span>Conversation Info & Media</span>
                      </button>

                      {/* 2. Unfollow */}
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() => setConfirmAction('unfollow')}
                        className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all"
                      >
                        <UserMinus className="w-4 h-4 text-slate-400" />
                        <span>Unfollow</span>
                      </button>

                      {/* 3. Block */}
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() => setConfirmAction('block')}
                        className="w-full py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all"
                      >
                        <Ban className="w-4 h-4 text-rose-400" />
                        <span>Block</span>
                      </button>
                    </>
                  ) : status === 'follow_back' ? (
                    <>
                      {/* Follow Back Button */}
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={handleFollowBack}
                        className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#ff1744] via-[#d3121f] to-[#991b1b] hover:brightness-110 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_15px_rgba(255,23,68,0.3)] transition-all"
                      >
                        {actionLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <UserPlus className="w-4 h-4" />
                        )}
                        <span>Follow Back</span>
                      </button>

                      {/* Message Option */}
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={handleOpenChat}
                        className="group w-full py-2.5 rounded-xl bg-white/5 hover:bg-[#ff1744]/15 border border-white/10 hover:border-[#ff1744]/30 text-slate-200 hover:text-white font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all"
                      >
                        <AnimatedSendIcon className="w-4 h-4 text-[#ff1744]" />
                        <span>Message</span>
                      </button>

                      {/* Block */}
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() => setConfirmAction('block')}
                        className="w-full py-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        <span>Block @{profile.username}</span>
                      </button>
                    </>
                  ) : status === 'pending_sent' ? (
                    <>
                      <div className="w-full py-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-400 font-semibold text-xs flex items-center justify-center gap-2 select-none">
                        <Clock className="w-4 h-4 text-amber-400" />
                        <span>Request Sent (Pending)</span>
                      </div>
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() => setConfirmAction('block')}
                        className="w-full py-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        <span>Block @{profile.username}</span>
                      </button>
                    </>
                  ) : status === 'pending_received' ? (
                    <>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={actionLoading}
                          onClick={handleAccept}
                          className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all"
                        >
                          <Check className="w-4 h-4" /> Accept
                        </button>
                        <button
                          type="button"
                          disabled={actionLoading}
                          onClick={handleDecline}
                          className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-slate-300 font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all"
                        >
                          <X className="w-4 h-4" /> Decline
                        </button>
                      </div>
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() => setConfirmAction('block')}
                        className="w-full py-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        <span>Block @{profile.username}</span>
                      </button>
                    </>
                  ) : status === 'declined' ? (
                    <>
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={handleFollow}
                        className="w-full py-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all"
                      >
                        {actionLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <UserPlus className="w-4 h-4" />
                        )}
                        <span>Follow Again</span>
                      </button>
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() => setConfirmAction('block')}
                        className="w-full py-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        <span>Block @{profile.username}</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={handleFollow}
                        className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#ff1744] via-[#d3121f] to-[#991b1b] hover:brightness-110 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_15px_rgba(255,23,68,0.3)] transition-all"
                      >
                        {actionLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <UserPlus className="w-4 h-4" />
                        )}
                        <span>Follow to Message</span>
                      </button>
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() => setConfirmAction('block')}
                        className="w-full py-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        <span>Block @{profile.username}</span>
                      </button>
                    </>
                  )}

                  {/* Theme Option (specifically for other user's profile) */}
                  <button
                    type="button"
                    onClick={() => setView('theme')}
                    className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-[#ff1744]/15 border border-white/10 hover:border-[#ff1744]/30 text-slate-200 hover:text-white font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all"
                    title="Change chat background theme for this user"
                  >
                    <Palette className="w-4 h-4 text-[#ff1744]" />
                    <span>Theme</span>
                  </button>
                </div>
              )}
            </div>
          ) : view === 'theme' ? (
            /* Theme Selection Subview */
            <div className="space-y-4">
              {/* Subview Header with Back button */}
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <button
                  type="button"
                  onClick={() => setView('profile')}
                  className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Profile</span>
                </button>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  Chat Theme
                </h4>
                <div className="w-10" />
              </div>

              <ChatThemeSelector
                targetUserId={activeUserId}
                conversationId={activeConversation?._id}
              />
            </div>
          ) : (
            /* Followers / Following List Subview */
            <div className="space-y-4">
              {/* Subview Header with Back button */}
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <button
                  type="button"
                  onClick={() => setView('profile')}
                  className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Profile</span>
                </button>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  {view === 'followers' ? 'Followers' : 'Following'} ({followList.length})
                </h4>
                <div className="w-10" />
              </div>

              {/* List Content */}
              {loadingFollowList ? (
                <div className="py-12 flex flex-col items-center justify-center text-slate-500 gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
                  <span className="text-xs">
                    Loading {view === 'followers' ? 'followers' : 'following'}...
                  </span>
                </div>
              ) : followList.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-center text-slate-500">
                  <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-3 text-slate-400">
                    <Users className="w-6 h-6 text-amber-400" />
                  </div>
                  <h5 className="text-sm font-semibold text-white mb-1">
                    {view === 'followers' ? 'No followers yet' : 'Not following anyone yet'}
                  </h5>
                  <p className="text-xs text-slate-400 max-w-xs">
                    {view === 'followers'
                      ? `Accounts that follow @${profile?.username || 'this user'} will appear here.`
                      : `Accounts @${profile?.username || 'this user'} follows will appear here.`}
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                  {followList.map((targetUser) => (
                    <div
                      key={targetUser._id}
                      className="nexa-user-card flex items-center justify-between p-3 rounded-xl bg-[#0a0a0f] border border-[#ff1744]/15 hover:border-[#ff1744]/35 transition-colors"
                    >
                      {/* Clickable Profile Info: navigates to that user's profile view */}
                      <div
                        className="flex items-center gap-3 min-w-0 cursor-pointer group flex-1 mr-2"
                        onClick={() => handleSelectAccountFromList(targetUser._id)}
                        title="View profile & options"
                      >
                        <Avatar
                          src={targetUser.avatar}
                          name={targetUser.name}
                          size="md"
                          showStatus={false}
                        />
                        <div className="min-w-0">
                          <h5 className="text-xs sm:text-sm font-semibold text-white truncate group-hover:text-[#ff1744] transition-colors">
                            {targetUser.name}
                          </h5>
                          <p className="text-[11px] text-[#ff1744]/80 font-medium truncate">
                            @{targetUser.username}
                          </p>
                        </div>
                      </div>

                      {/* Relationship Action Button */}
                      <div className="flex-shrink-0">
                        {targetUser.relationshipStatus === 'self' ? (
                          <span className="text-[11px] text-slate-500 font-medium px-2 py-1">
                            You
                          </span>
                        ) : targetUser.relationshipStatus === 'follow_back' ? (
                          <button
                            type="button"
                            disabled={actionTargetId === targetUser._id}
                            onClick={() => handleListFollowBack(targetUser)}
                            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#ff1744] via-[#d3121f] to-[#991b1b] hover:brightness-110 active:scale-95 text-white font-bold text-xs transition-all cursor-pointer shadow-[0_0_10px_rgba(255,23,68,0.3)] flex items-center gap-1"
                          >
                            {actionTargetId === targetUser._id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <UserPlus className="w-3 h-3" />
                            )}
                            <span>Follow Back</span>
                          </button>
                        ) : (targetUser.relationshipStatus === 'connected' || targetUser.relationshipStatus === 'following') ? (
                          <div className="flex items-center gap-1.5">
                            <span className="px-2 py-1 rounded-xl bg-white/5 border border-white/10 text-emerald-400 font-medium text-[11px] select-none flex items-center gap-1">
                              <UserCheck className="w-3 h-3" /> Following
                            </span>
                            <button
                              type="button"
                              disabled={actionTargetId === targetUser._id}
                              onClick={() => handleListMessage(targetUser)}
                              className="group p-1.5 rounded-xl bg-[#ff1744]/15 hover:bg-[#ff1744]/25 border border-[#ff1744]/30 text-[#ff1744] font-semibold text-xs transition-all cursor-pointer shadow-sm shadow-[#ff1744]/10"
                              title="Open direct message"
                              aria-label="Direct Message"
                            >
                              <AnimatedSendIcon className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : targetUser.relationshipStatus === 'pending_sent' ? (
                          <span className="px-2.5 py-1 rounded-xl bg-white/5 border border-white/10 text-slate-400 font-medium text-[11px] select-none">
                            Request Sent
                          </span>
                        ) : targetUser.relationshipStatus === 'pending_received' ? (
                          <button
                            type="button"
                            disabled={actionTargetId === targetUser._id}
                            onClick={() => handleListAccept(targetUser)}
                            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#ff1744] via-[#d3121f] to-[#991b1b] hover:brightness-110 active:scale-95 text-white font-bold text-xs transition-all cursor-pointer shadow-[0_0_10px_rgba(255,23,68,0.3)] flex items-center gap-1"
                          >
                            {actionTargetId === targetUser._id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Check className="w-3.5 h-3.5" />
                            )}
                            <span>Accept</span>
                          </button>
                        ) : targetUser.relationshipStatus === 'blocked' ? (
                          <span className="px-2.5 py-1 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 font-medium text-[11px] select-none">
                            Blocked
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={actionTargetId === targetUser._id}
                            onClick={() => handleListFollow(targetUser)}
                            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#ff1744] via-[#d3121f] to-[#991b1b] hover:brightness-110 active:scale-95 text-white font-bold text-xs transition-all cursor-pointer shadow-[0_0_10px_rgba(255,23,68,0.3)] flex items-center gap-1"
                          >
                            {actionTargetId === targetUser._id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <UserPlus className="w-3 h-3" />
                            )}
                            <span>Follow</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Confirmation Dialogs for Unfollow & Block */}
          {confirmAction && (
            <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 overflow-y-auto bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
              <div className="w-full max-w-sm max-w-[calc(100vw-24px)] bg-[#0a0a0f] border border-[#ff1744]/25 rounded-2xl p-5 sm:p-6 shadow-[0_0_35px_rgba(255,23,68,0.15)] space-y-4 my-auto">
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2.5 rounded-xl ${
                      confirmAction === 'block'
                        ? 'bg-rose-500/15 text-rose-400 border border-rose-500/20'
                        : 'bg-[#ff1744]/15 text-[#ff1744] border border-[#ff1744]/25'
                    }`}
                  >
                    {confirmAction === 'block' ? (
                      <Ban className="w-5 h-5" />
                    ) : (
                      <UserMinus className="w-5 h-5" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-base font-bold text-white truncate">
                      {confirmAction === 'block'
                        ? `Block @${profile?.username}?`
                        : `Unfollow @${profile?.username}?`}
                    </h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {confirmAction === 'block'
                        ? "They won't be able to interact with you."
                        : `You will no longer be able to message @${profile?.username}.`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => setConfirmAction(null)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/5 border border-white/10 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={
                      confirmAction === 'block'
                        ? handleBlockConfirm
                        : handleUnfollowConfirm
                    }
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/20 transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>{confirmAction === 'block' ? 'Block' : 'Unfollow'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="py-8 text-center text-xs text-slate-500">User not found</div>
      )}
    </Modal>
  );
};
