import React from 'react';
import { Pin, X } from 'lucide-react';
import { chatApi } from '../../api/endpoints';

export const PinnedBanner = ({ conversation, onJumpToMessage, onUnpin }) => {
  const pinnedList = conversation?.pinnedMessages || [];
  if (pinnedList.length === 0) return null;

  const latestPinned = pinnedList[pinnedList.length - 1];

  return (
    <div className="px-4 py-2 bg-indigo-950/40 border-b border-indigo-500/20 flex items-center justify-between text-xs text-indigo-200">
      <div
        onClick={() => onJumpToMessage(latestPinned._id || latestPinned)}
        className="flex items-center gap-2 cursor-pointer truncate max-w-[90%]"
      >
        <Pin className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
        <span className="font-semibold text-indigo-300">Pinned:</span>
        <span className="truncate text-slate-300">
          {latestPinned.content || 'Pinned Attachment'}
        </span>
      </div>

      <button
        onClick={() => onUnpin(latestPinned._id || latestPinned)}
        className="p-1 hover:text-white rounded transition-colors"
        title="Unpin"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
