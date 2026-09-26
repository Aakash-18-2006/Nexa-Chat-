import React, { useEffect, useRef } from 'react';

/**
 * PlanetTransition
 * 
 * Cinematic planet-centered energy wave transition matching the NEXA aesthetic.
 * Originates from the exact visual center of the black hole / planet.
 * 
 * Sequence (~1100ms total):
 * - Phase 1 (0-200ms): Planet activation, subtle pulse & radial energy condensation.
 * - Phase 2 (200-620ms): Planet expansion, transparent circular wave with concentric caustic rings,
 *                         subtle crimson/white energy edges and small outward fragments.
 * - Phase 3 (620-880ms): Full-screen wave expansion; landing content dissolves; login begins reveal.
 * - Phase 4 (880-1150ms): Wave dissipates to transparent; login settles sharply; complete cleanup.
 */
export const PlanetTransition = ({
  active,
  origin = { x: typeof window !== 'undefined' ? window.innerWidth / 2 : 500, y: typeof window !== 'undefined' ? window.innerHeight * 0.49 : 400 },
  onStartLoginReveal,
  onComplete,
}) => {
  const canvasRef = useRef(null);
  const onStartLoginRevealRef = useRef(onStartLoginReveal);
  onStartLoginRevealRef.current = onStartLoginReveal;
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const originRef = useRef(origin);
  originRef.current = origin;

  useEffect(() => {
    if (!active) return;

    // Check prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      if (onStartLoginRevealRef.current) onStartLoginRevealRef.current();
      const timeout = setTimeout(() => {
        if (onCompleteRef.current) onCompleteRef.current();
      }, 250);
      return () => clearTimeout(timeout);
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    const startTime = performance.now();
    const totalDuration = 1150; // ms

    // High-DPI support
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.scale(dpr, dpr);

    const ox = originRef.current?.x ?? (width / 2);
    const oy = originRef.current?.y ?? (height * 0.49);

    // Max expansion radius to easily clear all four corners
    const maxRadius = Math.hypot(
      Math.max(ox, width - ox),
      Math.max(oy, height - oy)
    ) * 1.08;

    // Generate ~35-40 small elegant particles (not excessive)
    const particleCount = 38;
    const particles = [];
    const colors = [
      '#ffffff', // Core photon white
      '#ffffff',
      '#ff2a55', // Bright crimson
      '#ff1744', // Deep neon crimson
      '#fc00ff', // Subtle Nexa violet
      '#f1f5f9', // Soft silver
    ];

    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 180 + Math.random() * 620; // px/s
      const size = 1.2 + Math.random() * 2.6;
      const color = colors[Math.floor(Math.random() * colors.length)];
      const delay = Math.random() * 120; // stagger slightly after burst
      const isStreak = Math.random() > 0.4;

      particles.push({
        x: ox,
        y: oy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size,
        color,
        delay,
        alpha: 1,
        drag: 0.965,
        isStreak,
      });
    }

    let loginRevealTriggered = false;
    let hasCompleted = false;

    const render = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / totalDuration, 1);

      ctx.clearRect(0, 0, width, height);

      // Trigger login reveal at ~700ms (Phase 3 transition point)
      if (elapsed >= 700 && !loginRevealTriggered) {
        loginRevealTriggered = true;
        if (onStartLoginRevealRef.current) {
          onStartLoginRevealRef.current();
        }
      }

      // =========================================================================
      // PHASE 1 (0 to 220ms): Planet activation & subtle compression pulse
      // =========================================================================
      if (elapsed < 240) {
        const p1 = elapsed / 240;
        // Inward then outward pulse curve
        const pulse = Math.sin(p1 * Math.PI);
        const ringRadius = 42 + pulse * 18;
        const auraAlpha = pulse * 0.55;

        // Subtle glowing condensation aura around planet center
        const auraGrad = ctx.createRadialGradient(ox, oy, 10, ox, oy, ringRadius + 30);
        auraGrad.addColorStop(0, `rgba(255, 255, 255, ${auraAlpha * 0.45})`);
        auraGrad.addColorStop(0.4, `rgba(255, 23, 68, ${auraAlpha * 0.35})`);
        auraGrad.addColorStop(0.8, `rgba(252, 0, 255, ${auraAlpha * 0.15})`);
        auraGrad.addColorStop(1, 'rgba(3, 3, 7, 0)');

        ctx.save();
        ctx.fillStyle = auraGrad;
        ctx.beginPath();
        ctx.arc(ox, oy, ringRadius + 30, 0, Math.PI * 2);
        ctx.fill();

        // Delicate filament activation ring
        ctx.beginPath();
        ctx.arc(ox, oy, ringRadius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 255, 255, ${auraAlpha * 0.8})`;
        ctx.lineWidth = 1.5;
        ctx.shadowColor = '#ff1744';
        ctx.shadowBlur = 12;
        ctx.stroke();
        ctx.restore();
      }

      // =========================================================================
      // PHASES 2 & 3 (200ms to 950ms): Expanding Transparent Circular Wave & Caustics
      // =========================================================================
      if (elapsed >= 180) {
        const waveTime = elapsed - 180;
        const waveDuration = 760; // ms for the wave to travel across the viewport
        const waveProgress = Math.min(waveTime / waveDuration, 1);

        // Smooth cubic out expansion for realistic gravitational wave acceleration
        const easeOutWave = 1 - Math.pow(1 - waveProgress, 2.6);
        const waveRadius = 35 + easeOutWave * maxRadius;

        // Wave opacity: starts high, stays luminous, fades cleanly near borders
        const waveAlpha = Math.max(0, Math.sin(Math.pow(waveProgress, 0.7) * Math.PI) * 0.85);

        if (waveAlpha > 0.005) {
          ctx.save();

          // 1. Transparent Wave Shimmer (Center remains transparent, only subtle refraction rim)
          const rimThickness = Math.min(120, 25 + waveProgress * 90);
          const waveGrad = ctx.createRadialGradient(
            ox,
            oy,
            Math.max(0, waveRadius - rimThickness),
            ox,
            oy,
            waveRadius + 6
          );
          waveGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
          waveGrad.addColorStop(0.65, `rgba(255, 23, 68, ${waveAlpha * 0.12})`);
          waveGrad.addColorStop(0.9, `rgba(252, 0, 255, ${waveAlpha * 0.22})`);
          waveGrad.addColorStop(0.97, `rgba(255, 255, 255, ${waveAlpha * 0.45})`);
          waveGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');

          ctx.fillStyle = waveGrad;
          ctx.beginPath();
          ctx.arc(ox, oy, waveRadius + 6, 0, Math.PI * 2);
          ctx.fill();

          // 2. Primary Glowing Edge Ring (Sharp photon-white core with crimson glow)
          ctx.beginPath();
          ctx.arc(ox, oy, waveRadius, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(255, 255, 255, ${waveAlpha * 0.9})`;
          ctx.lineWidth = Math.max(1, 2.8 * (1 - easeOutWave * 0.6));
          ctx.shadowColor = '#ff1744';
          ctx.shadowBlur = 16;
          ctx.stroke();

          // 3. Concentric Subtle Caustic Filament Rings (Subtle ripples echoing the planet)
          const ringOffsets = [18, 38, 64];
          const ringAlphas = [0.45, 0.28, 0.15];
          ringOffsets.forEach((offset, idx) => {
            const r = waveRadius - offset;
            if (r > 10) {
              ctx.beginPath();
              ctx.arc(ox, oy, r, 0, Math.PI * 2);
              ctx.strokeStyle = `rgba(252, 0, 255, ${waveAlpha * ringAlphas[idx]})`;
              ctx.lineWidth = 1;
              ctx.shadowColor = '#fc00ff';
              ctx.shadowBlur = 8;
              ctx.stroke();
            }
          });

          // 4. Planet Core Dissolve Flash (Soft radial bloom at planet center that dissipates)
          if (waveProgress < 0.5) {
            const coreDissolve = waveProgress / 0.5;
            const coreRadius = 40 + coreDissolve * 160;
            const coreAlpha = (1 - coreDissolve) * 0.65;
            const coreGrad = ctx.createRadialGradient(ox, oy, 0, ox, oy, coreRadius);
            coreGrad.addColorStop(0, `rgba(255, 255, 255, ${coreAlpha * 0.85})`);
            coreGrad.addColorStop(0.4, `rgba(255, 23, 68, ${coreAlpha * 0.5})`);
            coreGrad.addColorStop(0.8, `rgba(252, 0, 255, ${coreAlpha * 0.15})`);
            coreGrad.addColorStop(1, 'rgba(3, 3, 7, 0)');

            ctx.fillStyle = coreGrad;
            ctx.beginPath();
            ctx.arc(ox, oy, coreRadius, 0, Math.PI * 2);
            ctx.fill();
          }

          ctx.restore();
        }

        // =========================================================================
        // Subtle fragments / particles released outward from planet
        // =========================================================================
        const dt = 0.016;
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          if (waveTime < p.delay) continue;

          const pTime = (waveTime - p.delay) / (totalDuration - 200);
          if (pTime <= 0 || pTime >= 1) continue;

          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vx *= p.drag;
          p.vy *= p.drag;

          p.alpha = Math.max(0, 1 - Math.pow(pTime, 1.4));

          ctx.save();
          ctx.globalAlpha = p.alpha;

          if (p.isStreak) {
            // Elegant motion streak
            const tailX = p.x - p.vx * 0.02;
            const tailY = p.y - p.vy * 0.02;
            ctx.beginPath();
            ctx.moveTo(tailX, tailY);
            ctx.lineTo(p.x, p.y);
            ctx.strokeStyle = p.color;
            ctx.lineWidth = p.size;
            ctx.lineCap = 'round';
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 6;
            ctx.stroke();
          } else {
            // Soft glowing ember
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fillStyle = p.color;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 8;
            ctx.fill();
          }
          ctx.restore();
        }
      }

      // Loop or Finish
      if (progress < 1) {
        rafId = requestAnimationFrame(render);
      } else {
        ctx.clearRect(0, 0, width, height);
        if (!hasCompleted) {
          hasCompleted = true;
          if (!loginRevealTriggered && onStartLoginRevealRef.current) {
            onStartLoginRevealRef.current();
          }
          if (onCompleteRef.current) {
            onCompleteRef.current();
          }
        }
      }
    };

    rafId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(rafId);
      if (ctx) ctx.clearRect(0, 0, width, height);
    };
  }, [active]);

  if (!active) return null;

  return (
    <canvas
      id="planet-transition-canvas"
      ref={canvasRef}
      className="fixed inset-0 z-40 pointer-events-none"
      style={{ width: '100vw', height: '100vh' }}
    />
  );
};

export default PlanetTransition;
