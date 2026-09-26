import React, { memo } from 'react';
import painArtwork from '../../assets/themes/pain-theme.png';
import './PainThemeBackground.css';

/**
 * PainThemeBackground
 * 
 * Anime theme background featuring Deva Path Pain (Shinra Tensei):
 * - High-resolution artwork layer
 * - Atmospheric dark vignette ensuring message readability
 * - Dynamic Rinnegan / Chakra energy pulse
 * - Ambient ember particle drift
 * - Strict non-blocking pointer-events: none layer
 */
export const PainThemeBackground = memo(({ className = '' }) => {
  return (
    <div
      className={`pain-theme-container ${className}`.trim()}
      aria-hidden="true"
    >
      {/* High-res character & kunai artwork */}
      <img
        src={painArtwork}
        alt=""
        loading="eager"
        decoding="async"
        className="pain-theme-artwork"
        onError={(e) => {
          // Fallback to public folder path if asset bundle path fails
          e.currentTarget.src = '/themes/pain-theme.png';
        }}
      />

      {/* Atmospheric dark contrast vignette */}
      <div className="pain-theme-overlay" />

      {/* Rinnegan / Chakra central glow pulse */}
      <div className="pain-theme-chakra-pulse" />

      {/* Ambient floating dust & ember sparks */}
      <div className="pain-theme-particles" />
    </div>
  );
});

PainThemeBackground.displayName = 'PainThemeBackground';
export default PainThemeBackground;
