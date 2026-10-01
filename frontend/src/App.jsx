import React, { useState } from 'react';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { NotificationProvider } from './context/NotificationContext';
import { ChatProvider, useChat } from './context/ChatContext';
import { CallProvider } from './context/CallContext';

import { LandingPage } from './components/landing/LandingPage';
import { NavigationRail } from './components/chat/NavigationRail';
import { NotificationCenter } from './components/notifications/NotificationCenter';
import { Sidebar } from './components/chat/Sidebar';
import { ChatWindow } from './components/chat/ChatWindow';
import { TempRoomWindow } from './components/tempRooms/TempRoomWindow';
import { CommandPalette } from './components/chat/CommandPalette';
import { RadiantSunshineBackground } from './components/ui/RadiantSunshineBackground';
import { RedBlackPulseBackground } from './components/ui/RedBlackPulseBackground';
import { PainThemeBackground } from './components/ui/PainThemeBackground';
import { ResetPasswordPage } from './components/auth/ResetPasswordPage';
import { VerifyEmailPage } from './components/auth/VerifyEmailPage';
import { DownloadPage } from './components/download/DownloadPage';

// Modals
import { NewChatModal } from './components/chat/NewChatModal';
import { CreateGroupModal } from './components/groups/CreateGroupModal';
import { AddMembersModal } from './components/groups/AddMembersModal';
import { TempRoomModal } from './components/tempRooms/TempRoomModal';
import { AIAssistantModal } from './components/ai/AIAssistantModal';
import { GlobalSearchModal } from './components/search/GlobalSearchModal';
import { SettingsModal } from './components/settings/SettingsModal';
import { UserProfileModal } from './components/profile/UserProfileModal';
import { IncomingCallModal } from './components/call/IncomingCallModal';
import { CallModal } from './components/call/CallModal';

const ChatDashboard = () => {
  const {
    activeConversation,
    setActiveConversation,
    activeTempRoom,
    leaveTempRoom,
    soundEnabled,
    toggleSound
  } = useChat();

  const { theme, toggleTheme, backgroundTheme } = useTheme();
  const { user, logout } = useAuth();

  // Navigation Rail / Sidebar filter section: 'all' | 'direct' | 'groups' | 'temp'
  const [activeSection, setActiveSection] = useState('all');

  // Modal visibility states
  const [searchOpen, setSearchOpen] = useState(false);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [addMembersOpen, setAddMembersOpen] = useState(false);
  const [tempRoomOpen, setTempRoomOpen] = useState(false);
  const [aiAssistantOpen, setAiAssistantOpen] = useState(false);
  const [aiInitialTab, setAiInitialTab] = useState('chat');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState('account');
  const [myProfileOpen, setMyProfileOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  const hasActiveChat = !!activeConversation || !!activeTempRoom;

  const handleMobileBack = () => {
    setActiveConversation(null);
    if (activeTempRoom) leaveTempRoom();
  };

  const isLightTheme = theme === 'light';

  return (
    <div className={`nexa-app-container w-full h-full flex overflow-hidden relative ${backgroundTheme === 'red_black_pulse' || backgroundTheme === 'pain_theme' ? 'bg-black' : 'bg-[#090a0f]'}`}>
      {/* Dynamic Animated Background Layers (Lower stacking layer: z-index 0, pointer-events-none) */}
      {backgroundTheme === 'red_black_pulse' ? (
        <RedBlackPulseBackground />
      ) : backgroundTheme === 'pain_theme' ? (
        <PainThemeBackground />
      ) : backgroundTheme === 'radiant_sunshine' ? (
        <RadiantSunshineBackground />
      ) : isLightTheme ? (
        <RadiantSunshineBackground />
      ) : null}

      {/* Nexa Application UI (Stacked cleanly above the background animation) */}
      <div className="relative z-10 w-full h-full flex overflow-hidden">
        {/* Column 1: Left Navigation Rail (Always visible on desktop/tablet; hidden on mobile) */}
        <div className="relative z-20 hidden md:flex h-full flex-shrink-0">
          <NavigationRail
            activeSection={activeSection}
            onChangeSection={setActiveSection}
            onOpenSearch={() => setSearchOpen(true)}
            onOpenCommandPalette={() => setCommandPaletteOpen(true)}
            soundEnabled={soundEnabled}
            onToggleSound={toggleSound}
          />
        </div>

        {/* Column 2: Conversation Sidebar (Always on desktop/tablet; on mobile full screen if no active chat) */}
        <div className={`relative z-10 ${hasActiveChat ? 'hidden md:flex' : 'flex'} w-full md:w-auto flex-1 md:flex-initial h-full min-w-0 flex-shrink-0`}>
          <Sidebar
            activeSection={activeSection}
            onChangeSection={setActiveSection}
            onOpenSearch={() => setSearchOpen(true)}
            onOpenNewChat={() => setNewChatOpen(true)}
            onOpenNewGroup={() => setNewGroupOpen(true)}
            onOpenTempRoom={() => setTempRoomOpen(true)}
            onOpenSettings={(tab = 'account') => {
              setSettingsInitialTab(tab);
              setSettingsOpen(true);
            }}
            onOpenMyProfile={() => setMyProfileOpen(true)}
          />
        </div>

        {/* Column 3 & 4: Central Chat Workspace + Chat Info Drawer */}
        <div className={`relative z-0 ${!hasActiveChat ? 'hidden md:flex' : 'flex'} flex-1 h-full min-w-0 w-full`}>
          {activeTempRoom ? (
            <TempRoomWindow onBack={handleMobileBack} />
          ) : (
            <ChatWindow
              onBack={handleMobileBack}
              onOpenAI={(tab = 'chat') => {
                setAiInitialTab(tab);
                setAiAssistantOpen(true);
              }}
              onOpenAddMember={() => setAddMembersOpen(true)}
            />
          )}
        </div>
      </div>

      {/* Real-time Left Notification Center Panel */}
      <NotificationCenter />

      {/* Command Palette (⌘K / Ctrl+K) */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onOpenNewChat={() => setNewChatOpen(true)}
        onOpenNewGroup={() => setNewGroupOpen(true)}
        onOpenTempRoom={() => setTempRoomOpen(true)}
        onOpenSearch={() => setSearchOpen(true)}
        onOpenSettings={(tab = 'account') => {
          setSettingsInitialTab(tab);
          setSettingsOpen(true);
        }}
        onOpenMyProfile={() => setMyProfileOpen(true)}
        onToggleTheme={toggleTheme}
        currentTheme={theme}
        soundEnabled={soundEnabled}
        onToggleSound={toggleSound}
        onLogout={logout}
      />

      {/* Global Modals - Conditionally rendered only when active to avoid mounting 10,000+ lines of DOM/hooks */}
      {searchOpen && <GlobalSearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />}
      {newChatOpen && <NewChatModal isOpen={newChatOpen} onClose={() => setNewChatOpen(false)} />}
      {newGroupOpen && <CreateGroupModal isOpen={newGroupOpen} onClose={() => setNewGroupOpen(false)} />}
      {addMembersOpen && (
        <AddMembersModal
          isOpen={addMembersOpen}
          onClose={() => setAddMembersOpen(false)}
          conversation={activeConversation}
        />
      )}
      {tempRoomOpen && <TempRoomModal isOpen={tempRoomOpen} onClose={() => setTempRoomOpen(false)} />}
      {aiAssistantOpen && (
        <AIAssistantModal
          isOpen={aiAssistantOpen}
          onClose={() => setAiAssistantOpen(false)}
          conversation={activeConversation}
          initialTab={aiInitialTab}
        />
      )}
      {myProfileOpen && (
        <UserProfileModal
          userId={user?._id}
          isOpen={myProfileOpen}
          onClose={() => setMyProfileOpen(false)}
          onEditProfile={() => {
            setMyProfileOpen(false);
            setSettingsInitialTab('account');
            setSettingsOpen(true);
          }}
        />
      )}
      {settingsOpen && (
        <SettingsModal
          isOpen={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          initialTab={settingsInitialTab}
        />
      )}
      {/* Call Modals */}
      <IncomingCallModal />
      <CallModal />
    </div>
  );
};

const MainApp = () => {
  const { user, loading } = useAuth();
  const [currentPath, setCurrentPath] = useState(() => window.location.pathname);
  const [returnToLogin, setReturnToLogin] = useState(false);
  const [returnToForgot, setReturnToForgot] = useState(false);

  React.useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-[#050505] flex flex-col items-center justify-center text-white select-none">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#ff1744] via-[#d3121f] to-[#991b1b] flex items-center justify-center shadow-[0_0_25px_rgba(255,23,68,0.4)] animate-pulse mb-4">
          <span className="text-xl font-black text-white">N</span>
        </div>
        <p className="text-xs font-semibold text-[#ff1744] tracking-wider uppercase">Loading NEXA...</p>
      </div>
    );
  }

  // Check if user is navigating to reset-password route
  const searchParams = new URLSearchParams(window.location.search);
  const isResetPasswordRoute =
    currentPath.startsWith('/reset-password') ||
    searchParams.has('resetToken') ||
    (searchParams.has('token') && currentPath.startsWith('/reset-password'));

  if (isResetPasswordRoute) {
    return (
      <ResetPasswordPage
        onNavigateToLogin={() => {
          window.history.replaceState({}, '', '/');
          setCurrentPath('/');
          setReturnToLogin(true);
          setReturnToForgot(false);
        }}
        onNavigateToForgot={() => {
          window.history.replaceState({}, '', '/');
          setCurrentPath('/');
          setReturnToForgot(true);
          setReturnToLogin(false);
        }}
      />
    );
  }

  const isVerifyEmailRoute = currentPath.startsWith('/verify-email');
  if (isVerifyEmailRoute) {
    return (
      <VerifyEmailPage
        onNavigateToLogin={() => {
          window.history.replaceState({}, '', '/');
          setCurrentPath('/');
          setReturnToLogin(true);
          setReturnToForgot(false);
        }}
      />
    );
  }

  // Check if user is navigating to download route
  const isDownloadRoute =
    currentPath.startsWith('/download') ||
    currentPath.startsWith('/download-android') ||
    currentPath.startsWith('/apk') ||
    currentPath.startsWith('/app');

  if (isDownloadRoute) {
    return (
      <DownloadPage
        onNavigateHome={() => {
          window.history.replaceState({}, '', '/');
          setCurrentPath('/');
        }}
      />
    );
  }

  if (!user) {
    const isLoginRoute = currentPath === '/login';
    const isRegisterRoute = currentPath === '/register';
    return (
      <LandingPage
        initialAuthOpen={returnToLogin || returnToForgot || isLoginRoute || isRegisterRoute}
        initialAuthMode={returnToForgot ? 'forgot' : isRegisterRoute ? 'register' : 'login'}
      />
    );
  }

  return (
    <SocketProvider>
      <NotificationProvider>
        <ChatProvider>
          <CallProvider>
            <ChatDashboard />
          </CallProvider>
        </ChatProvider>
      </NotificationProvider>
    </SocketProvider>
  );
};

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[NEXA ErrorBoundary Caught]:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full bg-[#05070d] flex flex-col items-center justify-center p-6 text-slate-100 select-none">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#ff1744] via-[#d3121f] to-[#991b1b] flex items-center justify-center shadow-[0_0_30px_rgba(255,23,68,0.4)] mb-6">
            <span className="text-2xl font-black text-white">N</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight mb-2">Something went wrong</h2>
          <p className="text-sm text-slate-400 max-w-md text-center mb-6">
            An unexpected error occurred while loading this view. You can reload the application to continue.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => {
                localStorage.removeItem('nexa_token');
                window.location.href = '/';
              }}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-slate-300 transition-colors border border-white/10"
            >
              Clear Session & Return
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-5 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-[#ff1744] via-[#d3121f] to-[#991b1b] text-white shadow-lg hover:opacity-90 transition-opacity"
            >
              Reload NEXA
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <MainApp />
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
