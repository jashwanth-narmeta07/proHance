import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import axiosClient, {
  setAccessToken,
  getStoredRefreshToken,
  setStoredRefreshToken,
} from '../api/axiosClient.js';
import { connectSocket, disconnectSocket } from '../api/socketClient.js';
import * as authApi from '../services/authApi.js';
import { roleHasPermission } from '../constants/permissions.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);

  const applySession = useCallback((session) => {
    setAccessToken(session.accessToken);
    setStoredRefreshToken(session.refreshToken);
    setUser(session.user);
    connectSocket(session.accessToken);
  }, []);

  const clearSession = useCallback(() => {
    setAccessToken(null);
    setStoredRefreshToken(null);
    setUser(null);
    disconnectSocket();
  }, []);

  // On load, if a refresh token survived a page reload, try to silently
  // re-establish the session by hitting /auth/me (which triggers the axios
  // 401 -> refresh flow the first time it fails).
  useEffect(() => {
    async function bootstrap() {
      const refreshToken = getStoredRefreshToken();
      if (!refreshToken) {
        setIsInitializing(false);
        return;
      }
      try {
        // We don't have an access token yet, so force one refresh up front.
        const { data } = await axiosClient.post('/auth/refresh', { refreshToken });
        setAccessToken(data.data.accessToken);
        setStoredRefreshToken(data.data.refreshToken);
        setUser(data.data.user);
        connectSocket(data.data.accessToken);
      } catch {
        clearSession();
      } finally {
        setIsInitializing(false);
      }
    }
    bootstrap();
  }, [clearSession]);

  useEffect(() => {
    const onExpired = () => clearSession();
    window.addEventListener('auth:session-expired', onExpired);
    return () => window.removeEventListener('auth:session-expired', onExpired);
  }, [clearSession]);

  const login = useCallback(
    async (credentials) => {
      const session = await authApi.login(credentials);
      applySession(session);
      return session.user;
    },
    [applySession]
  );

  const registerOrganization = useCallback(
    async (payload) => {
      const session = await authApi.registerOrganization(payload);
      applySession(session);
      return session.user;
    },
    [applySession]
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const hasPermission = useCallback(
    (permission) => (user ? roleHasPermission(user.role, permission) : false),
    [user]
  );

  const value = {
    user,
    isAuthenticated: !!user,
    isInitializing,
    login,
    registerOrganization,
    logout,
    hasPermission,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
