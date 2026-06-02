import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { apiFetch, getApiBase } from './api'

const presetCities = [
  { city: 'Cusco', country: 'Peru', label: 'Cusco' },
  { city: 'Lima', country: 'Peru', label: 'Lima' },
  { city: 'Medellin', country: 'Colombia', label: 'Medellin' },
  { city: 'Ciudad de Mexico', country: 'Mexico', label: 'Ciudad de México' },
  { city: 'Bangkok', country: 'Thailand', label: 'Bangkok' },
  { city: 'Paris', country: 'France', label: 'París' },
  { city: 'Roma', country: 'Italy', label: 'Roma' },
  { city: 'Tokio', country: 'Japan', label: 'Tokio' },
]

function ExternalLink({ href, children }) {
  if (!href) return <span className="text-gray-400">-</span>
  return <a className="text-teal-700 hover:underline" href={href} target="_blank" rel="noreferrer">{children}</a>
}

export default function OperatorLeadsPage() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const [city, setCity] = useState('Cusco')
  const [country, setCountry] = useState('Peru')
  const [filterCity, setFilterCity] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterRating, setFilterRating] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(50)
  const [total, setTotal] = useState(0)

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total, limit])

  const load = async (overrides = {}) => {
    setLoading(true)
    setError('')
    try {
      const effective = {
        city: filterCity,
        category: filterCategory,
        rating: filterRating,
        lead_status: filterStatus,
        page,
        limit,
        ...overrides,
      }
      const params = new URLSearchParams()
      params.set('page', String(effective.page))
      params.set('limit', String(effective.limit))
      params.set('sort', 'created_at:desc')
      if (effective.city) params.set('city', effective.city)
      if (effective.category) params.set('category', effective.category)
      if (effective.rating) params.set('rating', effective.rating)
      if (effective.lead_status) params.set('lead_status', effective.lead_status)
      const response = await apiFetch(`/operator-leads?${params.toString()}`)
      setRows(response?.items || [])
      setTotal(response?.total || 0)
    } catch (e) {
      setError(e?.message || 'Failed to load operator leads')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [page, limit])

  const runSearch = async () => {
    setSearching(true)
    setError('')
    setMessage('')
    try {
      const response = await apiFetch('/operator-leads/search', {
        method: 'POST',
        body: JSON.stringify({ city, country }),
      })
      setMessage(`Imported ${response?.total || 0} leads for ${city}. Inserted: ${response?.inserted || 0}, updated: ${response?.updated || 0}.`)
      setFilterCity(city)
      setPage(1)
      await load({ city, page: 1 })
    } catch (e) {
      setError(e?.message || 'Failed to search leads')
    } finally {
      setSearching(false)
    }
  }

  const exportCsv = () => {
    const params = new URLSearchParams()
    if (filterCity) params.set('city', filterCity)
    if (filterCategory) params.set('category', filterCategory)
    if (filterRating) params.set('rating', filterRating)
    if (filterStatus) params.set('lead_status', filterStatus)
    window.open(`${getApiBase()}/operator-leads/export?${params.toString()}`, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-teal-700">Operator Leads</h1>
        <p className="text-sm text-gray-600 mt-1">
          Build a real operator database by city using Outscraper and keep it ready for WadAgent enrichment.
        </p>
      </div>

      <div className="bg-white border rounded-lg p-4 space-y-4">
        <div className="flex flex-wrap gap-2">
          {presetCities.map((preset) => (
            <Button
              key={`${preset.city}-${preset.country}`}
              variant="outline"
              size="sm"
              onClick={() => {
                setCity(preset.city)
                setCountry(preset.country)
              }}
            >
              {preset.label}
            </Button>
          ))}
        </div>

        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <div>
            <label className="block text-xs text-gray-600">City</label>
            <input className="w-full border rounded px-3 py-2" value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-gray-600">Country</label>
            <input className="w-full border rounded px-3 py-2" value={country} onChange={(e) => setCountry(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button onClick={runSearch} disabled={searching || !city || !country}>
              {searching ? 'Searching…' : 'Search operators'}
            </Button>
          </div>
        </div>

        <div className="text-xs text-gray-500">
          This runs queries like `tour operator`, `walking tour`, `free walking tour`, and `local guide` for the selected city.
        </div>
        {message && <div className="text-sm text-teal-700">{message}</div>}
        {error && <div className="text-sm text-red-600">{error}</div>}
      </div>

      <div className="bg-white border rounded-lg p-4">
        <div className="flex flex-wrap items-end gap-2 mb-4">
          <div>
            <label className="block text-xs text-gray-600">Filter city</label>
            <input className="border rounded px-2 py-1" value={filterCity} onChange={(e) => setFilterCity(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-gray-600">Category</label>
            <input className="border rounded px-2 py-1" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-gray-600">Min rating</label>
            <input className="border rounded px-2 py-1" value={filterRating} onChange={(e) => setFilterRating(e.target.value)} placeholder="4.0" />
          </div>
          <div>
            <label className="block text-xs text-gray-600">Lead status</label>
            <select className="border rounded px-2 py-1" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="">All</option>
              <option value="new">new</option>
              <option value="contacted">contacted</option>
              <option value="qualified">qualified</option>
              <option value="rejected">rejected</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-600">Page size</label>
            <select className="border rounded px-2 py-1" value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
              {[25, 50, 100, 200].map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </div>
          <Button variant="outline" onClick={() => { setPage(1); load() }}>Apply filters</Button>
          <Button variant="outline" onClick={exportCsv}>Export CSV</Button>
        </div>

        <div className="overflow-x-auto border rounded-lg">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">City</th>
                <th className="px-3 py-2">Rating</th>
                <th className="px-3 py-2">Reviews</th>
                <th className="px-3 py-2">Website</th>
                <th className="px-3 py-2">Phone</th>
                <th className="px-3 py-2">Lead status</th>
                <th className="px-3 py-2">Source query</th>
                <th className="px-3 py-2">Created</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td className="px-3 py-3" colSpan={10}>Loading…</td></tr>
              ) : rows.length ? rows.map((row) => (
                <tr key={row.id} className="border-t align-top">
                  <td className="px-3 py-2">
                    <div className="font-semibold text-gray-900">{row.name}</div>
                    <div className="text-xs text-gray-500">{row.address || '-'}</div>
                  </td>
                  <td className="px-3 py-2">{row.category || '-'}</td>
                  <td className="px-3 py-2">{row.city}, {row.country}</td>
                  <td className="px-3 py-2">{row.rating ?? '-'}</td>
                  <td className="px-3 py-2">{row.reviews_count ?? 0}</td>
                  <td className="px-3 py-2 max-w-[220px] truncate">
                    <ExternalLink href={row.website}>{row.website || 'Visit'}</ExternalLink>
                  </td>
                  <td className="px-3 py-2">{row.phone || '-'}</td>
                  <td className="px-3 py-2">{row.lead_status}</td>
                  <td className="px-3 py-2 text-xs text-gray-600">{row.source_query}</td>
                  <td className="px-3 py-2 text-xs text-gray-600">{row.created_at ? new Date(row.created_at).toLocaleString() : '-'}</td>
                </tr>
              )) : (
                <tr><td className="px-3 py-3" colSpan={10}>No leads found.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between mt-3 text-sm">
          <div>Page {page} of {totalPages} · {total} results</div>
          <div className="space-x-2">
            <Button variant="outline" size="sm" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1}>Prev</Button>
            <Button variant="outline" size="sm" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={page >= totalPages}>Next</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
