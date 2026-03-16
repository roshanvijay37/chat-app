import { io } from 'socket.io-client';
import { API_URL } from './api';

let socket = null;

export const connectSocket = (token) => {
  if (socket) return socket;
  socket = io(API_URL, { auth: { token } });
  socket.on('connect', () => console.log('Socket connected'));
  socket.on('disconnect', () => console.log('Socket disconnected'));
  return socket;
};

export const getSocket = () => socket;

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
