import React from 'react';
import { useTheme } from '../../context/ThemeContext';

export const AnimatedGlowCircleButton = ({
  onClick,
  children,
  icon: Icon,
  className = '',
  buttonClassName = '',
  title,
  ariaLabel,
  id,
  isOpen = false
}) => {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  return (
    <div className={`nexa-glow-circle-poda ${className}`}>
      {/* Outer Rotating Glowing Backdrops */}
      <div className="nexa-glow-circle-glow" aria-hidden="true" />
      <div className="nexa-glow-circle-darkBorderBg" aria-hidden="true" />
      <div className="nexa-glow-circle-white" aria-hidden="true" />
      <div className="nexa-glow-circle-border" aria-hidden="true" />

      {/* Real Circular Button */}
      <button
        type="button"
        id={id}
        onClick={onClick}
        title={title || undefined}
        aria-label={ariaLabel || undefined}
        aria-expanded={isOpen}
        className={`nexa-glow-circle-inner group ${
          isLight ? 'bg-white text-slate-900 border-black/10' : 'bg-black text-white border-white/10'
        } ${buttonClassName}`}
      >
        {Icon ? (
          <div
            className={`w-7 h-7 rounded-full bg-gradient-to-tr from-[#991b1b] via-[#d3121f] to-[#ff1744] text-white flex items-center justify-center shadow-[0_0_12px_rgba(255,23,68,0.4)] group-hover:scale-110 transition-transform duration-300 ${
              isOpen ? 'rotate-45 scale-105 shadow-[0_0_16px_rgba(255,23,68,0.6)]' : 'group-hover:rotate-12'
            }`}
          >
            <Icon className="w-4 h-4 text-white" />
          </div>
        ) : (
          children
        )}
      </button>
    </div>
  );
};
