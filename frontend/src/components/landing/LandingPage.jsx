import React, { useState, useEffect, useRef } from 'react';
import EtchedAccretion from '@/components/ui/etched-accretion';
import { PlanetTransition } from '@/components/ui/PlanetTransition';
import { AuthModal } from '../auth/AuthModal';
import { MessageSquare, ArrowRight } from 'lucide-react';

export const LandingPage = ({ initialAuthOpen = false, initialAuthMode = 'login' }) => {
  const [authModalOpen, setAuthModalOpen] = useState(initialAuthOpen);
  const [authMode, setAuthMode] = useState(initialAuthMode);

  // Planet transition states
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isPlanetActivating, setIsPlanetActivating] = useState(false);
  const [isWaveExpanding, setIsWaveExpanding] = useState(false);
  const [transitionOrigin, setTransitionOrigin] = useState({
    x: typeof window !== 'undefined' ? window.innerWidth / 2 : 500,
    y: typeof window !== 'undefined' ? window.innerHeight * 0.49 : 400,
  });
  const activationTimeoutRef = useRef(null);

  useEffect(() => {
    if (initialAuthOpen) {
      setAuthModalOpen(true);
      setAuthMode(initialAuthMode || 'login');
    }
  }, [initialAuthOpen, initialAuthMode]);

  // Sync with browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      if (path === '/login' || path === '/register') {
        setAuthMode(path === '/register' ? 'register' : 'login');
        setAuthModalOpen(true);
      } else if (path === '/') {
        setAuthModalOpen(false);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      if (activationTimeoutRef.current) clearTimeout(activationTimeoutRef.current);
    };
  }, []);

  const openAuth = (mode = 'login') => {
    setAuthMode(mode);
    setAuthModalOpen(true);
    if (window.location.pathname !== `/${mode}`) {
      window.history.pushState({ auth: true }, '', `/${mode}`);
    }
  };

  const handleStartChattingClick = (e) => {
    // Prevent double triggers
    if (isTransitioning || authModalOpen) return;

    // Check prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      openAuth('login');
      return;
    }

    // Dynamically calculate the EXACT visual center of the planet / black hole
    const planetEl = document.querySelector('[data-planet-element="true"]') || document.querySelector('canvas');
    let originX = window.innerWidth / 2;
    let originY = window.innerHeight * 0.49;

    if (planetEl) {
      const rect = planetEl.getBoundingClientRect();
      const px = parseFloat(planetEl.getAttribute('data-planet-x')) || 0.5;
      const py = parseFloat(planetEl.getAttribute('data-planet-y')) || 0.49;
      originX = rect.left + rect.width * px;
      originY = rect.top + rect.height * py;
    }

    setTransitionOrigin({ x: originX, y: originY });
    setIsTransitioning(true);
    setIsPlanetActivating(true);

    // Phase 1 -> Phase 2 handover at ~200ms
    activationTimeoutRef.current = setTimeout(() => {
      setIsPlanetActivating(false);
      setIsWaveExpanding(true);
    }, 200);
  };

  // Phase 3 handover at ~700ms: reveal login behind the expanding transparent wave
  const handleStartLoginReveal = () => {
    openAuth('login');
  };

  // Phase 4 completion at ~1150ms: cleanup transition state
  const handleTransitionComplete = () => {
    setIsTransitioning(false);
    setIsPlanetActivating(false);
    setIsWaveExpanding(false);
  };

  const handleCloseModal = () => {
    setAuthModalOpen(false);
    if (window.location.pathname === '/login' || window.location.pathname === '/register') {
      window.history.replaceState({}, '', '/');
    }
  };

  return (
    <div className="relative w-full h-[100dvh] overflow-hidden bg-[#030307] text-slate-100 select-none">
      {/* Cinematic Planet Energy Wave Transition */}
      <PlanetTransition
        active={isTransitioning}
        origin={transitionOrigin}
        onStartLoginReveal={handleStartLoginReveal}
        onComplete={handleTransitionComplete}
      />

      {/* Existing WebGL2 Accretion Disk / Planet Background */}
      <EtchedAccretion
        preset="crimson"
        interactive={!isTransitioning && !authModalOpen}
        className="w-full h-full"
        height="100dvh"
      >
        {/* Animated Landing Content Wrapper that dissolves into the wave in Phase 2/3 */}
        <div
          className={`relative w-full h-full transition-all duration-500 ease-out ${
            isWaveExpanding
              ? 'opacity-0 scale-[1.04] blur-[3px] pointer-events-none'
              : 'opacity-100 scale-100 blur-0'
          }`}
        >
          {/* Top Floating Navigation Bar */}
          <header
            className="absolute top-0 left-0 right-0 z-30 w-full max-w-7xl mx-auto px-5 sm:px-6 py-4 sm:py-6 flex items-center justify-between pointer-events-auto"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#991b1b] via-[#d3121f] to-[#ff1744] flex items-center justify-center shadow-[0_0_20px_rgba(255,23,68,0.45)] border border-[#ff1744]/30">
                <MessageSquare className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-black tracking-tight text-white drop-shadow-md">NEXA</span>
            </div>
          </header>

          {/* Main Title / Product Identity */}
          <div className="absolute top-20 sm:top-24 md:top-[14vh] lg:top-[16vh] left-0 right-0 flex items-center justify-center pointer-events-none select-none z-10">
            <span
              style={{
                fontFamily: "'Postamp Grotesk', 'Oswald', 'Antonio', 'Barlow Condensed', sans-serif",
                fontWeight: 800,
                fontSize: "clamp(36px, 8vw, 108px)",
                lineHeight: 1,
                letterSpacing: "-0.02em",
                color: "#f2f4f8",
                textShadow: "0 4px 30px rgba(0,0,0,0.6)",
                display: "inline-block",
              }}
            >
              NEXA
            </span>
          </div>

          {/* Floating CTA Overlay */}
          <div
            className="absolute bottom-16 sm:bottom-20 left-1/2 -translate-x-1/2 z-20 flex items-center justify-center pointer-events-auto"
          >
            <button
              id="start-chatting-btn"
              onClick={handleStartChattingClick}
              disabled={isTransitioning}
              className={`nexa-start-chat-button text-sm sm:text-base font-bold transition-all duration-200 ${
                isPlanetActivating
                  ? 'scale-95 opacity-80 cursor-wait'
                  : ''
              }`}
            >
              <span>Start Chatting</span>
              <ArrowRight className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>
      </EtchedAccretion>

      {/* Real Authentication Modal with smooth reveal transition */}
      <AuthModal
        isOpen={authModalOpen}
        initialMode={authMode}
        closable={true}
        onClose={handleCloseModal}
      />
    </div>
  );
};
