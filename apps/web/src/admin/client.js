// Existing AuthContext owns identity. Second-factor proof exists in memory only.
export function createAdminClient({ getSession, getBase, onStepUp = () => {}, fetcher = (...args) => fetch(...args), now = Date.now }) {
  let proof = null
  const clear = () => { proof = null }
  const invalid = () => Object.assign(new Error('Inicia sesión de nuevo para administrar Wadatrip.'), { status: 401 })
  function setProof(token, sessionToken) {
    if (getSession()?.token !== sessionToken) throw invalid()
    let expires
    try { expires = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).exp * 1000 } catch { throw invalid() }
    if (!Number.isFinite(expires) || expires <= now()) throw invalid()
    proof = { token, sessionToken, expires }
    return expires
  }
  async function request(path, init = {}) {
    const session = getSession()
    if (session?.loading || !session?.user || !session.token) throw invalid()
    const check = () => { const latest = getSession(); if (latest?.loading || latest?.token !== session.token || latest?.user?.id !== session.user.id) throw invalid() }
    const headers = new Headers(init.headers || {})
    headers.delete('X-Admin-Proof')
    headers.set('Content-Type', 'application/json'); headers.set('Authorization', `Bearer ${session.token}`)
    if (proof?.sessionToken === session.token && proof.expires > now()) headers.set('X-Admin-Proof', proof.token)
    else if (proof) { clear(); onStepUp() }
    check()
    const response = await fetcher(`${getBase()}${path}`, { ...init, headers, signal: AbortSignal.timeout(15000) })
    check()
    const payload = await response.json().catch(() => null); check()
    if (response.status === 401) { clear(); session.logout(); throw invalid() }
    if (response.status === 403 && payload?.code === 'ADMIN_PRIMARY_REAUTH_REQUIRED') { clear(); session.logout() }
    if (response.status === 403 && payload?.code === 'ADMIN_STEP_UP_REQUIRED') { clear(); onStepUp() }
    if (!response.ok) throw Object.assign(new Error(payload?.message || 'No se pudo consultar la administración.'), { status: response.status })
    return payload
  }
  return { request, clear, setProof }
}
