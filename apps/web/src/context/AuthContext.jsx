import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppConfig } from '../config/appConfig';

const tokenStorageKey = 'wadatrip_token';

const AuthContext = createContext({
  user: null,
  token: null,
  loading: true,
  error: null,
  login: async () => {},
  register: async () => {},
  logout: () => {},
  refreshProfile: async () => {},
});

async function jsonRequest(path, options = {}) {
  const baseUrl = AppConfig.api.baseUrl?.replace(/\/$/, '') || '';
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    credentials: 'include',
    ...options,
  });
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
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(tokenStorageKey);
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

  const register = useCallback(async ({ email, password, name }) => {
    const payload = await jsonRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
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
    logout,
    refreshProfile,
  }), [user, token, loading, error, login, register, logout, refreshProfile]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
