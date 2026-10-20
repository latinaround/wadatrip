import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext.jsx';
import { AppConfig } from '../config/appConfig';

const Context = createContext({ data: null, error: false, refresh: async () => {}, review: async () => {} });
const base = (AppConfig.api.baseUrl || '').replace(/\/$/, '');

export function OperatorInboxProvider({ children }) {
  const { user, token, logout } = useAuth();
  const userId = user?.id;
  const auth = useRef();
  auth.current = { userId, token };
  const requests = useRef(new Set());
  const sequence = useRef(0);
  const [snapshot, setSnapshot] = useState(null);
  const current = useCallback(identity => auth.current.userId === identity.userId && auth.current.token === identity.token, []);

  const request = useCallback(async (path, method = 'GET') => {
    const identity = { userId, token };
    if (!userId || !token) throw new Error('Sign in required');
    const controller = new AbortController();
    requests.current.add(controller);
    const timeout = window.setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(`${base}/operator/booking-inbox${path}`, {
        method, headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }, signal: controller.signal,
      });
      if (!current(identity)) throw new Error('Session changed');
      if (response.status === 401) logout();
      if (!response.ok) throw new Error('Could not update booking notifications');
      return await response.json();
    } finally {
      window.clearTimeout(timeout);
      requests.current.delete(controller);
    }
  }, [userId, token, logout, current]);

  const refresh = useCallback(async () => {
    const identity = { userId, token };
    if (!userId || !token) return;
    const order = ++sequence.current;
    try {
      const data = await request('');
      if (current(identity) && order === sequence.current) setSnapshot({ ...identity, data, error: false });
    } catch {
      if (current(identity) && order === sequence.current) setSnapshot({ ...identity, data: null, error: true });
    }
  }, [userId, token, request, current]);

  const review = useCallback(async id => {
    await request(`/${encodeURIComponent(id)}/review`, 'POST');
    await refresh();
  }, [request, refresh]);

  useEffect(() => {
    const controllers = requests.current;
    setSnapshot(null);
    refresh();
    const visibleRefresh = () => { if (document.visibilityState === 'visible') refresh(); };
    const interval = window.setInterval(visibleRefresh, 60000);
    window.addEventListener('focus', visibleRefresh);
    document.addEventListener('visibilitychange', visibleRefresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', visibleRefresh);
      document.removeEventListener('visibilitychange', visibleRefresh);
      controllers.forEach(controller => controller.abort());
      controllers.clear();
    };
  }, [refresh]);

  const state = snapshot && current(snapshot) ? snapshot : { data: null, error: false };
  return <Context.Provider value={{ data: state.data, error: state.error, refresh, review }}>{children}</Context.Provider>;
}

export const useOperatorInbox = () => useContext(Context);
