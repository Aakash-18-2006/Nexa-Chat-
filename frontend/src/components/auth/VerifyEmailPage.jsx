import React, { useState, useEffect } from 'react';
import { authApi } from '../../api/endpoints';
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  Mail,
  ArrowRight,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';

export const VerifyEmailPage = ({ onNavigateToLogin }) => {
  const [status, setStatus] = useState('verifying'); // 'verifying' | 'success' | 'error'
  const [errorMessage, setErrorMessage] = useState('');
  const [resendEmail, setResendEmail] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState('');

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const token = searchParams.get('token');

    if (!token) {
      setStatus('error');
      setErrorMessage('No email verification token provided in URL.');
      return;
    }

    const runVerification = async () => {
      try {
        const res = await authApi.verifyEmail(token);
        if (res.data.success) {
          setStatus('success');
        } else {
          setStatus('error');
          setErrorMessage(res.data.message || 'Verification link is invalid or has expired.');
        }
      } catch (err) {
        setStatus('error');
        setErrorMessage(
          err.response?.data?.message || 'Verification link is invalid or has expired. Please request a new one.'
        );
      }
    };

    runVerification();
  }, []);

  const handleResend = async (e) => {
    e.preventDefault();
    if (!resendEmail.trim()) return;

    setResendLoading(true);
    setResendSuccess('');
    setErrorMessage('');

    try {
      const res = await authApi.resendVerification({ email: resendEmail.trim() });
      setResendSuccess(res.data?.message || 'A fresh verification link has been sent to your email.');
    } catch (err) {
      setErrorMessage(err.response?.data?.message || 'Failed to resend verification email.');
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] w-full bg-[#05070d] text-slate-100 flex items-center justify-center p-3 sm:p-4 relative overflow-y-auto select-none">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#ff1744]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-[#991b1b]/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md max-w-[calc(100vw-24px)] max-h-[calc(100dvh-2rem)] overflow-y-auto bg-[#0a0a0f]/90 border border-[#ff1744]/25 rounded-3xl p-5 sm:p-8 shadow-[0_0_40px_rgba(255,23,68,0.15)] backdrop-blur-xl z-10 animate-in fade-in duration-300 my-auto">
        
        {/* Header Icon */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#991b1b] via-[#d3121f] to-[#ff1744] flex items-center justify-center shadow-[0_0_25px_rgba(255,23,68,0.4)] border border-[#ff1744]/30 mb-4">
            {status === 'success' ? (
              <CheckCircle2 className="w-8 h-8 text-white" />
            ) : status === 'error' ? (
              <AlertCircle className="w-8 h-8 text-white" />
            ) : (
              <ShieldCheck className="w-8 h-8 text-white animate-pulse" />
            )}
          </div>

          <h2 className="text-2xl font-bold tracking-tight text-white">
            {status === 'verifying' && 'Verifying Email...'}
            {status === 'success' && 'Email Verified!'}
            {status === 'error' && 'Verification Issue'}
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">
            {status === 'verifying' && 'Validating your cryptographic verification link with NEXA security...'}
            {status === 'success' && 'Your email address is verified. You have full access to NEXA Messenger.'}
            {status === 'error' && errorMessage}
          </p>
        </div>

        {/* Verifying State */}
        {status === 'verifying' && (
          <div className="py-8 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 text-[#ff1744] animate-spin" />
            <span className="text-xs text-slate-400 font-medium">Securing session...</span>
          </div>
        )}

        {/* Success State */}
        {status === 'success' && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-xs text-emerald-400 text-center leading-relaxed">
              Your account security status is verified and updated.
            </div>

            <button
              type="button"
              onClick={onNavigateToLogin}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-[#ff1744] via-[#d3121f] to-[#991b1b] hover:brightness-110 active:scale-95 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(255,23,68,0.35)] transition-all cursor-pointer"
            >
              <span>Continue to NEXA</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Error State */}
        {status === 'error' && (
          <div className="space-y-4">
            {resendSuccess ? (
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-xs text-emerald-400 text-center leading-relaxed">
                {resendSuccess}
              </div>
            ) : (
              <form onSubmit={handleResend} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Resend Verification Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                    <input
                      type="email"
                      required
                      value={resendEmail}
                      onChange={(e) => setResendEmail(e.target.value)}
                      placeholder="your.email@example.com"
                      className="w-full bg-[#050505] border border-[#ff1744]/25 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-[#ff1744] transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={resendLoading || !resendEmail.trim()}
                  className="w-full py-2.5 px-4 bg-gradient-to-r from-[#ff1744] via-[#d3121f] to-[#991b1b] hover:brightness-110 active:scale-95 disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(255,23,68,0.25)] transition-all cursor-pointer"
                >
                  {resendLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                  ) : (
                    <>
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Resend Verification Link</span>
                    </>
                  )}
                </button>
              </form>
            )}

            <div className="pt-3 border-t border-white/5 text-center">
              <button
                type="button"
                onClick={onNavigateToLogin}
                className="text-xs text-[#ff1744] hover:text-[#ff2a55] font-medium transition-colors cursor-pointer"
              >
                Return to NEXA Login
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
