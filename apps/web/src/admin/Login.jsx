import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signInEmail } from './firebase'
import { useAdmin } from './auth'
import { Button } from '@/components/ui/button'

export default function AdminLogin() {
  const navigate = useNavigate()
  const { user, isAdmin, ready } = useAdmin()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (ready && user && isAdmin) navigate('/admin/providers', { replace: true })
  }, [ready, user, isAdmin])

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signInEmail(email.trim(), password)
      // redirect handled by effect
    } catch (e) {
      setError(e?.message || 'Login failed')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <form onSubmit={onSubmit} className="w-full max-w-sm bg-white border rounded-lg p-6 shadow-sm">
        <h1 className="text-xl font-extrabold text-teal-700 mb-4">Admin Login</h1>
        <label className="block text-sm font-medium text-gray-700">Email</label>
        <input className="mt-1 w-full border rounded px-3 py-2" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@wadatrip.com" />
        <label className="block text-sm font-medium text-gray-700 mt-3">Password</label>
        <input className="mt-1 w-full border rounded px-3 py-2" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
        {error && (<div className="text-red-600 text-sm mt-3">{error}</div>)}
        <Button className="w-full mt-4" type="submit" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</Button>
      </form>
    </div>
  )
}
