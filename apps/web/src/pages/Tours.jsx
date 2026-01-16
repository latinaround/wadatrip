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
          const message = data?.message || data?.error || response.statusText || 'Error loading tours';
          throw new Error(message);
        }
        const rows = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
        if (mounted) setItems(rows);
      } catch (err) {
        if (mounted) setError(err?.message || 'Error loading tours');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [apiBase]);

  return (
    <div className="page-shell">
      <div className="page-container space-y-10">
        <header className="space-y-3">
          <p className="page-kicker">Tours</p>
          <h1 className="text-3xl font-semibold text-slate-900 md:text-4xl">Tours ready to book</h1>
          <p className="max-w-2xl text-sm text-slate-600">
            Discover real experiences published by verified operators.
          </p>
        </header>

        <section className="page-card p-5">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="page-kicker">Filters</p>
              <p className="text-sm text-slate-600">Showing all published tours.</p>
            </div>
            <div className="text-xs text-slate-500">
              {items.length} experiences
            </div>
          </div>
        </section>

        {loading && <p className="text-slate-600">Loading tours...</p>}
        {error && <p className="text-rose-600">{error}</p>}

        {!loading && !error && items.length === 0 && (
          <p className="text-slate-600">No tours have been published yet.</p>
        )}

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <Link
              key={item.id}
              to={`/tours/${item.id}`}
              className="page-card p-5 transition-transform hover:-translate-y-1"
            >
              <div className="space-y-3">
                <div>
                  <p className="text-xs uppercase text-slate-500">{item.city || '-'}</p>
                  <h2 className="text-lg font-semibold text-slate-900">{item.title}</h2>
                </div>
                {item.provider_name && (
                  <p className="text-xs text-slate-500">
                    Operated by {item.provider_name}
                    {item.provider_country ? ` (${item.provider_country})` : ''}
                  </p>
                )}
                <p className="text-sm text-slate-600 line-clamp-3">
                  {item.description || 'Experience hosted by a local partner.'}
                </p>
                <div className="text-base font-semibold text-teal-700">
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
