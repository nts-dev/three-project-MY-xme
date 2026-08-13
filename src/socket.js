import { io } from "socket.io-client";

const URL = import.meta.env.MODE === "production"
  ? "https://xme.com.my/"
  : "http://localhost:4000";

export const socket = io(URL, {
  path: "/socket.io/",
  autoConnect: false,
  transports: ["polling", "websocket"],
  withCredentials: true,
});

export const clearSocketBuffers = () => {
  socket.sendBuffer = [];
  socket.receiveBuffer = [];
};

export const connectSocket = () => {
  if (!socket.connected) {
    socket.connect();
  }
};

export const disconnectSocket = () => {
  clearSocketBuffers();
  if (socket.connected || socket.active) {
    socket.disconnect();
  }
};

export const emitSocketEvent = (eventName, payload, { volatile = false } = {}) => {

  
  if (!socket.connected) {
     
    if (!volatile) {
     
      socket.emit(eventName, payload);
    }
    return false;
  }

  const target = volatile ? socket.volatile : socket;
  target.emit(eventName, payload);
  return true;
};
