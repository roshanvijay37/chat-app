import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Platform, Alert } from 'react-native';
import { getSocket } from '../services/socket';
import {
  getLocalStream, createPeerConnection, createOffer, createAnswer,
  setRemoteAnswer, addIceCandidate, endCall as endWebRTC,
  toggleMute, toggleCamera, switchCamera,
} from '../services/webrtc';

const CallContext = createContext();

export const useCall = () => useContext(CallContext);

export function CallProvider({ children }) {
  const [callState, setCallState] = useState('idle');
  const [callType, setCallType] = useState(null);
  const [remoteUser, setRemoteUser] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const pendingCandidates = useRef([]);
  const incomingOffer = useRef(null);
  const remoteUserRef = useRef(null);
  const callStateRef = useRef('idle');

  // Keep refs in sync with state
  useEffect(() => { remoteUserRef.current = remoteUser; }, [remoteUser]);
  useEffect(() => { callStateRef.current = callState; }, [callState]);

  const cleanup = () => {
    try { endWebRTC(); } catch {}
    setCallState('idle');
    setCallType(null);
    setRemoteUser(null);
    setLocalStream(null);
    setRemoteStream(null);
    setIsMuted(false);
    setIsCameraOff(false);
    pendingCandidates.current = [];
    incomingOffer.current = null;
    remoteUserRef.current = null;
    callStateRef.current = 'idle';
  };

  // Listen for call events
  useEffect(() => {
    const interval = setInterval(() => {
      const socket = getSocket();
      if (!socket) return;
      clearInterval(interval);

      socket.on('call:incoming', ({ from, callType: type, offer }) => {
        if (callStateRef.current !== 'idle') {
          socket.emit('call:busy', { to: from });
          return;
        }
        incomingOffer.current = offer;
        setCallType(type);
        setRemoteUser({ id: from });
        remoteUserRef.current = { id: from };
        setCallState('incoming');
      });

      socket.on('call:accepted', async ({ from, answer }) => {
        try {
          await setRemoteAnswer(answer);
          for (const c of pendingCandidates.current) {
            await addIceCandidate(c);
          }
          pendingCandidates.current = [];
          setCallState('connected');
        } catch (e) {
          console.error('call:accepted error:', e);
          cleanup();
        }
      });

      socket.on('call:rejected', () => cleanup());
      socket.on('call:ended', () => cleanup());
      socket.on('call:busy', () => {
        Alert.alert('Busy', 'The user is on another call');
        cleanup();
      });

      socket.on('call:ice-candidate', async ({ candidate }) => {
        try {
          if (callStateRef.current === 'connected') {
            await addIceCandidate(candidate);
          } else {
            pendingCandidates.current.push(candidate);
          }
        } catch (e) {
          console.error('ICE candidate error:', e);
        }
      });
    }, 500);

    return () => clearInterval(interval);
  }, []);

  const startCall = async (user, type) => {
    try {
      const socket = getSocket();
      if (!socket || callStateRef.current !== 'idle') return;

      setRemoteUser(user);
      remoteUserRef.current = user;
      setCallType(type);
      setCallState('outgoing');

      const stream = await getLocalStream(type === 'video');
      if (!stream) {
        Alert.alert('Permission Denied', 'Camera/microphone access is required for calls');
        cleanup();
        return;
      }
      setLocalStream(stream);

      createPeerConnection(
        (stream) => setRemoteStream(stream),
        (candidate) => socket.emit('call:ice-candidate', { to: user.id, candidate })
      );

      const offer = await createOffer();
      socket.emit('call:initiate', { to: user.id, callType: type, offer });
    } catch (e) {
      console.error('startCall error:', e);
      Alert.alert('Call Failed', 'Could not start the call. Please check permissions.');
      cleanup();
    }
  };

  const acceptCall = async () => {
    try {
      const socket = getSocket();
      if (!socket || callStateRef.current !== 'incoming') return;

      const stream = await getLocalStream(callType === 'video');
      if (!stream) {
        Alert.alert('Permission Denied', 'Camera/microphone access is required for calls');
        rejectCall();
        return;
      }
      setLocalStream(stream);

      const user = remoteUserRef.current;
      createPeerConnection(
        (stream) => setRemoteStream(stream),
        (candidate) => socket.emit('call:ice-candidate', { to: user.id, candidate })
      );

      const answer = await createAnswer(incomingOffer.current);
      socket.emit('call:accept', { to: user.id, answer });

      for (const c of pendingCandidates.current) {
        await addIceCandidate(c);
      }
      pendingCandidates.current = [];
      setCallState('connected');
    } catch (e) {
      console.error('acceptCall error:', e);
      cleanup();
    }
  };

  const rejectCall = () => {
    const socket = getSocket();
    const user = remoteUserRef.current;
    if (socket && user) {
      socket.emit('call:reject', { to: user.id });
    }
    cleanup();
  };

  const hangUp = () => {
    const socket = getSocket();
    const user = remoteUserRef.current;
    if (socket && user) {
      socket.emit('call:end', { to: user.id });
    }
    cleanup();
  };

  const onToggleMute = () => setIsMuted(toggleMute());
  const onToggleCamera = () => setIsCameraOff(toggleCamera());
  const onSwitchCamera = () => switchCamera();

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
