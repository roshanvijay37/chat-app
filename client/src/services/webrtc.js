const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

let pc = null;
let localStream = null;

export async function getLocalStream(callType) {
  const constraints = { audio: true, video: callType === "video" };
  localStream = await navigator.mediaDevices.getUserMedia(constraints);
  return localStream;
}

export function createPeerConnection(onIceCandidate, onRemoteStream) {
  pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

  pc.onicecandidate = (e) => {
    if (e.candidate) onIceCandidate(e.candidate);
  };

  pc.ontrack = (e) => {
    if (e.streams?.[0]) onRemoteStream(e.streams[0]);
  };

  if (localStream) {
    localStream.getTracks().forEach((t) => pc.addTrack(t, localStream));
  }

  return pc;
}

export async function createOffer() {
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  return offer;
}

export async function createAnswer(offer) {
  await pc.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  return answer;
}

export async function setRemoteAnswer(answer) {
  await pc.setRemoteDescription(new RTCSessionDescription(answer));
}

export async function addIceCandidate(candidate) {
  if (pc && candidate) await pc.addIceCandidate(new RTCIceCandidate(candidate));
}

export function toggleMute() {
  const track = localStream?.getAudioTracks()[0];
  if (track) { track.enabled = !track.enabled; return !track.enabled; }
  return false;
}

export function toggleCamera() {
  const track = localStream?.getVideoTracks()[0];
  if (track) { track.enabled = !track.enabled; return !track.enabled; }
  return false;
}

export function endCall() {
  localStream?.getTracks().forEach((t) => t.stop());
  localStream = null;
  if (pc) { pc.close(); pc = null; }
}

export function getPC() { return pc; }
export function getLocalStreamRef() { return localStream; }
