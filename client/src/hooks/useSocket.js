import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { getAccessTokenForSocket } from '../api/axiosClient.js';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || `http://${window.location.hostname}:5000`;

/**
 * One socket connection per authenticated session, authenticated the same
 * way REST calls are (the JWT access token) - see server/src/sockets/index.js.
 * `enabled` lets callers avoid connecting before a user is logged in.
 */
export function useSocket(enabled) {
  const socketRef = useRef(null);

  useEffect(() => {
    if (!enabled) return undefined;
    const token = getAccessTokenForSocket();
    if (!token) return undefined;

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [enabled]);

  return socketRef;
}