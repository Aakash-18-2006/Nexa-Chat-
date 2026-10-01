import React, { useState, useRef, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Avatar } from '../ui/Avatar';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useChat } from '../../context/ChatContext';
import { useSocket } from '../../context/SocketContext';
import { authApi, mediaApi, followApi, accountApi } from '../../api/endpoints';
import {
  User,
  Shield,
  Palette,
  Key,
  Check,
  CheckCircle2,
  AlertCircle,
  Mail,
  Moon,
  Sun,
  Laptop,
  Pencil,
  Loader2,
  Ban,
  ShieldCheck,
  ShieldAlert,
  Lock,
  Smartphone,
  Globe,
  Copy,
  Download,
  RefreshCw,
  LogOut,
  Trash2,
  Eye,
  EyeOff,
  AlertTriangle,
  QrCode,
  Flame,
  Sparkles,
  Zap
} from 'lucide-react';
import { RedBlackPulseBackground } from '../ui/RedBlackPulseBackground';
import { PainThemeBackground } from '../ui/PainThemeBackground';
import { RadiantSunshineBackground } from '../ui/RadiantSunshineBackground';
import { ChatSpaceBackground } from '../chat/ChatSpaceBackground';

export const SettingsModal = ({ isOpen, onClose, initialTab = 'account' }) => {
  const { user, updateUser, logoutAllDevices } = useAuth();
  const { theme, setTheme, backgroundTheme, setBackgroundTheme } = useTheme();
  const { fetchConversations } = useChat();
  const { socket } = useSocket();
  const fileInputRef = useRef(null);

  const [activeTab, setActiveTab] = useState(initialTab); // 'account' | 'privacy' | 'appearance' | 'security' | 'blocked'

  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Account State
  const [name, setName] = useState(user?.name || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [avatar, setAvatar] = useState(user?.avatar || '');

  // Privacy State
  const [lastSeen, setLastSeen] = useState(user?.settings?.privacy?.lastSeen || 'everyone');
  const [onlineStatus, setOnlineStatus] = useState(user?.settings?.privacy?.onlineStatus || 'everyone');
  const [readReceipts, setReadReceipts] = useState(user?.settings?.privacy?.readReceipts !== false);

  // Password Change State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  // 2FA Flow State
  const [enable2FAModal, setEnable2FAModal] = useState(false); // setup modal
  const [enable2FAStep, setEnable2FAStep] = useState('password'); // 'password' | 'scan' | 'codes'
  const [reauthPassword, setReauthPassword] = useState('');
  const [totpSecret, setTotpSecret] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [verifyTotpCode, setVerifyTotpCode] = useState('');
  const [recoveryCodesList, setRecoveryCodesList] = useState([]);
  const [twoFactorLoading, setTwoFactorLoading] = useState(false);
  const [twoFactorError, setTwoFactorError] = useState('');
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedCodes, setCopiedCodes] = useState(false);

  // Disable 2FA State
  const [disable2FAModal, setDisable2FAModal] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [disableLoading, setDisableLoading] = useState(false);
  const [disableError, setDisableError] = useState('');

  // Regenerate Recovery Codes State
  const [regenModal, setRegenModal] = useState(false);
  const [regenPassword, setRegenPassword] = useState('');
  const [regenLoading, setRegenLoading] = useState(false);
  const [regenError, setRegenError] = useState('');

  // Sessions State
  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [revokingSessionId, setRevokingSessionId] = useState(null);
  const [logoutAllConfirm, setLogoutAllConfirm] = useState(false);
  const [loggingOutAll, setLoggingOutAll] = useState(false);

  // Blocked Accounts State
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [loadingBlocked, setLoadingBlocked] = useState(false);
  const [unblockLoading, setUnblockLoading] = useState(false);
  const [confirmUnblockUser, setConfirmUnblockUser] = useState(null);

  const [savedMsg, setSavedMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Email Change State
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [newEmailInput, setNewEmailInput] = useState('');
  const [emailChangeLoading, setEmailChangeLoading] = useState(false);
  const [emailChangeError, setEmailChangeError] = useState('');
  const [emailSentSuccess, setEmailSentSuccess] = useState(false);
  const [sentToEmail, setSentToEmail] = useState('');

  // Username Change State
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [newUsernameInput, setNewUsernameInput] = useState('');
  const [usernameCheckLoading, setUsernameCheckLoading] = useState(false);
  const [usernameAvailability, setUsernameAvailability] = useState(null); // { available: boolean, valid: boolean, message: string, isCurrent?: boolean }
  const [usernameChangeLoading, setUsernameChangeLoading] = useState(false);
  const [usernameChangeError, setUsernameChangeError] = useState('');
  const [usernameChangeSuccess, setUsernameChangeSuccess] = useState('');

  // Debounced username availability check for Account Info
  useEffect(() => {
    if (!isEditingUsername) {
      setUsernameAvailability(null);
      setUsernameCheckLoading(false);
      return;
    }

    const trimmed = newUsernameInput.trim();
    if (!trimmed) {
      setUsernameAvailability(null);
      setUsernameCheckLoading(false);
      return;
    }

    const clean = trimmed.toLowerCase();
    const regex = /^[a-zA-Z0-9_]{3,30}$/;
    if (!regex.test(clean)) {
      setUsernameCheckLoading(false);
      setUsernameAvailability({
        available: false,
        valid: false,
        message: 'Username must be 3–30 characters and contain only letters, numbers, and underscores.'
      });
      return;
    }

    if (user && clean === user.username?.toLowerCase()) {
      setUsernameCheckLoading(false);
      setUsernameAvailability({
        available: true,
        valid: true,
        isCurrent: true,
        message: 'Username available'
      });
      return;
    }

    setUsernameCheckLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await accountApi.checkUsername(clean);
        if (res.data?.available) {
          setUsernameAvailability({
            available: true,
            valid: true,
            message: 'Username available'
          });
        } else {
          setUsernameAvailability({
            available: false,
            valid: res.data?.valid !== false,
            message: res.data?.message || 'Username already in use'
          });
        }
      } catch (err) {
        setUsernameAvailability({
          available: false,
          valid: false,
          message: err.response?.data?.message || 'Error checking availability'
        });
      } finally {
        setUsernameCheckLoading(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [newUsernameInput, isEditingUsername, user]);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setBio(user.bio || '');
      setAvatar(user.avatar || '');
      setLastSeen(user.settings?.privacy?.lastSeen || 'everyone');
      setOnlineStatus(user.settings?.privacy?.onlineStatus || 'everyone');
      setReadReceipts(user.settings?.privacy?.readReceipts !== false);
    }
  }, [user, isOpen]);

  // Refresh Account Info dynamically when Settings opens or Account tab is active
  useEffect(() => {
    if (isOpen && activeTab === 'account' && user) {
      accountApi.getAccountInfo()
        .then((res) => {
          if (res.data?.success && res.data.account) {
            const acc = res.data.account;
            if (
              acc.email !== user.email ||
              acc.isEmailVerified !== user.isEmailVerified ||
              (acc.username && acc.username !== user.username)
            ) {
              updateUser({
                email: acc.email,
                isEmailVerified: acc.isEmailVerified,
                username: acc.username || user.username
              });
            }
          }
        })
        .catch((err) => {
          console.debug('[Settings] Refresh account info:', err?.message);
        });
    }
  }, [isOpen, activeTab]);

  // Load Sessions when Security tab opens
  const loadSessions = async () => {
    setLoadingSessions(true);
    try {
      const res = await authApi.getSessions();
      if (res.data.success) {
        setSessions(res.data.sessions || []);
      }
    } catch (err) {
      console.error('Failed to load sessions:', err);
    } finally {
      setLoadingSessions(false);
    }
  };

  useEffect(() => {
    if (isOpen && activeTab === 'security') {
      loadSessions();
    }
  }, [isOpen, activeTab]);

  const loadBlockedUsers = async () => {
    setLoadingBlocked(true);
    try {
      const res = await followApi.getBlocked();
      if (res.data.success) {
        setBlockedUsers(res.data.blockedUsers || []);
      }
    } catch (err) {
      console.error('Failed to load blocked users:', err);
    } finally {
      setLoadingBlocked(false);
    }
  };

  useEffect(() => {
    if (isOpen && activeTab === 'blocked') {
      loadBlockedUsers();
    }
  }, [isOpen, activeTab]);

  // Real-time synchronization for block/unblock changes
  useEffect(() => {
    if (!socket || !isOpen) return;

    const handleRelationshipChanged = () => {
      if (activeTab === 'blocked') {
        loadBlockedUsers();
      }
    };

    socket.on('relationship_changed', handleRelationshipChanged);
    return () => {
      socket.off('relationship_changed', handleRelationshipChanged);
    };
  }, [socket, isOpen, activeTab]);

  const handleAvatarFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    e.target.value = '';

    const validMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!validMimeTypes.includes(file.type)) {
      setErrorMsg('Please select a valid image file (JPEG, PNG, WebP, or GIF).');
      return;
    }

    const maxSizeBytes = 5 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      setErrorMsg('Image file size must be less than 5MB.');
      return;
    }

    setUploadingAvatar(true);
    setErrorMsg('');
    setSavedMsg('');

    const previewUrl = URL.createObjectURL(file);
    const previousAvatar = avatar;
    setAvatar(previewUrl);

    try {
      const uploadRes = await mediaApi.uploadFile(file);
      const uploadedUrl = uploadRes.data?.file?.url;
      if (!uploadedUrl) {
        throw new Error(uploadRes.data?.message || 'Failed to upload profile image.');
      }

      const profileRes = await authApi.updateProfile({ avatar: uploadedUrl });
      if (profileRes.data?.success && profileRes.data?.user) {
        updateUser(profileRes.data.user);
        setAvatar(uploadedUrl);
        setSavedMsg('Profile picture updated successfully!');
        setTimeout(() => setSavedMsg(''), 2500);
      } else {
        throw new Error(profileRes.data?.message || 'Failed to save profile picture.');
      }
    } catch (err) {
      console.error('Profile image upload failed:', err);
      setAvatar(previousAvatar);
      setErrorMsg(err.response?.data?.message || err.message || 'Failed to upload profile image.');
    } finally {
      setUploadingAvatar(false);
      URL.revokeObjectURL(previewUrl);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSavedMsg('');
    setErrorMsg('');

    try {
      const res = await authApi.updateProfile({
        name,
        bio,
        avatar,
        settings: {
          privacy: {
            lastSeen,
            onlineStatus,
            readReceipts
          }
        }
      });

      if (res.data.success) {
        updateUser(res.data.user);
        setSavedMsg('Settings updated successfully!');
        setTimeout(() => setSavedMsg(''), 2500);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to update settings');
    } finally {
      setLoading(false);
    }
  };

  // Change Password
  const handleChangePassword = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSavedMsg('');

    if (newPassword.length < 8) {
      setErrorMsg('New password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setErrorMsg('New passwords do not match.');
      return;
    }

    setPasswordLoading(true);

    try {
      const res = await authApi.changePassword({ currentPassword, newPassword });
      if (res.data.success) {
        setSavedMsg('Password changed successfully! Other sessions have been logged out.');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
        setTimeout(() => setSavedMsg(''), 3000);
        loadSessions();
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to update password');
    } finally {
      setPasswordLoading(false);
    }
  };

  // 2FA: Initiate Setup
  const handleInitiate2FASetup = async (e) => {
    e.preventDefault();
    setTwoFactorError('');
    setTwoFactorLoading(true);

    try {
      const res = await authApi.setup2FA({ password: reauthPassword });
      if (res.data.success) {
        setTotpSecret(res.data.secret);
        setQrCodeUrl(res.data.qrCodeDataUrl);
        setEnable2FAStep('scan');
        setReauthPassword('');
      }
    } catch (err) {
      setTwoFactorError(err.response?.data?.message || 'Password verification failed');
    } finally {
      setTwoFactorLoading(false);
    }
  };

  // 2FA: Confirm Code & Enable
  const handleConfirm2FA = async (e) => {
    e.preventDefault();
    setTwoFactorError('');
    setTwoFactorLoading(true);

    try {
      const res = await authApi.confirm2FA({ code: verifyTotpCode });
      if (res.data.success) {
        setRecoveryCodesList(res.data.recoveryCodes || []);
        setEnable2FAStep('codes');
        setVerifyTotpCode('');
        updateUser({ twoFactorEnabled: true });
      }
    } catch (err) {
      setTwoFactorError(err.response?.data?.message || 'Invalid verification code');
    } finally {
      setTwoFactorLoading(false);
    }
  };

  // 2FA: Disable
  const handleDisable2FA = async (e) => {
    e.preventDefault();
    setDisableError('');
    setDisableLoading(true);

    try {
      const res = await authApi.disable2FA({
        password: disablePassword,
        code: disableCode
      });
      if (res.data.success) {
        updateUser({ twoFactorEnabled: false });
        setDisable2FAModal(false);
        setDisablePassword('');
        setDisableCode('');
        setSavedMsg('Two-step verification has been disabled.');
        setTimeout(() => setSavedMsg(''), 3000);
      }
    } catch (err) {
      setDisableError(err.response?.data?.message || 'Failed to disable 2FA');
    } finally {
      setDisableLoading(false);
    }
  };

  // 2FA: Regenerate Recovery Codes
  const handleRegenerateCodes = async (e) => {
    e.preventDefault();
    setRegenError('');
    setRegenLoading(true);

    try {
      const res = await authApi.regenerateRecoveryCodes({ password: regenPassword });
      if (res.data.success) {
        setRecoveryCodesList(res.data.recoveryCodes || []);
        setRegenModal(false);
        setRegenPassword('');
        // Open the codes display dialog
        setEnable2FAStep('codes');
        setEnable2FAModal(true);
      }
    } catch (err) {
      setRegenError(err.response?.data?.message || 'Failed to regenerate recovery codes');
    } finally {
      setRegenLoading(false);
    }
  };

  // Sessions: Revoke single session
  const handleRevokeSession = async (sessionId) => {
    setRevokingSessionId(sessionId);
    try {
      const res = await authApi.revokeSession({ sessionId });
      if (res.data.success) {
        setSessions((prev) => prev.filter((s) => s.sessionId !== sessionId));
        setSavedMsg('Session revoked successfully.');
        setTimeout(() => setSavedMsg(''), 2500);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to revoke session');
    } finally {
      setRevokingSessionId(null);
    }
  };

  // Sessions: Log out of all devices
  const handleLogoutAllDevices = async () => {
    setLoggingOutAll(true);
    try {
      await logoutAllDevices();
      onClose();
    } catch (err) {
      setErrorMsg('Failed to log out of all devices');
      setLoggingOutAll(false);
    }
  };

  // Download recovery codes as text file
  const handleDownloadCodes = () => {
    const text = `NEXA MESSENGER - 2-STEP VERIFICATION RECOVERY CODES\nAccount: ${user?.email}\nGenerated: ${new Date().toUTCString()}\n\nEach code can only be used once if you lose access to your authenticator app:\n\n${recoveryCodesList.map((c, i) => `${i + 1}. ${c}`).join('\n')}\n\nKeep these codes strictly private.`;
    const element = document.createElement('a');
    const file = new Blob([text], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `nexa-recovery-codes-${user?.username}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleCopyCodes = () => {
    navigator.clipboard.writeText(recoveryCodesList.join('\n'));
    setCopiedCodes(true);
    setTimeout(() => setCopiedCodes(false), 2000);
  };

  const handleConfirmUnblock = async () => {
    if (!confirmUnblockUser) return;
    try {
      setUnblockLoading(true);
      const res = await followApi.unblock(confirmUnblockUser._id);
      if (res.data.success) {
        setBlockedUsers((prev) => prev.filter((u) => u._id !== confirmUnblockUser._id));
        setSavedMsg(`Unblocked @${confirmUnblockUser.username}`);
        setTimeout(() => setSavedMsg(''), 2500);
        setConfirmUnblockUser(null);
        await fetchConversations();
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to unblock user');
    } finally {
      setUnblockLoading(false);
    }
  };

  const handleSendEmailConfirmation = async () => {
    setEmailChangeError('');
    const clean = newEmailInput.trim().toLowerCase();
    if (!clean) {
      setEmailChangeError('Please enter a valid email address.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(clean)) {
      setEmailChangeError('Please enter a valid email address.');
      return;
    }
    if (clean === user?.email?.toLowerCase()) {
      setEmailChangeError('The new email address cannot be the same as your current email.');
      return;
    }

    try {
      setEmailChangeLoading(true);
      const res = await accountApi.requestEmailChange({ newEmail: clean });
      if (res.data.success) {
        setSentToEmail(clean);
        setEmailSentSuccess(true);
        setIsEditingEmail(false);
        setNewEmailInput('');
      } else {
        setEmailChangeError(res.data.message || 'Failed to send confirmation email.');
      }
    } catch (err) {
      setEmailChangeError(
        err.response?.data?.message || 'That email address is already associated with another account.'
      );
    } finally {
      setEmailChangeLoading(false);
    }
  };

  const handleChangeUsername = async () => {
    setUsernameChangeError('');
    setUsernameChangeSuccess('');
    const clean = newUsernameInput.trim().toLowerCase();
    const regex = /^[a-zA-Z0-9_]{3,30}$/;
    if (!regex.test(clean)) {
      setUsernameChangeError('Username must be 3–30 characters and contain only letters, numbers, and underscores.');
      return;
    }

    if (clean === user?.username?.toLowerCase()) {
      setIsEditingUsername(false);
      setNewUsernameInput('');
      return;
    }

    try {
      setUsernameChangeLoading(true);
      const res = await accountApi.changeUsername({ newUsername: clean });
      if (res.data?.success) {
        updateUser({ username: clean });
        setUsernameChangeSuccess(`@${clean}`);
        setIsEditingUsername(false);
        setNewUsernameInput('');
        setUsernameAvailability(null);
      } else {
        setUsernameChangeError(res.data?.message || 'Failed to update username');
      }
    } catch (err) {
      setUsernameChangeError(err.response?.data?.message || 'Username already in use');
    } finally {
      setUsernameChangeLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="NEXA Settings" maxWidth="max-w-2xl">
      <div className="flex flex-col sm:flex-row gap-6">
        {/* Sidebar Nav */}
        <div className="sm:w-48 flex sm:flex-col gap-1 border-b sm:border-b-0 sm:border-r border-[#ff1744]/15 pb-3 sm:pb-0 sm:pr-3 text-xs select-none flex-shrink-0 overflow-x-auto scrollbar-none">
          {[
            { id: 'account', label: 'Account', icon: User },
            { id: 'privacy', label: 'Privacy', icon: Shield },
            { id: 'appearance', label: 'Appearance', icon: Palette },
            { id: 'security', label: 'Security & 2FA', icon: Key },
            { id: 'blocked', label: 'Blocked Accounts', icon: Ban }
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setSavedMsg('');
                  setErrorMsg('');
                }}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl font-medium transition-all cursor-pointer text-left whitespace-nowrap sm:whitespace-normal flex-shrink-0 sm:flex-shrink ${
                  activeTab === item.id
                    ? 'bg-gradient-to-r from-[#ff1744] via-[#d3121f] to-[#991b1b] text-white shadow-[0_0_12px_rgba(255,23,68,0.35)]'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content Panel */}
        <div className="flex-1 min-w-0 max-h-[calc(100dvh-200px)] sm:max-h-[520px] overflow-y-auto pr-1">
          {savedMsg && (
            <div className="mb-4 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-1.5 animate-in fade-in duration-150">
              <Check className="w-3.5 h-3.5 shrink-0" />
              <span>{savedMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="mb-4 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs animate-in fade-in duration-150">
              {errorMsg}
            </div>
          )}

          {/* Account Tab */}
          {activeTab === 'account' && (
            <>
              <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="flex items-center gap-3.5 mb-2">
                <div className="relative inline-block flex-shrink-0 group">
                  <Avatar src={avatar} name={name || 'User'} size="lg" showStatus={false} />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingAvatar}
                    aria-label="Edit profile picture"
                    title="Edit profile picture"
                    className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-gradient-to-r from-[#ff1744] via-[#d3121f] to-[#991b1b] active:scale-95 text-white flex items-center justify-center shadow-md ring-2 ring-[#0a0a0f] transition-all cursor-pointer disabled:opacity-60"
                  >
                    {uploadingAvatar ? (
                      <Loader2 className="w-3 h-3 animate-spin text-white" />
                    ) : (
                      <Pencil className="w-3 h-3" />
                    )}
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleAvatarFileSelect}
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="hidden"
                  />
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-semibold text-white">{name}</h4>
                  <p className="text-xs text-[#ff1744]">@{user?.username}</p>
                  <p className="text-[11px] text-slate-400 truncate">{user?.email}</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Display Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#050505] border border-[#ff1744]/20 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#ff1744] focus:shadow-[0_0_12px_rgba(255,23,68,0.25)] transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Bio / Status</label>
                <textarea
                  rows={2}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Hey there! I am using NEXA."
                  className="w-full bg-[#050505] border border-[#ff1744]/20 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#ff1744] focus:shadow-[0_0_12px_rgba(255,23,68,0.25)] transition-all resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-gradient-to-r from-[#ff1744] via-[#d3121f] to-[#991b1b] hover:brightness-110 active:scale-95 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-[0_0_15px_rgba(255,23,68,0.25)] transition-all cursor-pointer"
              >
                Save Changes
              </button>
            </form>

            {/* Account Info Section */}
            <div className="pt-5 mt-5 border-t border-[#ff1744]/15">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">Account Info</h4>
                  <p className="text-[11px] text-slate-400">View and update your registered account email</p>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#050505] border border-[#ff1744]/20">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Email Address</label>
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold text-white truncate">{user?.email}</p>
                      {user?.isEmailVerified ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                          Verified
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/25">
                          Unverified
                        </span>
                      )}
                    </div>
                  </div>

                  {!isEditingEmail && !emailSentSuccess && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditingEmail(true);
                        setNewEmailInput('');
                        setEmailChangeError('');
                      }}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 active:scale-95 text-[#ff1744] border border-[#ff1744]/25 transition-all cursor-pointer flex-shrink-0"
                    >
                      Change
                    </button>
                  )}
                </div>

                {/* Change Email Form */}
                {isEditingEmail && (
                  <div className="mt-3 pt-3 border-t border-white/5 animate-in fade-in duration-200">
                    <label className="block text-xs font-semibold text-slate-300 mb-1">New Email Address</label>
                    <div className="space-y-2">
                      <input
                        type="email"
                        value={newEmailInput}
                        onChange={(e) => {
                          setNewEmailInput(e.target.value);
                          setEmailChangeError('');
                        }}
                        placeholder="Enter your new email address"
                        className="w-full bg-[#0a0a0f] border border-[#ff1744]/20 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#ff1744] focus:shadow-[0_0_12px_rgba(255,23,68,0.25)] transition-all"
                      />

                      {emailChangeError && (
                        <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>{emailChangeError}</span>
                        </div>
                      )}

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={handleSendEmailConfirmation}
                          disabled={emailChangeLoading || !newEmailInput.trim()}
                          className="py-2 px-3.5 rounded-xl bg-gradient-to-r from-[#ff1744] via-[#d3121f] to-[#991b1b] hover:brightness-110 active:scale-95 disabled:opacity-50 text-white font-bold text-xs shadow-[0_0_12px_rgba(255,23,68,0.25)] transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          {emailChangeLoading ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Sending...</span>
                            </>
                          ) : (
                            <span>Send Confirmation Email</span>
                          )}
                        </button>

                        <button
                          type="button"
                          disabled={emailChangeLoading}
                          onClick={() => {
                            setIsEditingEmail(false);
                            setNewEmailInput('');
                            setEmailChangeError('');
                          }}
                          className="py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white font-medium text-xs transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Email Sent State */}
                {emailSentSuccess && (
                  <div className="mt-3 pt-3 border-t border-white/5 space-y-2 animate-in fade-in duration-200">
                    <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs space-y-1">
                      <div className="flex items-center gap-1.5 font-bold">
                        <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                        <span>Confirmation email sent</span>
                      </div>
                      <p className="text-[11px] text-slate-300">
                        We've sent a confirmation link to <strong className="text-white">{sentToEmail}</strong>. Please check your inbox and confirm the change.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setEmailSentSuccess(false)}
                      className="text-[11px] text-[#ff1744] hover:underline font-medium cursor-pointer"
                    >
                      Dismiss
                    </button>
                  </div>
                )}
              </div>

              {/* Username Card */}
              <div className="p-3.5 rounded-2xl bg-[#050505] border border-[#ff1744]/20 mt-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Username</label>
                    <p className="text-xs font-semibold text-white truncate font-mono">@{user?.username}</p>
                  </div>

                  {!isEditingUsername && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditingUsername(true);
                        setNewUsernameInput('');
                        setUsernameAvailability(null);
                        setUsernameChangeError('');
                        setUsernameChangeSuccess('');
                      }}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 active:scale-95 text-[#ff1744] border border-[#ff1744]/25 transition-all cursor-pointer flex-shrink-0"
                    >
                      Change
                    </button>
                  )}
                </div>

                {/* Change Username Form */}
                {isEditingUsername && (
                  <div className="mt-3 pt-3 border-t border-white/5 animate-in fade-in duration-200">
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Change Username</label>
                    <div className="space-y-2">
                      <div className="relative">
                        <span className="absolute left-3 top-2 text-xs font-bold text-[#ff1744]">@</span>
                        <input
                          type="text"
                          value={newUsernameInput}
                          onChange={(e) => {
                            setNewUsernameInput(e.target.value);
                            setUsernameChangeError('');
                            setUsernameChangeSuccess('');
                          }}
                          placeholder="new_username"
                          autoFocus
                          className="w-full bg-[#0a0a0f] border border-[#ff1744]/20 rounded-xl pl-7 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#ff1744] focus:shadow-[0_0_12px_rgba(255,23,68,0.25)] transition-all font-mono"
                        />
                      </div>

                      {/* Real-time Availability & Validation Feedback */}
                      {usernameCheckLoading && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-400">
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-[#ff1744]" />
                          <span>Checking availability...</span>
                        </div>
                      )}

                      {!usernameCheckLoading && usernameAvailability && (
                        <div className="flex items-center gap-1.5 text-xs">
                          {usernameAvailability.available ? (
                            <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
                              <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]"></span>
                              <span>Username available</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-rose-400 font-medium">
                              <span className="inline-block w-2.5 h-2.5 rounded-full bg-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.6)]"></span>
                              <span>
                                {!usernameAvailability.valid ? (
                                  <>Invalid username: {usernameAvailability.message}</>
                                ) : (
                                  <>Username already in use</>
                                )}
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {usernameChangeError && (
                        <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>{usernameChangeError}</span>
                        </div>
                      )}

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={handleChangeUsername}
                          disabled={
                            usernameChangeLoading ||
                            usernameCheckLoading ||
                            !newUsernameInput.trim() ||
                            !usernameAvailability?.available ||
                            newUsernameInput.trim().toLowerCase() === user?.username?.toLowerCase()
                          }
                          className="py-2 px-3.5 rounded-xl bg-gradient-to-r from-[#ff1744] via-[#d3121f] to-[#991b1b] hover:brightness-110 active:scale-95 disabled:opacity-40 disabled:hover:brightness-100 disabled:cursor-not-allowed text-white font-bold text-xs shadow-[0_0_12px_rgba(255,23,68,0.25)] transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          {usernameChangeLoading ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Changing...</span>
                            </>
                          ) : (
                            <span>Change</span>
                          )}
                        </button>

                        <button
                          type="button"
                          disabled={usernameChangeLoading}
                          onClick={() => {
                            setIsEditingUsername(false);
                            setNewUsernameInput('');
                            setUsernameAvailability(null);
                            setUsernameChangeError('');
                          }}
                          className="py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white font-medium text-xs transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Username Changed Success Banner */}
                {usernameChangeSuccess && (
                  <div className="mt-3 pt-3 border-t border-white/5 space-y-2 animate-in fade-in duration-200">
                    <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs space-y-1">
                      <div className="flex items-center gap-1.5 font-bold">
                        <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                        <span>Username changed successfully</span>
                      </div>
                      <p className="text-[11px] text-slate-300">
                        Your username is now: <strong className="text-white font-mono">{usernameChangeSuccess}</strong>
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setUsernameChangeSuccess('')}
                      className="text-[11px] text-[#ff1744] hover:underline font-medium cursor-pointer"
                    >
                      Dismiss
                    </button>
                  </div>
                )}
              </div>
            </div>
            </>
          )}

          {/* Privacy Tab */}
          {activeTab === 'privacy' && (
            <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Who can see my last seen</label>
                <select
                  value={lastSeen}
                  onChange={(e) => setLastSeen(e.target.value)}
                  className="w-full bg-[#050505] border border-[#ff1744]/20 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#ff1744] cursor-pointer"
                >
                  <option value="everyone">Everyone</option>
                  <option value="nobody">Nobody</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Who can see when I am online</label>
                <select
                  value={onlineStatus}
                  onChange={(e) => setOnlineStatus(e.target.value)}
                  className="w-full bg-[#050505] border border-[#ff1744]/20 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#ff1744] cursor-pointer"
                >
                  <option value="everyone">Everyone</option>
                  <option value="nobody">Nobody</option>
                </select>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-[#050505] border border-[#ff1744]/15">
                <div>
                  <span className="font-semibold text-white block">Read Receipts</span>
                  <span className="text-[11px] text-slate-400">Show double checkmarks when read</span>
                </div>
                <input
                  type="checkbox"
                  checked={readReceipts}
                  onChange={(e) => setReadReceipts(e.target.checked)}
                  className="w-4 h-4 rounded text-[#ff1744] focus:ring-[#ff1744] bg-black border-white/20 cursor-pointer accent-[#ff1744]"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-gradient-to-r from-[#ff1744] via-[#d3121f] to-[#991b1b] hover:brightness-110 active:scale-95 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-[0_0_15px_rgba(255,23,68,0.25)] transition-all cursor-pointer"
              >
                Save Privacy Settings
              </button>
            </form>
          )}

          {/* Appearance Tab */}
          {activeTab === 'appearance' && (
            <div className="space-y-6">
              {/* Theme Preference */}
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-slate-300">Theme Preference</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'dark', label: 'Dark Mode', icon: Moon },
                    { id: 'light', label: 'Light Mode', icon: Sun },
                    { id: 'system', label: 'System', icon: Laptop }
                  ].map((t) => {
                    const Icon = t.icon;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setTheme(t.id)}
                        className={`flex flex-col items-center justify-center p-4 rounded-xl border text-xs font-semibold gap-2 transition-all cursor-pointer ${
                          theme === t.id
                            ? 'bg-[#ff1744]/15 border-[#ff1744] text-[#ff1744] shadow-[0_0_15px_rgba(255,23,68,0.2)]'
                            : 'bg-[#050505] border-[#ff1744]/15 text-slate-400 hover:text-white hover:border-[#ff1744]/40'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                        <span>{t.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Background Theme Section */}
              <div className="space-y-3 pt-3 border-t border-white/10">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-xs font-semibold text-white">Background Theme</label>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Choose an animated background theme for your workspace and chat.
                    </p>
                  </div>
                  {backgroundTheme !== 'default' && (
                    <button
                      type="button"
                      onClick={() => setBackgroundTheme('default')}
                      className="text-[11px] text-[#ff1744] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      Reset to Default
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    {
                      id: 'default',
                      name: 'Default',
                      desc: 'Standard clean NEXA dark or light background',
                      icon: Sparkles,
                      preview: (
                        <div className="w-full h-full bg-[#090a0f] flex items-center justify-center border border-white/5">
                          <span className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase">Default Clean</span>
                        </div>
                      )
                    },
                    {
                      id: 'red_black_pulse',
                      name: 'Red Black Pulse',
                      desc: 'Dark red pulse, swirling smoke & floating black shards',
                      icon: Flame,
                      preview: (
                        <div className="relative w-full h-full overflow-hidden bg-black">
                          <RedBlackPulseBackground className="is-contained is-preview" />
                        </div>
                      )
                    },
                    {
                      id: 'radiant_sunshine',
                      name: 'Radiant Sunshine',
                      desc: 'Luminous blue sky with animated sun bloom flares',
                      icon: Sun,
                      preview: (
                        <div className="relative w-full h-full overflow-hidden bg-gradient-to-br from-[#1d4ed8] via-[#3b82f6] to-[#93c5fd]">
                          <RadiantSunshineBackground className="is-contained" />
                        </div>
                      )
                    },
                    {
                      id: 'cosmic_starfield',
                      name: 'Cosmic Starfield',
                      desc: 'Deep space parallax twinkling starfield',
                      icon: Moon,
                      preview: (
                        <div className="relative w-full h-full overflow-hidden bg-[#050505]">
                          <ChatSpaceBackground />
                        </div>
                      )
                    },
                    {
                      id: 'pain_theme',
                      name: 'Pain (Shinra Tensei)',
                      desc: 'Deva Path Pain with Rinnegan chakra & flying kunai',
                      icon: Zap,
                      preview: (
                        <div className="relative w-full h-full overflow-hidden bg-black">
                          <PainThemeBackground className="is-contained is-preview" />
                        </div>
                      )
                    }
                  ].map((bg) => {
                    const isSelected = (backgroundTheme || 'default') === bg.id;
                    const Icon = bg.icon;
                    return (
                      <div
                        key={bg.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setBackgroundTheme(bg.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setBackgroundTheme(bg.id);
                          }
                        }}
                        className={`group relative rounded-xl p-3 border transition-all cursor-pointer text-left ${
                          isSelected
                            ? 'border-[#ff1744] bg-[#ff1744]/10 shadow-[0_0_15px_rgba(255,23,68,0.2)] ring-1 ring-[#ff1744]'
                            : 'border-white/10 hover:border-[#ff1744]/30 bg-[#050505] hover:bg-white/[0.03]'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-[#ff1744]' : 'text-slate-400'}`} />
                            <span className="text-xs font-bold text-white tracking-tight">{bg.name}</span>
                          </div>
                          {isSelected && (
                            <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#ff1744] text-white shadow-sm shadow-[#ff1744]/40">
                              <Check className="w-2.5 h-2.5 stroke-[3]" /> Active
                            </span>
                          )}
                        </div>
                        <div className="relative h-20 w-full rounded-lg overflow-hidden border border-white/10 mb-2">
                          {bg.preview}
                        </div>
                        <p className="text-[10px] text-slate-400 line-clamp-1">{bg.desc}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* SECURITY & 2FA TAB */}
          {/* ========================================================= */}
          {activeTab === 'security' && (
            <div className="space-y-6 text-xs">
              
              {/* 1. Two-Step Verification Section */}
              <div className="p-4 rounded-2xl bg-[#050505] border border-[#ff1744]/20 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`p-2 rounded-xl border ${user?.twoFactorEnabled ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400' : 'bg-amber-500/10 border-amber-500/25 text-amber-400'}`}>
                      {user?.twoFactorEnabled ? <ShieldCheck className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-white">Two-Step Verification (2FA)</h4>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${user?.twoFactorEnabled ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'}`}>
                          {user?.twoFactorEnabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {user?.twoFactorEnabled
                          ? 'Your account is secured with a TOTP authenticator app.'
                          : 'Protect your account with Google Authenticator, Microsoft Authenticator, or Authy.'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex flex-wrap gap-2">
                  {!user?.twoFactorEnabled ? (
                    <button
                      type="button"
                      onClick={() => {
                        setEnable2FAStep('password');
                        setTwoFactorError('');
                        setEnable2FAModal(true);
                      }}
                      className="py-2 px-3.5 bg-gradient-to-r from-[#ff1744] via-[#d3121f] to-[#991b1b] hover:brightness-110 active:scale-95 text-white font-bold text-xs rounded-xl shadow-[0_0_12px_rgba(255,23,68,0.25)] transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Enable Two-Step Verification</span>
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setRegenPassword('');
                          setRegenError('');
                          setRegenModal(true);
                        }}
                        className="py-1.5 px-3 bg-white/5 hover:bg-white/10 border border-[#ff1744]/25 text-[#ff1744] font-semibold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Regenerate Recovery Codes</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setDisablePassword('');
                          setDisableCode('');
                          setDisableError('');
                          setDisable2FAModal(true);
                        }}
                        className="py-1.5 px-3 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 text-rose-400 font-semibold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <Lock className="w-3 h-3" />
                        <span>Disable 2FA</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* 2. Password Change Section */}
              <form onSubmit={handleChangePassword} className="p-4 rounded-2xl bg-[#050505] border border-[#ff1744]/20 space-y-3">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Key className="w-4 h-4 text-[#ff1744]" />
                  <span>Change Password</span>
                </h4>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">Current Password</label>
                  <div className="relative">
                    <input
                      type={showCurrentPass ? 'text' : 'password'}
                      required
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-[#0a0a0f] border border-[#ff1744]/20 rounded-xl pl-3 pr-9 py-2 text-xs text-white focus:outline-none focus:border-[#ff1744] transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPass(!showCurrentPass)}
                      className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300"
                    >
                      {showCurrentPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">New Password (min 8 chars)</label>
                    <div className="relative">
                      <input
                        type={showNewPass ? 'text' : 'password'}
                        required
                        minLength={8}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-[#0a0a0f] border border-[#ff1744]/20 rounded-xl pl-3 pr-9 py-2 text-xs text-white focus:outline-none focus:border-[#ff1744] transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPass(!showNewPass)}
                        className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300"
                      >
                        {showNewPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">Confirm New Password</label>
                    <input
                      type="password"
                      required
                      minLength={8}
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-[#0a0a0f] border border-[#ff1744]/20 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#ff1744] transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={passwordLoading || !currentPassword || !newPassword}
                  className="py-2 px-4 bg-gradient-to-r from-[#ff1744] via-[#d3121f] to-[#991b1b] hover:brightness-110 active:scale-95 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-[0_0_12px_rgba(255,23,68,0.25)] transition-all cursor-pointer"
                >
                  {passwordLoading ? 'Updating Password...' : 'Update Password'}
                </button>
              </form>

              {/* 3. Sessions & Devices Section */}
              <div className="p-4 rounded-2xl bg-[#050505] border border-[#ff1744]/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <Laptop className="w-4 h-4 text-[#ff1744]" />
                      <span>Active Sessions & Devices</span>
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Devices currently authorized and connected to your account.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setLogoutAllConfirm(true)}
                    className="py-1.5 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 text-rose-400 font-semibold text-[11px] transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <LogOut className="w-3 h-3" />
                    <span>Log Out of All Devices</span>
                  </button>
                </div>

                {loadingSessions ? (
                  <div className="py-6 flex justify-center text-slate-400">
                    <Loader2 className="w-5 h-5 animate-spin text-[#ff1744]" />
                  </div>
                ) : sessions.length === 0 ? (
                  <p className="text-slate-500 py-3 text-center">No active sessions found.</p>
                ) : (
                  <div className="space-y-2 pt-1">
                    {sessions.map((sess) => (
                      <div
                        key={sess.sessionId}
                        className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-colors ${
                          sess.isCurrent
                            ? 'bg-[#ff1744]/10 border-[#ff1744]/40 shadow-[0_0_15px_rgba(255,23,68,0.1)]'
                            : 'bg-[#0a0a0f] border-white/10 hover:border-white/20'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`p-2 rounded-xl ${sess.isCurrent ? 'bg-[#ff1744]/20 text-[#ff1744]' : 'bg-white/5 text-slate-400'}`}>
                            {sess.deviceInfo?.toLowerCase().includes('ios') || sess.deviceInfo?.toLowerCase().includes('android') ? (
                              <Smartphone className="w-4 h-4" />
                            ) : (
                              <Laptop className="w-4 h-4" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-white truncate text-xs">{sess.deviceInfo}</span>
                              {sess.isCurrent && (
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#ff1744]/20 text-[#ff1744] border border-[#ff1744]/40">
                                  Current Device
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              IP: {sess.ip || '127.0.0.1'} • Last Active: {sess.lastActive ? new Date(sess.lastActive).toLocaleDateString() + ' ' + new Date(sess.lastActive).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently'}
                            </p>
                          </div>
                        </div>

                        {!sess.isCurrent && (
                          <button
                            type="button"
                            disabled={revokingSessionId === sess.sessionId}
                            onClick={() => handleRevokeSession(sess.sessionId)}
                            className="py-1 px-2.5 rounded-lg border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 text-[10px] font-semibold transition-colors cursor-pointer flex-shrink-0"
                          >
                            {revokingSessionId === sess.sessionId ? 'Revoking...' : 'Revoke'}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Blocked Accounts Tab */}
          {activeTab === 'blocked' && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-bold text-white">Blocked Accounts</h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Accounts you have blocked cannot message you or send you follow requests.
                </p>
              </div>

              {loadingBlocked ? (
                <div className="py-12 flex flex-col items-center justify-center text-slate-500 gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-[#ff1744]" />
                  <span className="text-xs">Loading blocked accounts...</span>
                </div>
              ) : blockedUsers.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-center text-slate-500">
                  <div className="w-12 h-12 rounded-2xl bg-white/5 border border-[#ff1744]/20 flex items-center justify-center mb-3 text-slate-400 shadow-[0_0_15px_rgba(255,23,68,0.06)]">
                    <ShieldCheck className="w-6 h-6 text-[#ff1744]" />
                  </div>
                  <h4 className="text-sm font-semibold text-white mb-1">No blocked accounts</h4>
                  <p className="text-xs text-slate-400 max-w-xs">
                    You have not blocked any accounts. Accounts you block will appear here.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                  {blockedUsers.map((bu) => (
                    <div
                      key={bu._id}
                      className="flex items-center justify-between p-3 rounded-xl bg-[#050505] border border-[#ff1744]/15 hover:border-[#ff1744]/35 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar
                          src={bu.avatar}
                          name={bu.name}
                          size="md"
                          showStatus={false}
                        />
                        <div className="min-w-0">
                          <h5 className="text-xs sm:text-sm font-semibold text-white truncate">
                            {bu.name}
                          </h5>
                          <p className="text-[11px] text-[#ff1744] font-medium truncate">
                            @{bu.username}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setConfirmUnblockUser(bu)}
                        className="px-3.5 py-1.5 rounded-xl border border-[#ff1744]/30 hover:bg-[#ff1744]/15 text-[#ff1744] text-xs font-semibold transition-all cursor-pointer flex-shrink-0"
                      >
                        Unblock
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* MODAL: ENABLE 2FA SETUP (STEPS) */}
      {/* ========================================================= */}
      {enable2FAModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 overflow-y-auto bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-md max-w-[calc(100vw-24px)] max-h-[calc(100dvh-2rem)] overflow-y-auto my-auto bg-[#0a0a0f] border border-[#ff1744]/30 rounded-3xl p-5 sm:p-6 shadow-[0_0_40px_rgba(255,23,68,0.2)] space-y-4">
            
            {/* Step 1: Password Re-authentication */}
            {enable2FAStep === 'password' && (
              <form onSubmit={handleInitiate2FASetup} className="space-y-4">
                <div className="text-center">
                  <div className="w-12 h-12 rounded-2xl bg-[#ff1744]/15 text-[#ff1744] border border-[#ff1744]/30 flex items-center justify-center mx-auto mb-3 shadow-[0_0_20px_rgba(255,23,68,0.2)]">
                    <Lock className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-white">Confirm Your Password</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    To set up Two-Step Verification, please confirm your NEXA account password.
                  </p>
                </div>

                {twoFactorError && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-400 text-xs">
                    {twoFactorError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Account Password</label>
                  <input
                    type="password"
                    required
                    autoFocus
                    value={reauthPassword}
                    onChange={(e) => setReauthPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[#050505] border border-[#ff1744]/25 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#ff1744] transition-all"
                  />
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setEnable2FAModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={twoFactorLoading || !reauthPassword}
                    className="px-4 py-2 bg-gradient-to-r from-[#ff1744] via-[#d3121f] to-[#991b1b] hover:brightness-110 active:scale-95 text-white font-bold text-xs rounded-xl shadow-[0_0_15px_rgba(255,23,68,0.25)] transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    {twoFactorLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Continue</span>
                  </button>
                </div>
              </form>
            )}

            {/* Step 2: Scan QR Code & Enter 6-digit Code */}
            {enable2FAStep === 'scan' && (
              <form onSubmit={handleConfirm2FA} className="space-y-4">
                <div className="text-center">
                  <h3 className="text-lg font-bold text-white">Scan Authenticator QR Code</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Scan with Google Authenticator, Microsoft Authenticator, Authy, or 1Password.
                  </p>
                </div>

                {twoFactorError && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-400 text-xs">
                    {twoFactorError}
                  </div>
                )}

                {/* QR Code Container */}
                <div className="flex flex-col items-center justify-center p-4 bg-white rounded-2xl border border-white/20 w-fit mx-auto shadow-lg">
                  {qrCodeUrl ? (
                    <img src={qrCodeUrl} alt="2FA QR Code" className="w-48 h-48 rounded-lg" />
                  ) : (
                    <Loader2 className="w-12 h-12 text-slate-600 animate-spin" />
                  )}
                </div>

                {/* Manual Secret Key */}
                <div className="p-2.5 rounded-xl bg-[#050505] border border-white/10 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-[10px] text-slate-400 block">Manual Setup Key</span>
                    <span className="font-mono text-xs text-[#ff1744] font-semibold break-all select-all">
                      {totpSecret}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(totpSecret);
                      setCopiedKey(true);
                      setTimeout(() => setCopiedKey(false), 2000);
                    }}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer flex-shrink-0"
                    title="Copy Key"
                  >
                    {copiedKey ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>

                {/* 6-Digit Code Input */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Enter 6-Digit Authenticator Code
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={verifyTotpCode}
                    onChange={(e) => setVerifyTotpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    className="w-full bg-[#050505] border border-[#ff1744]/30 rounded-xl px-3 py-2.5 text-center text-lg font-mono tracking-widest text-white focus:outline-none focus:border-[#ff1744] transition-all"
                  />
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setEnable2FAModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={twoFactorLoading || verifyTotpCode.length !== 6}
                    className="px-4 py-2 bg-gradient-to-r from-[#ff1744] via-[#d3121f] to-[#991b1b] hover:brightness-110 active:scale-95 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-[0_0_15px_rgba(255,23,68,0.25)] transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    {twoFactorLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Verify & Activate</span>
                  </button>
                </div>
              </form>
            )}

            {/* Step 3: Backup Recovery Codes Display */}
            {enable2FAStep === 'codes' && (
              <div className="space-y-4">
                <div className="text-center">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto mb-3 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                    <Check className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-white">Save Backup Recovery Codes</h3>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    If you lose access to your authenticator app, these one-time codes are the <strong>only way</strong> to access your account.
                  </p>
                </div>

                {/* Codes Grid */}
                <div className="grid grid-cols-2 gap-2 p-3 bg-[#050505] border border-[#ff1744]/25 rounded-2xl">
                  {recoveryCodesList.map((code, idx) => (
                    <div
                      key={idx}
                      className="p-2 rounded-xl bg-white/5 font-mono text-center text-xs font-bold text-[#ff1744] border border-white/5"
                    >
                      {code}
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleCopyCodes}
                    className="flex-1 py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {copiedCodes ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCodes ? 'Copied!' : 'Copy All'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadCodes}
                    className="flex-1 py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download (.txt)</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setEnable2FAModal(false);
                    setSavedMsg('Two-Step Verification activated successfully!');
                    setTimeout(() => setSavedMsg(''), 3000);
                  }}
                  className="w-full py-2.5 bg-gradient-to-r from-[#ff1744] via-[#d3121f] to-[#991b1b] hover:brightness-110 active:scale-95 text-white font-bold text-xs rounded-xl shadow-[0_0_15px_rgba(255,23,68,0.25)] transition-all cursor-pointer"
                >
                  I Have Saved My Recovery Codes
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: DISABLE 2FA */}
      {/* ========================================================= */}
      {disable2FAModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 overflow-y-auto bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-sm max-w-[calc(100vw-24px)] max-h-[calc(100dvh-2rem)] overflow-y-auto my-auto bg-[#0a0a0f] border border-rose-500/30 rounded-3xl p-5 sm:p-6 shadow-[0_0_40px_rgba(244,63,94,0.15)] space-y-4">
            <div className="text-center">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/15 text-rose-400 border border-rose-500/30 flex items-center justify-center mx-auto mb-3">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">Disable Two-Step Verification</h3>
              <p className="text-xs text-slate-400 mt-1">
                This significantly lowers your account security. Strong re-authentication required.
              </p>
            </div>

            {disableError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-400 text-xs">
                {disableError}
              </div>
            )}

            <form onSubmit={handleDisable2FA} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Account Password</label>
                <input
                  type="password"
                  required
                  value={disablePassword}
                  onChange={(e) => setDisablePassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#050505] border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#ff1744] transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Authenticator Code or Recovery Code</label>
                <input
                  type="text"
                  required
                  value={disableCode}
                  onChange={(e) => setDisableCode(e.target.value)}
                  placeholder="6-digit code or AB7X-92KP"
                  className="w-full bg-[#050505] border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#ff1744] transition-all font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setDisable2FAModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={disableLoading || !disablePassword || !disableCode}
                  className="px-4 py-2 bg-rose-500 hover:bg-rose-600 active:scale-95 text-white font-bold text-xs rounded-xl shadow-[0_0_15px_rgba(244,63,94,0.3)] transition-all cursor-pointer flex items-center gap-1.5"
                >
                  {disableLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Disable 2FA</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: REGENERATE RECOVERY CODES */}
      {/* ========================================================= */}
      {regenModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 overflow-y-auto bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-sm max-w-[calc(100vw-24px)] max-h-[calc(100dvh-2rem)] overflow-y-auto my-auto bg-[#0a0a0f] border border-[#ff1744]/30 rounded-3xl p-5 sm:p-6 shadow-[0_0_40px_rgba(255,23,68,0.15)] space-y-4">
            <div className="text-center">
              <div className="w-12 h-12 rounded-2xl bg-[#ff1744]/15 text-[#ff1744] border border-[#ff1744]/30 flex items-center justify-center mx-auto mb-3">
                <RefreshCw className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">Regenerate Recovery Codes</h3>
              <p className="text-xs text-slate-400 mt-1">
                Old recovery codes will be immediately invalidated. Enter your password to continue.
              </p>
            </div>

            {regenError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-400 text-xs">
                {regenError}
              </div>
            )}

            <form onSubmit={handleRegenerateCodes} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Account Password</label>
                <input
                  type="password"
                  required
                  autoFocus
                  value={regenPassword}
                  onChange={(e) => setRegenPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#050505] border border-[#ff1744]/25 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#ff1744] transition-all"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setRegenModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={regenLoading || !regenPassword}
                  className="px-4 py-2 bg-gradient-to-r from-[#ff1744] via-[#d3121f] to-[#991b1b] hover:brightness-110 active:scale-95 text-white font-bold text-xs rounded-xl shadow-[0_0_15px_rgba(255,23,68,0.25)] transition-all cursor-pointer flex items-center gap-1.5"
                >
                  {regenLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Regenerate</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: CONFIRM LOG OUT OF ALL DEVICES */}
      {/* ========================================================= */}
      {logoutAllConfirm && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 overflow-y-auto bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-sm max-w-[calc(100vw-24px)] max-h-[calc(100dvh-2rem)] overflow-y-auto my-auto bg-[#0a0a0f] border border-rose-500/30 rounded-3xl p-5 sm:p-6 shadow-[0_0_40px_rgba(244,63,94,0.2)] space-y-4">
            <div className="text-center">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/15 text-rose-400 border border-rose-500/30 flex items-center justify-center mx-auto mb-3">
                <LogOut className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">Log Out of All Devices?</h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                This will revoke every active session on all phones, tablets, and computers including this one. You will need to sign in again.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setLogoutAllConfirm(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={loggingOutAll}
                onClick={handleLogoutAllDevices}
                className="px-4 py-2 bg-rose-500 hover:bg-rose-600 active:scale-95 text-white font-bold text-xs rounded-xl shadow-[0_0_15px_rgba(244,63,94,0.3)] transition-all cursor-pointer flex items-center gap-1.5"
              >
                {loggingOutAll && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirm Log Out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog for Unblocking */}
      {confirmUnblockUser && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 overflow-y-auto bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-sm max-w-[calc(100vw-24px)] max-h-[calc(100dvh-2rem)] overflow-y-auto my-auto bg-[#0a0a0f] border border-[#ff1744]/25 rounded-2xl p-5 sm:p-6 shadow-[0_0_35px_rgba(255,23,68,0.15)] space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-[#ff1744]/15 text-[#ff1744] border border-[#ff1744]/25 flex-shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h4 className="text-base font-bold text-white truncate">
                  Unblock @{confirmUnblockUser.username}?
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  They will be able to search for your profile and send you follow requests.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={unblockLoading}
                onClick={() => setConfirmUnblockUser(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/5 border border-white/10 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={unblockLoading}
                onClick={handleConfirmUnblock}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-[#ff1744] via-[#d3121f] to-[#991b1b] hover:brightness-110 active:scale-95 text-white shadow-[0_0_15px_rgba(255,23,68,0.3)] transition-all cursor-pointer flex items-center gap-1.5"
              >
                {unblockLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Unblock</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
};
