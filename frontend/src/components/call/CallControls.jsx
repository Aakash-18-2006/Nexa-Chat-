import React from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneOff, RefreshCw } from 'lucide-react';

export const CallControls = ({
  callType = 'audio',
  isMuted = false,
  isVideoOff = false,
  onToggleMute,
  onToggleVideo,
  onSwitchCamera,
  onEndCall
}) => {
  return (
    <div className="flex items-center justify-center gap-4 sm:gap-6 py-4 px-6 rounded-3xl bg-black/60 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
      {/* Mute/Unmute Mic Button */}
      <button
        onClick={onToggleMute}
        title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
        className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer ${
          isMuted
            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 shadow-[0_0_15px_rgba(244,63,94,0.3)] hover:bg-rose-500/30'
            : 'bg-white/10 text-white border border-white/15 hover:bg-white/20 hover:scale-105'
        }`}
      >
        {isMuted ? <MicOff className="w-5 h-5 sm:w-6 sm:h-6" /> : <Mic className="w-5 h-5 sm:w-6 sm:h-6" />}
      </button>

      {/* Video Call Controls */}
      {callType === 'video' && (
        <>
          {/* Camera On/Off */}
          <button
            onClick={onToggleVideo}
            title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
            className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer ${
              isVideoOff
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 shadow-[0_0_15px_rgba(244,63,94,0.3)] hover:bg-rose-500/30'
                : 'bg-white/10 text-white border border-white/15 hover:bg-white/20 hover:scale-105'
            }`}
          >
            {isVideoOff ? <VideoOff className="w-5 h-5 sm:w-6 sm:h-6" /> : <Video className="w-5 h-5 sm:w-6 sm:h-6" />}
          </button>

          {/* Switch Camera */}
          <button
            onClick={onSwitchCamera}
            title="Switch camera (front/rear)"
            className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-white/10 text-white border border-white/15 hover:bg-white/20 hover:scale-105 flex items-center justify-center transition-all duration-200 cursor-pointer"
          >
            <RefreshCw className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </>
      )}

      {/* End Call Hangup Button */}
      <button
        onClick={onEndCall}
        title="End call"
        className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-[0_0_20px_rgba(239,68,68,0.6)] hover:scale-105 transition-all duration-200 cursor-pointer"
      >
        <PhoneOff className="w-5 h-5 sm:w-6 sm:h-6" />
      </button>
    </div>
  );
};
