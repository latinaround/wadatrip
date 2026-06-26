import { initializeApp, getApps } from 'firebase/app'

const cfg = {
  apiKey: import.meta.env.VITE_FB_API_KEY,
  authDomain: import.meta.env.VITE_FB_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FB_PROJECT_ID,
  appId: import.meta.env.VITE_FB_APP_ID,
}

let app
function hasFirebaseConfig() {
  return Boolean(cfg.apiKey && cfg.authDomain && cfg.projectId && cfg.appId)
}

export function ensureFirebase() {
  if (!hasFirebaseConfig()) {
    throw new Error('Firebase admin auth is not configured.')
  }
  if (!getApps().length) {
    app = initializeApp(cfg)
  }
  return app || getApps()[0]
}

export async function getFirebaseAuth() {
  const firebaseApp = ensureFirebase()
  let mod
  try {
    mod = await import('firebase/auth')
  } catch {
    throw new Error('Firebase SDK is missing from this build.')
  }
  if (!mod?.getAuth) throw new Error('firebase/auth not available')
  return mod.getAuth(firebaseApp)
}

// Helper para login por email que evita import estático en Login.jsx
export async function signInEmail(email, password) {
  try {
    const auth = await getFirebaseAuth()
    const mod = await import('firebase/auth')
    if (!mod?.signInWithEmailAndPassword) throw new Error('firebase/auth not available')
    return await mod.signInWithEmailAndPassword(auth, email, password)
  } catch (e) {
    const code = String(e?.code || '')
    if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
      throw new Error('Invalid admin email or password.')
    }
    if (code === 'auth/too-many-requests') {
      throw new Error('Too many sign-in attempts. Try again in a few minutes.')
    }
    if (e instanceof Error) {
      throw e
    }
    throw new Error('Admin sign-in failed.')
  }
}
