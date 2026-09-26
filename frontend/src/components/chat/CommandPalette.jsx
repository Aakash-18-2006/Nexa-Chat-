import React, { useState, useEffect } from 'react';
import {
  Search,
  MessageSquare,
  Users,
  Clock,
  Moon,
  Sun,
  Volume2,
  VolumeX,
  Settings,
  LogOut,
  Sparkles,
  Command,
  User
} from 'lucide-react';

export const CommandPalette = ({
  isOpen,
  onClose,
  onOpenNewChat,
  onOpenNewGroup,
  onOpenTempRoom,
  onOpenSearch,
  onOpenSettings,
  onOpenMyProfile,
  onToggleTheme,
  currentTheme,
  soundEnabled,
  onToggleSound,
  onLogout
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const actions = [
    {
      id: 'search',
      title: 'Global Search',
      description: 'Search messages, people, and groups',
      icon: Search,
      category: 'Navigation',
      run: onOpenSearch
    },
    {
      id: 'new_chat',
      title: 'New Direct Chat',
      description: 'Find a user and start a 1-to-1 conversation',
      icon: MessageSquare,
      category: 'Messaging',
      run: onOpenNewChat
    },
    {
      id: 'new_group',
      title: 'Create Group',
      description: 'Start a collaborative group conversation',
      icon: Users,
      category: 'Messaging',
      run: onOpenNewGroup
    },
    {
      id: 'temp_room',
      title: 'Temporary Room',
      description: 'Generate or join an ephemeral room with code',
      icon: Clock,
      category: 'Messaging',
      run: onOpenTempRoom
    },
    {
      id: 'theme',
      title: `Switch to ${currentTheme === 'dark' ? 'Light' : 'Dark'} Mode`,
      description: 'Toggle between Black/Amber and Ivory/Amber themes',
      icon: currentTheme === 'dark' ? Sun : Moon,
      category: 'Preferences',
      run: onToggleTheme
    },
    {
      id: 'audio',
      title: `${soundEnabled ? 'Mute' : 'Unmute'} Audio Alerts`,
      description: 'Toggle acoustic notification sounds for new messages',
      icon: soundEnabled ? VolumeX : Volume2,
      category: 'Preferences',
      run: onToggleSound
    },
    {
      id: 'my_profile',
      title: 'My Profile',
      description: 'View your profile, followers, and account details',
      icon: User,
      category: 'Account',
      run: onOpenMyProfile
    },
    {
      id: 'settings',
      title: 'Settings',
      description: 'Manage settings, privacy, appearance, and blocked accounts',
      icon: Settings,
      category: 'System',
      run: onOpenSettings
    },
    {
      id: 'logout',
      title: 'Sign Out',
      description: 'End your current NEXA session',
      icon: LogOut,
      category: 'System',
      run: onLogout
    }
  ];

  const filtered = actions.filter((a) =>
    a.title.toLowerCase().includes(query.toLowerCase()) ||
    a.description.toLowerCase().includes(query.toLowerCase()) ||
    a.category.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Global Cmd+K / Ctrl+K listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) {
          onClose();
        } else {
          setQuery('');
        }
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSelect = (action) => {
    onClose();
    action.run();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4">
      <div className="fixed inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-xl bg-[#0a0a0f]/95 border border-[#ff1744]/25 rounded-2xl shadow-[0_0_35px_rgba(255,23,68,0.12),0_0_65px_rgba(153,27,27,0.06)] backdrop-blur-2xl overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-150">
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-[#ff1744]/15 gap-3">
          <Command className="w-5 h-5 text-[#ff1744] flex-shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search action... (e.g. 'theme', 'group')"
            className="w-full bg-transparent text-sm text-white placeholder:text-slate-500 focus:outline-none"
          />
          <kbd className="px-2 py-0.5 rounded text-[10px] font-mono bg-white/5 border border-white/10 text-slate-400">
            ESC
          </kbd>
        </div>

        {/* Command Items List */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {filtered.length > 0 ? (
            filtered.map((action, idx) => {
              const Icon = action.icon;
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={action.id}
                  onClick={() => handleSelect(action)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-[#ff1744]/15 border border-[#ff1744]/40 text-white shadow-[0_0_12px_rgba(255,23,68,0.15)]'
                      : 'hover:bg-white/5 text-slate-300 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                        isSelected
                          ? 'bg-gradient-to-r from-[#ff1744] to-[#991b1b] text-white shadow-[0_0_10px_rgba(255,23,68,0.5)]'
                          : 'bg-white/5 text-[#ff1744]'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="truncate">
                      <p className="text-xs font-semibold text-white truncate">{action.title}</p>
                      <p className="text-[11px] text-slate-400 truncate">{action.description}</p>
                    </div>
                  </div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 flex-shrink-0">
                    {action.category}
                  </span>
                </div>
              );
            })
          ) : (
            <div className="py-8 text-center text-xs text-slate-500">
              No matching commands found
            </div>
          )}
        </div>

        <div className="px-4 py-2 bg-[#050505] border-t border-[#ff1744]/10 flex items-center justify-between text-[11px] text-slate-500">
          <span>Use <b>↑ ↓</b> to navigate, <b>Enter</b> to select</span>
          <span className="text-[#ff1744] font-medium">NEXA Command Hub</span>
        </div>
      </div>
    </div>
  );
};
