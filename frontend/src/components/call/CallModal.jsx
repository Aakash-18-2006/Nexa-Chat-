import React, { useEffect, useRef } from 'react';
import { useCall } from '../../context/CallContext';
import { Avatar } from '../ui/Avatar';
import { CallControls } from './CallControls';
import { formatDuration } from '../../utils/formatters';
import { Phone, PhoneOff, Video, User } from 'lucide-react';

export const CallModal = () => {
  const {
    callState,
    activeCall,
    localStream,
    remoteStream,
    isMuted,
    isVideoOff,
    cameraFacingMode,
    callDuration,
    statusMessage,
    cancelCall,
    endCall,
    toggleMute,
    toggleVideo,
    switchCamera
  } = useCall();

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);

  // Bind local stream to local video element
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, callState]);

  // Bind remote stream to remote video/audio elements
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
    if (remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, callState]);

  // If idle or incoming (handled by IncomingCallModal), do not render
  if (callState === 'idle' || callState === 'incoming') {
    return null;
  }

  const callType = activeCall?.callType || 'audio';
  const isCaller = activeCall?.isCaller;
  const targetUser = isCaller ? activeCall?.receiver : activeCall?.caller;
  const isVideo = callType === 'video';

  const isConnectingOrRinging = ['calling', 'ringing', 'connecting'].includes(callState);
  const isEndedOrFailed = ['ended', 'declined', 'missed', 'failed', 'unavailable', 'busy'].includes(callState);

  // Status subtitle display
  const getStatusText = () => {
    if (statusMessage) return statusMessage;
    if (callState === 'calling') return 'Calling...';
    if (callState === 'ringing') return 'Ringing...';
    if (callState === 'connecting') return 'Connecting...';
    if (callState === 'connected') return formatDuration(callDuration);
    if (callState === 'ended') return 'Call Ended';
    if (callState === 'declined') return 'Call Declined';
    if (callState === 'busy') return 'User Busy';
    if (callState === 'unavailable') return 'User Unavailable';
    return '';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-xl animate-fadeIn select-none">
      {/* Hidden audio element for WebRTC audio playback */}
      <audio ref={remoteAudioRef} autoPlay playsInline />

      {/* Main Container */}
      <div className="relative w-full h-full max-w-4xl md:max-h-[85vh] md:rounded-3xl bg-[#090a10] border border-white/10 flex flex-col justify-between overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.8)]">
        
        {/* ===================== VIDEO CALL MODE ===================== */}
        {isVideo ? (
          <div className="relative w-full h-full flex flex-col justify-between overflow-hidden">
            {/* Remote Video Stream / Fallback */}
            <div className="absolute inset-0 bg-slate-950 flex items-center justify-center">
              {remoteStream && remoteStream.getVideoTracks().length > 0 ? (
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-center p-6">
                  <div className="p-1 rounded-full bg-gradient-to-tr from-[#ff1744] via-[#d3121f] to-[#991b1b] mb-4 shadow-[0_0_30px_rgba(255,23,68,0.3)]">
                    <Avatar
                      src={targetUser?.avatar}
                      name={targetUser?.name || 'User'}
                      size="2xl"
                      showStatus={false}
                    />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-1">
                    {targetUser?.name || 'User'}
                  </h3>
                  <p className="text-sm font-semibold text-[#ff1744] animate-pulse">
                    {getStatusText()}
                  </p>
                </div>
              )}
            </div>

            {/* Top Bar with user info & duration */}
            <div className="relative z-10 p-4 sm:p-6 flex items-center justify-between bg-gradient-to-b from-black/80 via-black/40 to-transparent">
              <div className="flex items-center gap-3">
                <Avatar
                  src={targetUser?.avatar}
                  name={targetUser?.name || 'User'}
                  size="sm"
                  showStatus={false}
                />
                <div>
                  <h4 className="text-sm sm:text-base font-bold text-white leading-tight">
                    {targetUser?.name || 'User'}
                  </h4>
                  <p className="text-xs font-semibold text-[#ff1744]">
                    {getStatusText()}
                  </p>
                </div>
              </div>

              {callState === 'connected' && (
                <div className="px-3 py-1 rounded-full bg-black/50 border border-white/10 text-xs font-mono font-bold text-emerald-400 shadow-sm">
                  {formatDuration(callDuration)}
                </div>
              )}
            </div>

            {/* Local Video Stream Picture-in-Picture (PiP) */}
            {localStream && !isVideoOff && (
              <div className="absolute top-20 right-4 sm:right-6 w-28 sm:w-40 aspect-[3/4] rounded-2xl overflow-hidden border-2 border-white/20 shadow-[0_0_25px_rgba(0,0,0,0.6)] z-20 bg-slate-900">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover -scale-x-100"
                />
              </div>
            )}

            {/* Bottom Controls Bar */}
            <div className="relative z-10 p-4 sm:p-6 flex flex-col items-center justify-center bg-gradient-to-t from-black/90 via-black/50 to-transparent">
              {isConnectingOrRinging ? (
                <button
                  onClick={cancelCall}
                  className="px-6 py-3 rounded-full bg-rose-600 hover:bg-rose-500 text-white font-semibold flex items-center gap-2 shadow-[0_0_20px_rgba(244,63,94,0.5)] transition-all cursor-pointer"
                >
                  <PhoneOff className="w-5 h-5" /> Cancel Call
                </button>
              ) : (
                <CallControls
                  callType="video"
                  isMuted={isMuted}
                  isVideoOff={isVideoOff}
                  onToggleMute={toggleMute}
                  onToggleVideo={toggleVideo}
                  onSwitchCamera={switchCamera}
                  onEndCall={endCall}
                />
              )}
            </div>
          </div>
        ) : (
          /* ===================== AUDIO CALL MODE ===================== */
          <div className="relative w-full h-full flex flex-col justify-between items-center p-6 sm:p-12 overflow-hidden">
            {/* Ambient Background Glow */}
            <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-gradient-to-tr from-[#ff1744]/20 via-[#d3121f]/20 to-[#991b1b]/20 rounded-full blur-3xl pointer-events-none" />

            {/* Top Info */}
            <div className="relative z-10 flex flex-col items-center">
              <span className="text-xs font-semibold tracking-wider text-slate-400 uppercase mb-1">
                Nexa Encrypted Audio Call
              </span>
            </div>

            {/* Central Pulsing Avatar & Status */}
            <div className="relative z-10 flex flex-col items-center text-center my-auto">
              <div className="relative mb-6">
                {callState === 'connected' && (
                  <div className="absolute -inset-3 rounded-full bg-gradient-to-tr from-[#ff1744] via-[#d3121f] to-[#991b1b] blur-lg opacity-40 animate-pulse" />
                )}
                {isConnectingOrRinging && (
                  <div className="absolute -inset-4 rounded-full bg-[#ff1744] blur-lg opacity-30 animate-ping" />
                )}
                <div className="relative z-10 p-1.5 rounded-full bg-gradient-to-tr from-[#ff1744] via-[#d3121f] to-[#991b1b] shadow-[0_0_40px_rgba(255,23,68,0.3)]">
                  <Avatar
                    src={targetUser?.avatar}
                    name={targetUser?.name || 'User'}
                    size="2xl"
                    showStatus={false}
                  />
                </div>
              </div>

              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-1">
                {targetUser?.name || 'User'}
              </h2>
              {targetUser?.username && (
                <p className="text-sm text-slate-400 mb-3">@{targetUser.username}</p>
              )}

              <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm font-semibold text-[#ff1744]">
                <span className={`w-2 h-2 rounded-full ${callState === 'connected' ? 'bg-emerald-400 animate-pulse' : 'bg-[#ff1744]'}`} />
                <span>{getStatusText()}</span>
              </div>
            </div>

            {/* Bottom Controls */}
            <div className="relative z-10 w-full flex justify-center pb-2">
              {isConnectingOrRinging ? (
                <button
                  onClick={cancelCall}
                  className="px-8 py-3.5 rounded-full bg-rose-600 hover:bg-rose-500 text-white font-semibold flex items-center gap-2.5 shadow-[0_0_25px_rgba(244,63,94,0.5)] hover:scale-105 transition-all cursor-pointer"
                >
                  <PhoneOff className="w-5 h-5" /> Cancel Call
                </button>
              ) : (
                <CallControls
                  callType="audio"
                  isMuted={isMuted}
                  onToggleMute={toggleMute}
                  onEndCall={endCall}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
