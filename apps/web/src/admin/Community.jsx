import { useEffect, useRef, useState } from 'react';
import { apiFetch } from './api';

export default function AdminCommunity() {
  const [data, setData] = useState(null), [error, setError] = useState(''), [page, setPage] = useState(1), [status, setStatus] = useState('open');
  const [revision, setRevision] = useState(0), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true);
  const active = useRef(true), writing = useRef(false);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => {
    let current = true; setData(null); setError(''); setLoading(true);
    apiFetch(`/admin/community/reports?page=${page}&status=${status}`).then(result => { if (current) setData(result); })
      .catch(err => { if (current) setError(err.message); }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [page, status, revision]);
  async function resolve(id, action) {
    if (writing.current || !window.confirm(action === 'hide' ? '¿Ocultar el contenido reportado y cerrar este reporte?' : '¿Cerrar este reporte sin ocultar el contenido?')) return;
    writing.current = true; setBusy(true); setError('');
    try { await apiFetch(`/admin/community/reports/${id}/resolve`, { method: 'POST', body: JSON.stringify({ action }) }); if (active.current) setRevision(v => v + 1); }
    catch (err) { if (active.current) setError(err.message); }
    finally { writing.current = false; if (active.current) setBusy(false); }
  }
  return <section className="space-y-4 p-5 text-slate-900"><h1 className="text-2xl font-bold text-teal-800">Moderación de Community</h1>
    <p>Revisión humana de reportes. Las acciones quedan auditadas. Ocultar una pregunta oculta también sus respuestas de la vista pública; no cambia reservas ni pagos.</p>
    <label>Estado<select className="ml-3 rounded border p-2" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}><option value="open">Pendientes</option><option value="resolved">Resueltos</option></select></label>
    <button className="ml-3 rounded border p-2" disabled={loading || busy} onClick={() => setRevision(v => v + 1)}>Actualizar</button>
    {loading && <p role="status">Cargando…</p>}{error && <p role="alert" className="text-red-800">{error}</p>}
    {data?.items.map(row => { const content = row.thread || row.reply; return <article key={row.id} className="space-y-3 rounded-xl border bg-white p-4"><p className="text-sm text-slate-600">Reporte: {row.id} · {row.reason} · {new Date(row.created_at).toLocaleString()}</p><p>Autor público: {content?.author?.name} · Estado: {content?.status}</p>{content?.title && <h2 className="font-semibold">{content.title}</h2>}<p className="whitespace-pre-wrap break-words">{content?.message}</p>{row.status === 'open' ? <div className="flex gap-3"><button className="rounded border border-red-700 px-3 py-2 text-red-800" disabled={busy} onClick={() => resolve(row.id, 'hide')}>Ocultar y cerrar reporte</button><button className="rounded border px-3 py-2" disabled={busy} onClick={() => resolve(row.id, 'dismiss')}>Cerrar sin ocultar</button></div> : <p>Resolución: {row.resolution}</p>}</article>; })}
    {data?.items.length === 0 && <p>No hay reportes para este filtro.</p>}
    <div className="flex items-center gap-3"><button className="rounded border p-2" disabled={loading || busy || page <= 1} onClick={() => setPage(v => v - 1)}>Anterior</button><span>Página {page}</span><button className="rounded border p-2" disabled={loading || busy || !data || page * 20 >= data.total} onClick={() => setPage(v => v + 1)}>Siguiente</button></div>
  </section>;
}
