import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppConfig } from '../config/appConfig';

const normalizeBaseUrl = (base) => (base || '').replace(/\/$/, '');

const formatPrice = (value, currency = 'USD') => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return 'Consultar';
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

export default function Tours() {
  const apiBase = useMemo(() => normalizeBaseUrl(AppConfig.api.baseUrl), []);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${apiBase}/listings/search?status=published&limit=50`);
        const data = await response.json().catch(() => null);
        if (!response.ok) {
          const message = data?.message || data?.error || response.statusText || 'Error cargando tours';
          throw new Error(message);
        }
        const rows = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
        if (mounted) setItems(rows);
      } catch (err) {
        if (mounted) setError(err?.message || 'Error cargando tours');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [apiBase]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-emerald-50">
      <div className="mx-auto max-w-6xl px-4 py-12 space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold text-emerald-200">Tours disponibles</h1>
          <p className="text-emerald-100 text-sm">
            Explora experiencias reales publicadas por operadores verificados.
          </p>
        </header>

        {loading && <p className="text-emerald-100">Cargando tours...</p>}
        {error && <p className="text-rose-200">{error}</p>}

        {!loading && !error && items.length === 0 && (
          <p className="text-emerald-100">Aun no hay tours publicados.</p>
        )}

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <Link
              key={item.id}
              to={`/tours/${item.id}`}
              className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-5 shadow-lg transition-transform hover:-translate-y-1"
            >
              <div className="space-y-3">
                <div>
                  <p className="text-xs uppercase text-emerald-100/80">{item.city || '-'}</p>
                  <h2 className="text-lg font-semibold text-emerald-50">{item.title}</h2>
                </div>
                {item.provider_name && (
                  <p className="text-xs text-emerald-100">
                    Operado por {item.provider_name}
                    {item.provider_country ? ` (${item.provider_country})` : ''}
                  </p>
                )}
                <p className="text-sm text-emerald-100/90 line-clamp-3">
                  {item.description || 'Experiencia operada por un partner local.'}
                </p>
                <div className="text-base font-semibold text-emerald-200">
                  {formatPrice(item.price_from, item.currency || 'USD')}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
