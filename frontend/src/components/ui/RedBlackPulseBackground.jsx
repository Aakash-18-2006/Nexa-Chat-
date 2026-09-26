import React, { memo } from 'react';
import './RedBlackPulseBackground.css';

/**
 * RedBlackPulseBackground
 * 
 * An animated dark red and black atmospheric background featuring:
 * - Deep black & dark red radial gradient foundation
 * - Red glowing central core with smooth pulsing animation
 * - Dual swirling red smoke layers with counter-rotating swirl animations
 * - 3 floating black shards with red rim-glow and slow floating motion
 * 
 * Follows strict containment, pointer-events: none, and reduced-motion guidelines.
 */
export const RedBlackPulseBackground = memo(({ className = '' }) => {
  return (
    <div
      className={`red-black-pulse-container ${className}`.trim()}
      aria-hidden="true"
    >
      {/* 1. Red Glowing Core */}
      <div className="red-black-pulse-core" />

      {/* 2. Swirling Red Smoke Layers */}
      <div className="red-black-pulse-smoke red-black-pulse-smoke-1" />
      <div className="red-black-pulse-smoke red-black-pulse-smoke-2" />

      {/* 3. Floating Black Shards (3 variations) */}
      <div className="red-black-pulse-shard red-black-pulse-shard-1" />
      <div className="red-black-pulse-shard red-black-pulse-shard-2" />
      <div className="red-black-pulse-shard red-black-pulse-shard-3" />
    </div>
  );
});

RedBlackPulseBackground.displayName = 'RedBlackPulseBackground';
export default RedBlackPulseBackground;
