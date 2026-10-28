// Navigation only: credentials must never be transported in a return URL.
const INTERNAL_ORIGIN = 'https://wadatrip.invalid';
const CREDENTIAL_KEYS = new Set(['auth_token', 'access_token', 'id_token', 'token', 'client_secret']);

export function safeAuthReturnPath(value, fallback = '/account') {
  if (typeof value !== 'string' || value.length > 2048 || !value.startsWith('/')
    || value.startsWith('//') || /[\\\u0000-\u0020\u007f]/.test(value)) return fallback;
  try {
    const url = new URL(value, INTERNAL_ORIGIN);
    if (url.origin !== INTERNAL_ORIGIN || url.pathname.startsWith('//')) return fallback;
    // Reject encoded separators/control characters as well as their nested forms.
    // Keep normal encoded spaces in query values (for example city names).
    let decoded = url.pathname;
    for (let depth = 0; depth < 4; depth++) {
      const next = decodeURIComponent(decoded);
      if (/[\\\u0000-\u0020\u007f]/.test(next)) return fallback;
      const canonical = new URL(next, INTERNAL_ORIGIN);
      if (canonical.origin !== INTERNAL_ORIGIN || canonical.pathname.startsWith('//')) return fallback;
      if (next === decoded) break;
      decoded = next;
      if (depth === 3) return fallback;
    }
    for (const key of [...url.searchParams.keys(), ...new URLSearchParams(url.hash.slice(1)).keys()]) {
      if (CREDENTIAL_KEYS.has(key.toLowerCase())) return fallback;
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
