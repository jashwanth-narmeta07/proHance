import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import axiosClient from '../api/axiosClient.js';
import { getSocket } from '../api/socketClient.js';
import { useAuth } from './AuthContext.jsx';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const load = useCallback(async () => {
    try {
      const [{ data: listRes }, { data: countRes }] = await Promise.all([
        axiosClient.get('/notifications'),
        axiosClient.get('/notifications/unread-count'),
      ]);
      setNotifications(listRes.data.notifications);
      setUnreadCount(countRes.data.count);
    } catch {
      // Silently skip - the notification bell just stays at its last known state.
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) load();
    else {
      setNotifications([]);
      setUnreadCount(0);
    }
  }, [isAuthenticated, load]);

  // Real-time delivery: the backend pushes 'notification:new' the instant it
  // creates one (see server sockets/index.js + notification.service.js).
  useEffect(() => {
    if (!isAuthenticated) return undefined;
    const socket = getSocket();
    if (!socket) return undefined;

    function handleNew(payload) {
      setNotifications((prev) => [{ ...payload, _id: payload.id, read: false }, ...prev]);
      setUnreadCount((c) => c + 1);
      toast(payload.title, { icon: '🔔' });
    }

    socket.on('notification:new', handleNew);
    return () => socket.off('notification:new', handleNew);
  }, [isAuthenticated]);

  const markRead = useCallback(async (id) => {
    await axiosClient.patch(`/notifications/${id}/read`);
    setNotifications((prev) => prev.map((n) => (n._id === id ? { ...n, read: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
  }, []);

  const markAllRead = useCallback(async () => {
    await axiosClient.post('/notifications/mark-all-read');
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  }, []);

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markRead, markAllRead, reload: load }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within a NotificationProvider');
  return ctx;
}
