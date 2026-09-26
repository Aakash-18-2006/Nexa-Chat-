import React from 'react';
import { useChat } from '../../context/ChatContext';
import { useTheme } from '../../context/ThemeContext';
import { RadiantSunshineBackground } from '../ui/RadiantSunshineBackground';
import { RedBlackPulseBackground } from '../ui/RedBlackPulseBackground';
import { PainThemeBackground } from '../ui/PainThemeBackground';
import { ChatSpaceBackground } from './ChatSpaceBackground';
import { Check, Moon, Sun, RotateCcw, Flame, Zap } from 'lucide-react';

export const ChatThemeSelector = ({ targetUserId, conversationId, onSelect }) => {
  const { theme: appTheme } = useTheme();
  const { setChatTheme, getChatTheme } = useChat();

  const isLightAppTheme = appTheme === 'light';
  const currentMode = isLightAppTheme ? 'light' : 'dark';
  const defaultThemeId = isLightAppTheme ? 'radiant_sunshine' : 'dark_background';

  // Read current saved theme for this user or conversation for the CURRENT global theme mode
  const customSavedTheme =
    (targetUserId ? getChatTheme(targetUserId, currentMode) : null) ||
    (conversationId ? getChatTheme(conversationId, currentMode) : null);

  // Active theme is customSavedTheme if set, otherwise the app's default for this mode
  const activeThemeId = customSavedTheme || defaultThemeId;

  const handleSelectTheme = (themeId) => {
    if (targetUserId) {
      setChatTheme(targetUserId, currentMode, themeId);
    }
    if (conversationId) {
      setChatTheme(conversationId, currentMode, themeId);
    }
    if (onSelect) {
      onSelect(themeId);
    }
  };

  const handleResetToDefault = () => {
    if (targetUserId) {
      setChatTheme(targetUserId, currentMode, 'default');
    }
    if (conversationId) {
      setChatTheme(conversationId, currentMode, 'default');
    }
    if (onSelect) {
      onSelect(defaultThemeId);
    }
  };

  const themes = [
    {
      id: 'radiant_sunshine',
      name: 'Radiant Sunshine',
      isDefault: isLightAppTheme,
      icon: Sun,
      preview: (
        <div className="relative w-full h-full overflow-hidden bg-gradient-to-br from-[#1d4ed8] via-[#3b82f6] to-[#93c5fd]">
          <RadiantSunshineBackground className="is-contained" />
        </div>
      )
    },
    {
      id: 'dark_background',
      name: 'Dark Background',
      isDefault: !isLightAppTheme,
      icon: Moon,
      preview: (
        <div className="relative w-full h-full overflow-hidden bg-[#050505]">
          <ChatSpaceBackground />
        </div>
      )
    },
    {
      id: 'red_black_pulse',
      name: 'Red Black Pulse',
      isDefault: false,
      icon: Flame,
      preview: (
        <div className="relative w-full h-full overflow-hidden bg-black">
          <RedBlackPulseBackground className="is-contained is-preview" />
        </div>
      )
    },
    {
      id: 'pain_theme',
      name: 'Pain (Shinra Tensei)',
      isDefault: false,
      icon: Zap,
      preview: (
        <div className="relative w-full h-full overflow-hidden bg-black">
          <PainThemeBackground className="is-contained is-preview" />
        </div>
      )
    }
  ];

  return (
    <div className="space-y-4 select-none">
      <div className="text-left">
        <p className="text-xs text-slate-400">
          Personalize the background for this conversation in{' '}
          <span className="font-semibold text-white">
            {isLightAppTheme ? 'Light Theme' : 'Dark Theme'}
          </span>
          .
        </p>
      </div>

      {/* Theme Cards List */}
      <div className="space-y-3">
        {themes.map((t) => {
          const isSelected = activeThemeId === t.id;
          const Icon = t.icon;

          return (
            <div
              key={t.id}
              role="button"
              tabIndex={0}
              onClick={() => handleSelectTheme(t.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleSelectTheme(t.id);
                }
              }}
              className={`group relative rounded-2xl p-3 border transition-all cursor-pointer text-left ${
                isSelected
                  ? 'border-[#ff1744] bg-[#ff1744]/10 shadow-lg shadow-[#ff1744]/15 ring-1 ring-[#ff1744]'
                  : 'border-white/10 hover:border-white/20 bg-white/[0.02] hover:bg-white/[0.05]'
              }`}
            >
              {/* Header: Name, Default Badge, Selection Indicator */}
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                      t.id === 'radiant_sunshine'
                        ? 'bg-amber-400/15 text-amber-300'
                        : t.id === 'red_black_pulse'
                        ? 'bg-red-500/15 text-[#ff1744]'
                        : t.id === 'pain_theme'
                        ? 'bg-orange-500/15 text-orange-400'
                        : 'bg-indigo-500/15 text-indigo-300'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs sm:text-sm font-bold text-white tracking-tight truncate">
                    {t.name}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {t.isDefault && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      Default Theme ✓
                    </span>
                  )}
                  {isSelected && (
                    <span className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-gradient-to-r from-[#ff1744] to-[#991b1b] text-white shadow-md shadow-[#ff1744]/30">
                      <Check className="w-3 h-3 stroke-[3]" />
                      Selected
                    </span>
                  )}
                </div>
              </div>

              {/* Actual Live Background Animation Preview */}
              <div className="relative h-24 sm:h-28 w-full rounded-xl overflow-hidden border border-white/10 shadow-inner">
                {t.preview}

                {/* Subtle vignette on preview card */}
                <div className="absolute inset-0 pointer-events-none rounded-xl ring-1 ring-inset ring-white/10" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Reset to Default Button (Visible if a custom override is currently set for this mode) */}
      {Boolean(customSavedTheme) && (
        <button
          type="button"
          onClick={handleResetToDefault}
          className="w-full py-2 rounded-xl text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5 text-[#ff1744]" />
          <span>Reset {isLightAppTheme ? 'Light' : 'Dark'} Theme to Default</span>
        </button>
      )}
    </div>
  );
};
