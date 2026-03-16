import {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
  mediaDevices,
} from 'react-native-webrtc';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

let peerConnection = null;
let localStream = null;
let remoteStream = null;

export async function getLocalStream(isVideo = true) {
  const constraints = {
    audio: true,
    video: isVideo ? { facingMode: 'user', width: 640, height: 480 } : false,
  };
  localStream = await mediaDevices.getUserMedia(constraints);
  return localStream;
}

export function createPeerConnection(onRemoteStream, onIceCandidate) {
  peerConnection = new RTCPeerConnection(ICE_SERVERS);

  // Add local tracks to connection
  if (localStream) {
    localStream.getTracks().forEach((track) => {
      peerConnection.addTrack(track, localStream);
    });
  }

  // Handle remote stream
  peerConnection.ontrack = (event) => {
    remoteStream = event.streams[0];
    onRemoteStream?.(remoteStream);
  };

  // Handle ICE candidates
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      onIceCandidate?.(event.candidate);
    }
  };

  peerConnection.oniceconnectionstatechange = () => {
    console.log('ICE state:', peerConnection?.iceConnectionState);
  };

  return peerConnection;
}

export async function createOffer() {
  if (!peerConnection) return null;
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  return offer;
}

export async function createAnswer(offer) {
  if (!peerConnection) return null;
  await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  return answer;
}

export async function setRemoteAnswer(answer) {
  if (!peerConnection) return;
  await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
}

export async function addIceCandidate(candidate) {
  if (!peerConnection) return;
  await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
}

export function toggleMute() {
  if (!localStream) return false;
  const audioTrack = localStream.getAudioTracks()[0];
  if (audioTrack) {
    audioTrack.enabled = !audioTrack.enabled;
    return !audioTrack.enabled; // returns true if muted
  }
  return false;
}

export function toggleCamera() {
  if (!localStream) return false;
  const videoTrack = localStream.getVideoTracks()[0];
  if (videoTrack) {
    videoTrack.enabled = !videoTrack.enabled;
    return !videoTrack.enabled; // returns true if camera off
  }
  return false;
}

export function switchCamera() {
  if (!localStream) return;
  const videoTrack = localStream.getVideoTracks()[0];
  if (videoTrack) {
    videoTrack._switchCamera();
  }
}

export function endCall() {
  if (localStream) {
    localStream.getTracks().forEach((track) => track.stop());
    localStream = null;
  }
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  remoteStream = null;
}

export function getLocalStreamRef() {
  return localStream;
}

export function getRemoteStreamRef() {
  return remoteStream;
}
