import React, { useState, useEffect } from 'react';
import { Sparkles, Download, X, ArrowUpCircle } from 'lucide-react';
import {
  checkForAppUpdate,
  dismissUpdatePrompt,
  openDownloadPage
} from '../../services/updateService';

export const UpdateNotificationBanner = () => {
  const [updateInfo, setUpdateInfo] = useState(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const runCheck = async () => {
      try {
        const info = await checkForAppUpdate(false);
        if (isMounted && info && info.hasUpdate) {
          setUpdateInfo(info);
          setIsVisible(true);
        }
      } catch (err) {
        console.debug('[UpdateNotificationBanner] Check failed:', err);
      }
    };

    // Slight delay after startup so app initializes smoothly
    const timer = setTimeout(runCheck, 2500);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, []);

  if (!isVisible || !updateInfo) {
    return null;
  }

  const handleUpdate = () => {
    openDownloadPage(updateInfo.downloadUrl);
  };

  const handleDismiss = () => {
    dismissUpdatePrompt(updateInfo.latestVersion);
    setIsVisible(false);
  };

  return (
    <aside
      aria-label="App update notification"
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 sm:max-w-md z-50 animate-in fade-in slide-in-from-bottom-5 duration-300 pointer-events-auto"
    >
      <div className="relative overflow-hidden rounded-2xl bg-[#0d0e15]/95 border border-[#ff1744]/40 p-4 shadow-[0_12px_40px_rgba(0,0,0,0.7),0_0_25px_rgba(255,23,68,0.2)] backdrop-blur-xl">
        {/* Glow ambient background accent */}
        <div className="absolute -top-12 -right-12 w-28 h-28 rounded-full bg-[#ff1744]/20 blur-2xl pointer-events-none" />

        <div className="flex items-start gap-3.5 relative z-10">
          {/* Update icon badge */}
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#ff1744]/25 to-[#991b1b]/20 border border-[#ff1744]/40 flex items-center justify-center text-[#ff1744] shrink-0 shadow-[0_0_15px_rgba(255,23,68,0.3)]">
            <ArrowUpCircle className="w-5 h-5 animate-pulse" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 pr-2">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#ff1744] bg-[#ff1744]/10 px-2 py-0.5 rounded-full border border-[#ff1744]/25">
                <Sparkles className="w-2.5 h-2.5" />
                Update Available
              </span>
              <span className="text-[11px] font-semibold text-slate-300">
                v{updateInfo.latestVersion}
              </span>
            </div>

            <h4 className="text-sm font-bold text-white tracking-tight leading-snug">
              New NEXA update available
            </h4>

            <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
              {updateInfo.releaseNotes || 'Download and install the latest APK to get new features and optimizations.'}
            </p>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 mt-3.5">
              <button
                type="button"
                onClick={handleUpdate}
                className="flex-1 py-2 px-3.5 rounded-xl bg-gradient-to-r from-[#ff1744] via-[#d3121f] to-[#991b1b] text-white font-bold text-xs shadow-[0_0_15px_rgba(255,23,68,0.35)] hover:shadow-[0_0_25px_rgba(255,23,68,0.5)] hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Update</span>
              </button>

              <button
                type="button"
                onClick={handleDismiss}
                className="py-2 px-3.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-semibold text-xs transition-colors border border-white/10 cursor-pointer"
              >
                Later
              </button>
            </div>
          </div>

          {/* Close button */}
          <button
            type="button"
            onClick={handleDismiss}
            className="p-1 -mt-1 -mr-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            aria-label="Dismiss update notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
