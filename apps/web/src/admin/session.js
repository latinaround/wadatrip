// The Firebase identity and its generation own the cached gateway session.
export function createAdminSession({ getAuth, exchange, now = Date.now }) {
  let cached = null
  let pending = null
  let generation = 0

  function clear() {
    generation += 1
    cached = null
    pending = null
  }

  async function token() {
    const auth = await getAuth()
    const user = auth?.currentUser
    if (!user?.uid) {
      clear()
      throw new Error('Admin sign-in is required')
    }
    if (cached?.user === user && cached.expiresAt > now() + 30000) return cached.token
    if (pending?.user === user) return pending.promise
    clear()
    const started = generation
    const promise = issueToken(auth, user, started)
    pending = { user, promise }
    try {
      return await promise
    } finally {
      if (pending?.promise === promise) pending = null
    }
  }

  async function issueToken(auth, user, started) {
    const firebaseToken = await user.getIdToken()
    if (auth.currentUser !== user || started !== generation) throw new Error('Admin session changed; retry')
    const gatewayToken = await exchange(firebaseToken)
    if (auth.currentUser !== user || started !== generation) throw new Error('Admin session changed; retry')
    let claims
    try {
      const payload = gatewayToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
      claims = JSON.parse(atob(payload))
    } catch {
      throw new Error('Invalid admin session')
    }
    const expiresAt = Number(claims.exp) * 1000
    if (!Number.isFinite(expiresAt) || expiresAt <= now() + 30000) throw new Error('Admin session has expired')
    cached = { user, token: gatewayToken, expiresAt }
    return gatewayToken
  }

  // Recheck identity after awaits, immediately before issuing the authenticated request.
  async function assertCurrent(tokenValue) {
    const auth = await getAuth()
    if (!cached || cached.token !== tokenValue || cached.user !== auth?.currentUser || cached.expiresAt <= now()) {
      throw new Error('Admin session changed; retry')
    }
  }

  return { token, clear, assertCurrent }
}
