/**
 * WebRTC Service for Nexa Chat
 * Manages peer connection, STUN/TURN configurations, media streams, and ICE candidates
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

  getIceServers() {
    const iceServers = [];

    // STUN servers
    const customStun = import.meta.env.VITE_STUN_SERVER;
    if (customStun) {
      iceServers.push({ urls: customStun });
    }
    iceServers.push(
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' }
    );

    // TURN servers if configured via env variables
    const turnUrl = import.meta.env.VITE_TURN_SERVER;
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

  async getMediaStream({ audio = true, video = false, facingMode = 'user' } = {}) {
    // Stop any existing stream
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
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        : false
    };

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      return this.localStream;
    } catch (err) {
      console.error('Failed to get media devices:', err);
      throw err;
    }
  }

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

    this.peerConnection = new RTCPeerConnection(config);
    this.remoteStream = new MediaStream();

    // Attach local tracks if available
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        this.peerConnection.addTrack(track, this.localStream);
      });
    }

    // Handle remote tracks
    this.peerConnection.ontrack = (event) => {
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

    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.onIceCandidateCallback) {
        this.onIceCandidateCallback(event.candidate);
      }
    };

    // Handle connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      if (this.peerConnection && this.onConnectionStateChangeCallback) {
        this.onConnectionStateChangeCallback(this.peerConnection.connectionState);
      }
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      if (this.peerConnection && this.onConnectionStateChangeCallback) {
        this.onConnectionStateChangeCallback(this.peerConnection.iceConnectionState);
      }
    };

    return this.peerConnection;
  }

  async createOffer() {
    if (!this.peerConnection) throw new Error('PeerConnection not initialized');
    const offer = await this.peerConnection.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true
    });
    await this.peerConnection.setLocalDescription(offer);
    return offer;
  }

  async createAnswer(remoteOffer) {
    if (!this.peerConnection) throw new Error('PeerConnection not initialized');
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(remoteOffer));

    // Process queued ICE candidates
    await this.processQueuedCandidates();

    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    return answer;
  }

  async handleAnswer(remoteAnswer) {
    if (!this.peerConnection) return;
    if (this.peerConnection.signalingState !== 'stable') {
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(remoteAnswer));
      await this.processQueuedCandidates();
    }
  }

  async handleCandidate(candidate) {
    if (!candidate) return;
    if (this.peerConnection && this.peerConnection.remoteDescription) {
      try {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.error('Error adding received ice candidate:', e);
      }
    } else {
      this.iceCandidatesQueue.push(candidate);
    }
  }

  async processQueuedCandidates() {
    while (this.iceCandidatesQueue.length > 0) {
      const cand = this.iceCandidatesQueue.shift();
      try {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(cand));
      } catch (e) {
        console.error('Error adding queued ice candidate:', e);
      }
    }
  }

  setAudioEnabled(enabled) {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = enabled;
      });
    }
  }

  setVideoEnabled(enabled) {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach((track) => {
        track.enabled = enabled;
      });
    }
  }

  async switchCamera(currentFacingMode = 'user') {
    const nextFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
    if (!this.localStream) return nextFacingMode;

    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: nextFacingMode }
      });
      const newVideoTrack = newStream.getVideoTracks()[0];

      if (this.peerConnection) {
        const senders = this.peerConnection.getSenders();
        const videoSender = senders.find((s) => s.track && s.track.kind === 'video');
        if (videoSender) {
          await videoSender.replaceTrack(newVideoTrack);
        }
      }

      // Replace in local stream
      const oldVideoTracks = this.localStream.getVideoTracks();
      oldVideoTracks.forEach((track) => {
        track.stop();
        this.localStream.removeTrack(track);
      });
      this.localStream.addTrack(newVideoTrack);

      return nextFacingMode;
    } catch (err) {
      console.error('Failed to switch camera:', err);
      return currentFacingMode;
    }
  }

  stopLocalStream() {
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {
          console.error('Error stopping track:', e);
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
          console.error('Error stopping remote track:', e);
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
        console.error('Error closing peerConnection:', e);
      }
      this.peerConnection = null;
    }
    this.iceCandidatesQueue = [];
  }

  cleanup() {
    this.stopLocalStream();
    this.stopRemoteStream();
    this.cleanupPeerConnection();
    this.onRemoteStreamCallback = null;
    this.onIceCandidateCallback = null;
    this.onConnectionStateChangeCallback = null;
  }
}

export const webrtcService = new WebRTCService();
