import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiFetch } from './api'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { COUNTRY_OPTIONS, normalizeCountryCode } from '@/utils/geoOptions'

const emptyForm = {
  slug: '',
  city: '',
  country_code: '',
  title: '',
  eyebrow: '',
  image_url: '',
  active: true,
}

export default function DestinationCoversPage() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [selected, setSelected] = useState(null)
  const [accessCode, setAccessCode] = useState('')
  const [q, setQ] = useState('')
  const [city, setCity] = useState('')
  const [countryCode, setCountryCode] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [total, setTotal] = useState(0)
  const [form, setForm] = useState(emptyForm)

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total, limit])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', String(limit))
      if (q) params.set('q', q)
      if (city) params.set('city', city)
      if (countryCode) params.set('country_code', normalizeCountryCode(countryCode))
      const res = await apiFetch(`/destination-covers?${params.toString()}`)
      const items = Array.isArray(res?.items) ? res.items : []
      setRows(items)
      setTotal(typeof res?.total === 'number' ? res.total : items.length)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load destination covers')
    } finally {
      setLoading(false)
    }
  }, [city, countryCode, limit, page, q])

  useEffect(() => {
    void load()
  }, [load])

  const applyItem = (item) => {
    setSelected(item)
    setForm({
      slug: item.slug || '',
      city: item.city || '',
      country_code: normalizeCountryCode(item.country_code),
      title: item.title || '',
      eyebrow: item.eyebrow || '',
      image_url: item.image_url || '',
      active: item.active !== false,
    })
    setMessage('')
    setError('')
  }

  const resetForm = () => {
    setSelected(null)
    setForm(emptyForm)
    setMessage('')
    setError('')
  }

  const save = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const payload = {
        ...form,
        city: String(form.city || '').trim(),
        country_code: normalizeCountryCode(form.country_code) || undefined,
        image_url: String(form.image_url || '').trim(),
        title: String(form.title || '').trim() || undefined,
        eyebrow: String(form.eyebrow || '').trim() || undefined,
        slug: String(form.slug || '').trim() || undefined,
        active: !!form.active,
        access_code: accessCode.trim() || undefined,
      }
      const res = await apiFetch('/destination-covers', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      setMessage(selected ? 'Destination cover updated.' : 'Destination cover created.')
      applyItem(res)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save destination cover')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-teal-700">Destination Covers</h1>
          <p className="text-sm text-gray-600 mt-1">Manage fallback hero images by city and country.</p>
        </div>
        <Button variant="outline" onClick={resetForm}>New cover</Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div>
          <div className="flex flex-wrap items-end gap-2 mb-3">
            <div className="flex-1 min-w-[220px]">
              <label className="block text-xs text-gray-600">Search</label>
              <input className="w-full border rounded px-2 py-1" placeholder="city or title" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-gray-600">City</label>
              <input className="border rounded px-2 py-1" value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-gray-600">Country</label>
              <div className="mt-1 min-w-[170px]">
                <Select value={normalizeCountryCode(countryCode) || 'all'} onValueChange={(value) => setCountryCode(value === 'all' ? '' : value)}>
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
              <label className="block text-xs text-gray-600">Page size</label>
              <select className="border rounded px-2 py-1" value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
                {[10, 20, 50, 100].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            <Button onClick={() => { setPage(1); void load() }}>Apply</Button>
          </div>

          {error && <div className="text-red-600 mb-2">{error}</div>}
          {message && <div className="text-teal-700 mb-2">{message}</div>}

          <div className="bg-white border rounded-lg overflow-hidden">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="px-3 py-2">Preview</th>
                  <th className="px-3 py-2">City</th>
                  <th className="px-3 py-2">Country</th>
                  <th className="px-3 py-2">Slug</th>
                  <th className="px-3 py-2">Title</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td className="px-3 py-3" colSpan={7}>Loading…</td></tr>
                ) : rows.length ? rows.map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="px-3 py-2">
                      <img src={row.image_url} alt={row.title || row.city} className="h-16 w-24 rounded-lg object-cover border" />
                    </td>
                    <td className="px-3 py-2 font-medium">{row.city}</td>
                    <td className="px-3 py-2">{row.country_code || '-'}</td>
                    <td className="px-3 py-2 font-mono text-xs">{row.slug}</td>
                    <td className="px-3 py-2">{row.title || '-'}</td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${row.active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-700'}`}>
                        {row.active ? 'active' : 'inactive'}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <Button size="sm" variant="outline" onClick={() => applyItem(row)}>Edit</Button>
                    </td>
                  </tr>
                )) : (
                  <tr><td className="px-3 py-3" colSpan={7}>No destination covers found.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between mt-3 text-sm">
            <div>Page {page} of {totalPages} · {total} results</div>
            <div className="space-x-2">
              <Button variant="outline" size="sm" onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={page <= 1}>Prev</Button>
              <Button variant="outline" size="sm" onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))} disabled={page >= totalPages}>Next</Button>
            </div>
          </div>
        </div>

        <div className="bg-white border rounded-lg p-4 h-fit">
          <h2 className="text-lg font-bold">{selected ? 'Edit destination cover' : 'Create destination cover'}</h2>
          <p className="text-sm text-gray-600 mt-1">Use one curated image per city-country pair as a real fallback hero.</p>

          <form className="mt-4 space-y-4" onSubmit={save}>
            <div>
              <label className="block text-xs text-gray-600">Access code</label>
              <input className="w-full border rounded px-2 py-2" value={accessCode} onChange={(e) => setAccessCode(e.target.value)} placeholder="Required if operator access code is enabled" />
            </div>
            <div>
              <label className="block text-xs text-gray-600">City</label>
              <input className="w-full border rounded px-2 py-2" value={form.city} onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))} required />
            </div>
            <div>
              <label className="block text-xs text-gray-600">Country (ISO2)</label>
              <div className="mt-1">
                <Select value={normalizeCountryCode(form.country_code) || 'none'} onValueChange={(value) => setForm((prev) => ({ ...prev, country_code: value === 'none' ? '' : value }))}>
                  <SelectTrigger className="h-10 w-full">
                    <SelectValue placeholder="Choose a country" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No country</SelectItem>
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
              <label className="block text-xs text-gray-600">Slug (optional)</label>
              <input className="w-full border rounded px-2 py-2" value={form.slug} onChange={(e) => setForm((prev) => ({ ...prev, slug: e.target.value }))} placeholder="cusco-pe" />
            </div>
            <div>
              <label className="block text-xs text-gray-600">Title</label>
              <input className="w-full border rounded px-2 py-2" value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} placeholder="Cusco adventures" />
            </div>
            <div>
              <label className="block text-xs text-gray-600">Eyebrow</label>
              <input className="w-full border rounded px-2 py-2" value={form.eyebrow} onChange={(e) => setForm((prev) => ({ ...prev, eyebrow: e.target.value }))} placeholder="Andean highlands" />
            </div>
            <div>
              <label className="block text-xs text-gray-600">Image URL</label>
              <input className="w-full border rounded px-2 py-2" value={form.image_url} onChange={(e) => setForm((prev) => ({ ...prev, image_url: e.target.value }))} placeholder="https://..." required />
            </div>
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm((prev) => ({ ...prev, active: e.target.checked }))} />
              <span>Active</span>
            </label>
            {form.image_url ? (
              <img src={form.image_url} alt={form.title || form.city || 'Destination cover preview'} className="h-48 w-full rounded-xl object-cover border" />
            ) : null}
            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>{saving ? 'Saving…' : selected ? 'Update cover' : 'Create cover'}</Button>
              <Button type="button" variant="outline" onClick={resetForm}>Clear</Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
