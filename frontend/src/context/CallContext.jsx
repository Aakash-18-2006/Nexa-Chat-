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
  const [incomingCall, setIncomingCall] = useState(null); // { callId, conversationId, callType, caller }

  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);

  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [cameraFacingMode, setCameraFacingMode] = useState('user');
  const [callDuration, setCallDuration] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');

  const durationTimerRef = useRef(null);
  const activeCallRef = useRef(null);
  const incomingCallRef = useRef(null);
  const callStateRef = useRef('idle');

  // Keep refs in sync for event callbacks
  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);

  useEffect(() => {
    incomingCallRef.current = incomingCall;
  }, [incomingCall]);

  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  // Duration timer when WebRTC reaches 'connected'
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

  // Comprehensive cleanup of media, peer connections, and audio tones
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

  // Initiate an Outgoing Voice or Video Call
  const startCall = async ({ conversationId, receiver, callType = 'audio' }) => {
    if (!socket || !user || !receiver) return;

    if (callState !== 'idle') {
      console.warn('[NEXA Call] Call already in progress or ringing');
      return;
    }

    const receiverId = (receiver._id || receiver.id || receiver).toString();
    console.log('[NEXA CALL DEBUG] startCall initiated for target:', receiverId, 'callType:', callType);

    // Verify recipient online status
    const isOnline = onlineUsers.has(receiverId);
    if (!isOnline) {
      console.log('[NEXA CALL DEBUG] Target user is not in local onlineUsers set:', receiverId);
      setCallState('unavailable');
      setStatusMessage(`${receiver.name || 'User'} is currently offline`);
      cleanupCall('unavailable', 2500);
      return;
    }

    try {
      setCallState('calling');
      setStatusMessage('Requesting permissions...');

      // 1. Acquire local microphone / camera permissions
      const stream = await webrtcService.getMediaStream({
        audio: true,
        video: callType === 'video',
        facingMode: 'user'
      });
      setLocalStream(stream);

      // 2. Play outgoing ringback tone
      sound.startOutgoingRing();
      setStatusMessage('Calling...');

      // 3. Emit initiate to backend socket
      socket.emit(
        'call:initiate',
        {
          targetUserId: receiverId,
          receiverId,
          conversationId,
          callType
        },
        (response) => {
          if (!response?.success) {
            sound.stopOutgoingRing();
            setCallState('failed');
            setStatusMessage(response?.message || 'Call failed');
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
      console.error('[NEXA Call] Media device error on initiate:', err);
      sound.stopOutgoingRing();
      setCallState('failed');

      const isPermissionDenied =
        err.name === 'NotAllowedError' ||
        err.name === 'PermissionDeniedError' ||
        err.message?.includes('Permission denied');

      if (isPermissionDenied) {
        setStatusMessage(
          callType === 'video'
            ? 'Camera & microphone permission is required for video calls.'
            : 'Microphone permission is required for voice calls.'
        );
      } else {
        setStatusMessage('Could not access microphone or camera.');
      }

      cleanupCall('failed', 3500);
    }
  };

  // Accept an Incoming Voice or Video Call
  const acceptCall = async () => {
    if (!incomingCall || !socket || !user) return;

    sound.stopRingtone();
    setCallState('connecting');
    setStatusMessage('Connecting...');

    const callId = incomingCall.callId;
    const conversationId = incomingCall.conversationId;
    const callType = incomingCall.callType || 'audio';
    const caller = incomingCall.caller;
    const callerId = (caller._id || caller).toString();

    try {
      // 1. Acquire local microphone / camera
      const stream = await webrtcService.getMediaStream({
        audio: true,
        video: callType === 'video',
        facingMode: 'user'
      });
      setLocalStream(stream);

      // 2. Create RTCPeerConnection on receiver side
      webrtcService.createPeerConnection({
        onRemoteStream: (rStream) => {
          console.log('[NEXA Call] Remote stream received in CallContext');
          setRemoteStream(rStream);
        },
        onIceCandidate: (candidate) => {
          socket.emit('call:signal', {
            callId,
            targetUserId: callerId,
            to: callerId,
            signal: { type: 'candidate', candidate }
          });
        },
        onConnectionStateChange: (state) => {
          if (state === 'connected') {
            sound.playCallConnected();
            setCallState('connected');
            setStatusMessage('');
          } else if (state === 'failed' || state === 'disconnected') {
            console.warn('[NEXA Call] Receiver connection state change:', state);
          }
        }
      });

      setActiveCall({
        callId,
        conversationId,
        callType,
        caller,
        receiver: user,
        isCaller: false
      });

      setIncomingCall(null);

      // 3. Emit accept confirmation to backend socket
      socket.emit('call:accept', { callId }, (res) => {
        if (!res?.success) {
          console.error('[NEXA Call] call:accept ack error:', res?.message);
        }
      });
    } catch (err) {
      console.error('[NEXA Call] Error accepting call:', err);
      sound.stopRingtone();
      setCallState('failed');

      const isPermissionDenied =
        err.name === 'NotAllowedError' ||
        err.name === 'PermissionDeniedError' ||
        err.message?.includes('Permission denied');

      if (isPermissionDenied) {
        setStatusMessage(
          callType === 'video'
            ? 'Camera & microphone permission is required for video calls.'
            : 'Microphone permission is required for voice calls.'
        );
      } else {
        setStatusMessage('Could not start microphone or camera.');
      }

      socket.emit('call:reject', {
        callId,
        reason: 'failed'
      });

      cleanupCall('failed', 3500);
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

  // End Active or Connected Call
  const endCall = () => {
    if (!activeCall || !socket) {
      cleanupCall('idle');
      return;
    }
    sound.stopOutgoingRing();
    sound.stopRingtone();
    sound.playCallEnded();

    socket.emit('call:end', {
      callId: activeCall.callId,
      duration: callDuration
    });

    cleanupCall('ended', 1500);
  };

  // Toggle Microphone Audio Track
  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    webrtcService.setAudioEnabled(!nextMuted);
  };

  // Toggle Camera Video Track
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
      console.log('[NEXA CALL DEBUG] call:incoming received:', data);
      if (callStateRef.current !== 'idle') {
        // User is currently busy on another active call
        console.log('[NEXA CALL DEBUG] User busy, rejecting incoming call:', data.callId);
        socket.emit('call:reject', {
          callId: data.callId,
          reason: 'busy'
        });
        return;
      }

      setIncomingCall(data);
      setCallState('incoming');
      sound.startRingtone();

      // Emit ringing acknowledgment back to caller
      socket.emit('call:ringing', { callId: data.callId });
    };

    // 2. Caller receives Ringing confirmation
    const handleCallRinging = ({ callId }) => {
      if (activeCallRef.current?.callId === callId) {
        setCallState('ringing');
        setStatusMessage('Ringing...');
      }
    };

    // 3. Caller receives Acceptance: Initiate WebRTC Offer creation
    const handleCallAccepted = async ({ callId, connectedAt }) => {
      console.log('[NEXA Call] Received call:accepted for callId:', callId);
      sound.stopOutgoingRing();
      setCallState('connecting');
      setStatusMessage('Connecting...');

      const currentActive = activeCallRef.current;
      if (!currentActive || currentActive.callId !== callId) return;

      const receiverId = (currentActive.receiver._id || currentActive.receiver).toString();

      try {
        // Create Caller's RTCPeerConnection
        webrtcService.createPeerConnection({
          onRemoteStream: (rStream) => {
            console.log('[NEXA Call] Remote stream received by Caller');
            setRemoteStream(rStream);
          },
          onIceCandidate: (candidate) => {
            socket.emit('call:signal', {
              callId,
              targetUserId: receiverId,
              to: receiverId,
              signal: { type: 'candidate', candidate }
            });
          },
          onConnectionStateChange: (state) => {
            if (state === 'connected') {
              sound.playCallConnected();
              setCallState('connected');
              setStatusMessage('');
            } else if (state === 'failed' || state === 'disconnected') {
              console.warn('[NEXA Call] Caller connection state change:', state);
            }
          }
        });

        // Create WebRTC Offer and transmit to Receiver
        const offer = await webrtcService.createOffer();
        socket.emit('call:signal', {
          callId,
          targetUserId: receiverId,
          to: receiverId,
          signal: { type: 'offer', offer }
        });
      } catch (err) {
        console.error('[NEXA Call] Error creating WebRTC offer on call acceptance:', err);
        setCallState('failed');
        setStatusMessage('Signaling error');
        cleanupCall('failed', 2500);
      }
    };

    // 4. Call Rejected / Declined / Busy / Timeout
    const handleCallRejected = ({ callId, reason }) => {
      console.log('[NEXA Call] Call rejected:', reason);
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
      } else if (reason === 'failed') {
        msg = 'Call failed to connect';
        nextState = 'failed';
      }

      setStatusMessage(msg);
      cleanupCall(nextState, 2500);
    };

    // 5. Caller Cancelled before answer
    const handleCallCancelled = ({ callId }) => {
      sound.stopRingtone();
      if (incomingCallRef.current?.callId === callId || activeCallRef.current?.callId === callId) {
        setStatusMessage('Call cancelled');
        cleanupCall('missed', 1500);
      }
    };

    // 6. WebRTC Signaling Data Exchange (Offer, Answer, ICE Candidates)
    const handleCallSignal = async ({ callId, senderId, signal }) => {
      if (!signal) return;

      const currentActive = activeCallRef.current;
      const currentCallId = currentActive?.callId;
      if (currentCallId && currentCallId !== callId) return;

      try {
        if (signal.type === 'offer') {
          // Receiver handles incoming offer and creates answer
          console.log('[NEXA Call] Processing incoming WebRTC offer');
          await webrtcService.handleOffer(signal.offer);
          const answer = await webrtcService.createAnswer();
          socket.emit('call:signal', {
            callId,
            targetUserId: senderId,
            to: senderId,
            signal: { type: 'answer', answer }
          });
        } else if (signal.type === 'answer') {
          // Caller handles incoming answer
          console.log('[NEXA Call] Processing incoming WebRTC answer');
          await webrtcService.handleAnswer(signal.answer);
        } else if (signal.type === 'candidate' && signal.candidate) {
          // Either peer handles ICE candidate
          await webrtcService.handleCandidate(signal.candidate);
        }
      } catch (err) {
        console.error('[NEXA Call] Error handling WebRTC signal:', err);
      }
    };

    // 7. Call Ended by remote peer
    const handleCallEnded = ({ callId, duration, reason }) => {
      console.log('[NEXA Call] Received call:ended for callId:', callId);
      sound.stopOutgoingRing();
      sound.stopRingtone();
      sound.playCallEnded();
      setStatusMessage(reason === 'peer_disconnected' ? 'User disconnected' : 'Call ended');
      cleanupCall('ended', 1500);
    };

    // 8. User is Busy
    const handleCallBusy = ({ message }) => {
      sound.stopOutgoingRing();
      setStatusMessage(message || 'User is currently on another call');
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

    // Direct WebRTC event aliases
    const handleDirectOffer = ({ callId, senderId, offer }) => {
      handleCallSignal({ callId, senderId, signal: { type: 'offer', offer } });
    };

    const handleDirectAnswer = ({ callId, senderId, answer }) => {
      handleCallSignal({ callId, senderId, signal: { type: 'answer', answer } });
    };

    const handleDirectCandidate = ({ callId, senderId, candidate }) => {
      handleCallSignal({ callId, senderId, signal: { type: 'candidate', candidate } });
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

    socket.on('webrtc-offer', handleDirectOffer);
    socket.on('webrtc-answer', handleDirectAnswer);
    socket.on('ice-candidate', handleDirectCandidate);

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

      socket.off('webrtc-offer', handleDirectOffer);
      socket.off('webrtc-answer', handleDirectAnswer);
      socket.off('ice-candidate', handleDirectCandidate);
    };
  }, [socket, cleanupCall]);

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
