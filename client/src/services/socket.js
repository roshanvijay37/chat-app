import { io } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_API_URL ?? "";
let socket = null;

export const connectSocket = (token) => {
  if (socket) return socket;
  socket = io(SOCKET_URL, { auth: { token } });
  socket.on("connect", () => console.log("Socket connected"));
  socket.on("disconnect", () => console.log("Socket disconnected"));
  return socket;
};

export const getSocket = () => socket;

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
