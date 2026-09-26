import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';
import { webrtcService } from '../services/webrtcService';
import { sound } from '../utils/sound';

const CallContext = createContext();

export const CallProvider = ({ children }) => {
  const { socket, onlineUsers } = useSocket();
  const { user } = useAuth();

  // Call states: 'idle' | 'calling' | 'ringing' | 'incoming' | 'connecting' | 'connected' | 'ended' | 'declined' | 'missed' | 'failed' | 'unavailable' | 'busy'
  const [callState, setCallState] = useState('idle');
  const [activeCall, setActiveCall] = useState(null); // { callId, conversationId, callType: 'audio'|'video', caller, receiver, isCaller }
  const [incomingCall, setIncomingCall] = useState(null); // { callId, conversationId, callType, caller, offer }

  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);

  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [cameraFacingMode, setCameraFacingMode] = useState('user');
  const [callDuration, setCallDuration] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');

  const durationTimerRef = useRef(null);
  const activeCallRef = useRef(null);
  const callStateRef = useRef('idle');

  // Keep refs in sync for event callbacks
  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);

  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  // Duration timer when connected
  useEffect(() => {
    if (callState === 'connected') {
      setCallDuration(0);
      durationTimerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
        durationTimerRef.current = null;
      }
    }

    return () => {
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
        durationTimerRef.current = null;
      }
    };
  }, [callState]);

  // Cleanup all media and state
  const cleanupCall = useCallback((nextState = 'idle', delayReset = 0) => {
    sound.stopRingtone();
    sound.stopOutgoingRing();
    webrtcService.cleanup();
    setLocalStream(null);
    setRemoteStream(null);
    setIsMuted(false);
    setIsVideoOff(false);

    if (delayReset > 0) {
      setCallState(nextState);
      setTimeout(() => {
        setCallState('idle');
        setActiveCall(null);
        setIncomingCall(null);
        setStatusMessage('');
        setCallDuration(0);
      }, delayReset);
    } else {
      setCallState(nextState);
      if (nextState === 'idle') {
        setActiveCall(null);
        setIncomingCall(null);
        setStatusMessage('');
        setCallDuration(0);
      }
    }
  }, []);

  // Initiate an Outgoing Call
  const startCall = async ({ conversationId, receiver, callType = 'audio' }) => {
    if (!socket || !user || !receiver) return;

    if (callState !== 'idle') {
      console.warn('Call already in progress or ringing');
      return;
    }

    const receiverId = (receiver._id || receiver).toString();

    // Verify recipient availability
    const isOnline = onlineUsers.has(receiverId);
    if (!isOnline) {
      setCallState('unavailable');
      setStatusMessage(`${receiver.name || 'User'} is currently offline`);
      setTimeout(() => {
        setCallState('idle');
        setStatusMessage('');
      }, 3000);
      return;
    }

    try {
      setCallState('calling');
      setStatusMessage('Starting call...');

      // 1. Get user media (microphone & camera if video)
      const stream = await webrtcService.getMediaStream({
        audio: true,
        video: callType === 'video',
        facingMode: 'user'
      });
      setLocalStream(stream);

      // 2. Initialize Peer Connection
      webrtcService.createPeerConnection({
        onRemoteStream: (rStream) => {
          setRemoteStream(rStream);
        },
        onIceCandidate: (candidate) => {
          if (activeCallRef.current?.callId) {
            socket.emit('call:signal', {
              callId: activeCallRef.current.callId,
              targetUserId: receiverId,
              signal: { type: 'candidate', candidate }
            });
          }
        },
        onConnectionStateChange: (state) => {
          if (state === 'connected') {
            setCallState('connected');
            setStatusMessage('');
            sound.stopOutgoingRing();
          } else if (state === 'failed' || state === 'disconnected') {
            setStatusMessage('Connection lost');
          }
        }
      });

      // 3. Create WebRTC offer
      const offer = await webrtcService.createOffer();

      // 4. Start outgoing ring audio
      sound.startOutgoingRing();
      setStatusMessage('Calling...');

      // 5. Emit initiate to backend socket
      socket.emit(
        'call:initiate',
        {
          conversationId,
          receiverId,
          callType,
          offer
        },
        (response) => {
          if (response?.error) {
            sound.stopOutgoingRing();
            setCallState('failed');
            setStatusMessage(response.error);
            cleanupCall('failed', 2500);
            return;
          }

          if (response?.callId) {
            setActiveCall({
              callId: response.callId,
              conversationId,
              callType,
              caller: user,
              receiver,
              isCaller: true
            });
          }
        }
      );
    } catch (err) {
      console.error('Call initiation failed:', err);
      sound.stopOutgoingRing();
      setCallState('failed');
      setStatusMessage(
        err.name === 'NotAllowedError'
          ? 'Microphone / camera permission denied'
          : 'Could not access media devices'
      );
      cleanupCall('failed', 3000);
    }
  };

  // Accept an Incoming Call
  const acceptCall = async () => {
    if (!incomingCall || !socket || !user) return;

    sound.stopRingtone();
    setCallState('connecting');
    setStatusMessage('Connecting...');

    try {
      const callType = incomingCall.callType || 'audio';
      const stream = await webrtcService.getMediaStream({
        audio: true,
        video: callType === 'video',
        facingMode: 'user'
      });
      setLocalStream(stream);

      // Create peer connection
      webrtcService.createPeerConnection({
        onRemoteStream: (rStream) => {
          setRemoteStream(rStream);
        },
        onIceCandidate: (candidate) => {
          socket.emit('call:signal', {
            callId: incomingCall.callId,
            targetUserId: incomingCall.caller._id || incomingCall.caller,
            signal: { type: 'candidate', candidate }
          });
        },
        onConnectionStateChange: (state) => {
          if (state === 'connected') {
            setCallState('connected');
            setStatusMessage('');
          }
        }
      });

      // Create WebRTC answer
      const answer = await webrtcService.createAnswer(incomingCall.offer);

      setActiveCall({
        callId: incomingCall.callId,
        conversationId: incomingCall.conversationId,
        callType: incomingCall.callType,
        caller: incomingCall.caller,
        receiver: user,
        isCaller: false
      });

      setIncomingCall(null);

      // Emit accept to backend
      socket.emit('call:accept', {
        callId: incomingCall.callId,
        answer
      });

      sound.playCallConnected();
      setCallState('connected');
      setStatusMessage('');
    } catch (err) {
      console.error('Failed to accept call:', err);
      sound.stopRingtone();
      setCallState('failed');
      setStatusMessage(
        err.name === 'NotAllowedError'
          ? 'Microphone / camera permission denied'
          : 'Could not start media stream'
      );
      socket.emit('call:reject', {
        callId: incomingCall.callId,
        reason: 'failed'
      });
      cleanupCall('failed', 2500);
    }
  };

  // Reject Incoming Call
  const rejectCall = (reason = 'declined') => {
    if (!incomingCall || !socket) return;
    sound.stopRingtone();
    socket.emit('call:reject', {
      callId: incomingCall.callId,
      reason
    });
    setIncomingCall(null);
    setCallState('idle');
  };

  // Cancel Outgoing Call (Caller cancels before answer)
  const cancelCall = () => {
    if (!activeCall || !socket) return;
    sound.stopOutgoingRing();
    socket.emit('call:cancel', {
      callId: activeCall.callId
    });
    cleanupCall('idle');
  };

  // End Call (Active or Connected)
  const endCall = () => {
    if (!activeCall || !socket) {
      cleanupCall('idle');
      return;
    }
    sound.stopOutgoingRing();
    sound.stopRingtone();
    sound.playCallEnded();

    socket.emit('call:end', {
      callId: activeCall.callId
    });

    cleanupCall('ended', 1500);
  };

  // Toggle Mute Audio
  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    webrtcService.setAudioEnabled(!nextMuted);
  };

  // Toggle Video Camera
  const toggleVideo = () => {
    const nextVideoOff = !isVideoOff;
    setIsVideoOff(nextVideoOff);
    webrtcService.setVideoEnabled(!nextVideoOff);
  };

  // Switch between front/back cameras
  const switchCamera = async () => {
    const newMode = await webrtcService.switchCamera(cameraFacingMode);
    setCameraFacingMode(newMode);
  };

  // Socket Event Listeners for Call Lifecycle
  useEffect(() => {
    if (!socket) return;

    // 1. Incoming Call Invitation
    const handleIncomingCall = (data) => {
      if (callStateRef.current !== 'idle') {
        // User is busy on another call
        socket.emit('call:reject', {
          callId: data.callId,
          reason: 'busy'
        });
        return;
      }

      setIncomingCall(data);
      setCallState('incoming');
      sound.startRingtone();
    };

    // 2. Caller receives Ringing confirmation
    const handleCallRinging = ({ callId }) => {
      if (activeCallRef.current?.callId === callId) {
        setCallState('ringing');
        setStatusMessage('Ringing...');
      }
    };

    // 3. Caller receives Acceptance & Answer from Recipient
    const handleCallAccepted = async ({ callId, answer }) => {
      sound.stopOutgoingRing();
      setCallState('connecting');
      setStatusMessage('Connecting...');

      try {
        await webrtcService.handleAnswer(answer);
        sound.playCallConnected();
        setCallState('connected');
        setStatusMessage('');
      } catch (err) {
        console.error('Error handling answer:', err);
        setCallState('failed');
        setStatusMessage('Signaling error');
        cleanupCall('failed', 2000);
      }
    };

    // 4. Call Rejected / Declined
    const handleCallRejected = ({ callId, reason }) => {
      sound.stopOutgoingRing();
      sound.stopRingtone();

      let msg = 'Call declined';
      let nextState = 'declined';
      if (reason === 'busy') {
        msg = 'User is currently on another call';
        nextState = 'busy';
      } else if (reason === 'timeout') {
        msg = 'No answer';
        nextState = 'missed';
      } else if (reason === 'unavailable') {
        msg = 'User is unavailable';
        nextState = 'unavailable';
      }

      setStatusMessage(msg);
      cleanupCall(nextState, 2500);
    };

    // 5. Caller Cancelled before answer
    const handleCallCancelled = ({ callId }) => {
      sound.stopRingtone();
      if (incomingCall?.callId === callId || activeCallRef.current?.callId === callId) {
        setStatusMessage('Call cancelled');
        cleanupCall('missed', 1500);
      }
    };

    // 6. WebRTC Signaling Data (ICE candidates / renegotiation)
    const handleCallSignal = async ({ callId, signal }) => {
      if (signal?.type === 'candidate') {
        await webrtcService.handleCandidate(signal.candidate);
      } else if (signal?.type === 'offer') {
        // renegotiation if needed
      } else if (signal?.type === 'answer') {
        await webrtcService.handleAnswer(signal.answer);
      }
    };

    // 7. Call Ended by remote peer
    const handleCallEnded = ({ callId }) => {
      sound.stopOutgoingRing();
      sound.stopRingtone();
      sound.playCallEnded();
      setStatusMessage('Call ended');
      cleanupCall('ended', 1500);
    };

    // 8. User is Busy
    const handleCallBusy = ({ message }) => {
      sound.stopOutgoingRing();
      setStatusMessage(message || 'User is currently in another call');
      cleanupCall('busy', 2500);
    };

    // 9. User is Offline / Unavailable
    const handleCallUnavailable = ({ message }) => {
      sound.stopOutgoingRing();
      setStatusMessage(message || 'User is currently offline');
      cleanupCall('unavailable', 2500);
    };

    // 10. Call timed out (45s no answer)
    const handleCallTimeout = ({ callId }) => {
      sound.stopOutgoingRing();
      sound.stopRingtone();
      setStatusMessage('No answer');
      cleanupCall('missed', 2000);
    };

    socket.on('call:incoming', handleIncomingCall);
    socket.on('call:ringing', handleCallRinging);
    socket.on('call:accepted', handleCallAccepted);
    socket.on('call:rejected', handleCallRejected);
    socket.on('call:cancelled', handleCallCancelled);
    socket.on('call:signal', handleCallSignal);
    socket.on('call:ended', handleCallEnded);
    socket.on('call:busy', handleCallBusy);
    socket.on('call:unavailable', handleCallUnavailable);
    socket.on('call:timeout', handleCallTimeout);

    return () => {
      socket.off('call:incoming', handleIncomingCall);
      socket.off('call:ringing', handleCallRinging);
      socket.off('call:accepted', handleCallAccepted);
      socket.off('call:rejected', handleCallRejected);
      socket.off('call:cancelled', handleCallCancelled);
      socket.off('call:signal', handleCallSignal);
      socket.off('call:ended', handleCallEnded);
      socket.off('call:busy', handleCallBusy);
      socket.off('call:unavailable', handleCallUnavailable);
      socket.off('call:timeout', handleCallTimeout);
    };
  }, [socket, incomingCall, cleanupCall]);

  return (
    <CallContext.Provider
      value={{
        callState,
        activeCall,
        incomingCall,
        localStream,
        remoteStream,
        isMuted,
        isVideoOff,
        cameraFacingMode,
        callDuration,
        statusMessage,
        startCall,
        acceptCall,
        rejectCall,
        cancelCall,
        endCall,
        toggleMute,
        toggleVideo,
        switchCamera
      }}
    >
      {children}
    </CallContext.Provider>
  );
};

export const useCall = () => useContext(CallContext);
