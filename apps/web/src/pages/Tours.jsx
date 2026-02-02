import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppConfig } from '../config/appConfig';
import { buildTourSlug } from '../utils/tourSlug';

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
  const [filters, setFilters] = useState({ city: '', country: '' });
  const [freeOnly, setFreeOnly] = useState(false);
  const [geoStatus, setGeoStatus] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          status: 'published',
          limit: '50',
        });
        if (filters.city.trim()) params.set('city', filters.city.trim());
        if (filters.country.trim()) params.set('country_code', filters.country.trim().toUpperCase());
        if (freeOnly) params.set('free_tour', 'true');

        const response = await fetch(`${apiBase}/listings/search?${params.toString()}`);
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
  }, [apiBase, filters.city, filters.country, freeOnly]);

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const applyGeolocation = () => {
    setGeoStatus('');
    if (!navigator.geolocation) {
      setGeoStatus('Geolocation is not supported on this device.');
      return;
    }
    setGeoStatus('Detecting your location...');
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`,
          );
          const data = await response.json().catch(() => null);
          const address = data?.address || {};
          const city = address.city || address.town || address.village || address.state || '';
          const countryCode = address.country_code ? String(address.country_code).toUpperCase() : '';
          setFilters((prev) => ({
            ...prev,
            city: city || prev.city,
            country: countryCode || prev.country,
          }));
          setGeoStatus(city ? `Using ${city}${countryCode ? `, ${countryCode}` : ''}` : 'Location detected.');
        } catch (err) {
          setGeoStatus('Unable to resolve your city. Please enter it manually.');
        }
      },
      () => setGeoStatus('Location permission denied. Enter your city manually.'),
      { timeout: 10000 },
    );
  };

  return (
    <div className="page-shell">
      <div className="page-container space-y-10">
        <header className="space-y-3">
          <p className="page-kicker text-[#00D9FF]">Tours</p>
          <h1 className="text-3xl font-semibold neon-title md:text-4xl">Tours ready to book</h1>
          <p className="max-w-2xl text-sm text-[#e0e0e0]">
            Discover real experiences published by verified operators.
          </p>
        </header>

        <section className="page-card">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <p className="page-kicker text-[#00D9FF]">Filters</p>
              <p className="text-sm text-[#e0e0e0]">Find tours by city or country.</p>
            </div>
            <div className="text-xs text-[#a0a0a0]">{items.length} experiences</div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-[1.5fr_1fr_auto] md:items-end">
            <div>
              <label className="text-xs text-[#a0a0a0]">City</label>
              <input
                value={filters.city}
                onChange={(event) => handleFilterChange('city', event.target.value)}
                placeholder="Lima"
                className="mt-2 w-full rounded-md border border-[#00D9FF]/30 bg-[#1a1f3a] px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="text-xs text-[#a0a0a0]">Country (ISO2)</label>
              <input
                value={filters.country}
                onChange={(event) => handleFilterChange('country', event.target.value)}
                placeholder="PE"
                className="mt-2 w-full rounded-md border border-[#00D9FF]/30 bg-[#1a1f3a] px-3 py-2 text-sm text-white"
              />
            </div>
            <button
              type="button"
              onClick={applyGeolocation}
              className="h-10 rounded-md border border-[#00D9FF]/40 px-4 text-xs font-semibold uppercase tracking-wide text-[#00D9FF] hover:text-white"
            >
              Use my location
            </button>
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs text-[#e0e0e0]">
            <input
              id="free-tours"
              type="checkbox"
              checked={freeOnly}
              onChange={(event) => setFreeOnly(event.target.checked)}
            />
            <label htmlFor="free-tours">Free walking tours</label>
          </div>
          {geoStatus && <p className="mt-3 text-xs text-[#a0a0a0]">{geoStatus}</p>}
        </section>

        {loading && <p className="text-[#e0e0e0]">Loading tours...</p>}
        {error && <p className="text-[#ff006e]">{error}</p>}

        {!loading && !error && items.length === 0 && (
          <p className="text-[#e0e0e0]">No tours have been published yet.</p>
        )}

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <Link
              key={item.id}
              to={`/tours/${buildTourSlug({ title: item.title, city: item.city, id: item.id })}`}
              className="page-card flex flex-col gap-3 transition-transform hover:-translate-y-1"
            >
              <div className="flex flex-col gap-3">
                <div>
                  <p className="text-xs uppercase text-[#a0a0a0]">{item.city || '-'}</p>
                  <h2 className="text-lg font-semibold text-white">{item.title}</h2>
                </div>
                {item.provider_name && (
                  <p className="text-xs text-[#a0a0a0]">
                    Hosted by local guide {item.provider_name}
                    {item.provider_country ? ` (${item.provider_country})` : ''}
                  </p>
                )}
                <p className="text-sm text-[#e0e0e0] leading-relaxed line-clamp-3">
                  {item.description || 'Experience hosted by a local partner.'}
                </p>
                <div className="text-base font-semibold text-[#00D9FF]">
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
