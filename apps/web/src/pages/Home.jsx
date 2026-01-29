import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppConfig } from '../config/appConfig';
import { buildTourSlug } from '../utils/tourSlug';
import FlightPricePredictor from '../components/FlightPricePredictor';

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

export default function Home() {
  const { t } = useTranslation();
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
        const params = new URLSearchParams({
          status: 'published',
          limit: '12',
        });
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
  }, [apiBase]);

  const topTours = items.slice(0, 3);
  const featured = items.slice(3, 5);

  return (
    <div className="page-shell">
      <div className="page-container space-y-16">
        <section className="space-y-6">
          <p className="page-kicker text-[#00D9FF]">{t('home.hero_kicker', 'Local guides marketplace')}</p>
          <div className="space-y-4">
            <h1 className="text-3xl font-semibold neon-title md:text-5xl">
              {t('home.hero_title', 'Book tours directly from local guides')}
            </h1>
            <p className="max-w-2xl text-sm text-[#e0e0e0] md:text-base">
              {t(
                'home.hero_subtitle',
                'AI helps you pick the best experience for your taste and budget. No agencies, no middlemen.'
              )}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              to="/tours"
              className="neon-cta inline-flex h-12 items-center justify-center rounded-md px-6 text-sm font-black uppercase tracking-wide transition-transform hover:scale-105"
            >
              {t('home.hero_primary', 'Explore experiences')}
            </Link>
            <Link
              to="/plan"
              className="inline-flex h-12 items-center justify-center rounded-md border border-[#00D9FF]/40 px-6 text-sm font-semibold text-[#00D9FF] hover:text-white"
            >
              {t('home.hero_secondary', 'Plan with AI')}
            </Link>
          </div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#a0a0a0]">
            {t('home.hero_badge', 'Human-led experiences · AI-optimized choices')}
          </p>
        </section>

        <section className="space-y-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="page-kicker text-[#00D9FF]">{t('home.top_kicker', 'Top tours')}</p>
              <p className="text-sm text-[#e0e0e0]">
                {t('home.top_subtitle', 'Highest‑rated experiences from local guides.')}
              </p>
            </div>
            <Link to="/tours" className="text-sm text-[#00D9FF] hover:text-white">
              {t('home.see_all', 'See all tours')}
            </Link>
          </div>

          {loading && <p className="text-[#e0e0e0]">{t('home.loading', 'Loading tours...')}</p>}
          {error && <p className="text-[#ff006e]">{error}</p>}
          {!loading && !error && topTours.length === 0 && (
            <p className="text-[#e0e0e0]">{t('home.empty', 'No tours have been published yet.')}</p>
          )}

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {topTours.map((item) => (
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
                      {t('home.hosted_by', 'Hosted by')} {item.provider_name}
                    </p>
                  )}
                  <p className="text-sm text-[#e0e0e0] leading-relaxed line-clamp-3">
                    {item.description || t('home.default_desc', 'Experience hosted by a local partner.')}
                  </p>
                  <div className="text-base font-semibold text-[#00D9FF]">
                    {formatPrice(item.price_from, item.currency || 'USD')}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="space-y-6">
          <div>
            <p className="page-kicker text-[#00D9FF]">{t('home.featured_kicker', 'Featured this week')}</p>
            <p className="text-sm text-[#e0e0e0]">
              {t('home.featured_subtitle', 'Curated experiences ready to book right now.')}
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            {featured.map((item) => (
              <Link
                key={item.id}
                to={`/tours/${buildTourSlug({ title: item.title, city: item.city, id: item.id })}`}
                className="page-card flex flex-col gap-4 transition-transform hover:-translate-y-1"
              >
                <div className="flex flex-col gap-4">
                  <div>
                    <p className="text-xs uppercase text-[#a0a0a0]">{item.city || '-'}</p>
                    <h2 className="text-xl font-semibold text-white">{item.title}</h2>
                  </div>
                  {item.provider_name && (
                    <p className="text-xs text-[#a0a0a0]">
                      {t('home.hosted_by', 'Hosted by')} {item.provider_name}
                    </p>
                  )}
                  <p className="text-sm text-[#e0e0e0] leading-relaxed line-clamp-4">
                    {item.description || t('home.default_desc', 'Experience hosted by a local partner.')}
                  </p>
                  <div className="text-base font-semibold text-[#00D9FF]">
                    {formatPrice(item.price_from, item.currency || 'USD')}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="page-card flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <p className="text-sm text-[#00D9FF]">{t('home.guide_kicker', 'For guides')}</p>
            <h2 className="text-2xl font-semibold text-white">
              {t('home.guide_title', 'Are you a tour guide?')}
            </h2>
            <p className="text-sm text-[#e0e0e0]">
              {t('home.guide_subtitle', 'List your tour here and reach travelers directly.')}
            </p>
          </div>
          <Link
            to="/operator/tours/new"
            className="neon-cta inline-flex h-12 items-center justify-center rounded-md px-6 text-sm font-black uppercase tracking-wide transition-transform hover:scale-105"
          >
            {t('home.guide_cta', 'List your tour')}
          </Link>
        </section>

        <FlightPricePredictor />
      </div>
    </div>
  );
}
