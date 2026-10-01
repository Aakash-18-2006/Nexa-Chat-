import React, { useState, useEffect } from 'react';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { chatApi, groupApi, userApi, followApi } from '../../api/endpoints';
import { Avatar } from '../ui/Avatar';
import { UserProfileModal } from '../profile/UserProfileModal';
import { formatDate, formatFileSize } from '../../utils/formatters';
import { resolveMediaUrl } from '../../utils/urlConfig';
import { openOrDownloadFile } from '../../utils/fileHandler';
import AnimatedSendIcon from '../common/AnimatedSendIcon';
import {
  X,
  Users,
  Image,
  FileText,
  Pin,
  ShieldCheck,
  UserPlus,
  UserMinus,
  UserCheck,
  LogOut,
  Download,
  MessageSquare,
  Clock,
  Check,
  Ban,
  Loader2,
  ArrowLeft,
  Palette
} from 'lucide-react';
import { ChatThemeSelector } from './ChatThemeSelector';

export const RightPanel = ({ conversation, onClose, onOpenAddMember }) => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const { messages, fetchConversations, setActiveConversation, selectConversation } = useChat();

  const [tab, setTab] = useState('info'); // 'info' (User Profile / Group Info) | 'media' | 'files' | 'pinned'
  const [profileView, setProfileView] = useState('main'); // 'main' | 'followers' | 'following'
  const [mediaList, setMediaList] = useState([]);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [selectedProfileUserId, setSelectedProfileUserId] = useState(null);

  // Profile data for direct chat participant
  const [profileData, setProfileData] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Followers & Following list state
  const [followList, setFollowList] = useState([]);
  const [loadingFollowList, setLoadingFollowList] = useState(false);
  const [actionTargetId, setActionTargetId] = useState(null);

  const isGroup = conversation?.type === 'group';
  const otherParticipant = !isGroup
    ? conversation?.participants?.find((p) => (p._id || p) !== user?._id)
    : null;

  const title = isGroup
    ? conversation.groupInfo?.name || 'Group Details'
    : otherParticipant?.name || 'Contact Info';

  const avatar = isGroup
    ? conversation.groupInfo?.avatar
    : otherParticipant?.avatar;

  const isCurrentUserAdmin =
    isGroup &&
    conversation.groupInfo?.adminIds?.some(
      (a) => (a._id || a) === user?._id
    );

  // Reset subview when conversation or tab changes
  useEffect(() => {
    setProfileView('main');
  }, [conversation?._id, tab]);

  // Load real user profile from database for direct chat
  const loadProfile = async () => {
    if (isGroup || !otherParticipant) return;
    const targetId = otherParticipant._id || otherParticipant;
    setLoadingProfile(true);
    try {
      const res = await userApi.getProfile(targetId);
      if (res.data.success) {
        setProfileData(res.data.user);
      }
    } catch (err) {
      console.error('Failed to load user profile in RightPanel:', err);
    } finally {
      setLoadingProfile(false);
    }
  };

  useEffect(() => {
    if (!isGroup && otherParticipant) {
      loadProfile();
    }
  }, [conversation?._id, otherParticipant?._id || otherParticipant]);

  // Real-time synchronization for relationship and follow count changes
  useEffect(() => {
    if (!socket || isGroup) return;

    const targetId = (otherParticipant?._id || otherParticipant)?.toString();

    const handleRelationshipChanged = ({ userId: uId }) => {
      if (uId === targetId) {
        loadProfile();
        if (profileView === 'followers' || profileView === 'following') {
          loadFollowList(profileView);
        }
      }
    };

    const handleFollowAccepted = ({ userId: uId }) => {
      if (uId === targetId) {
        loadProfile();
        if (profileView === 'followers' || profileView === 'following') {
          loadFollowList(profileView);
        }
      }
    };

    socket.on('relationship_changed', handleRelationshipChanged);
    socket.on('follow_request_accepted', handleFollowAccepted);
    return () => {
      socket.off('relationship_changed', handleRelationshipChanged);
      socket.off('follow_request_accepted', handleFollowAccepted);
    };
  }, [socket, isGroup, otherParticipant, profileView]);

  // Load followers or following list
  const loadFollowList = async (type) => {
    const targetId = profileData?._id || otherParticipant?._id || otherParticipant;
    if (!targetId) return;
    setLoadingFollowList(true);
    try {
      const res = type === 'followers'
        ? await followApi.getFollowers(targetId)
        : await followApi.getFollowing(targetId);
      if (res.data.success) {
        setFollowList(res.data.users || []);
      }
    } catch (err) {
      console.error(`Failed to load ${type}:`, err);
    } finally {
      setLoadingFollowList(false);
    }
  };

  useEffect(() => {
    if (!isGroup && (profileView === 'followers' || profileView === 'following')) {
      loadFollowList(profileView);
    }
  }, [profileView, profileData?._id]);

  // Fetch media & files
  useEffect(() => {
    if (tab === 'media' || tab === 'files') {
      const loadMedia = async () => {
        setLoadingMedia(true);
        try {
          const res = await chatApi.getConversationMedia(conversation._id);
          if (res.data.success) {
            setMediaList(res.data.media);
          }
        } catch (err) {
          console.error('Failed to load media:', err);
        } finally {
          setLoadingMedia(false);
        }
      };
      loadMedia();
    }
  }, [conversation?._id, tab]);

  // Main follow request handlers
  const handleFollow = async () => {
    const targetId = profileData?._id || otherParticipant?._id || otherParticipant;
    if (!targetId) return;
    try {
      setActionLoading(true);
      const res = await followApi.sendRequest(targetId);
      if (res.data.success) {
        setProfileData((prev) => ({
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
    if (!profileData) return;
    try {
      setActionLoading(true);
      const res = await followApi.followBack(profileData._id);
      if (res.data.success) {
        await loadProfile();
        await fetchConversations();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to follow back');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!profileData?.requestId) return;
    try {
      setActionLoading(true);
      const res = await followApi.acceptRequest(profileData.requestId);
      if (res.data.success) {
        await loadProfile();
        await fetchConversations();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to accept follow request');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDecline = async () => {
    if (!profileData?.requestId) return;
    try {
      setActionLoading(true);
      const res = await followApi.declineRequest(profileData.requestId);
      if (res.data.success) {
        setProfileData((prev) => ({ ...prev, relationshipStatus: 'declined' }));
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to decline follow request');
    } finally {
      setActionLoading(false);
    }
  };

  const handleMessage = () => {
    const composer = document.querySelector('textarea, input[placeholder*="message"]');
    if (composer) {
      composer.focus();
    }
  };

  // List item relationship handlers
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
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Could not open conversation');
    } finally {
      setActionTargetId(null);
    }
  };

  // Group handlers
  const handleRemoveMember = async (memberId) => {
    if (!confirm('Remove this member from the group?')) return;
    try {
      const res = await groupApi.removeMember(conversation._id, memberId);
      if (res.data.success) {
        setActiveConversation(res.data.group);
        fetchConversations();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to remove member');
    }
  };

  const handleToggleAdmin = async (memberId, currentIsAdmin) => {
    try {
      const action = currentIsAdmin ? 'demote' : 'promote';
      const res = await groupApi.toggleAdmin(conversation._id, memberId, action);
      if (res.data.success) {
        setActiveConversation(res.data.group);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to change admin role');
    }
  };

  const handleLeaveGroup = async () => {
    if (!confirm('Are you sure you want to leave this group?')) return;
    try {
      const res = await groupApi.leaveGroup(conversation._id);
      if (res.data.success) {
        onClose();
        fetchConversations();
        setActiveConversation(null);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to leave group');
    }
  };

  const images = mediaList.filter((m) => m.mimeType?.startsWith('image/'));
  const files = mediaList.filter((m) => !m.mimeType?.startsWith('image/'));
  const pinnedMessages = conversation.pinnedMessages || [];

  const relStatus = profileData?.relationshipStatus || 'none';

  return (
    <div className="fixed md:relative inset-0 md:inset-auto w-full md:w-80 lg:w-96 h-full bg-[#08080d] border-l border-white/10 flex flex-col flex-shrink-0 z-40 md:z-20 animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
        <h3 className="text-sm font-bold text-white tracking-tight">
          {isGroup ? 'Group Information' : 'Chat Info'}
        </h3>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-[#ff1744] hover:bg-[#ff1744]/10 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs: User Profile | Media | Files | Pinned */}
      <div className="flex border-b border-white/5 px-3 sm:px-4 pt-2 gap-1 text-xs select-none overflow-x-auto scrollbar-none">
        {[
          { id: 'info', label: isGroup ? 'Group Info' : 'User Profile' },
          { id: 'media', label: `Media (${images.length})` },
          { id: 'files', label: `Files (${files.length})` },
          { id: 'pinned', label: `Pinned (${pinnedMessages.length})` }
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 font-medium border-b-2 transition-colors cursor-pointer whitespace-nowrap flex-shrink-0 ${
              tab === t.id
                ? 'border-[#ff1744] text-[#ff1744] font-bold shadow-[0_0_12px_rgba(255,23,68,0.25)]'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-5">
        {/* User Profile Tab (or Group Info for groups) */}
        {tab === 'info' && (
          isGroup ? (
            <div className="space-y-6">
              {/* Group Profile Summary */}
              <div className="flex flex-col items-center text-center">
                <Avatar src={avatar} name={title} size="xl" showStatus={false} />
                <h4 className="text-base font-bold text-white mt-3">{title}</h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  {conversation.participants?.length || 0} participants
                </p>
                {conversation.groupInfo?.description && (
                  <p className="text-xs text-slate-300 mt-2 px-4 leading-relaxed opacity-90">
                    {conversation.groupInfo.description}
                  </p>
                )}
              </div>

              {/* In Group: Member List */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Members ({conversation.participants?.length || 0})
                  </span>
                  {isCurrentUserAdmin && (
                    <button
                      onClick={onOpenAddMember}
                      className="text-xs font-semibold text-[#ff1744] hover:text-[#ff2a55] flex items-center gap-1 cursor-pointer"
                    >
                      <UserPlus className="w-3.5 h-3.5" /> Add
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  {conversation.participants?.map((member) => {
                    const memberId = member._id || member;
                    const isAdmin = conversation.groupInfo?.adminIds?.some(
                      (a) => (a._id || a) === memberId
                    );
                    const isSelf = memberId === user?._id;

                    return (
                      <div
                        key={memberId}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-[#0a0a0f] border border-[#ff1744]/15 text-xs shadow-[0_0_12px_rgba(255,23,68,0.02)]"
                      >
                        <div
                          className="flex items-center gap-2.5 min-w-0 cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => {
                            if (!isSelf) setSelectedProfileUserId(memberId);
                          }}
                        >
                          <Avatar
                            src={member.avatar}
                            name={member.name || 'Member'}
                            size="sm"
                            showStatus={false}
                          />
                          <div className="truncate">
                            <span className="font-semibold text-white truncate block">
                              {member.name || 'User'} {isSelf && '(You)'}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              @{member.username}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {isAdmin && (
                            <span className="px-2 py-0.5 rounded-md bg-[#ff1744]/15 text-[#ff1744] font-semibold text-[10px] border border-[#ff1744]/30">
                              Admin
                            </span>
                          )}

                          {isCurrentUserAdmin && !isSelf && (
                            <>
                              <button
                                onClick={() => handleToggleAdmin(memberId, isAdmin)}
                                title={isAdmin ? 'Demote Admin' : 'Make Admin'}
                                className="p-1 rounded text-slate-400 hover:text-[#ff1744] cursor-pointer"
                              >
                                <ShieldCheck className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleRemoveMember(memberId)}
                                title="Remove from group"
                                className="p-1 rounded text-slate-400 hover:text-rose-400 cursor-pointer"
                              >
                                <UserMinus className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Leave Group */}
                <div className="pt-4 mt-6 border-t border-white/5">
                  <button
                    onClick={handleLeaveGroup}
                    className="w-full py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" /> Leave Group
                  </button>
                </div>
              </div>
            </div>
          ) : profileView === 'main' ? (
            <div className="flex flex-col items-center text-center space-y-4 pt-2">
              {/* Profile Photo */}
              <Avatar
                src={profileData?.avatar || avatar}
                name={profileData?.name || title}
                size="xl"
                showStatus={false}
              />

              {/* Name & Username */}
              <div>
                <h4 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  {profileData?.name || title}
                </h4>
                <p className="text-xs text-[#ff1744] font-medium mt-0.5">
                  @{profileData?.username || otherParticipant?.username || 'user'}
                </p>
              </div>

              {/* Bio if available */}
              {profileData?.bio && (
                <p className="text-xs text-slate-300 px-3 py-2 rounded-xl bg-white/[0.02] border border-white/5 leading-relaxed text-center max-w-xs">
                  {profileData.bio}
                </p>
              )}

              {/* Real Followers & Following Counts from Database (Clickable) */}
              <div className="grid grid-cols-2 gap-3 w-full max-w-xs mt-2">
                <button
                  type="button"
                  onClick={() => setProfileView('followers')}
                  className="flex flex-col items-center justify-center p-3 rounded-2xl bg-[#0d0d14] border border-white/10 hover:border-[#ff1744]/40 hover:shadow-[0_0_15px_rgba(255,23,68,0.15)] transition-all cursor-pointer shadow-xs active:scale-98 group"
                  title="View accounts that follow this user"
                >
                  <span className="text-base sm:text-lg font-extrabold text-white group-hover:text-[#ff1744] transition-colors">
                    {loadingProfile ? (
                      <Loader2 className="w-4 h-4 animate-spin text-[#ff1744] inline" />
                    ) : (
                      profileData?.followersCount ?? 0
                    )}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-400 group-hover:text-slate-300 uppercase tracking-wider mt-0.5">
                    Followers
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setProfileView('following')}
                  className="flex flex-col items-center justify-center p-3 rounded-2xl bg-[#0d0d14] border border-white/10 hover:border-[#ff1744]/40 hover:shadow-[0_0_15px_rgba(255,23,68,0.15)] transition-all cursor-pointer shadow-xs active:scale-98 group"
                  title="View accounts this user follows"
                >
                  <span className="text-base sm:text-lg font-extrabold text-white group-hover:text-[#ff1744] transition-colors">
                    {loadingProfile ? (
                      <Loader2 className="w-4 h-4 animate-spin text-[#ff1744] inline" />
                    ) : (
                      profileData?.followingCount ?? 0
                    )}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-400 group-hover:text-slate-300 uppercase tracking-wider mt-0.5">
                    Following
                  </span>
                </button>
              </div>

              {/* Follow Request / Connection Button */}
              <div className="w-full max-w-xs pt-2">
                {(relStatus === 'connected' || relStatus === 'following') ? (
                  <button
                    type="button"
                    onClick={handleMessage}
                    className="group w-full py-2.5 rounded-xl bg-gradient-to-r from-[#ff1744] via-[#d3121f] to-[#991b1b] hover:opacity-95 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_15px_rgba(255,23,68,0.3)] transition-all"
                  >
                    <AnimatedSendIcon className="w-4 h-4" />
                    <span>Message</span>
                  </button>
                ) : relStatus === 'follow_back' ? (
                  <div className="space-y-2 w-full">
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={handleFollowBack}
                      className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#ff1744] via-[#d3121f] to-[#991b1b] hover:opacity-95 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_15px_rgba(255,23,68,0.3)] transition-all"
                    >
                      {actionLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <UserPlus className="w-4 h-4" />
                      )}
                      <span>Follow Back</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleMessage}
                      className="group w-full py-2 rounded-xl bg-white/5 hover:bg-[#ff1744]/15 border border-white/10 hover:border-[#ff1744]/30 text-white font-medium text-xs flex items-center justify-center gap-2 cursor-pointer transition-all"
                    >
                      <AnimatedSendIcon className="w-3.5 h-3.5 text-[#ff1744]" />
                      <span>Message</span>
                    </button>
                  </div>
                ) : relStatus === 'pending_sent' ? (
                  <div className="w-full py-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-400 font-semibold text-xs flex items-center justify-center gap-2 select-none">
                    <Clock className="w-4 h-4 text-[#ff1744]" />
                    <span>Request Sent</span>
                  </div>
                ) : relStatus === 'pending_received' ? (
                  <div className="flex gap-2 w-full">
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={handleAccept}
                      className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all"
                    >
                      {actionLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                      <span>Accept</span>
                    </button>
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={handleDecline}
                      className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-slate-300 font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all"
                    >
                      <X className="w-4 h-4" />
                      <span>Decline</span>
                    </button>
                  </div>
                ) : relStatus === 'blocked' ? (
                  <div className="w-full py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 font-semibold text-xs flex items-center justify-center gap-2 select-none">
                    <Ban className="w-4 h-4" />
                    <span>Blocked</span>
                  </div>
                ) : relStatus === 'declined' ? (
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={handleFollow}
                    className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-[#ff1744]/20 border border-[#ff1744]/40 text-[#ff1744] font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all hover:shadow-[0_0_15px_rgba(255,23,68,0.2)]"
                  >
                    {actionLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <UserPlus className="w-4 h-4" />
                    )}
                    <span>Follow Again</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={handleFollow}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#ff1744] via-[#d3121f] to-[#991b1b] hover:opacity-95 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_15px_rgba(255,23,68,0.3)] transition-all"
                  >
                    {actionLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <UserPlus className="w-4 h-4" />
                    )}
                    <span>Follow to Message</span>
                  </button>
                )}
              </div>

              {/* Chat Theme Option for direct user profile */}
              {otherParticipant && (
                <div className="w-full max-w-xs pt-2">
                  <button
                    type="button"
                    onClick={() => setProfileView('theme')}
                    className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-[#ff1744]/15 border border-white/10 hover:border-[#ff1744]/30 text-slate-200 hover:text-white font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all"
                    title="Change chat background theme for this user"
                  >
                    <Palette className="w-4 h-4 text-[#ff1744]" />
                    <span>Theme</span>
                  </button>
                </div>
              )}
            </div>
          ) : profileView === 'theme' ? (
            /* Theme Selection Subview */
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <button
                  type="button"
                  onClick={() => setProfileView('main')}
                  className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  Chat Theme
                </h4>
                <div className="w-10" />
              </div>

              <ChatThemeSelector
                targetUserId={otherParticipant?._id || otherParticipant}
                conversationId={conversation?._id}
              />
            </div>
          ) : (
            /* Followers / Following List Subview */
            <div className="space-y-4">
              {/* Subview Header with Back button */}
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <button
                  type="button"
                  onClick={() => setProfileView('main')}
                  className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  {profileView === 'followers' ? 'Followers' : 'Following'} ({followList.length})
                </h4>
                <div className="w-10" />
              </div>

              {/* List Content */}
              {loadingFollowList ? (
                <div className="py-12 flex flex-col items-center justify-center text-slate-500 gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-[#ff1744]" />
                  <span className="text-xs">
                    Loading {profileView === 'followers' ? 'followers' : 'following'}...
                  </span>
                </div>
              ) : followList.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-center text-slate-500">
                  <div className="w-12 h-12 rounded-2xl bg-white/5 border border-[#ff1744]/20 flex items-center justify-center mb-3 text-slate-400 shadow-[0_0_15px_rgba(255,23,68,0.06)]">
                    <Users className="w-6 h-6 text-[#ff1744]" />
                  </div>
                  <h5 className="text-sm font-semibold text-white mb-1">
                    {profileView === 'followers' ? 'No followers yet' : 'Not following anyone yet'}
                  </h5>
                  <p className="text-xs text-slate-400 max-w-xs">
                    {profileView === 'followers'
                      ? `Accounts that follow @${profileData?.username || 'this user'} will appear here.`
                      : `Accounts @${profileData?.username || 'this user'} follows will appear here.`}
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                  {followList.map((targetUser) => (
                    <div
                      key={targetUser._id}
                      className="flex items-center justify-between p-3 rounded-xl bg-[#0a0a0f] border border-[#ff1744]/15 hover:border-[#ff1744]/35 transition-colors"
                    >
                      {/* Clickable Profile Info: opens full UserProfileModal */}
                      <div
                        className="flex items-center gap-3 min-w-0 cursor-pointer group flex-1 mr-2"
                        onClick={() => setSelectedProfileUserId(targetUser._id)}
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
                            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#ff1744] to-[#991b1b] hover:brightness-110 active:scale-95 text-white font-bold text-xs transition-all cursor-pointer shadow-[0_0_10px_rgba(255,23,68,0.3)] flex items-center gap-1"
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
                              <UserPlus className="w-3.5 h-3.5" />
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
          )
        )}

        {/* Media Tab */}
        {tab === 'media' && (
          <div>
            {images.length === 0 ? (
              <p className="text-center text-xs text-slate-500 py-8">No shared photos yet</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {images.map((img, i) => {
                  const mediaUrl = resolveMediaUrl(img.url);
                  return (
                    <a
                      key={i}
                      href={mediaUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="aspect-square rounded-xl overflow-hidden border border-white/10 hover:opacity-90 transition-opacity"
                    >
                      <img src={mediaUrl} alt="Shared" className="w-full h-full object-cover" />
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Files Tab */}
        {tab === 'files' && (
          <div>
            {files.length === 0 ? (
              <p className="text-center text-xs text-slate-500 py-8">No shared documents yet</p>
            ) : (
              <div className="space-y-2">
                {files.map((file, i) => {
                  return (
                    <div
                      key={i}
                      onClick={() =>
                        openOrDownloadFile({
                          url: file.url,
                          name: file.name,
                          mimeType: file.mimeType
                        })
                      }
                      className="flex items-center justify-between p-3 rounded-xl bg-[#0a0a0f] border border-[#ff1744]/15 text-xs shadow-[0_0_12px_rgba(255,23,68,0.02)] cursor-pointer hover:bg-black/50 hover:border-[#ff1744]/30 transition-all select-none group/sharedfile"
                      title={`Open ${file.name || 'document'}`}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          openOrDownloadFile({
                            url: file.url,
                            name: file.name,
                            mimeType: file.mimeType
                          });
                        }
                      }}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 pointer-events-none">
                        <FileText className="w-4 h-4 text-[#ff1744] flex-shrink-0 group-hover/sharedfile:scale-110 transition-transform" />
                        <div className="truncate">
                          <span className="font-medium text-white truncate block group-hover/sharedfile:text-[#ff1744] transition-colors">
                            {file.name}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {formatFileSize(file.size)}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openOrDownloadFile({
                            url: file.url,
                            name: file.name,
                            mimeType: file.mimeType
                          });
                        }}
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-[#ff1744] text-white cursor-pointer transition-colors flex-shrink-0"
                        title="Download"
                        aria-label="Download"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Pinned Tab */}
        {tab === 'pinned' && (
          <div>
            {pinnedMessages.length === 0 ? (
              <p className="text-center text-xs text-slate-500 py-8">No pinned messages yet</p>
            ) : (
              <div className="space-y-2">
                {pinnedMessages.map((pm, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-xl bg-[#0a0a0f] border border-[#ff1744]/15 text-xs text-slate-200 shadow-[0_0_12px_rgba(255,23,68,0.02)]"
                  >
                    <div className="flex items-center justify-between mb-1 text-[11px] text-[#ff1744] font-semibold">
                      <span>{pm.sender?.name || 'Member'}</span>
                      <span>{formatDate(pm.createdAt)}</span>
                    </div>
                    <p className="whitespace-pre-wrap">{pm.content || '[Attachment]'}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <UserProfileModal
        userId={selectedProfileUserId}
        isOpen={!!selectedProfileUserId}
        onClose={() => {
          setSelectedProfileUserId(null);
          loadProfile();
          if (profileView === 'followers' || profileView === 'following') {
            loadFollowList(profileView);
          }
        }}
      />
    </div>
  );
};
