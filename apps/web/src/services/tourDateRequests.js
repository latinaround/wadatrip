// AuthContext is the only session source. Never trust request identity from the browser.
export async function dateRequestApi({ apiBase, getSession, path = '', method = 'GET', body }) {
  const session = getSession();
  const invalid = () => Object.assign(new Error('Please sign in again to manage date requests.'), { status: 401 });
  const assertSession = () => {
    const current = getSession();
    if (current.loading || !current.user || !current.token || current.user.id !== session.user?.id || current.token !== session.token) throw invalid();
    return current;
  };
  assertSession();
  const response = await fetch(`${apiBase}/tour-date-requests${path}`, {
    method, headers: { Authorization: `Bearer ${session.token}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(10000),
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const current = assertSession();
  if (response.status === 401) { current.logout(); throw invalid(); }
  const payload = await response.json().catch(() => null);
  assertSession();
  if (!response.ok) throw Object.assign(new Error(payload?.message || 'Could not save or load the date request.'), { status: response.status });
  return payload;
}
