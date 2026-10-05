import { io } from 'socket.io-client';

export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || `http://${window.location.hostname}:5000`;

let socket = null;

/**
 * One shared socket for the whole app, created lazily once we have an access
 * token. Auth happens via the same JWT used for REST calls (see
 * server/src/sockets/index.js), never a separate credential.
 */
export function connectSocket(accessToken) {
  if (socket) {
    socket.auth = { token: accessToken };
    socket.connect();
    return socket;
  }
  socket = io(SOCKET_URL, {
    auth: { token: accessToken },
    autoConnect: true,
    reconnection: true,
  });
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function getSocket() {
  return socket;
}