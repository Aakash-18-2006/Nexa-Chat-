import React from 'react';
import { useCall } from '../../context/CallContext';
import { Avatar } from '../ui/Avatar';
import { Phone, PhoneOff, Video } from 'lucide-react';

export const IncomingCallModal = () => {
  const { incomingCall, acceptCall, rejectCall } = useCall();

  if (!incomingCall) return null;

  const caller = incomingCall.caller || {};
  const isVideo = incomingCall.callType === 'video';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn select-none">
      <div className="relative w-full max-w-sm rounded-3xl bg-[#0c0d14]/95 border border-[#ff1744]/20 p-6 sm:p-8 flex flex-col items-center text-center shadow-[0_0_50px_rgba(255,23,68,0.25)] overflow-hidden">
        {/* Ambient background glow */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-48 h-48 bg-gradient-to-tr from-[#ff1744] via-[#d3121f] to-[#991b1b] rounded-full blur-3xl opacity-20 pointer-events-none" />

        {/* Pulsing Avatar Ring */}
        <div className="relative mb-6">
          <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-[#ff1744] via-[#d3121f] to-[#991b1b] blur-md opacity-75 animate-ping" />
          <div className="relative z-10 p-1 rounded-full bg-gradient-to-tr from-[#ff1744] via-[#d3121f] to-[#991b1b]">
            <Avatar
              src={caller.avatar}
              name={caller.name || caller.username || 'Caller'}
              size="2xl"
              showStatus={false}
            />
          </div>
        </div>

        {/* Caller Info */}
        <h3 className="text-xl sm:text-2xl font-bold text-white mb-1 tracking-tight">
          {caller.name || caller.username || 'Unknown User'}
        </h3>
        {caller.username && (
          <p className="text-sm text-slate-400 mb-3">@{caller.username}</p>
        )}

        {/* Call Type Indicator */}
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-[#ff1744]/20 text-xs font-semibold text-[#ff1744] mb-8">
          {isVideo ? <Video className="w-3.5 h-3.5" /> : <Phone className="w-3.5 h-3.5" />}
          <span>Incoming {isVideo ? 'Video Call' : 'Audio Call'}...</span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-center gap-6 w-full">
          {/* Decline Button */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              onClick={() => rejectCall('declined')}
              className="w-14 h-14 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow-[0_0_20px_rgba(244,63,94,0.4)] hover:scale-110 active:scale-95 transition-all duration-200 cursor-pointer"
              title="Decline call"
            >
              <PhoneOff className="w-6 h-6" />
            </button>
            <span className="text-xs text-slate-400 font-medium">Decline</span>
          </div>

          {/* Accept Button */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              onClick={acceptCall}
              className="w-14 h-14 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white flex items-center justify-center shadow-[0_0_25px_rgba(16,185,129,0.5)] hover:scale-110 active:scale-95 transition-all duration-200 cursor-pointer animate-bounce"
              title="Accept call"
            >
              {isVideo ? <Video className="w-6 h-6" /> : <Phone className="w-6 h-6" />}
            </button>
            <span className="text-xs text-emerald-400 font-medium">Accept</span>
          </div>
        </div>
      </div>
    </div>
  );
};
