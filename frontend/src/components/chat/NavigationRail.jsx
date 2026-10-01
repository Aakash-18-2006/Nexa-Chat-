import React from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useNotifications } from '../../context/NotificationContext';
import { Volume2, VolumeX, Bell, Smartphone } from 'lucide-react';

export const NavigationRail = ({
  activeSection, // 'all' | 'direct' | 'groups'
  onChangeSection,
  onOpenSearch,
  onOpenCommandPalette,
  soundEnabled,
  onToggleSound
}) => {
  const { theme, toggleTheme } = useTheme();
  const { unreadCount, isOpen, toggleNotifications } = useNotifications();

  return (
    <aside className="w-16 h-full bg-[#050505] border-r border-white/10 flex flex-col items-center justify-between py-4 select-none z-30 flex-shrink-0">
      {/* Top Emblem */}
      <div className="flex flex-col items-center gap-6">
        <div
          onClick={() => onChangeSection('all')}
          className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#991b1b] via-[#d3121f] to-[#ff1744] flex items-center justify-center shadow-[0_0_20px_rgba(255,23,68,0.45)] border border-[#ff1744]/30 cursor-pointer hover:scale-105 transition-all duration-300"
          title="NEXA Real-Time"
        >
          <span className="font-black text-white text-xl tracking-tighter">N</span>
        </div>

        {/* Navigation Item Icons */}
        <nav className="flex flex-col items-center gap-2">
          {/* Direct Messages */}
          <button
            type="button"
            onClick={() => onChangeSection('direct')}
            className={`nexa-rail-btn ${activeSection === 'direct' ? 'is-active' : ''}`}
            title="Direct Messages"
            aria-label="Direct Messages"
          >
            <div className="nexa-rail-icon">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-5 h-5 text-black dark:text-white"
              >
                <path
                  d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
                  className="nexa-draw-stroke"
                />
              </svg>
            </div>
            {activeSection === 'direct' && (
              <span className="absolute -left-2 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-gradient-to-b from-[#ff1744] to-[#991b1b] shadow-[0_0_8px_#ff1744]" />
            )}
          </button>

          {/* Groups */}
          <button
            type="button"
            onClick={() => onChangeSection('groups')}
            className={`nexa-rail-btn ${activeSection === 'groups' ? 'is-active' : ''}`}
            title="Groups"
            aria-label="Groups"
          >
            <div className="nexa-rail-icon">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-5 h-5 text-black dark:text-white"
              >
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" className="nexa-draw-stroke" />
                <circle cx="9" cy="7" r="4" className="nexa-draw-stroke-sm" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" className="nexa-draw-stroke-delayed" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" className="nexa-draw-stroke-delayed" />
              </svg>
            </div>
            {activeSection === 'groups' && (
              <span className="absolute -left-2 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-gradient-to-b from-[#ff1744] to-[#991b1b] shadow-[0_0_8px_#ff1744]" />
            )}
          </button>

          {/* Notification Center Trigger with Uiverse Bell Ring Animation */}
          <button
            type="button"
            onClick={toggleNotifications}
            className={`nexa-notif-btn ${isOpen ? 'is-active' : ''}`}
            aria-label="Notification Center"
          >
            <div className="nexa-bell-icon">
              <Bell className="w-5 h-5 text-white" />
            </div>

            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full bg-gradient-to-r from-[#ff1744] to-[#991b1b] text-white shadow-[0_0_10px_rgba(255,23,68,0.6)] animate-pulse pointer-events-none z-10">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}

            {isOpen && (
              <span className="absolute -left-2 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-gradient-to-b from-[#ff1744] to-[#991b1b] shadow-[0_0_8px_#ff1744]" />
            )}
          </button>

          <div className="w-8 h-[1px] bg-white/10 my-1" />

          {/* Global Search Trigger with Progressive SVG Stroke Tracing */}
          <button
            type="button"
            onClick={onOpenSearch}
            className="nexa-rail-btn"
            aria-label="Global Search"
          >
            <div className="nexa-rail-icon">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-5 h-5 text-white"
              >
                <circle cx="11" cy="11" r="8" className="nexa-draw-stroke-sm" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" className="nexa-draw-stroke-delayed" />
              </svg>
            </div>
          </button>

          {/* Command Palette Trigger with Progressive SVG Stroke Tracing */}
          <button
            type="button"
            onClick={onOpenCommandPalette}
            className="nexa-rail-btn"
            title="Command Palette (⌘K / Ctrl+K)"
            aria-label="Command Palette"
          >
            <div className="nexa-rail-icon">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-5 h-5 text-black dark:text-white"
              >
                <path
                  d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3"
                  className="nexa-draw-stroke-lg"
                />
              </svg>
            </div>
          </button>

          {/* Download NEXA for Android */}
          <a
            href="https://nexa-chat.vercel.app/download"
            target="_blank"
            rel="noopener noreferrer"
            className="nexa-rail-btn group"
            title="Download NEXA for Android"
            aria-label="Download NEXA for Android"
          >
            <div className="nexa-rail-icon">
              <Smartphone className="w-5 h-5 text-slate-300 group-hover:text-[#ff1744] transition-colors" />
            </div>
          </a>
        </nav>
      </div>

      {/* Bottom Controls */}
      <div className="flex flex-col items-center gap-2">
        {/* Audio Alerts Toggle */}
        <button
          type="button"
          onClick={onToggleSound}
          className={`p-2.5 rounded-xl transition-colors cursor-pointer ${
            soundEnabled
              ? 'text-[#ff1744] hover:text-[#ff2a55]'
              : 'text-slate-500 hover:text-slate-400'
          }`}
          title={soundEnabled ? 'Acoustic Sound Notifications: ON' : 'Sound Notifications: OFF'}
          aria-label={soundEnabled ? 'Acoustic Sound Notifications: ON' : 'Sound Notifications: OFF'}
        >
          {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>

        {/* Day/Night Theme Toggle (Uiverse by mobinkakei) */}
        <div className="flex items-center justify-center p-1 select-none">
          <label
            className="nexa-theme-toggle-wrapper"
            title={`Switch Theme (Current: ${theme === 'dark' ? 'Dark' : 'Light'})`}
          >
            <input
              className="nexa-theme-toggle-input"
              type="checkbox"
              checked={theme === 'dark'}
              onChange={toggleTheme}
              aria-label="Toggle dark mode"
            />
            <span className="nexa-theme-toggle-track">
              <span className="nexa-theme-toggle-handler">
                <span className="nexa-crater nexa-crater--1" />
                <span className="nexa-crater nexa-crater--2" />
                <span className="nexa-crater nexa-crater--3" />
              </span>
              <span className="nexa-star nexa-star--1" />
              <span className="nexa-star nexa-star--2" />
              <span className="nexa-star nexa-star--3" />
              <span className="nexa-star nexa-star--4" />
              <span className="nexa-star nexa-star--5" />
              <span className="nexa-star nexa-star--6" />
            </span>
          </label>
        </div>
      </div>
    </aside>
  );
};

