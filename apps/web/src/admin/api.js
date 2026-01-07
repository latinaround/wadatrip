export function getApiBase() {
  const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'
  return base.replace(/\/$/, '')
}

async function getIdToken() {
  try {
    const { getFirebaseAuth } = await import('./firebase')
    const auth = getFirebaseAuth()
    const user = auth?.currentUser
    if (user && user.getIdToken) return await user.getIdToken()
  } catch {}
  return undefined
}

export async function apiFetch(path, init = {}) {
  const base = getApiBase()
  const headers = new Headers(init.headers || {})
  headers.set('Content-Type', 'application/json')
  const token = await getIdToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const res = await fetch(`${base}${path}`, { ...init, headers })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status}: ${text}`)
  }
  return res.json()
}

