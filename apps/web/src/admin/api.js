import { getFirebaseAuth } from './firebase'
import { createAdminSession } from './session'

export function getApiBase() {
  const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'
  return base.replace(/\/$/, '')
}

async function exchangeToken(firebaseToken) {
  const response = await fetch(`${getApiBase()}/auth/firebase`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken: firebaseToken }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok || !data?.token) {
    throw new Error(data?.message || 'Admin session could not be verified')
  }
  return data.token
}

const session = createAdminSession({ getAuth: getFirebaseAuth, exchange: exchangeToken })
export const clearAdminSession = session.clear

export async function apiFetch(path, init = {}) {
  const base = getApiBase()
  const headers = new Headers(init.headers || {})
  headers.set('Content-Type', 'application/json')
  const token = await session.token()
  headers.set('Authorization', `Bearer ${token}`)
  await session.assertCurrent(token)
  const res = await fetch(`${base}${path}`, { ...init, headers })
  if (res.status === 401) session.clear()
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status}: ${text}`)
  }
  const data = await res.json()
  await session.assertCurrent(token)
  return data
}
