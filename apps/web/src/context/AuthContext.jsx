import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppConfig } from '../config/appConfig';

const tokenStorageKey = 'wadatrip_token';

function readInitialToken() {
  if (typeof window === 'undefined') return null;
  const hash = String(window.location.hash || '');
  if (hash.startsWith('#auth_token=')) {
    return decodeURIComponent(hash.slice('#auth_token='.length)) || null;
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
});

async function jsonRequest(path, options = {}) {
  const baseUrl = AppConfig.api.baseUrl?.replace(/\/$/, '') || '';
  const controller = new AbortController();
  const timeoutMs = Number(AppConfig.api.timeout) || 10000;
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      signal: controller.signal,
      ...options,
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

  const persistToken = useCallback((value) => {
    if (typeof window === 'undefined') return;
    if (value) {
      window.localStorage.setItem(tokenStorageKey, value);
    } else {
      window.localStorage.removeItem(tokenStorageKey);
    }
  }, []);

  const fetchProfile = useCallback(async (activeToken) => {
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
      setUser(me);
      setError(null);
      return me;
    } catch (err) {
      console.error('Failed to load profile', err);
      setUser(null);
      setError(err);
      persistToken(null);
      setToken(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [persistToken]);

  useEffect(() => {
    if (token) {
      persistToken(token);
    }
    setLoading(true);
    fetchProfile(token);
  }, [token, fetchProfile]);

  const login = useCallback(async ({ email, password }) => {
    const payload = await jsonRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (payload?.token) {
      setToken(payload.token);
      persistToken(payload.token);
      setUser(payload.user);
      setError(null);
    }
    return payload;
  }, [persistToken]);

  const register = useCallback(async ({ email, password, name, role = 'traveler' }) => {
    const payload = await jsonRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name, role }),
    });
    if (payload?.token) {
      setToken(payload.token);
      persistToken(payload.token);
      setUser(payload.user);
      setError(null);
    }
    return payload;
  }, [persistToken]);

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
    const payload = await jsonRequest('/auth/verify-code', {
      method: 'POST',
      body: JSON.stringify({ email, code, role, name }),
    });
    if (payload?.token) {
      setToken(payload.token);
      persistToken(payload.token);
      setUser(payload.user);
      setError(null);
    }
    return payload;
  }, [persistToken]);

  const logout = useCallback(() => {
    persistToken(null);
    setToken(null);
    setUser(null);
  }, [persistToken]);

  const refreshProfile = useCallback(async () => fetchProfile(token), [fetchProfile, token]);

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
  }), [user, token, loading, error, login, register, requestCode, verifyCode, logout, refreshProfile]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
