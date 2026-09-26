import React, { useEffect, useRef, memo } from 'react';
import './RadiantSunshineBackground.css';

interface Particle {
  x: number;
  y: number;
  radius: number;
  speedY: number;
  phase: number;
  swaySpeed: number;
  swayDist: number;
  baseAlpha: number;
  pulseSpeed: number;
  pulse: number;
}

interface RadiantSunshineBackgroundProps {
  className?: string;
}

export const RadiantSunshineBackground: React.FC<RadiantSunshineBackgroundProps> = memo(({ className = '' }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let ctx: CanvasRenderingContext2D | null = null;
    try {
      ctx = canvas.getContext('2d', { alpha: true });
    } catch (e) {
      ctx = null;
    }

    if (!ctx) return;

    let animationFrameId: number;
    let isVisible = !document.hidden;
    let width = 0;
    let height = 0;
    let lastDrawTime = 0;
    const targetInterval = 1000 / 36; // ~36 FPS lightweight pacing

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Responsive Canvas Resizing
    const resize = () => {
      if (!canvas || !ctx) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();

    const resizeObserver = new ResizeObserver(() => {
      resize();
    });
    resizeObserver.observe(canvas);

    // Generate ~50 Floating Light Particles
    const PARTICLE_COUNT = 50;
    const particles: Particle[] = [];

    const createParticle = (spawnY?: number): Particle => ({
      x: Math.random() * (width || window.innerWidth || 800),
      y: spawnY !== undefined ? spawnY : Math.random() * (height || window.innerHeight || 600),
      radius: 1.5 + Math.random() * 2.8,
      speedY: -0.35 - Math.random() * 0.55,
      phase: Math.random() * Math.PI * 2,
      swaySpeed: 0.008 + Math.random() * 0.015,
      swayDist: 12 + Math.random() * 20,
      baseAlpha: 0.25 + Math.random() * 0.5,
      pulseSpeed: 0.012 + Math.random() * 0.02,
      pulse: Math.random() * Math.PI * 2,
    });

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push(createParticle());
    }

    const onVisibilityChange = () => {
      isVisible = !document.hidden;
      if (isVisible) {
        lastDrawTime = performance.now();
        loop(performance.now());
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    // Particle Animation Loop
    const loop = (now: number) => {
      if (!isVisible || !ctx) return;

      animationFrameId = requestAnimationFrame(loop);

      const elapsed = now - lastDrawTime;
      if (elapsed < targetInterval) return;
      lastDrawTime = now - (elapsed % targetInterval);

      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        if (!prefersReducedMotion) {
          p.y += p.speedY;
          p.phase += p.swaySpeed;
          p.pulse += p.pulseSpeed;

          // Recycle particles drifting off the top
          if (p.y < -20) {
            particles[i] = createParticle(height + 15);
            continue;
          }
        }

        const currentX = p.x + Math.sin(p.phase) * p.swayDist;
        const currentAlpha = Math.max(
          0.05,
          Math.min(1, p.baseAlpha * (0.7 + 0.3 * Math.sin(p.pulse)))
        );

        // Draw soft glowing particle
        const grad = ctx.createRadialGradient(
          currentX,
          p.y,
          0,
          currentX,
          p.y,
          p.radius * 2.5
        );
        grad.addColorStop(0, `rgba(255, 255, 255, ${currentAlpha})`);
        grad.addColorStop(0.35, `rgba(254, 240, 138, ${currentAlpha * 0.75})`);
        grad.addColorStop(0.7, `rgba(253, 224, 71, ${currentAlpha * 0.3})`);
        grad.addColorStop(1, 'rgba(255, 255, 255, 0)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(currentX, p.y, p.radius * 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    animationFrameId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animationFrameId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div className={`radiant-sunshine-container ${className}`.trim()} aria-hidden="true">
      {/* Sky atmospheric depth overlay */}
      <div className="radiant-sky-overlay" />

      {/* Sun System (Upper-Right Anchor) */}
      <div className="radiant-sun-anchor">
        {/* Outer Atmospheric Bloom */}
        <div className="radiant-sun-bloom-outer" />

        {/* Inner Warm Bloom */}
        <div className="radiant-sun-bloom-inner" />

        {/* Primary Rotating Sun Rays (SVG) */}
        <svg
          className="radiant-sun-rays"
          viewBox="0 0 1000 1000"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <radialGradient id="sunRayGrad1" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.75" />
              <stop offset="25%" stopColor="#fef08a" stopOpacity="0.45" />
              <stop offset="60%" stopColor="#fde047" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#93c5fd" stopOpacity="0" />
            </radialGradient>
          </defs>
          {/* 16 Radiating Rays */}
          {Array.from({ length: 16 }).map((_, idx) => {
            const angle = (idx * 360) / 16;
            return (
              <path
                key={idx}
                d="M500 500 L475 20 L525 20 Z"
                fill="url(#sunRayGrad1)"
                transform={`rotate(${angle} 500 500)`}
              />
            );
          })}
        </svg>

        {/* Secondary Counter-Rotating Ethereal Rays (SVG) */}
        <svg
          className="radiant-sun-rays-secondary"
          viewBox="0 0 1000 1000"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <radialGradient id="sunRayGrad2" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.6" />
              <stop offset="35%" stopColor="#fffbeb" stopOpacity="0.3" />
              <stop offset="75%" stopColor="#bfdbfe" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
            </radialGradient>
          </defs>
          {/* 12 Secondary Rays */}
          {Array.from({ length: 12 }).map((_, idx) => {
            const angle = (idx * 360) / 12 + 15;
            return (
              <path
                key={idx}
                d="M500 500 L482 60 L518 60 Z"
                fill="url(#sunRayGrad2)"
                transform={`rotate(${angle} 500 500)`}
              />
            );
          })}
        </svg>

        {/* Brilliant Glowing Sun Core */}
        <div className="radiant-sun-core" />
      </div>

      {/* Moving Blurred Clouds (Drifting smoothly across screen) */}
      <div className="radiant-cloud radiant-cloud-1" />
      <div className="radiant-cloud radiant-cloud-2" />
      <div className="radiant-cloud radiant-cloud-3" />

      {/* Soft Glowing Atmospheric Orbs / Lens Flares */}
      <div className="radiant-orb radiant-orb-1" />
      <div className="radiant-orb radiant-orb-2" />
      <div className="radiant-orb radiant-orb-3" />

      {/* 2D Canvas Floating Light Particles */}
      <canvas ref={canvasRef} className="radiant-particles-canvas" />
    </div>
  );
});

RadiantSunshineBackground.displayName = 'RadiantSunshineBackground';
export default RadiantSunshineBackground;
