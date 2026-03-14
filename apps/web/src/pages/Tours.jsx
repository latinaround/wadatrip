import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AppConfig } from '../config/appConfig';
import { buildTourSlug } from '../utils/tourSlug';

const normalizeBaseUrl = (base) => (base || '').replace(/\/$/, '');

const formatPrice = (value, currency = 'USD') => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return 'Contact us';
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const buildTourHref = (item) => `/tours/${buildTourSlug({ title: item.title, city: item.city, id: item.id })}`;

const buildExperienceKey = (item) => {
  const city = String(item?.city || '').trim().toLowerCase();
  const title = String(item?.title || '').trim().toLowerCase();
  return `${title}::${city}`;
};

function ExperienceCard({ experience }) {
  const cheapestHost = experience.hosts[0] || null;
  const hostCount = experience.hosts.length;
  const freeTour = experience.hosts.some((host) => Array.isArray(host.tags) && host.tags.includes('free_tour'));

  return (
    <Link
      to={buildTourHref(cheapestHost || experience.primary)}
      className="group overflow-hidden rounded-[30px] border border-[#dccab9] bg-[linear-gradient(145deg,#f7e7d8_0%,#fcf3ea_58%,#eef8f6_100%)] p-6 text-[#0f172a] shadow-[0_18px_52px_rgba(15,23,42,0.10)] transition-transform duration-200 hover:-translate-y-1"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] text-[#167c7d]">{experience.city || 'Destination'}</p>
          <h2 className="mt-2 text-2xl font-semibold leading-tight text-[#0f172a]">{experience.title}</h2>
        </div>
        <div className="rounded-full border border-[#f1d6c1] bg-[#fff2e8] px-3 py-2 text-xs font-semibold text-[#136f71] shadow-sm">
          {freeTour ? 'Free option' : formatPrice(cheapestHost?.price_from, cheapestHost?.currency || 'USD')}
        </div>
      </div>

      <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-[#435164]">
        {experience.description || 'Compare verified local hosts offering the same experience in one clean view.'}
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="space-y-2">
          <div className="inline-flex items-center rounded-full bg-[#e8faf8] px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#167c7d]">
            {hostCount} {hostCount === 1 ? 'Host' : 'Hosts'} Available
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-[#6b7687]">Best match right now</p>
            <p className="mt-1 text-sm font-semibold text-[#0f172a]">{cheapestHost?.provider_name || 'Verified local host'}</p>
          </div>
        </div>
        <span className="inline-flex items-center justify-center rounded-2xl bg-[#0f172a] px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-white transition-colors group-hover:bg-[#167c7d]">
          Compare Hosts
        </span>
      </div>
    </Link>
  );
}

export default function Tours() {
  const apiBase = useMemo(() => normalizeBaseUrl(AppConfig.api.baseUrl), []);
  const location = useLocation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({ city: '', country: '' });
  const [freeOnly, setFreeOnly] = useState(false);
  const [geoStatus, setGeoStatus] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const wantsFree = params.get('free') === 'true' || params.get('free_tour') === 'true';
    const city = params.get('city') || '';
    const country = params.get('country_code') || '';
    if (wantsFree) setFreeOnly(true);
    if (city || country) {
      setFilters((prev) => ({
        city: city || prev.city,
        country: country || prev.country,
      }));
    }
  }, [location.search]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          status: 'published',
          limit: '60',
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
        } catch {
          setGeoStatus('Unable to resolve your city. Please enter it manually.');
        }
      },
      () => setGeoStatus('Location permission denied. Enter your city manually.'),
      { timeout: 10000 },
    );
  };

  const experiences = useMemo(() => {
    const groups = new Map();
    for (const item of items) {
      const key = buildExperienceKey(item);
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          title: item.title,
          city: item.city,
          description: item.description,
          primary: item,
          hosts: [],
        });
      }
      groups.get(key).hosts.push(item);
    }

    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        hosts: group.hosts.slice().sort((a, b) => {
          const aPrice = Number(a?.price_from || 0);
          const bPrice = Number(b?.price_from || 0);
          if (!Number.isFinite(aPrice) && !Number.isFinite(bPrice)) return 0;
          if (!Number.isFinite(aPrice)) return 1;
          if (!Number.isFinite(bPrice)) return -1;
          return aPrice - bPrice;
        }),
      }))
      .sort((a, b) => b.hosts.length - a.hosts.length || a.title.localeCompare(b.title));
  }, [items]);

  const activeCities = useMemo(() => {
    return Array.from(new Set(experiences.map((item) => String(item.city || '').trim()).filter(Boolean))).slice(0, 6);
  }, [experiences]);

  return (
    <div className="page-shell">
      <div className="page-container space-y-10">
        <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-stretch">
          <div className="overflow-hidden rounded-[30px] border border-white/12 bg-[linear-gradient(135deg,#0f7f77_0%,#14908d_42%,#dd8a63_100%)] p-8 shadow-[0_26px_70px_rgba(15,23,42,0.22)] md:p-9">
            <div className="space-y-5">
              <p className="page-kicker text-[#dcfffb]">Tours marketplace</p>
              <h1 className="max-w-3xl text-4xl font-semibold leading-[1.05] text-white md:text-5xl">Pick the experience first. Compare hosts second.</h1>
              <p className="max-w-2xl text-base leading-relaxed text-white/86">
                WadaTrip helps travelers find one clean experience page, then compare verified tour guides and operators without scrolling through duplicated listings.
              </p>
              <div className="flex flex-wrap gap-3">
                <span className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white">Verified hosts</span>
                <span className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white">Cleaner pricing</span>
                <span className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white">Traveler-first flow</span>
              </div>
            </div>
          </div>

          <section className="rounded-[30px] border border-[#e8d7c7] bg-[linear-gradient(180deg,#fff6ed_0%,#fffdf9_100%)] p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="page-kicker text-[#167c7d]">Filters</p>
                  <p className="text-sm text-[#64748b]">Search by city, country, or free walking tours.</p>
                </div>
                <div className="text-xs uppercase tracking-[0.18em] text-[#6b7687]">{experiences.length} experiences</div>
              </div>
              <div className="grid gap-3 md:grid-cols-[1.4fr_1fr_auto] md:items-end">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6b7687]">City</label>
                  <input
                    value={filters.city}
                    onChange={(event) => handleFilterChange('city', event.target.value)}
                    placeholder="Lima"
                    className="mt-2 w-full rounded-2xl border border-[#d7e6e3] bg-[#fffbf7] px-4 py-3 text-sm text-[#172033] outline-none transition-shadow focus:border-[#169a99] focus:shadow-[0_0_0_3px_rgba(22,154,153,0.15)]"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6b7687]">Country</label>
                  <input
                    value={filters.country}
                    onChange={(event) => handleFilterChange('country', event.target.value)}
                    placeholder="PE"
                    className="mt-2 w-full rounded-2xl border border-[#d7e6e3] bg-[#fffbf7] px-4 py-3 text-sm text-[#172033] outline-none transition-shadow focus:border-[#169a99] focus:shadow-[0_0_0_3px_rgba(22,154,153,0.15)]"
                  />
                </div>
                <button
                  type="button"
                  onClick={applyGeolocation}
                  className="h-12 rounded-2xl border border-[#d7bca9] px-4 text-xs font-semibold uppercase tracking-[0.16em] text-[#0f172a] transition-colors hover:bg-[#fff2e7]"
                >
                  Use My Location
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm text-[#435164]">
                <label className="inline-flex items-center gap-2 rounded-full border border-[#ecdccc] bg-[#fff8f0] px-4 py-2">
                  <input
                    id="free-tours"
                    type="checkbox"
                    checked={freeOnly}
                    onChange={(event) => setFreeOnly(event.target.checked)}
                  />
                  <span>Free walking tours</span>
                </label>
                {geoStatus ? <span className="text-xs uppercase tracking-[0.16em] text-[#6b7687]">{geoStatus}</span> : null}
              </div>
            </div>
          </section>
        </section>

        {activeCities.length ? (
          <section className="flex flex-wrap gap-3">
            {activeCities.map((city) => (
              <button
                key={city}
                type="button"
                onClick={() => handleFilterChange('city', city)}
                className="rounded-full border border-[#d8ecea] bg-[#f4fbfa] px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#167c7d] transition-colors hover:bg-[#e9f7f6]"
              >
                {city}
              </button>
            ))}
          </section>
        ) : null}

        {loading && <p className="text-[#cad3df]">Loading tours...</p>}
        {error && <p className="text-[#ff6d8e]">{error}</p>}
        {!loading && !error && experiences.length === 0 && (
          <p className="text-[#cad3df]">No tours have been published yet.</p>
        )}

        <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
          {experiences.map((experience) => (
            <ExperienceCard key={experience.key} experience={experience} />
          ))}
        </div>
      </div>
    </div>
  );
}




