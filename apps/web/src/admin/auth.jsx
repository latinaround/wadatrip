import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { onAuthStateChanged, signOut as fbSignOut } from 'firebase/auth'
import { getFirebaseAuth } from './firebase'

const AdminContext = createContext({ user: null, isAdmin: false, ready: false })

const DEFAULT_WHITELIST = ['kiara@wadatrip.com']
const DEV_BYPASS = (import.meta?.env?.VITE_ADMIN_DEV_BYPASS || '').toString() === 'true'
const DEV_EMAIL = (import.meta?.env?.VITE_ADMIN_DEV_EMAIL || 'kiara@wadatrip.com')
function parseWhitelist() {
  const envList = import.meta.env.VITE_ADMIN_WHITELIST || ''
  const parts = envList.split(',').map(s => s.trim()).filter(Boolean)
  return parts.length ? parts : DEFAULT_WHITELIST
}

export function AdminProvider({ children }) {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)
  const whitelist = useMemo(parseWhitelist, [])

  useEffect(() => {
    if (DEV_BYPASS) {
      // Modo desarrollo: no requiere Firebase
      setUser({ email: DEV_EMAIL })
      setReady(true)
      return () => {}
    }
    const auth = getFirebaseAuth()
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u || null)
      setReady(true)
    })
    return unsub
  }, [])

  const isAdmin = useMemo(() => {
    const email = (user?.email || '').toLowerCase()
    return !!email && whitelist.map(e => e.toLowerCase()).includes(email)
  }, [user, whitelist])

  const value = useMemo(() => ({
    user,
    setUser,
    isAdmin,
    ready,
    signOut: () => DEV_BYPASS ? setUser(null) : fbSignOut(getFirebaseAuth())
  }), [user, isAdmin, ready])
  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>
}

export function useAdmin() { return useContext(AdminContext) }
