import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAdmin } from './auth'
import { apiFetch } from './api'
import AuthDialog from '../components/AuthDialog.jsx'

export default function AdminLogin() {
  const admin = useAdmin()
  const [open, setOpen] = useState(false), [code, setCode] = useState(''), [setup, setSetup] = useState(null)
  const [error, setError] = useState(''), [busy, setBusy] = useState(false)
  if (!admin.ready) return <p className="p-6">Comprobando acceso…</p>
  if (admin.isAdmin && admin.verified) return <Navigate to="/admin/users" replace />
  const act = async callback => { setBusy(true); setError(''); try { await callback() } catch (err) { setError(err.message) } finally { setBusy(false) } }
  return <main className="min-h-screen bg-slate-50 p-6 text-slate-900"><section className="mx-auto max-w-lg space-y-4 rounded-2xl border bg-white p-6">
    <h1 className="text-2xl font-bold">Administración de Wadatrip</h1>
    <p>Usa tu cuenta de Wadatrip. Los permisos se verifican en el servidor.</p>
    {!admin.user ? <button className="rounded bg-teal-700 px-4 py-2 text-white" onClick={() => setOpen(true)}>Iniciar sesión</button> : !admin.isAdmin ? <>
      <p role="alert">{admin.error || 'Esta cuenta no tiene acceso administrativo.'}</p>
      <button className="rounded border p-2" onClick={admin.signOut}>Cerrar sesión y cambiar de cuenta</button>
      <button className="ml-2 rounded border p-2" onClick={admin.refresh}>Volver a comprobar</button>
    </> : <>
      <h2 className="font-semibold">Verificación con app autenticadora</h2>
      {!admin.enrolled && !setup && <button className="rounded border p-2" disabled={busy} onClick={() => act(async () => setSetup(await apiFetch('/admin/mfa/setup', { method: 'POST' })))}>Configurar segundo factor</button>}
      {setup && <div className="space-y-2 rounded border p-3">
        <p>Añade una cuenta manualmente en tu app autenticadora: nombre «Wadatrip», clave de configuración y códigos basados en tiempo.</p>
        <p className="break-all font-mono" aria-label="Clave de configuración">{setup.secret}</p>
        <p>No compartas esta clave. Al confirmar el primer código, desaparecerá de esta pantalla.</p>
      </div>}
      {(admin.enrolled || setup) && <form className="space-y-3" onSubmit={event => { event.preventDefault(); void act(async () => { await admin.verify(code); setSetup(null); setCode('') }) }}>
        <label htmlFor="admin-otp" className="block">Código de la app autenticadora</label>
        <input id="admin-otp" className="w-full rounded border p-2" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={event => setCode(event.target.value)} />
        <button className="rounded bg-teal-700 px-4 py-2 text-white" disabled={busy}>Verificar y entrar</button>
      </form>}
      <p className="text-sm">La verificación dura 15 minutos. Si pierdes tu autenticador, solicita recuperación administrativa; no se omite el segundo factor.</p>
      <button className="rounded border p-2" onClick={admin.signOut}>Cerrar sesión</button>
    </>}
    {error && <p role="alert">{error}</p>}
  </section><AuthDialog open={open} onClose={() => setOpen(false)} initialMode="login" /></main>
}
