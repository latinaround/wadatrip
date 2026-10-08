import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch } from './api'

const when = value => value ? new Date(value).toLocaleString() : '—'
const money = (amount, currency) => amount == null ? 'Desconocido' : `${(amount / 100).toFixed(2)} ${currency || 'moneda desconocida'}`
const views = {
  users: { title: 'Usuarios registrados', help: 'Las cuentas de prueba identificadas se excluyen por defecto del conteo. Las demás siguen sin clasificar: un registro no demuestra una compra ni identidad legal verificada.',
    columns: [['ID', x => x.id], ['Nombre', x => x.name || '—'], ['Correo', x => x.email], ['Rol', x => x.role], ['Estado', x => x.status],
      ['Registro', x => when(x.created_at)], ['Último acceso', x => when(x.last_login_at)], ['Reservas', x => x._count?.bookings || 0],
      ['Solicitudes', x => x._count?.tour_date_requests || 0], ['Operador', x => x.provider_profile?.status || 'Sin perfil'],
      ['Tipo de datos', x => x.data_category === 'test' ? 'Prueba' : 'Sin clasificar']],
    filter: 'role', options: ['traveler','guide','operator','admin'] },
  'date-requests': { title: 'Solicitudes de fechas', help: 'Son consultas: no reservas, cobros ni cupos retenidos.',
    columns: [['Solicitud', x => x.id], ['Tour', x => <Link className="underline" to={`/tours/${x.listing_id}`}>{x.listing?.title}</Link>],
      ['Usuario', x => x.user_id], ['Fecha solicitada', x => x.requested_date?.slice(0, 10)], ['Personas', x => x.num_people],
      ['Estado', x => x.status], ['Fecha ofrecida', x => x.response_date?.slice(0, 10) || '—'], ['Creada', x => when(x.created_at)]],
    filter: 'status', options: ['requested','available','declined','cancelled'] },
  'payment-issues': { title: 'Incidencias de pagos', help: 'Consulta para investigación. No ejecuta reembolsos, conciliaciones ni cambios de inventario. Un importe desconocido sigue siendo desconocido.',
    columns: [['Reserva', x => x.id], ['Tour', x => x.listing?.title], ['Estado reserva', x => x.status], ['Estado pago', x => x.payment?.status || x.payment_status || 'Sin registro'],
      ['Inventario', x => x.inventory_state || 'Desconocido'], ['Importe esperado', x => money(x.amount_cents, x.currency)],
      ['Importe cobrado', x => money(x.payment?.amount_charged_cents, x.payment?.charged_currency)], ['Procesador', x => x.payment?.processor || 'Desconocido'],
      ['Revisión', x => x.payment?.resolution || '—'], ['Reembolso', x => x.payment?.refund_status || '—'], ['PaymentRecord', x => x.payment?.id || 'Ausente']] },
  audit: { title: 'Bitácora administrativa', help: 'Acciones y resultados técnicos. No registra contraseñas, códigos, tokens, búsquedas personales ni cuerpos de requests.',
    columns: [['Fecha', x => when(x.created_at)], ['Administrador', x => x.actor_id], ['Acción', x => x.action], ['Recurso', x => x.resource_id || '—'], ['Resultado', x => x.result]] },
}
export default function AdminRecords({ view }) {
  const config = views[view]
  const [rows, setRows] = useState([]), [total, setTotal] = useState(0), [page, setPage] = useState(1)
  const [draft, setDraft] = useState(''), [query, setQuery] = useState(''), [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [revision, setRevision] = useState(0)
  const [dataScope, setDataScope] = useState('non_test'), [excludedTests, setExcludedTests] = useState(0)
  useEffect(() => { setRows([]); setTotal(0); setPage(1); setDraft(''); setQuery(''); setFilter('') }, [view])
  useEffect(() => {
    let current = true
    setRows([]); setLoading(true); setError(''); setExcludedTests(0)
    const params = new URLSearchParams({ page: String(page), limit: '20' })
    if (query && view === 'users') params.set('q', query)
    if (filter && config.filter) params.set(config.filter, filter)
    if (view === 'users') params.set('data_scope', dataScope)
    apiFetch(`/admin/${view}?${params}`).then(data => { if (current) { setRows(data.items || []); setTotal(data.total || 0); setExcludedTests(data.excluded_test_accounts || 0) } })
      .catch(err => { if (current) { setError(err.message); setTotal(0) } }).finally(() => { if (current) setLoading(false) })
    return () => { current = false }
  }, [view, query, filter, page, revision, dataScope])
  return <section className="space-y-4 p-4 md:p-6">
    <h1 className="text-2xl font-bold text-teal-800">{config.title}</h1><p>{config.help}</p>
    <form className="flex flex-wrap items-end gap-3" onSubmit={event => { event.preventDefault(); setPage(1); setQuery(draft); setRevision(value => value + 1) }}>
      {view === 'users' && <label>Buscar nombre, correo o ID<input className="mt-1 block rounded border p-2" maxLength={150} value={draft} onChange={event => setDraft(event.target.value)} /></label>}
      {config.filter && <label>Filtrar<select className="mt-1 block rounded border p-2" value={filter} onChange={event => { setFilter(event.target.value); setPage(1) }}><option value="">Todos</option>{config.options.map(option => <option key={option}>{option}</option>)}</select></label>}
      {view === 'users' && <label>Tipo de cuentas<select className="mt-1 block rounded border p-2" value={dataScope} onChange={event => { setDataScope(event.target.value); setPage(1) }}>
        <option value="non_test">Excluir pruebas identificadas</option><option value="test">Solo pruebas</option><option value="all">Todas, incluidas pruebas</option>
      </select></label>}
      <button className="rounded border bg-white px-3 py-2" disabled={loading}>Actualizar</button>
    </form>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    <p role="status">{loading ? 'Cargando…' : `${total} registros`}</p>
    {view === 'users' && !loading && !error && dataScope === 'non_test' && <p>{excludedTests} cuentas de prueba excluidas de esta consulta. Su historial se conserva.</p>}
    <div className="overflow-x-auto rounded border bg-white"><table className="min-w-full text-left text-sm">
      <thead className="bg-slate-100"><tr>{config.columns.map(([title]) => <th key={title} className="whitespace-nowrap p-3">{title}</th>)}</tr></thead>
      <tbody>{rows.map(row => <tr key={row.id} className="border-t">{config.columns.map(([title, cell]) => <td key={title} className="max-w-xs break-words p-3">{cell(row)}</td>)}</tr>)}</tbody>
    </table></div>
    {!loading && !error && !rows.length && <p>No hay registros para esta consulta.</p>}
    <div className="flex items-center gap-3"><button className="rounded border p-2" disabled={loading || page <= 1} onClick={() => setPage(value => value - 1)}>Anterior</button>
      <span>Página {page}</span><button className="rounded border p-2" disabled={loading || page * 20 >= total} onClick={() => setPage(value => value + 1)}>Siguiente</button></div>
  </section>
}
