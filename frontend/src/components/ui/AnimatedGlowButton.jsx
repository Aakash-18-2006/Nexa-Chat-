import React from 'react';

export const AnimatedGlowButton = ({
  onClick,
  children,
  icon: Icon,
  className = '',
  buttonClassName = '',
  disabled = false,
  type = 'button',
  title,
  ariaLabel
}) => {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel || title}
      className={`nexa-action-btn ${className} ${buttonClassName}`.trim()}
    >
      {Icon && (
        <Icon className="w-3.5 h-3.5 text-[#ff1744] flex-shrink-0" />
      )}
      {children && <span>{children}</span>}
    </button>
  );
};

export const ActionButton = AnimatedGlowButton;

