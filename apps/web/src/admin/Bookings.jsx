import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from './api'
import { Button } from '@/components/ui/button'

function StatusBadge({ status }) {
  const map = { pending: 'bg-yellow-100 text-yellow-800', confirmed: 'bg-green-100 text-green-800', cancelled: 'bg-red-100 text-red-700', completed: 'bg-gray-200 text-gray-800' }
  return <span className={`px-2 py-1 rounded text-xs font-semibold ${map[status] || 'bg-gray-100 text-gray-800'}`}>{status}</span>
}

export default function BookingsPage() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null)

  // Filters & pagination
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [total, setTotal] = useState(0)
  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total, limit])

  const load = async () => {
    setLoading(true); setError('')
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', String(limit))
      if (q) params.set('q', q)
      if (status) params.set('status', status)
      const res = await apiFetch(`/bookings?${params.toString()}`)
      setRows(res?.items || [])
      setTotal(res?.total || 0)
    } catch (e) { setError(e.message || 'Failed to load') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [page, limit])

  const setBookingStatus = async (row, next) => {
    await apiFetch(`/bookings/${encodeURIComponent(row.id)}/status`, { method: 'POST', body: JSON.stringify({ status: next }) })
    await load()
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-extrabold text-teal-700 mb-4">Bookings</h1>
      <div className="flex flex-wrap items-end gap-2 mb-3">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs text-gray-600">Search</label>
          <input className="w-full border rounded px-2 py-1" placeholder="tour/provider" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-gray-600">Status</label>
          <select className="border rounded px-2 py-1" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All</option>
            <option value="pending">pending</option>
            <option value="confirmed">confirmed</option>
            <option value="cancelled">cancelled</option>
            <option value="completed">completed</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-600">Page size</label>
          <select className="border rounded px-2 py-1" value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
            {[10,20,50,100].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <Button onClick={() => { setPage(1); load() }}>Apply</Button>
      </div>

      {error && <div className="text-red-600 mb-2">{error}</div>}
      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">Tour</th>
              <th className="px-3 py-2">Provider</th>
              <th className="px-3 py-2">User</th>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">People</th>
              <th className="px-3 py-2">Total</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Payment</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="px-3 py-3" colSpan={10}>Loading…</td></tr>
            ) : rows.length ? rows.map((b) => (
              <tr key={b.id} className="border-t">
                <td className="px-3 py-2 font-mono text-xs">{b.id}</td>
                <td className="px-3 py-2">{b.listing?.title || '-'}</td>
                <td className="px-3 py-2">{b.provider?.name || '-'}</td>
                <td className="px-3 py-2">{b.user?.email || b.user_id}</td>
                <td className="px-3 py-2">{new Date(b.date).toLocaleString()}</td>
                <td className="px-3 py-2">{b.num_people}</td>
                <td className="px-3 py-2">{b.total_price ?? '-'}</td>
                <td className="px-3 py-2"><StatusBadge status={b.status} /></td>
                <td className="px-3 py-2">{b.payment_status || '-'}</td>
                <td className="px-3 py-2 space-x-2">
                  <Button size="sm" variant="outline" onClick={() => setSelected(b)}>View</Button>
                  {b.status !== 'cancelled' && <Button size="sm" variant="destructive" onClick={() => setBookingStatus(b, 'cancelled')}>Cancel</Button>}
                  {b.status !== 'completed' && <Button size="sm" onClick={() => setBookingStatus(b, 'completed')}>Complete</Button>}
                </td>
              </tr>
            )) : (
              <tr><td className="px-3 py-3" colSpan={10}>No bookings found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-lg border max-w-2xl w-full p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold">Booking Details</h2>
              <Button variant="ghost" onClick={() => setSelected(null)}>Close</Button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><span className="font-medium">ID:</span> {selected.id}</div>
              <div><span className="font-medium">Status:</span> {selected.status}</div>
              <div><span className="font-medium">Payment:</span> {selected.payment_status || '-'}</div>
              <div><span className="font-medium">Date:</span> {new Date(selected.date).toLocaleString()}</div>
              <div><span className="font-medium">People:</span> {selected.num_people}</div>
              <div><span className="font-medium">Total:</span> {selected.total_price ?? '-'}</div>
              <div className="col-span-2"><span className="font-medium">Tour:</span> {selected.listing?.title || '-'}</div>
              <div className="col-span-2"><span className="font-medium">Provider:</span> {selected.provider?.name || '-'}</div>
              <div className="col-span-2"><span className="font-medium">User:</span> {selected.user?.email || selected.user_id}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

