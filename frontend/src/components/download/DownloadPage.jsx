import React, { useState } from 'react';
import {
  Smartphone,
  Download,
  QrCode,
  CheckCircle2,
  ShieldCheck,
  Zap,
  Radio,
  Sparkles,
  ArrowLeft,
  ExternalLink,
  ChevronDown,
  Info
} from 'lucide-react';

export const DownloadPage = ({ onNavigateHome }) => {
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [copied, setCopied] = useState(false);

  // GitHub Release direct download URL and Releases page
  const githubReleaseUrl = 'https://github.com/Aakash-18-2006/Nexa-Chat-/releases/latest/download/NEXA-Android.apk';
  const githubReleasesPage = 'https://github.com/Aakash-18-2006/Nexa-Chat-/releases';
  const downloadPageUrl = typeof window !== 'undefined' ? `${window.location.origin}/download` : 'https://nexa-chat.vercel.app/download';

  const handleCopyLink = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(downloadPageUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-[100dvh] w-full bg-[#050505] text-white flex flex-col justify-between selection:bg-[#ff1744] selection:text-white font-sans overflow-x-hidden relative">
      {/* Ambient background glows */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-[#ff1744]/15 blur-[120px]" />
        <div className="absolute top-1/3 -right-40 w-96 h-96 rounded-full bg-[#d3121f]/10 blur-[130px]" />
        <div className="absolute -bottom-40 left-1/3 w-96 h-96 rounded-full bg-[#ff2a55]/10 blur-[140px]" />
      </div>

      {/* Top Navbar */}
      <header className="relative z-20 w-full border-b border-white/10 bg-[#08080d]/80 backdrop-blur-md py-4 px-4 sm:px-8">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onNavigateHome || (() => { window.location.href = '/'; })}
              className="p-2 -ml-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              title="Return to NEXA"
              aria-label="Return to NEXA"
            >
              <ArrowLeft className="w-5 h-5 text-[#ff1744]" />
            </button>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#991b1b] via-[#d3121f] to-[#ff1744] flex items-center justify-center shadow-[0_0_15px_rgba(255,23,68,0.4)] border border-[#ff1744]/30">
                <span className="font-black text-white text-base">N</span>
              </div>
              <div className="flex flex-col">
                <span className="font-black text-lg tracking-wider text-white">NEXA</span>
                <span className="text-[10px] text-slate-400 -mt-1 font-semibold uppercase tracking-wider">Real-time Chat</span>
              </div>
            </div>
          </div>

          <button
            onClick={onNavigateHome || (() => { window.location.href = '/'; })}
            className="text-xs sm:text-sm font-semibold text-slate-300 hover:text-[#ff1744] transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <span>Open Web App</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 flex flex-col items-center justify-center">
        {/* Hero Section */}
        <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-12">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#ff1744]/10 border border-[#ff1744]/25 text-[#ff1744] text-xs font-bold tracking-wider uppercase mb-4 shadow-[0_0_20px_rgba(255,23,68,0.15)]">
            <Smartphone className="w-4 h-4" />
            <span>Official Android Release</span>
          </div>

          <h1 className="text-3xl sm:text-5xl md:text-6xl font-black text-white tracking-tight leading-none mb-4">
            Get <span className="bg-gradient-to-r from-[#ff2a55] via-[#ff1744] to-[#d3121f] bg-clip-text text-transparent drop-shadow-[0_0_25px_rgba(255,23,68,0.35)]">NEXA</span> on Android
          </h1>

          <p className="text-sm sm:text-base text-slate-300 font-medium max-w-lg mx-auto leading-relaxed">
            Ultra-low latency chat, HD WebRTC audio & video calls with Metered TURN relay, and Gemini AI assistant in a sleek standalone app.
          </p>
        </div>

        {/* Download & QR Grid */}
        <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 items-stretch mb-12">
          {/* Card 1: Direct Download */}
          <div className="bg-[#090a10]/90 backdrop-blur-xl border border-white/10 rounded-2xl sm:rounded-3xl p-6 sm:p-8 flex flex-col justify-between shadow-[0_10px_40px_rgba(0,0,0,0.5)] relative group hover:border-[#ff1744]/40 transition-all duration-300">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#ff1744]/5 rounded-full blur-3xl group-hover:bg-[#ff1744]/15 transition-all" />

            <div>
              <div className="w-12 h-12 rounded-2xl bg-[#ff1744]/15 border border-[#ff1744]/30 flex items-center justify-center text-[#ff1744] mb-5 shadow-[0_0_15px_rgba(255,23,68,0.2)]">
                <Download className="w-6 h-6" />
              </div>

              <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">Direct APK Download</h2>
              <p className="text-xs sm:text-sm text-slate-400 mb-6 leading-relaxed">
                Download the verified production release APK directly onto your device. Install and launch instantly.
              </p>

              {/* Version & Requirement Badge */}
              <div className="grid grid-cols-2 gap-2.5 p-3 rounded-xl bg-white/[0.03] border border-white/5 mb-6 text-xs">
                <div>
                  <span className="text-slate-500 block text-[10px] font-bold uppercase">Compatibility</span>
                  <span className="text-slate-200 font-semibold">Android 7.0+ (Nougat+)</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] font-bold uppercase">Version</span>
                  <span className="text-slate-200 font-semibold">v1.0.0</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] font-bold uppercase">Package ID</span>
                  <span className="text-slate-200 font-mono text-[11px]">com.nexa.chat</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] font-bold uppercase">Format / Size</span>
                  <span className="text-slate-200 font-semibold">APK • ~14.2 MB</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <a
                id="download-android-apk-btn"
                href={githubReleaseUrl}
                download="NEXA-Android.apk"
                className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-[#ff1744] via-[#d3121f] to-[#991b1b] text-white font-bold text-center text-sm sm:text-base shadow-[0_0_30px_rgba(255,23,68,0.35)] hover:shadow-[0_0_40px_rgba(255,23,68,0.6)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download className="w-5 h-5" />
                <span>Download NEXA for Android</span>
              </a>

              <a
                href={githubReleasesPage}
                target="_blank"
                rel="noreferrer"
                className="text-center text-xs text-slate-400 hover:text-slate-200 transition-colors flex items-center justify-center gap-1 py-1"
              >
                <span>View all releases on GitHub</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          {/* Card 2: QR Code Scan to Download */}
          <div className="bg-[#090a10]/90 backdrop-blur-xl border border-white/10 rounded-2xl sm:rounded-3xl p-6 sm:p-8 flex flex-col justify-between items-center text-center shadow-[0_10px_40px_rgba(0,0,0,0.5)] relative group hover:border-[#ff1744]/40 transition-all duration-300">
            <div className="w-full">
              <div className="inline-flex items-center gap-2 text-xs font-bold text-[#ff1744] uppercase tracking-wider mb-2">
                <QrCode className="w-4 h-4" />
                <span>Scan to Download</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">Scan from your Phone</h2>
              <p className="text-xs sm:text-sm text-slate-400 mb-6 max-w-xs mx-auto">
                Scan with your phone's camera or Google Lens to immediately open this download page on your Android device.
              </p>

              {/* High-Resolution QR Code Container */}
              <div className="relative mx-auto w-48 h-48 sm:w-52 sm:h-52 bg-white rounded-2xl p-3.5 shadow-[0_0_40px_rgba(255,23,68,0.2)] border-2 border-[#ff1744]/30 flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
                <img
                  src="/assets/nexa-android-qr.svg"
                  alt="NEXA Android APK Download QR Code"
                  className="w-full h-full object-contain"
                />
              </div>
            </div>

            <div className="w-full mt-6 flex flex-col gap-2">
              <button
                onClick={handleCopyLink}
                className="w-full py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-slate-300 transition-colors border border-white/10 cursor-pointer flex items-center justify-center gap-1.5"
              >
                {copied ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400 font-bold">Download Link Copied!</span>
                  </>
                ) : (
                  <>
                    <span>Copy Download Page Link</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Feature Pill Highlights */}
        <div className="w-full max-w-4xl grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-8">
          <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-[#ff1744] shrink-0" />
            <div className="text-left">
              <span className="block text-xs font-bold text-white">Safe & Secure</span>
              <span className="text-[10px] text-slate-400">Direct APK release</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-center gap-3">
            <Radio className="w-5 h-5 text-[#ff1744] shrink-0" />
            <div className="text-left">
              <span className="block text-xs font-bold text-white">Metered TURN</span>
              <span className="text-[10px] text-slate-400">4G/5G calling relay</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-center gap-3">
            <Zap className="w-5 h-5 text-[#ff1744] shrink-0" />
            <div className="text-left">
              <span className="block text-xs font-bold text-white">Ultra Fast</span>
              <span className="text-[10px] text-slate-400">Capacitor native shell</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-[#ff1744] shrink-0" />
            <div className="text-left">
              <span className="block text-xs font-bold text-white">Gemini AI</span>
              <span className="text-[10px] text-slate-400">Built-in smart helper</span>
            </div>
          </div>
        </div>

        {/* Installation Instructions Accordion */}
        <div className="w-full max-w-4xl bg-[#090a10]/60 border border-white/5 rounded-2xl p-4 sm:p-6 text-left">
          <button
            onClick={() => setShowInstallGuide(!showInstallGuide)}
            className="w-full flex items-center justify-between text-sm sm:text-base font-bold text-white cursor-pointer select-none"
          >
            <div className="flex items-center gap-2 text-slate-300">
              <Info className="w-4 h-4 text-[#ff1744]" />
              <span>How to install NEXA on Android</span>
            </div>
            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${showInstallGuide ? 'rotate-180' : ''}`} />
          </button>

          {showInstallGuide && (
            <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-slate-300 leading-relaxed">
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                <span className="font-bold text-white block mb-1">1. Download APK</span>
                Tap the download button above to save <span className="font-mono text-[11px] text-[#ff1744]">NEXA-Android.apk</span> to your device.
              </div>
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                <span className="font-bold text-white block mb-1">2. Allow Unknown Apps</span>
                If prompted by Android, tap "Settings" and toggle "Allow from this source" to authorize your browser to install APKs.
              </div>
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                <span className="font-bold text-white block mb-1">3. Install & Launch</span>
                Tap "Install" on the confirmation screen, then open NEXA from your app drawer and log in to start chatting!
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full border-t border-white/10 bg-[#08080d]/80 py-4 px-4 text-center text-xs text-slate-500">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>&copy; {new Date().getFullYear()} NEXA Real-time Chat. All rights reserved.</span>
          <span className="text-slate-400">Package: <code className="text-[#ff1744]">com.nexa.chat</code> • Target: Android 14/15</span>
        </div>
      </footer>
    </div>
  );
};
