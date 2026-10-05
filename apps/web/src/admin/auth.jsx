import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { apiFetch, configureAdminClient, clearAdminSession, setAdminProof } from './api'

const AdminContext = createContext({ user: null, isAdmin: false, ready: false })
export function AdminProvider({ children }) {
  const auth = useAuth(), authRef = useRef(auth); authRef.current = auth
  const accessOwner = useRef(null)
  const [access, setAccess] = useState(null), [ready, setReady] = useState(false), [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const [proofExpiry, setProofExpiry] = useState(null)
  useEffect(() => { configureAdminClient(() => authRef.current); return () => configureAdminClient(null) }, [])
  useEffect(() => { clearAdminSession(); setProofExpiry(null); setAccess(null); setReady(false); setError('') }, [auth.user?.id, auth.token])
  useEffect(() => {
    if (!proofExpiry) return
    const timer = window.setTimeout(() => { clearAdminSession(); setAccess(null); setRevision(value => value + 1) }, Math.max(0, proofExpiry - Date.now()))
    return () => window.clearTimeout(timer)
  }, [proofExpiry])
  useEffect(() => {
    let active = true
    if (auth.loading) return
    if (!auth.user || !auth.token) { setReady(true); return }
    setReady(false)
    apiFetch('/admin/session').then(data => { if (active) { accessOwner.current = { id: auth.user.id, token: auth.token }; setAccess(data); setError('') } })
      .catch(err => { if (active) { accessOwner.current = { id: auth.user.id, token: auth.token }; setAccess(null); setError(err.status === 403 ? 'Esta cuenta no tiene permiso de administración.' : err.message) } })
      .finally(() => { if (active) setReady(true) })
    return () => { active = false }
  }, [auth.user?.id, auth.token, auth.loading, revision])
  useEffect(() => {
    const expired = () => { setAccess(previous => previous ? { ...previous, step_up_verified: false } : previous); setRevision(value => value + 1) }
    window.addEventListener('wadatrip:admin-step-up', expired)
    return () => window.removeEventListener('wadatrip:admin-step-up', expired)
  }, [])
  const refresh = () => setRevision(value => value + 1)
  const currentOwner = accessOwner.current?.id === auth.user?.id && accessOwner.current?.token === auth.token
  return <AdminContext.Provider value={{ user: auth.user, ready: ready && !auth.loading && (!auth.user || currentOwner), isAdmin: currentOwner && Boolean(access?.admin),
    verified: currentOwner && Boolean(access?.step_up_verified), enrolled: currentOwner && Boolean(access?.mfa_enrolled), error, refresh,
    verify: async code => { const base = authRef.current.token; const result = await apiFetch('/admin/mfa/verify', { method: 'POST', body: JSON.stringify({ code }) }); setProofExpiry(setAdminProof(result.proof, base)); refresh() },
    signOut: () => { clearAdminSession(); auth.logout() } }}>{children}</AdminContext.Provider>
}
export function useAdmin() { return useContext(AdminContext) }
