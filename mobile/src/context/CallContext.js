import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { getSocket } from '../services/socket';
import {
  getLocalStream, createPeerConnection, createOffer, createAnswer,
  setRemoteAnswer, addIceCandidate, endCall as endWebRTC,
  toggleMute, toggleCamera, switchCamera,
} from '../services/webrtc';

const CallContext = createContext();

export const useCall = () => useContext(CallContext);

export function CallProvider({ children }) {
  const [callState, setCallState] = useState('idle'); // idle | outgoing | incoming | connected
  const [callType, setCallType] = useState(null); // voice | video
  const [remoteUser, setRemoteUser] = useState(null); // { id, display_name, avatar_url }
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const pendingCandidates = useRef([]);
  const incomingOffer = useRef(null);

  const handleRemoteStream = useCallback((stream) => {
    setRemoteStream(stream);
  }, []);

  const handleIceCandidate = useCallback((candidate) => {
    const socket = getSocket();
    if (socket && remoteUser) {
      socket.emit('call:ice-candidate', { to: remoteUser.id, candidate });
    }
  }, [remoteUser]);

  // Listen for call events
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onIncoming = async ({ from, callType: type, offer }) => {
      if (callState !== 'idle') {
        socket.emit('call:busy', { to: from });
        return;
      }
      incomingOffer.current = offer;
      setCallType(type);
      setRemoteUser({ id: from });
      setCallState('incoming');
    };

    const onAccepted = async ({ from, answer }) => {
      await setRemoteAnswer(answer);
      // Flush pending ICE candidates
      for (const c of pendingCandidates.current) {
        await addIceCandidate(c);
      }
      pendingCandidates.current = [];
      setCallState('connected');
    };

    const onRejected = () => {
      cleanup();
    };

    const onEnded = () => {
      cleanup();
    };

    const onIceCandidate = async ({ candidate }) => {
      if (callState === 'connected' || callState === 'incoming') {
        await addIceCandidate(candidate);
      } else {
        pendingCandidates.current.push(candidate);
      }
    };

    const onBusy = () => {
      cleanup();
    };

    socket.on('call:incoming', onIncoming);
    socket.on('call:accepted', onAccepted);
    socket.on('call:rejected', onRejected);
    socket.on('call:ended', onEnded);
    socket.on('call:ice-candidate', onIceCandidate);
    socket.on('call:busy', onBusy);

    return () => {
      socket.off('call:incoming', onIncoming);
      socket.off('call:accepted', onAccepted);
      socket.off('call:rejected', onRejected);
      socket.off('call:ended', onEnded);
      socket.off('call:ice-candidate', onIceCandidate);
      socket.off('call:busy', onBusy);
    };
  }, [callState, remoteUser]);

  const cleanup = () => {
    endWebRTC();
    setCallState('idle');
    setCallType(null);
    setRemoteUser(null);
    setLocalStream(null);
    setRemoteStream(null);
    setIsMuted(false);
    setIsCameraOff(false);
    pendingCandidates.current = [];
    incomingOffer.current = null;
  };

  // Initiate a call
  const startCall = async (user, type) => {
    const socket = getSocket();
    if (!socket || callState !== 'idle') return;

    setRemoteUser(user);
    setCallType(type);
    setCallState('outgoing');

    const stream = await getLocalStream(type === 'video');
    setLocalStream(stream);

    createPeerConnection(handleRemoteStream, (candidate) => {
      socket.emit('call:ice-candidate', { to: user.id, candidate });
    });

    const offer = await createOffer();
    socket.emit('call:initiate', { to: user.id, callType: type, offer });
  };

  // Accept incoming call
  const acceptCall = async () => {
    const socket = getSocket();
    if (!socket || callState !== 'incoming') return;

    const stream = await getLocalStream(callType === 'video');
    setLocalStream(stream);

    createPeerConnection(handleRemoteStream, (candidate) => {
      socket.emit('call:ice-candidate', { to: remoteUser.id, candidate });
    });

    const answer = await createAnswer(incomingOffer.current);
    socket.emit('call:accept', { to: remoteUser.id, answer });

    // Flush pending ICE candidates
    for (const c of pendingCandidates.current) {
      await addIceCandidate(c);
    }
    pendingCandidates.current = [];
    setCallState('connected');
  };

  // Reject incoming call
  const rejectCall = () => {
    const socket = getSocket();
    if (socket && remoteUser) {
      socket.emit('call:reject', { to: remoteUser.id });
    }
    cleanup();
  };

  // End active call
  const hangUp = () => {
    const socket = getSocket();
    if (socket && remoteUser) {
      socket.emit('call:end', { to: remoteUser.id });
    }
    cleanup();
  };

  const onToggleMute = () => {
    const muted = toggleMute();
    setIsMuted(muted);
  };

  const onToggleCamera = () => {
    const off = toggleCamera();
    setIsCameraOff(off);
  };

  const onSwitchCamera = () => {
    switchCamera();
  };

  return (
    <CallContext.Provider value={{
      callState, callType, remoteUser, localStream, remoteStream,
      isMuted, isCameraOff,
      startCall, acceptCall, rejectCall, hangUp,
      onToggleMute, onToggleCamera, onSwitchCamera,
    }}>
      {children}
    </CallContext.Provider>
  );
}
