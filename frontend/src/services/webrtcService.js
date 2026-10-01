/**
 * WebRTC Service for NEXA Real-time Chat
 * Manages native browser RTCPeerConnection, media devices, STUN/TURN configuration, and ICE candidate negotiation.
 */

class WebRTCService {
  constructor() {
    this.peerConnection = null;
    this.localStream = null;
    this.remoteStream = null;
    this.iceCandidatesQueue = [];
    this.onRemoteStreamCallback = null;
    this.onIceCandidateCallback = null;
    this.onConnectionStateChangeCallback = null;
  }

  /**
   * Centralized ICE Servers Configuration (Google STUN + Optional TURN)
   */
  getIceServers() {
    const iceServers = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' }
    ];

    // Optional custom STUN server
    const customStun = import.meta.env.VITE_STUN_SERVER || import.meta.env.VITE_STUN_URL;
    if (customStun) {
      iceServers.unshift({ urls: customStun });
    }

    // Optional TURN servers for restrictive NAT/firewall environments
    const turnUrl = import.meta.env.VITE_TURN_URL || import.meta.env.VITE_TURN_SERVER;
    const turnUsername = import.meta.env.VITE_TURN_USERNAME;
    const turnCredential = import.meta.env.VITE_TURN_CREDENTIAL;

    if (turnUrl) {
      const turnConfig = { urls: turnUrl };
      if (turnUsername) turnConfig.username = turnUsername;
      if (turnCredential) turnConfig.credential = turnCredential;
      iceServers.push(turnConfig);
    }

    return iceServers;
  }

  /**
   * Acquire local audio/video media stream using browser getUserMedia API
   */
  async getMediaStream({ audio = true, video = false, facingMode = 'user' } = {}) {
    // Stop any stale local tracks before requesting new stream
    this.stopLocalStream();

    const constraints = {
      audio: audio
        ? {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        : false,
      video: video
        ? {
            facingMode,
            width: { ideal: 1280, max: 1920 },
            height: { ideal: 720, max: 1080 }
          }
        : false
    };

    console.log('[NEXA WebRTC] Requesting local media devices with constraints:', constraints);
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log(
        '[NEXA WebRTC] Local media stream acquired:',
        this.localStream.getTracks().map((t) => `${t.kind} (${t.label})`).join(', ')
      );
      return this.localStream;
    } catch (err) {
      console.error('[NEXA WebRTC] Media acquisition error:', err);
      throw err;
    }
  }

  /**
   * Instantiate and configure native browser RTCPeerConnection
   */
  createPeerConnection({ onRemoteStream, onIceCandidate, onConnectionStateChange }) {
    this.cleanupPeerConnection();

    this.onRemoteStreamCallback = onRemoteStream;
    this.onIceCandidateCallback = onIceCandidate;
    this.onConnectionStateChangeCallback = onConnectionStateChange;
    this.iceCandidatesQueue = [];

    const config = {
      iceServers: this.getIceServers(),
      iceCandidatePoolSize: 10
    };

    console.log('[NEXA WebRTC] Creating RTCPeerConnection with config:', config);
    this.peerConnection = new RTCPeerConnection(config);
    this.remoteStream = new MediaStream();

    // Attach local audio/video tracks to peer connection
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        console.log(`[NEXA WebRTC] Adding local ${track.kind} track to RTCPeerConnection`);
        this.peerConnection.addTrack(track, this.localStream);
      });
    }

    // Remote track arrival handler
    this.peerConnection.ontrack = (event) => {
      console.log(`[NEXA WebRTC] Remote ${event.track.kind} track received`);
      if (event.streams && event.streams[0]) {
        event.streams[0].getTracks().forEach((track) => {
          if (!this.remoteStream.getTracks().some((t) => t.id === track.id)) {
            this.remoteStream.addTrack(track);
          }
        });
      } else if (event.track) {
        if (!this.remoteStream.getTracks().some((t) => t.id === event.track.id)) {
          this.remoteStream.addTrack(event.track);
        }
      }

      if (this.onRemoteStreamCallback) {
        this.onRemoteStreamCallback(this.remoteStream);
      }
    };

    // Local ICE candidate generation handler
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('[NEXA WebRTC] ICE candidate generated');
        if (this.onIceCandidateCallback) {
          this.onIceCandidateCallback(event.candidate);
        }
      }
    };

    // Connection state monitor
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      console.log(`[NEXA WebRTC] Connection state: ${state}`);
      if (this.onConnectionStateChangeCallback) {
        this.onConnectionStateChangeCallback(state);
      }
    };

    // ICE connection state monitor (fallback for older browser engines)
    this.peerConnection.oniceconnectionstatechange = () => {
      const iceState = this.peerConnection?.iceConnectionState;
      console.log(`[NEXA WebRTC] ICE connection state: ${iceState}`);
      if (
        this.onConnectionStateChangeCallback &&
        (!this.peerConnection?.connectionState || this.peerConnection?.connectionState === 'new')
      ) {
        this.onConnectionStateChangeCallback(iceState);
      }
    };

    return this.peerConnection;
  }

  /**
   * Create and set local WebRTC Offer
   */
  async createOffer() {
    if (!this.peerConnection) throw new Error('PeerConnection not initialized');
    console.log('[NEXA WebRTC] Creating offer');
    const offer = await this.peerConnection.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true
    });
    console.log('[NEXA WebRTC] Setting local description (offer)');
    await this.peerConnection.setLocalDescription(offer);
    return offer;
  }

  /**
   * Handle incoming remote WebRTC Offer
   */
  async handleOffer(remoteOffer) {
    if (!this.peerConnection) throw new Error('PeerConnection not initialized');
    console.log('[NEXA WebRTC] Received offer, setting remote description');
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(remoteOffer));
    await this.processQueuedCandidates();
  }

  /**
   * Create and set local WebRTC Answer
   */
  async createAnswer() {
    if (!this.peerConnection) throw new Error('PeerConnection not initialized');
    console.log('[NEXA WebRTC] Creating answer');
    const answer = await this.peerConnection.createAnswer();
    console.log('[NEXA WebRTC] Setting local description (answer)');
    await this.peerConnection.setLocalDescription(answer);
    return answer;
  }

  /**
   * Handle incoming remote WebRTC Answer
   */
  async handleAnswer(remoteAnswer) {
    if (!this.peerConnection) return;
    console.log('[NEXA WebRTC] Received answer, setting remote description');
    if (this.peerConnection.signalingState !== 'stable') {
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(remoteAnswer));
      await this.processQueuedCandidates();
    }
  }

  /**
   * Handle received remote ICE candidate
   */
  async handleCandidate(candidate) {
    if (!candidate) return;
    console.log('[NEXA WebRTC] ICE candidate received');
    if (
      this.peerConnection &&
      this.peerConnection.remoteDescription &&
      this.peerConnection.remoteDescription.type
    ) {
      try {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.error('[NEXA WebRTC] Error adding received ICE candidate:', e);
      }
    } else {
      console.log('[NEXA WebRTC] Remote description not set yet; queuing ICE candidate');
      this.iceCandidatesQueue.push(candidate);
    }
  }

  /**
   * Flush queued ICE candidates once remote description is set
   */
  async processQueuedCandidates() {
    if (!this.peerConnection || !this.peerConnection.remoteDescription) return;
    if (this.iceCandidatesQueue.length > 0) {
      console.log(`[NEXA WebRTC] Processing ${this.iceCandidatesQueue.length} queued ICE candidate(s)`);
    }
    while (this.iceCandidatesQueue.length > 0) {
      const cand = this.iceCandidatesQueue.shift();
      try {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(cand));
      } catch (e) {
        console.error('[NEXA WebRTC] Error adding queued ICE candidate:', e);
      }
    }
  }

  /**
   * Toggle microphone audio track
   */
  setAudioEnabled(enabled) {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = enabled;
      });
      console.log(`[NEXA WebRTC] Microphone audio ${enabled ? 'unmuted' : 'muted'}`);
    }
  }

  /**
   * Toggle camera video track
   */
  setVideoEnabled(enabled) {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach((track) => {
        track.enabled = enabled;
      });
      console.log(`[NEXA WebRTC] Camera video ${enabled ? 'enabled' : 'disabled'}`);
    }
  }

  /**
   * Switch between front and back camera (mobile support)
   */
  async switchCamera(currentFacingMode = 'user') {
    const nextFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
    if (!this.localStream) return nextFacingMode;

    try {
      console.log(`[NEXA WebRTC] Switching camera to ${nextFacingMode}`);
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: nextFacingMode,
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 }
        }
      });
      const newVideoTrack = newStream.getVideoTracks()[0];

      if (this.peerConnection) {
        const senders = this.peerConnection.getSenders();
        const videoSender = senders.find((s) => s.track && s.track.kind === 'video');
        if (videoSender) {
          await videoSender.replaceTrack(newVideoTrack);
        }
      }

      // Stop old video tracks and attach new track
      const oldVideoTracks = this.localStream.getVideoTracks();
      oldVideoTracks.forEach((track) => {
        track.stop();
        this.localStream.removeTrack(track);
      });
      this.localStream.addTrack(newVideoTrack);

      return nextFacingMode;
    } catch (err) {
      console.error('[NEXA WebRTC] Failed to switch camera:', err);
      return currentFacingMode;
    }
  }

  stopLocalStream() {
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {
          console.error('[NEXA WebRTC] Error stopping local track:', e);
        }
      });
      this.localStream = null;
    }
  }

  stopRemoteStream() {
    if (this.remoteStream) {
      this.remoteStream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {
          console.error('[NEXA WebRTC] Error stopping remote track:', e);
        }
      });
      this.remoteStream = null;
    }
  }

  cleanupPeerConnection() {
    if (this.peerConnection) {
      this.peerConnection.ontrack = null;
      this.peerConnection.onicecandidate = null;
      this.peerConnection.onconnectionstatechange = null;
      this.peerConnection.oniceconnectionstatechange = null;
      try {
        this.peerConnection.close();
      } catch (e) {
        console.error('[NEXA WebRTC] Error closing peerConnection:', e);
      }
      this.peerConnection = null;
    }
    this.iceCandidatesQueue = [];
  }

  /**
   * Complete call cleanup: release tracks, close RTCPeerConnection, reset streams
   */
  cleanup() {
    console.log('[NEXA WebRTC] Call ended');
    this.stopLocalStream();
    this.stopRemoteStream();
    this.cleanupPeerConnection();
    this.onRemoteStreamCallback = null;
    this.onIceCandidateCallback = null;
    this.onConnectionStateChangeCallback = null;
  }
}

export const webrtcService = new WebRTCService();
