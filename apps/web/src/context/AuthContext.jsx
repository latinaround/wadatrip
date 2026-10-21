import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppConfig } from '../config/appConfig';

const tokenStorageKey = 'wadatrip_token';

function readInitialToken() {
  if (typeof window === 'undefined') return null;
  const hash = String(window.location.hash || '');
  if (hash.startsWith('#auth_token=')) {
    try { return decodeURIComponent(hash.slice('#auth_token='.length)) || null; }
    catch { return null; }
  }
  return window.localStorage.getItem(tokenStorageKey);
}

function authCodeDeliveryMessage(reason) {
  switch (String(reason || '')) {
    case 'email_not_configured':
      return 'Email sign-in is not configured right now. Use password sign-in or try again later.';
    case 'email_failed':
    case 'email_error':
      return 'We could not send your code right now. Try again in a few minutes.';
    default:
      return 'We could not send your code right now.';
  }
}

const AuthContext = createContext({
  user: null,
  token: null,
  loading: true,
  error: null,
  login: async () => {},
  register: async () => {},
  requestCode: async () => {},
  verifyCode: async () => {},
  logout: () => {},
  refreshProfile: async () => {},
  updateProfile: async () => {},
});

async function jsonRequest(path, options = {}) {
  const baseUrl = AppConfig.api.baseUrl?.replace(/\/$/, '') || '';
  const controller = new AbortController();
  const timeoutMs = Number(AppConfig.api.timeout) || 10000;
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    const { headers = {}, ...requestOptions } = options;
    response = await fetch(`${baseUrl}${path}`, {
      ...requestOptions,
      headers: { 'Content-Type': 'application/json', ...headers },
      signal: controller.signal,
    });
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new Error('Request timed out. Please try again.');
    }
    throw err;
  } finally {
    window.clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const error = new Error(payload?.message || `Request failed with status ${response.status}`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return response.json().catch(() => null);
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => {
    return readInitialToken();
  });
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const session = useRef({ token });
  const profileRequest = useRef(0);

  const persistToken = useCallback((value) => {
    if (typeof window === 'undefined') return;
    if (value) {
      window.localStorage.setItem(tokenStorageKey, value);
    } else {
      window.localStorage.removeItem(tokenStorageKey);
    }
  }, []);

  const replaceSession = useCallback((nextToken, nextUser = null) => {
    // Invalidate old responses synchronously, before React renders the new session.
    session.current = { token: nextToken };
    profileRequest.current++;
    persistToken(nextToken);
    setToken(nextToken);
    setUser(nextUser);
    setError(null);
    setLoading(Boolean(nextToken));
  }, [persistToken]);

  const fetchProfile = useCallback(async (activeToken) => {
    const identity = session.current;
    if (identity.token !== activeToken) return null;
    const order = ++profileRequest.current;
    const isCurrent = () => session.current === identity && profileRequest.current === order;
    if (!activeToken) {
      setUser(null);
      setLoading(false);
      return null;
    }
    try {
      const me = await jsonRequest('/auth/me', {
        method: 'GET',
        headers: { Authorization: `Bearer ${activeToken}` },
      });
      if (!isCurrent()) return null;
      setUser(me);
      setError(null);
      return me;
    } catch (err) {
      if (!isCurrent()) return null;
      console.error('Failed to load profile', err);
      replaceSession(null);
      setError(err);
      return null;
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [replaceSession]);

  useEffect(() => {
    const requests = profileRequest;
    // Consume the legacy return fragment once; reload after logout must not reuse it.
    if (window.location.hash.startsWith('#auth_token=')) {
      window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}`);
    }
    if (token) {
      persistToken(token);
    }
    setLoading(true);
    fetchProfile(token);
    return () => { requests.current++; };
  }, [token, fetchProfile, persistToken]);

  const login = useCallback(async ({ email, password }) => {
    const identity = session.current;
    const payload = await jsonRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (session.current !== identity) throw new Error('Your session changed. Please sign in again.');
    if (payload?.token) {
      replaceSession(payload.token, payload.user);
    }
    return payload;
  }, [replaceSession]);

  const register = useCallback(async ({ email, password, name, role = 'traveler' }) => {
    const identity = session.current;
    const payload = await jsonRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name, role }),
    });
    if (session.current !== identity) throw new Error('Your session changed. Please sign in again.');
    if (payload?.token) {
      replaceSession(payload.token, payload.user);
    }
    return payload;
  }, [replaceSession]);

  const requestCode = useCallback(async ({ email, role = 'traveler', name }) => {
    const payload = await jsonRequest('/auth/request-code', {
      method: 'POST',
      body: JSON.stringify({ email, role, name }),
    });
    if (payload?.delivery && !payload?.preview_code) {
      throw new Error(authCodeDeliveryMessage(payload.delivery));
    }
    return payload;
  }, []);

  const verifyCode = useCallback(async ({ email, code, role = 'traveler', name }) => {
    const identity = session.current;
    const payload = await jsonRequest('/auth/verify-code', {
      method: 'POST',
      body: JSON.stringify({ email, code, role, name }),
    });
    if (session.current !== identity) throw new Error('Your session changed. Please sign in again.');
    if (payload?.token) {
      replaceSession(payload.token, payload.user);
    }
    return payload;
  }, [replaceSession]);

  const logout = useCallback(() => {
    replaceSession(null);
  }, [replaceSession]);

  const refreshProfile = useCallback(async () => fetchProfile(token), [fetchProfile, token]);

  const updateProfile = useCallback(async ({ name }) => {
    if (!token) throw new Error('Please sign in to update your profile.');
    const identity = session.current;
    const payload = await jsonRequest('/auth/update', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name }),
    });
    if (session.current !== identity) throw new Error('Your session changed. Please sign in again.');
    profileRequest.current++;
    setUser(payload);
    setError(null);
    setLoading(false);
    return payload;
  }, [token]);

  const value = useMemo(() => ({
    user,
    token,
    loading,
    error,
    login,
    register,
    requestCode,
    verifyCode,
    logout,
    refreshProfile,
    updateProfile,
  }), [user, token, loading, error, login, register, requestCode, verifyCode, logout, refreshProfile, updateProfile]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
