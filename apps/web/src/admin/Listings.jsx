import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { apiFetch } from './api'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { COUNTRY_OPTIONS, normalizeCountryCode } from '@/utils/geoOptions'

export default function ListingsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Filters & pagination
  const [q, setQ] = useState(searchParams.get('q') || '') // title contains
  const [city, setCity] = useState(searchParams.get('city') || '')
  const [country, setCountry] = useState(searchParams.get('country') || '')
  const [category, setCategory] = useState(searchParams.get('category') || '')
  const [status, setStatus] = useState(searchParams.get('status') || '')
  const [sort, setSort] = useState('created_at:desc') // created_at:desc|asc, price:asc|desc
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [total, setTotal] = useState(0)
  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total, limit])

  const load = async () => {
    setLoading(true); setError('')
    try {
      const params = new URLSearchParams()
      params.set('limit', String(limit))
      params.set('page', String(page))
      params.set('all', 'true')
      params.set('sort', sort)
      if (q) params.set('q', q)
      if (city) params.set('city', city)
      if (country) params.set('country', normalizeCountryCode(country))
      if (category) params.set('category', category)
      if (status) params.set('status', status)
      setSearchParams(params, { replace: true })
      const res = await apiFetch(`/listings/search?${params.toString()}`)
      setRows(res?.items || [])
      setTotal(res?.total || 0)
    } catch (e) { setError(e.message || 'Failed to load') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [page, limit, sort])

  const toggleStatus = async (row) => {
    const next = row.status === 'published' ? 'inactive' : 'published'
    await apiFetch(`/listings/${encodeURIComponent(row.id)}/status`, { method: 'POST', body: JSON.stringify({ status: next }) })
    await load()
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-extrabold text-teal-700 mb-2">Tour Reviews</h1>
      <p className="mb-4 max-w-3xl text-sm text-gray-600">
        Use this screen to review draft tours, confirm the linked guide status, and activate published listings.
      </p>
      <div className="mb-4 flex flex-wrap gap-2">
        <Button variant={!status ? 'default' : 'outline'} size="sm" onClick={() => { setStatus(''); setPage(1); }}>
          All tours
        </Button>
        <Button variant={status === 'draft' ? 'default' : 'outline'} size="sm" onClick={() => { setStatus('draft'); setPage(1); }}>
          Draft tours
        </Button>
        <Button variant={status === 'published' ? 'default' : 'outline'} size="sm" onClick={() => { setStatus('published'); setPage(1); }}>
          Published tours
        </Button>
        <Button variant={status === 'inactive' ? 'default' : 'outline'} size="sm" onClick={() => { setStatus('inactive'); setPage(1); }}>
          Inactive tours
        </Button>
      </div>
      <div className="flex flex-wrap items-end gap-2 mb-3">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs text-gray-600">Search title</label>
          <input className="w-full border rounded px-2 py-1" placeholder="title contains" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-gray-600">City</label>
          <input className="border rounded px-2 py-1" value={city} onChange={(e) => setCity(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-gray-600">Country</label>
          <div className="mt-1 min-w-[170px]">
            <Select value={normalizeCountryCode(country) || 'all'} onValueChange={(value) => setCountry(value === 'all' ? '' : value)}>
              <SelectTrigger className="h-9 w-full">
                <SelectValue placeholder="All countries" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All countries</SelectItem>
                {COUNTRY_OPTIONS.map((item) => (
                  <SelectItem key={item.code} value={item.code}>
                    {item.label} ({item.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <label className="block text-xs text-gray-600">Category</label>
          <select className="border rounded px-2 py-1" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All</option>
            <option value="tour">tour</option>
            <option value="activity">activity</option>
            <option value="transfer">transfer</option>
            <option value="custom">custom</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-600">Status</label>
          <select className="border rounded px-2 py-1" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All</option>
            <option value="published">published</option>
            <option value="inactive">inactive</option>
            <option value="draft">draft</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-600">Sort</label>
          <select className="border rounded px-2 py-1" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="created_at:desc">Newest</option>
            <option value="created_at:asc">Oldest</option>
            <option value="price:asc">Price ↑</option>
            <option value="price:desc">Price ↓</option>
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
              <th className="px-3 py-2">Provider ID</th>
              <th className="px-3 py-2">Guide status</th>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">City</th>
              <th className="px-3 py-2">Price from</th>
              <th className="px-3 py-2">Currency</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Dates</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="px-3 py-3" colSpan={10}>Loading…</td></tr>
            ) : rows.length ? rows.map((l) => (
              <tr key={l.id} className="border-t">
                <td className="px-3 py-2 font-mono text-xs">{l.id}</td>
                <td className="px-3 py-2 font-mono text-xs">{l.provider_id}</td>
                <td className="px-3 py-2">
                  <span className={`rounded px-2 py-1 text-xs font-semibold capitalize ${
                    String(l.provider_status || '').toLowerCase() === 'verified'
                      ? 'bg-green-100 text-green-800'
                      : String(l.provider_status || '').toLowerCase() === 'rejected'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {l.provider_status || 'pending'}
                  </span>
                </td>
                <td className="px-3 py-2">{l.title}</td>
                <td className="px-3 py-2">{l.city}</td>
                <td className="px-3 py-2">{l.price_from ?? '-'}</td>
                <td className="px-3 py-2">{l.currency}</td>
                <td className="px-3 py-2">{l.status}</td>
                <td className="px-3 py-2">{l.start_date ? new Date(l.start_date).toLocaleDateString() : '-'} — {l.end_date ? new Date(l.end_date).toLocaleDateString() : '-'}</td>
                <td className="px-3 py-2">
                  <Button size="sm" variant={l.status === 'published' ? 'destructive' : 'default'} onClick={() => toggleStatus(l)}>
                    {l.status === 'published' ? 'Deactivate' : 'Activate'}
                  </Button>
                </td>
              </tr>
            )) : (
              <tr><td className="px-3 py-3" colSpan={10}>No listings found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between mt-3 text-sm">
        <div>Page {page} of {totalPages} · {total} results</div>
        <div className="space-x-2">
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p-1))} disabled={page<=1}>Prev</Button>
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page>=totalPages}>Next</Button>
        </div>
      </div>
    </div>
  )
}
