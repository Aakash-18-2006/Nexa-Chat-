import React, { useState, useEffect } from 'react';
import { authApi } from '../../api/endpoints';
import { useTheme } from '../../context/ThemeContext';
import { RadiantSunshineBackground } from '../ui/RadiantSunshineBackground';
import {
  MessageSquare,
  Lock,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  ArrowLeft,
  Loader2
} from 'lucide-react';

export const ResetPasswordPage = ({ onNavigateToLogin, onNavigateToForgot }) => {
  const { theme } = useTheme();
  const isLightTheme = theme === 'light';

  // Read token from URL query string
  const [token, setToken] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('token') || params.get('resetToken') || '';
  });

  const [validatingToken, setValidatingToken] = useState(true);
  const [tokenError, setTokenError] = useState('');
  
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);

  // Validate token on mount
  useEffect(() => {
    if (!token) {
      setTokenError('No password reset token provided. Please request a new password reset link.');
      setValidatingToken(false);
      return;
    }

    const validate = async () => {
      try {
        await authApi.validateResetToken(token);
        setValidatingToken(false);
      } catch (err) {
        console.error('[Validate Token Error]:', err);
        setTokenError(
          err.response?.data?.message ||
          'This password reset link is invalid or has expired. Please request a new one.'
        );
        setValidatingToken(false);
      }
    };

    validate();
  }, [token]);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setFormError('');

    if (!newPassword || !confirmPassword) {
      setFormError('Please enter and confirm your new password.');
      return;
    }

    if (newPassword.length < 8) {
      setFormError('Password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setFormError('Passwords do not match. Please verify both fields.');
      return;
    }

    setSubmitting(true);

    try {
      const res = await authApi.resetPassword({
        token,
        password: newPassword
      });

      if (res.data?.success) {
        setResetSuccess(true);
      } else {
        setFormError(res.data?.message || 'Password reset failed. Please try again.');
      }
    } catch (err) {
      console.error('[Reset Password Error]:', err);
      if (err.response?.data?.message) {
        setFormError(err.response.data.message);
      } else if (!navigator.onLine || err.code === 'ERR_NETWORK') {
        setFormError('Network error. Please check your internet connection.');
      } else {
        setFormError('Password reset failed. Please try again or request a new link.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleReturnToLogin = () => {
    if (onNavigateToLogin) {
      onNavigateToLogin();
    } else {
      window.history.replaceState({}, '', '/');
      window.location.href = '/';
    }
  };

  const handleRequestNewLink = () => {
    if (onNavigateToForgot) {
      onNavigateToForgot();
    } else {
      window.history.replaceState({}, '', '/');
      window.location.href = '/';
    }
  };

  return (
    <div className="relative w-full min-h-[100dvh] h-[100dvh] overflow-y-auto bg-[#05070d] text-slate-100 flex items-center justify-center p-3 sm:p-4 select-none">
      {/* Radiant Sunshine Animation for Light Mode */}
      {isLightTheme && <RadiantSunshineBackground />}

      {/* Decorative ambient background glows matching accretion atmosphere */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-to-tr from-[#ff1744]/20 via-[#d3121f]/15 to-[#991b1b]/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Card */}
      <div className="relative w-full max-w-md max-w-[calc(100vw-24px)] max-h-[calc(100dvh-2rem)] overflow-y-auto bg-[#0a0a0f]/95 text-slate-100 rounded-3xl border border-[#ff1744]/25 p-5 sm:p-8 shadow-[0_0_35px_rgba(255,23,68,0.12),0_0_65px_rgba(153,27,27,0.08)] backdrop-blur-2xl z-10 animate-in fade-in duration-300 my-auto">
        
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#991b1b] via-[#d3121f] to-[#ff1744] flex items-center justify-center shadow-[0_0_20px_rgba(255,23,68,0.4)] border border-[#ff1744]/30 mb-3">
            <MessageSquare className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Reset Password</h2>
          <p className="text-sm text-slate-400 mt-1">
            Choose a strong new password for your NEXA account
          </p>
        </div>

        {/* 1. Loading State while validating token */}
        {validatingToken && (
          <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
            <Loader2 className="w-8 h-8 text-[#ff1744] animate-spin" />
            <p className="text-xs font-semibold text-slate-300">Verifying reset link security token...</p>
          </div>
        )}

        {/* 2. Token Error State (Expired or Invalid) */}
        {!validatingToken && tokenError && (
          <div className="space-y-5">
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-rose-200">Invalid or Expired Link</p>
                <p className="leading-relaxed">{tokenError}</p>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={handleRequestNewLink}
                className="w-full py-3 px-4 bg-gradient-to-r from-[#ff1744] via-[#d3121f] to-[#991b1b] hover:brightness-110 active:scale-95 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(255,23,68,0.35)] transition-all cursor-pointer"
              >
                <span>Request New Reset Link</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={handleReturnToLogin}
                className="w-full py-2.5 text-xs text-slate-400 hover:text-white font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Return to Login</span>
              </button>
            </div>
          </div>
        )}

        {/* 3. Reset Success State */}
        {!validatingToken && !tokenError && resetSuccess && (
          <div className="space-y-6 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto shadow-[0_0_25px_rgba(16,185,129,0.25)]">
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-bold text-white">Password Reset Successfully</h3>
              <p className="text-xs text-slate-300 leading-relaxed max-w-xs mx-auto">
                Your password has been securely updated. You can now log in using your new credentials.
              </p>
            </div>

            <button
              type="button"
              onClick={handleReturnToLogin}
              className="w-full py-3 px-4 bg-gradient-to-r from-[#ff1744] via-[#d3121f] to-[#991b1b] hover:brightness-110 active:scale-95 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(255,23,68,0.35)] transition-all cursor-pointer"
            >
              <span>Return to Login</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* 4. Active Reset Password Form */}
        {!validatingToken && !tokenError && !resetSuccess && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {formError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">New Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  minLength={6}
                  autoComplete="new-password"
                  className="w-full bg-[#050505] border border-[#ff1744]/20 rounded-xl pl-10 pr-10 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#ff1744] focus:shadow-[0_0_15px_rgba(255,23,68,0.25)] transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3 text-slate-500 hover:text-slate-300 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Confirm New Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your new password"
                  minLength={6}
                  autoComplete="new-password"
                  className="w-full bg-[#050505] border border-[#ff1744]/20 rounded-xl pl-10 pr-10 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#ff1744] focus:shadow-[0_0_15px_rgba(255,23,68,0.25)] transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3.5 top-3 text-slate-500 hover:text-slate-300 transition-colors"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || !newPassword || !confirmPassword}
              className="w-full py-3 px-4 bg-gradient-to-r from-[#ff1744] via-[#d3121f] to-[#991b1b] hover:brightness-110 active:scale-95 disabled:opacity-50 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(255,23,68,0.35)] transition-all cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Resetting Password...</span>
                </>
              ) : (
                <>
                  <span>Reset Password</span>
                  <ArrowRight className="w-4 h-4 text-white" />
                </>
              )}
            </button>

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={handleReturnToLogin}
                className="text-xs text-slate-400 hover:text-white font-medium transition-colors flex items-center justify-center gap-1.5 mx-auto cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Return to Login</span>
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
};
