import { AppConfig } from '../config/appConfig';

export async function communityRequest(path, { token, method = 'GET', body, signal } = {}) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) abort();
  const timeout = window.setTimeout(abort, 10000);
  try {
    const response = await fetch(`${(AppConfig.api.baseUrl || '').replace(/\/$/, '')}${path}`, {
      method, signal: controller.signal,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw Object.assign(new Error(typeof data?.message === 'string' && response.status < 500 ? data.message : 'Community is unavailable. Please try again.'), { status: response.status });
    if (!data || typeof data !== 'object') throw new Error('Community returned an invalid response. Please try again.');
    return data;
  } finally { window.clearTimeout(timeout); signal?.removeEventListener('abort', abort); }
}

export function destinationSearch({ country_code = '', city = '', region = '' } = {}, countryParam = 'country') {
  const q = new URLSearchParams();
  if (country_code) q.set(countryParam, country_code);
  if (city) q.set('city', city);
  if (region) q.set('region', region);
  return q.toString() ? `?${q}` : '';
}

export async function communityMessageKey(ref, payload, scope) {
  if (typeof scope !== 'string' || !scope) throw new Error('Sign in before preparing a message.');
  const fingerprint = JSON.stringify(payload);
  if (ref.current?.fingerprint === fingerprint && ref.current.scope === scope) return ref.current.pending;
  const record = { fingerprint, scope };
  record.pending = (async () => {
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(fingerprint));
    const digest = Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
    record.storageKey = `wadatrip:community-request:${scope}:${digest}`;
    const stored = sessionStorage.getItem(record.storageKey);
    record.id = /^[0-9a-f-]{36}$/i.test(stored || '') ? stored : crypto.randomUUID();
    // Persist only an opaque nonce, never the text, email or authentication token.
    sessionStorage.setItem(record.storageKey, record.id);
    return record.id;
  })();
  ref.current = record;
  return record.pending;
}

export function clearCommunityMessageKey(ref) {
  try { if (ref.current?.storageKey) sessionStorage.removeItem(ref.current.storageKey); } catch { /* A retained nonce still prevents a duplicate. */ }
  ref.current = null;
}
