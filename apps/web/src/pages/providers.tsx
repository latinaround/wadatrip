import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { apiFetch } from '@/admin/api'

type ProviderStatus = 'pending' | 'verified' | 'rejected' | string
type ProviderStatusFilter = '' | ProviderStatus

interface ProviderDocument {
  id: string
  url: string
  doc_type?: string | null
}

interface ProviderRow {
  id: string
  name: string
  email: string
  phone?: string | null
  instagram_handle?: string | null
  base_city?: string | null
  country_code?: string | null
  status: ProviderStatus
  created_at: string
  type?: string | null
  photo_url?: string | null
  bio_short?: string | null
  ratings_avg?: number | null
  ratings_count?: number | null
  documents?: ProviderDocument[]
}

interface ProvidersResponse {
  items?: ProviderRow[]
  total?: number
}

function StatusBadge({ status }: { status: ProviderStatus }) {
  const color =
    status === 'verified'
      ? 'bg-green-100 text-green-800'
      : status === 'rejected'
        ? 'bg-red-100 text-red-700'
        : 'bg-yellow-100 text-yellow-800'

  return <span className={`px-2 py-1 rounded text-xs font-semibold capitalize ${color}`}>{status}</span>
}

export default function ProvidersPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [rows, setRows] = useState<ProviderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<ProviderRow | null>(null)

  const initialQ = searchParams.get('q') || ''
  const initialStatus = (searchParams.get('status') || '') as ProviderStatusFilter
  const [q, setQ] = useState(initialQ)
  const [status, setStatus] = useState<ProviderStatusFilter>(initialStatus) // '', pending, verified, rejected
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [total, setTotal] = useState(0)
  const [filters, setFilters] = useState<{ q: string; status: ProviderStatusFilter }>({
    q: initialQ,
    status: initialStatus,
  })

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total, limit])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', String(limit))
      if (filters.q) params.set('q', filters.q)
      if (filters.status) params.set('status', filters.status)

      const response = (await apiFetch(`/providers?${params.toString()}`)) as ProvidersResponse
      const items = Array.isArray(response?.items) ? (response.items as ProviderRow[]) : []
      setRows(items)
      setTotal(typeof response?.total === 'number' ? response.total : items.length)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load providers')
    } finally {
      setLoading(false)
    }
  }, [filters.q, filters.status, limit, page])

  useEffect(() => {
    void load()
  }, [load])

  const changeStatus = useCallback(
    async (id: string, nextStatus: ProviderStatus) => {
      try {
        await apiFetch(`/providers/${encodeURIComponent(id)}/verify`, {
          method: 'POST',
          body: JSON.stringify({ status: nextStatus }),
        })
        await load()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to update status')
      }
    },
    [load],
  )

  const applyFilters = () => {
    setPage(1)
    setFilters({ q, status })
    const next = new URLSearchParams()
    if (q) next.set('q', q)
    if (status) next.set('status', status)
    setSearchParams(next, { replace: true })
  }

  const setQuickStatus = (nextStatus: ProviderStatusFilter) => {
    setStatus(nextStatus)
    setPage(1)
    setFilters({ q, status: nextStatus })
    const next = new URLSearchParams()
    if (q) next.set('q', q)
    if (nextStatus) next.set('status', nextStatus)
    setSearchParams(next, { replace: true })
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-extrabold text-teal-700 mb-2">Guide Approvals</h1>
      <p className="mb-4 max-w-3xl text-sm text-[#a0a0a0]">
        Approve the guide here first. After approval, review or activate their tours in <span className="font-medium text-white">Admin → Listings</span>.
      </p>
      <div className="mb-4 flex flex-wrap gap-2">
        <Button variant={!filters.status ? 'default' : 'outline'} size="sm" onClick={() => setQuickStatus('')}>
          All guides
        </Button>
        <Button variant={filters.status === 'pending' ? 'default' : 'outline'} size="sm" onClick={() => setQuickStatus('pending')}>
          Pending approvals
        </Button>
        <Button variant={filters.status === 'verified' ? 'default' : 'outline'} size="sm" onClick={() => setQuickStatus('verified')}>
          Verified
        </Button>
        <Button variant={filters.status === 'rejected' ? 'default' : 'outline'} size="sm" onClick={() => setQuickStatus('rejected')}>
          Rejected
        </Button>
      </div>
      <div className="flex flex-wrap items-end gap-2 mb-3">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs text-[#a0a0a0]">Search</label>
          <input
            className="w-full border rounded px-2 py-1"
            placeholder="name, email, city"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs text-[#a0a0a0]">Status</label>
          <select
            className="border rounded px-2 py-1"
            value={status}
            onChange={(e) => setStatus(e.target.value as ProviderStatusFilter)}
          >
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="verified">Verified</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-[#a0a0a0]">Page size</label>
          <select
            className="border rounded px-2 py-1"
            value={limit}
            onChange={(e) => {
              const parsed = Number(e.target.value)
              setLimit(Number.isFinite(parsed) && parsed > 0 ? parsed : 20)
            }}
          >
            {[10, 20, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <Button onClick={applyFilters}>Apply</Button>
      </div>
      {error && <div className="text-red-600 mb-2">{error}</div>}
      <div className="bg-[#1a1f3a] border rounded-lg overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-[#0a0e27] text-left">
            <tr>
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">Guide</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">City</th>
              <th className="px-3 py-2">Country</th>
              <th className="px-3 py-2">Rating</th>
              <th className="px-3 py-2">Contact</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Created</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-3 py-3" colSpan={10}>
                  Loading
                </td>
              </tr>
            ) : rows.length ? (
              rows.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="px-3 py-2 font-mono text-xs">{p.id}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-3">
                      {p.photo_url ? (
                        <img src={p.photo_url} alt={p.name} className="h-10 w-10 rounded-xl object-cover border" />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-100 text-xs font-bold text-teal-700">
                          {String(p.name || 'G').slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="font-medium">{p.name}</div>
                        {p.type ? <div className="text-xs text-[#a0a0a0] capitalize">{p.type}</div> : null}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2">{p.email}</td>
                  <td className="px-3 py-2">{p.base_city}</td>
                  <td className="px-3 py-2">{p.country_code}</td>
                  <td className="px-3 py-2">
                    {p.ratings_avg ? (
                      <div className="font-medium text-white">
                        {Number(p.ratings_avg).toFixed(1)}★
                        <div className="text-xs text-[#a0a0a0]">{Number(p.ratings_count || 0)} reviews</div>
                      </div>
                    ) : (
                      <span className="text-xs text-[#a0a0a0]">No ratings yet</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="space-y-1 text-xs">
                      {p.phone ? <div>{p.phone}</div> : null}
                      {p.instagram_handle ? <div className="text-[#7dd3fc]">@{p.instagram_handle}</div> : null}
                      {!p.phone && !p.instagram_handle ? <span className="text-[#a0a0a0]">No contact</span> : null}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="px-3 py-2">
                    {p.created_at ? new Date(p.created_at).toLocaleString() : ''}
                  </td>
                  <td className="px-3 py-2 space-x-2">
                    <Button variant="outline" size="sm" onClick={() => setSelected(p)}>
                      View
                    </Button>
                    <Button size="sm" onClick={() => changeStatus(p.id, 'verified')}>
                      Approve
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => changeStatus(p.id, 'rejected')}>
                      Reject
                    </Button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-3 py-3" colSpan={10}>
                  No providers found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between mt-3 text-sm">
        <div>
          Page {page} of {totalPages}  {total} results
        </div>
        <div className="space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={page <= 1}
          >
            Prev
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={page >= totalPages}
          >
            Next
          </Button>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-[#1a1f3a] rounded-lg border max-w-2xl w-full p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold">Provider Details</h2>
              <Button variant="ghost" onClick={() => setSelected(null)}>Close</Button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><span className="font-medium">ID:</span> {selected.id}</div>
              <div><span className="font-medium">Email:</span> {selected.email}</div>
              <div><span className="font-medium">Name:</span> {selected.name}</div>
              <div><span className="font-medium">Type:</span> {selected.type}</div>
              <div><span className="font-medium">City:</span> {selected.base_city}</div>
              <div><span className="font-medium">Country:</span> {selected.country_code}</div>
              <div><span className="font-medium">Phone:</span> {selected.phone || 'Not provided'}</div>
              <div><span className="font-medium">Instagram:</span> {selected.instagram_handle ? `@${selected.instagram_handle}` : 'Not provided'}</div>
              <div><span className="font-medium">Rating:</span> {selected.ratings_avg ? `${Number(selected.ratings_avg).toFixed(1)}★` : 'No ratings yet'}</div>
              <div><span className="font-medium">Reviews:</span> {Number(selected.ratings_count || 0)}</div>
              <div className="col-span-2"><span className="font-medium">Status:</span> {selected.status}</div>
              {selected.photo_url ? (
                <div className="col-span-2">
                  <span className="font-medium">Photo:</span>
                  <img src={selected.photo_url} alt={selected.name} className="mt-2 h-36 w-36 rounded-2xl object-cover border" />
                </div>
              ) : null}
              {selected.bio_short ? (
                <div className="col-span-2">
                  <span className="font-medium">Bio:</span> {selected.bio_short}
                </div>
              ) : null}
            </div>
            <div className="mt-4">
              <div className="font-semibold">Documents</div>
              {selected.documents?.length ? (
                <ul className="list-disc pl-5 text-sm mt-1">
                  {selected.documents.map((d) => (
                    <li key={d.id}><a className="text-teal-600 underline" href={d.url} target="_blank" rel="noreferrer">{d.doc_type || 'document'}</a></li>
                  ))}
                </ul>
              ) : (
                <div className="text-sm text-[#a0a0a0]">No documents uploaded.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


