import React from 'react';

const EMOJI_CATEGORIES = [
  {
    name: 'Smileys',
    emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '😉', '😌', '😍', '🥰', '😘', '😋', '😜', '🤪', '🤩', '🥳', '😎', '🤓', '🧐', '😏', '🤔']
  },
  {
    name: 'Gestures',
    emojis: ['👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '👇', '✋', '🤚', '👋', '👏', '🤝', '🙏', '💪']
  },
  {
    name: 'Hearts & Vibes',
    emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '🔥', '✨', '⚡', '🎉', '🚀', '💯']
  }
];

export const EmojiPicker = ({ onSelectEmoji, onClose }) => {
  return (
    <div className="absolute bottom-16 left-2 sm:left-4 z-30 w-72 sm:w-80 bg-[#121721] border border-white/10 rounded-2xl shadow-2xl p-3 animate-in fade-in zoom-in-95 duration-150">
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10">
        <span className="text-xs font-semibold text-slate-300">Emoji Picker</span>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-slate-500 hover:text-white"
        >
          ✕
        </button>
      </div>

      <div className="max-h-60 overflow-y-auto space-y-3 pr-1">
        {EMOJI_CATEGORIES.map((cat) => (
          <div key={cat.name}>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
              {cat.name}
            </span>
            <div className="grid grid-cols-7 sm:grid-cols-8 gap-1">
              {cat.emojis.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => onSelectEmoji(emoji)}
                  className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-lg transition-transform hover:scale-125 cursor-pointer"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
