import axios from 'axios';

// Same-machine access (whoever's running the server) hits Windows loopback
// quirks when the browser is pointed at its own LAN-facing IP instead of
// localhost - a plain top-level navigation timing out despite the server
// listening and other clients (like the desktop agent) reaching it fine is
// the signature of that. Deriving the API host from wherever the page
// itself was loaded from means both "this machine, via localhost" and
// "another machine on the LAN, via the IP" resolve correctly on their own,
// without anyone needing to hand-edit VITE_API_URL per machine.
const DEFAULT_API_URL = `http://${window.location.hostname}:5000/api/v1`;
export const API_BASE_URL = import.meta.env.VITE_API_URL || DEFAULT_API_URL;

const axiosClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Tokens are kept in module scope (not localStorage) for the access token to
// limit XSS exposure; the refresh token is persisted so a page reload doesn't
// force a re-login. This is an MVP tradeoff - production hardening (Phase 14)
// should move the refresh token to an httpOnly cookie set by the server.
let accessToken = null;

export function setAccessToken(token) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

export function getStoredRefreshToken() {
  return localStorage.getItem('refreshToken');
}

export function setStoredRefreshToken(token) {
  if (token) localStorage.setItem('refreshToken', token);
  else localStorage.removeItem('refreshToken');
}

axiosClient.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

let refreshPromise = null;

axiosClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;
    const code = error.response?.data?.code;
    const isAuthEndpoint = originalRequest?.url?.includes('/auth/');

    if (status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      originalRequest._retry = true;
      const refreshToken = getStoredRefreshToken();
      if (!refreshToken) {
        return Promise.reject(error);
      }

      try {
        // Coalesce concurrent 401s into a single refresh call.
        refreshPromise =
          refreshPromise ||
          axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken }).finally(() => {
            refreshPromise = null;
          });

        const { data } = await refreshPromise;
        setAccessToken(data.data.accessToken);
        setStoredRefreshToken(data.data.refreshToken);

        originalRequest.headers.Authorization = `Bearer ${data.data.accessToken}`;
        return axiosClient(originalRequest);
      } catch (refreshError) {
        setAccessToken(null);
        setStoredRefreshToken(null);
        window.dispatchEvent(new CustomEvent('auth:session-expired'));
        return Promise.reject(refreshError);
      }
    }

    // Any response tagged with one of these codes means the session is no
    // longer valid regardless of which endpoint returned it - clear it eagerly.
    if (code === 'REFRESH_TOKEN_REVOKED' || code === 'ACCOUNT_INACTIVE') {
      setAccessToken(null);
      setStoredRefreshToken(null);
      window.dispatchEvent(new CustomEvent('auth:session-expired'));
    }

    return Promise.reject(error);
  }
);

export default axiosClient;