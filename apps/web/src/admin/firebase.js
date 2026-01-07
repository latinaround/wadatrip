import { initializeApp, getApps } from 'firebase/app'
import { getAuth } from 'firebase/auth'

const cfg = {
  apiKey: import.meta.env.VITE_FB_API_KEY,
  authDomain: import.meta.env.VITE_FB_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FB_PROJECT_ID,
  appId: import.meta.env.VITE_FB_APP_ID,
}

let app
export function ensureFirebase() {
  if (!getApps().length) {
    try { app = initializeApp(cfg) } catch { /* noop */ }
  }
  return app
}

export function getFirebaseAuth() {
  ensureFirebase()
  return getAuth()
}

// Helper para login por email que evita import estático en Login.jsx
export async function signInEmail(email, password) {
  const auth = getFirebaseAuth()
  try {
    const mod = await import('firebase/auth')
    if (!mod?.signInWithEmailAndPassword) throw new Error('firebase/auth not available')
    return await mod.signInWithEmailAndPassword(auth, email, password)
  } catch (e) {
    throw new Error('Firebase SDK no instalado. Ejecuta: pnpm add firebase')
  }
}
