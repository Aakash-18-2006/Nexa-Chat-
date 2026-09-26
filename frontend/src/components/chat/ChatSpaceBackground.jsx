import React, { memo } from 'react';
import './ChatSpaceBackground.css';

/**
 * ChatSpaceBackground
 * Renders an animated space starfield background with smooth parallax layers
 * specifically for the chat message viewport area.
 */
export const ChatSpaceBackground = memo(({ className = '' }) => {
  return (
    <div className={`chat-space-bg ${className}`.trim()} aria-hidden="true">
      <div className="chat-stars-1" />
      <div className="chat-stars-2" />
      <div className="chat-stars-3" />
    </div>
  );
});

ChatSpaceBackground.displayName = 'ChatSpaceBackground';
