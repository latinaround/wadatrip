export function allowedWebOrigins(env: Record<string, string | undefined>) {
  const origins = new Set(['https://wadatrip.com', 'https://www.wadatrip.com']);
  for (const value of String(env.WEB_ALLOWED_ORIGINS || '').split(',').map(v => v.trim()).filter(Boolean)) {
    let parsed: URL;
    try { parsed = new URL(value); } catch { throw Error('Invalid explicit web origin configuration'); }
    if (parsed.protocol !== 'https:' || parsed.origin !== value || parsed.username || parsed.password || value.includes('*')) {
      throw Error('Invalid explicit web origin configuration');
    }
    origins.add(value);
  }
  return (origin: string) => {
    if (origins.has(origin)) return true;
    if (env.NODE_ENV === 'production') return false;
    try {
      const parsed = new URL(origin);
      return parsed.protocol === 'http:' && parsed.origin === origin && ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
    } catch { return false; }
  };
}
