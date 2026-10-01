import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { authApi, userApi } from '../../api/endpoints';
import {
  MessageSquare,
  ArrowRight,
  User,
  Mail,
  Lock,
  KeyRound,
  CheckCircle2,
  ArrowLeft,
  ShieldCheck,
  Eye,
  EyeOff,
  Key,
  AlertCircle,
  Loader2
} from 'lucide-react';

export const AuthModal = ({ isOpen, onClose, initialMode = 'login', closable = true }) => {
  const { login, register, verify2FA } = useAuth();
  const [mode, setMode] = useState(initialMode); // 'login' | 'register' | 'forgot' | '2fa'

  // Form fields
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // 2FA Challenge state
  const [twoFactorToken, setTwoFactorToken] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [isRecoveryCode, setIsRecoveryCode] = useState(false);

  // Forgot password fields
  const [forgotUsername, setForgotUsername] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');

  // General states
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [registrationNotice, setRegistrationNotice] = useState('');

  // Signup username availability state
  const [signupUsernameCheckLoading, setSignupUsernameCheckLoading] = useState(false);
  const [signupUsernameStatus, setSignupUsernameStatus] = useState(null);

  // Debounced username availability check for signup
  useEffect(() => {
    if (mode !== 'register') {
      setSignupUsernameStatus(null);
      setSignupUsernameCheckLoading(false);
      return;
    }

    const trimmed = username.trim();
    if (!trimmed) {
      setSignupUsernameStatus(null);
      setSignupUsernameCheckLoading(false);
      return;
    }

    const clean = trimmed.toLowerCase();
    const regex = /^[a-zA-Z0-9_]{3,30}$/;
    if (!regex.test(clean)) {
      setSignupUsernameCheckLoading(false);
      setSignupUsernameStatus({
        available: false,
        valid: false,
        message: '3–30 characters, letters, numbers & underscores only'
      });
      return;
    }

    setSignupUsernameCheckLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await userApi.checkUsername(clean);
        if (res.data?.available) {
          setSignupUsernameStatus({
            available: true,
            valid: true,
            message: 'Username available'
          });
        } else {
          setSignupUsernameStatus({
            available: false,
            valid: res.data?.valid !== false,
            message: res.data?.message || 'Username already in use'
          });
        }
      } catch (err) {
        setSignupUsernameStatus({
          available: false,
          valid: false,
          message: err.response?.data?.message || 'Error checking availability'
        });
      } finally {
        setSignupUsernameCheckLoading(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [username, mode]);

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setError('');
      setForgotError('');
      setForgotSuccess('');
      setRegistrationNotice('');
      setTwoFactorToken('');
      setTwoFactorCode('');
      setIsRecoveryCode(false);
      setSignupUsernameStatus(null);
    }
  }, [isOpen, initialMode]);

  if (!isOpen) return null;

  // Password strength calculator
  const getPasswordStrength = (pass) => {
    if (!pass) return { score: 0, text: '', color: '' };
    let score = 0;
    if (pass.length >= 8) score += 1;
    if (pass.length >= 12) score += 1;
    if (/[A-Z]/.test(pass)) score += 1;
    if (/[0-9]/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass)) score += 1;

    if (score <= 1) return { score: 1, text: 'Weak', color: 'bg-rose-500 text-rose-400' };
    if (score <= 3) return { score: 2, text: 'Moderate', color: 'bg-amber-500 text-amber-400' };
    return { score: 3, text: 'Strong', color: 'bg-emerald-500 text-emerald-400' };
  };

  const passwordStrength = getPasswordStrength(password);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (mode === 'register') {
      if (password.length < 8) {
        setError('Password must be at least 8 characters long');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        setError('Please provide a valid email address');
        return;
      }
    }

    setLoading(true);

    try {
      if (mode === 'login') {
        const res = await login(identifier, password);
        if (res.twoFactorRequired) {
          setTwoFactorToken(res.tempToken);
          setMode('2fa');
          setError('');
          setLoading(false);
          return;
        }
        onClose();
      } else if (mode === 'register') {
        await register({ name, username, email, password });
        onClose();
      }
    } catch (err) {
      if (err.response?.status === 502 || err.response?.status === 503) {
        setError('Backend server is unreachable. Please ensure the server is active.');
      } else if (err.code === 'ERR_NETWORK') {
        setError('Cannot connect to server. Check your network connection.');
      } else {
        setError(err.response?.data?.message || err.message || 'Authentication failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const handle2FASubmit = async (e) => {
    e.preventDefault();
    setError('');

    const cleanCode = twoFactorCode.trim();
    if (!cleanCode) {
      setError(isRecoveryCode ? 'Please enter your backup recovery code' : 'Please enter the 6-digit verification code');
      return;
    }

    setLoading(true);

    try {
      await verify2FA({
        tempToken: twoFactorToken,
        code: cleanCode,
        isRecoveryCode
      });
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid verification code');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setForgotError('');
    setForgotSuccess('');

    const cleanUsername = forgotUsername.trim();
    if (!cleanUsername) {
      setForgotError('Please enter your username');
      return;
    }

    setForgotLoading(true);

    try {
      const res = await authApi.forgotPassword({ username: cleanUsername });
      setForgotSuccess(
        res.data?.message ||
        'If an account exists for this username, a password reset link has been sent to the email address associated with the account.'
      );
    } catch (err) {
      console.error('[Forgot Password Error]:', err);
      setForgotError(err.response?.data?.message || 'Failed to process request. Please try again later.');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      {/* Semi-transparent backdrop */}
      <div
        className="fixed inset-0 bg-black/40 transition-opacity duration-300"
        onClick={closable ? onClose : undefined}
      />

      {/* Auth Card */}
      <div className="relative w-full max-w-md max-w-[calc(100vw-24px)] max-h-[calc(100dvh-2rem)] overflow-y-auto bg-[#0a0a0f]/95 text-slate-100 rounded-3xl border border-[#ff1744]/25 p-5 sm:p-8 shadow-[0_0_35px_rgba(255,23,68,0.12),0_0_65px_rgba(153,27,27,0.08)] backdrop-blur-2xl z-10 animate-in fade-in duration-300 my-auto">
        
        {/* Header Icon & Title */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-12 h-12 rounded-2xl overflow-hidden shadow-[0_0_20px_rgba(255,23,68,0.4)] border border-[#ff1744]/30 mb-3 flex items-center justify-center bg-black">
            {mode === '2fa' ? (
              <ShieldCheck className="w-6 h-6 text-white" />
            ) : mode === 'forgot' ? (
              <KeyRound className="w-6 h-6 text-white" />
            ) : (
              <img src="/assets/nexa-logo.png" alt="NEXA" className="w-full h-full object-contain" />
            )}
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white">
            {mode === 'login' && 'Welcome Back to NEXA'}
            {mode === 'register' && 'Join NEXA Today'}
            {mode === '2fa' && 'Two-Step Verification'}
            {mode === 'forgot' && 'Forgot Password?'}
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">
            {mode === 'login' && 'Enter your credentials to access your real-time chats'}
            {mode === 'register' && 'Create a secure account with end-to-end authentication'}
            {mode === '2fa' && (isRecoveryCode ? 'Enter one of your emergency recovery codes' : 'Enter the 6-digit code from your authenticator app')}
            {mode === 'forgot' && 'Enter your username to recover your account'}
          </p>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-400 text-xs flex items-center gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="leading-snug">{error}</span>
          </div>
        )}

        {/* ========================================================= */}
        {/* MODE: 2FA CHALLENGE */}
        {/* ========================================================= */}
        {mode === '2fa' && (
          <form onSubmit={handle2FASubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                {isRecoveryCode ? 'Backup Recovery Code' : '6-Digit Authenticator Code'}
              </label>
              <div className="relative">
                {isRecoveryCode ? (
                  <Key className="absolute left-3.5 top-3 w-4 h-4 text-[#ff1744]" />
                ) : (
                  <ShieldCheck className="absolute left-3.5 top-3 w-4 h-4 text-[#ff1744]" />
                )}
                <input
                  type="text"
                  required
                  autoFocus
                  maxLength={isRecoveryCode ? 12 : 6}
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(isRecoveryCode ? e.target.value.toUpperCase() : e.target.value.replace(/\D/g, ''))}
                  placeholder={isRecoveryCode ? 'AB7X-92KP' : '000000'}
                  className="w-full bg-[#050505] border border-[#ff1744]/30 rounded-xl pl-10 pr-4 py-2.5 text-base tracking-widest text-center font-mono text-white placeholder:text-slate-600 focus:outline-none focus:border-[#ff1744] focus:shadow-[0_0_15px_rgba(255,23,68,0.3)] transition-all"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5 text-center">
                {isRecoveryCode
                  ? 'Format: 8 uppercase characters (e.g. AB7X-92KP)'
                  : 'Open Google Authenticator, Microsoft Authenticator, or Authy'}
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || !twoFactorCode.trim()}
              className="w-full py-3 px-4 bg-gradient-to-r from-[#ff1744] via-[#d3121f] to-[#991b1b] hover:brightness-110 active:scale-95 disabled:opacity-50 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(255,23,68,0.35)] transition-all cursor-pointer"
            >
              {loading ? (
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>Verify and Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="flex flex-col gap-2 pt-2 border-t border-white/5 text-center">
              <button
                type="button"
                onClick={() => {
                  setIsRecoveryCode(!isRecoveryCode);
                  setTwoFactorCode('');
                  setError('');
                }}
                className="text-xs text-[#ff1744] hover:text-[#ff2a55] font-medium transition-colors cursor-pointer"
              >
                {isRecoveryCode ? 'Use 6-digit authenticator code instead' : 'Lost your authenticator? Use a backup recovery code'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError('');
                  setTwoFactorToken('');
                }}
                className="text-xs text-slate-400 hover:text-white transition-colors flex items-center justify-center gap-1 mx-auto cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Login</span>
              </button>
            </div>
          </form>
        )}

        {/* ========================================================= */}
        {/* MODE: FORGOT PASSWORD */}
        {/* ========================================================= */}
        {/* ========================================================= */}
        {/* MODE: FORGOT PASSWORD */}
        {/* ========================================================= */}
        {mode === 'forgot' && (
          <div className="space-y-4">
            {forgotSuccess ? (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-xs space-y-2">
                  <div className="flex items-center gap-2 font-semibold text-emerald-400">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Check Your Email</span>
                  </div>
                  <p className="text-slate-300 leading-relaxed">
                    {forgotSuccess}
                  </p>
                  <p className="text-[11px] text-slate-400 pt-1">
                    Please check your inbox (and spam folder). The link will expire in 30 minutes.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setForgotSuccess('');
                    setForgotError('');
                    setForgotUsername('');
                    setMode('login');
                  }}
                  className="w-full py-3 px-4 bg-gradient-to-r from-[#ff1744] via-[#d3121f] to-[#991b1b] hover:brightness-110 active:scale-95 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(255,23,68,0.35)] transition-all cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Login</span>
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotSubmit} className="space-y-3">
                {forgotError && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
                    <span className="font-semibold">Error:</span> {forgotError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Username</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 text-sm font-semibold text-slate-500">@</span>
                    <input
                      type="text"
                      required
                      autoFocus
                      value={forgotUsername}
                      onChange={(e) => setForgotUsername(e.target.value)}
                      placeholder="Enter your username"
                      className="w-full bg-[#050505] border border-[#ff1744]/20 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#ff1744] focus:shadow-[0_0_15px_rgba(255,23,68,0.25)] transition-all"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    We will send the password reset link directly to your account's registered email.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={forgotLoading || !forgotUsername.trim()}
                  className="w-full mt-2 py-3 px-4 bg-gradient-to-r from-[#ff1744] via-[#d3121f] to-[#991b1b] hover:brightness-110 active:scale-95 disabled:opacity-50 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(255,23,68,0.35)] transition-all cursor-pointer"
                >
                  {forgotLoading ? (
                    <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Continue</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}

            <div className="mt-4 pt-4 border-t border-white/5 text-center">
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setForgotError('');
                  setForgotSuccess('');
                  setMode('login');
                }}
                className="text-xs text-[#ff1744] hover:text-[#ff2a55] font-medium transition-colors flex items-center justify-center gap-1.5 mx-auto cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Login</span>
              </button>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* MODE: LOGIN & REGISTER */}
        {/* ========================================================= */}
        {(mode === 'login' || mode === 'register') && (
          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === 'register' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Alex Rivera"
                      className="w-full bg-[#050505] border border-[#ff1744]/20 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#ff1744] focus:shadow-[0_0_15px_rgba(255,23,68,0.25)] transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Username</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 text-sm font-semibold text-slate-500">@</span>
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="alex_rivera"
                      className="w-full bg-[#050505] border border-[#ff1744]/20 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#ff1744] focus:shadow-[0_0_15px_rgba(255,23,68,0.25)] transition-all font-mono"
                    />
                  </div>

                  {/* Real-time username availability indicator */}
                  {signupUsernameCheckLoading && (
                    <div className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-400">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-[#ff1744]" />
                      <span>Checking availability...</span>
                    </div>
                  )}

                  {!signupUsernameCheckLoading && signupUsernameStatus && (
                    <div className="mt-1.5 flex items-center gap-1.5 text-xs">
                      {signupUsernameStatus.available ? (
                        <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
                          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]"></span>
                          <span>Username available</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-rose-400 font-medium">
                          <span className="inline-block w-2 h-2 rounded-full bg-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.6)]"></span>
                          <span>{signupUsernameStatus.message || 'Username already in use'}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="alex@nexa.io"
                      className="w-full bg-[#050505] border border-[#ff1744]/20 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#ff1744] focus:shadow-[0_0_15px_rgba(255,23,68,0.25)] transition-all"
                    />
                  </div>
                </div>
              </>
            )}

            {mode === 'login' && (
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Email or Username</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="name@email.com or username"
                    className="w-full bg-[#050505] border border-[#ff1744]/20 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#ff1744] focus:shadow-[0_0_15px_rgba(255,23,68,0.25)] transition-all"
                  />
                </div>
              </div>
            )}

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-medium text-slate-400">Password</label>
                {mode === 'register' && password && (
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${passwordStrength.color} bg-opacity-20`}>
                    {passwordStrength.text} (min 8 chars)
                  </span>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  minLength={mode === 'register' ? 8 : 1}
                  className="w-full bg-[#050505] border border-[#ff1744]/20 rounded-xl pl-10 pr-10 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#ff1744] focus:shadow-[0_0_15px_rgba(255,23,68,0.25)] transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {mode === 'login' && (
                <div className="flex justify-end pt-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setError('');
                      setForgotError('');
                      setForgotSuccess('');
                      setForgotUsername(!identifier.includes('@') ? identifier.trim() : '');
                      setMode('forgot');
                    }}
                    className="text-xs text-[#ff1744] hover:text-[#ff2a55] font-medium transition-colors cursor-pointer select-none"
                  >
                    Forgot Password?
                  </button>
                </div>
              )}
            </div>

            {mode === 'register' && (
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    minLength={8}
                    className="w-full bg-[#050505] border border-[#ff1744]/20 rounded-xl pl-10 pr-10 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#ff1744] focus:shadow-[0_0_15px_rgba(255,23,68,0.25)] transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-3 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || (mode === 'register' && (signupUsernameCheckLoading || (signupUsernameStatus && !signupUsernameStatus.available)))}
              className="nexa-signin-button w-full mt-2 py-3 px-4 active:scale-95 disabled:opacity-50 text-white font-bold text-sm rounded-xl flex items-center justify-center cursor-pointer"
            >
              {loading ? (
                <span className="relative z-10 inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <span className="text-container">
                  <span className="text">
                    <span>{mode === 'login' ? 'Sign In to NEXA' : 'Create Account'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </span>
                </span>
              )}
            </button>

            <div className="mt-4 pt-4 border-t border-white/5 text-center">
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setMode(mode === 'login' ? 'register' : 'login');
                }}
                className="text-xs text-[#ff1744] hover:text-[#ff2a55] font-medium transition-colors cursor-pointer"
              >
                {mode === 'login'
                  ? "Don't have an account yet? Register now"
                  : 'Already have an account? Sign in'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
