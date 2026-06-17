import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppConfig } from '../config/appConfig';
import { buildTourSlug } from '../utils/tourSlug';
import { fetchDestinationCoverMap, resolveListingImage, resolveProviderAvatar } from '../utils/destinationMedia';
import { getListingPriceBadge, isFreeTour } from '../utils/listingMode';
import BrandLogo from '../components/BrandLogo';
import { useAuth } from '../context/AuthContext.jsx';

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

const getHostKey = (item) => String(item.provider_id || item.provider_name || '').trim();

const buildTourHref = (item) => `/tours/${buildTourSlug({ title: item.title, city: item.city, id: item.id })}`;

function StatCard({ label, value, tone = 'cyan' }) {
  const toneClasses = {
    cyan: 'border-[#7fe7e3]/30 bg-white/10',
    coral: 'border-[#f5c8ac]/30 bg-white/10',
    rose: 'border-[#f0bfd7]/30 bg-white/10',
  };

  return (
    <div className={`rounded-2xl border px-4 py-4 backdrop-blur ${toneClasses[tone] || toneClasses.cyan}`}>
      <p className="text-[11px] uppercase tracking-[0.24em] text-white/65">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}

function SectionHeader({ kicker, title, subtitle, actionLabel, actionHref }) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div className="space-y-2">
        <p className="page-kicker text-[#16d7d0]">{kicker}</p>
        <h2 className="text-2xl font-semibold text-white md:text-3xl">{title}</h2>
        {subtitle ? <p className="max-w-2xl text-sm leading-relaxed text-[#cad3df]">{subtitle}</p> : null}
      </div>
      {actionLabel && actionHref ? (
        <Link to={actionHref} className="text-sm font-semibold text-[#16d7d0] hover:text-white">
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}

function ExperienceCard({ item, tone = 'warm', destinationCoverMap }) {
  const toneClasses = {
    warm: 'from-[#f4dfcc] via-[#f8ece1] to-[#f6fbfa] border-[#e2ccb7]',
    aqua: 'from-[#e6f7f5] via-[#f3fbfb] to-[#fff0e7] border-[#cfe7e3]',
  };
  const coverImage = resolveListingImage(item, destinationCoverMap);
  const providerAvatar = resolveProviderAvatar(item);

  return (
    <Link
      to={buildTourHref(item)}
      className={`group overflow-hidden rounded-[28px] border bg-gradient-to-br ${toneClasses[tone] || toneClasses.warm} p-5 text-[#0f172a] shadow-[0_18px_48px_rgba(15,23,42,0.14)] transition-transform duration-200 hover:-translate-y-1`}
    >
      {coverImage ? (
        <div className="mb-5 overflow-hidden rounded-[22px] border border-white/50 bg-white/40">
          <img src={coverImage} alt={item.title} className="h-48 w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" />
        </div>
      ) : null}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] text-[#167c7d]">{item.city || 'Destination'}</p>
          <h3 className="mt-2 text-xl font-semibold leading-tight text-[#0f172a]">{item.title}</h3>
        </div>
        <div className="rounded-full border border-[#efd0bb] bg-[#fff0e4] px-3 py-2 text-xs font-semibold text-[#136f71] shadow-sm">
          {getListingPriceBadge(item, formatPrice)}
        </div>
      </div>
      <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-[#475569]">
        {item.description || 'Local experience published directly by a verified host.'}
      </p>
      <div className="mt-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {providerAvatar ? (
            <img src={providerAvatar} alt={item.provider_name || 'Host'} className="h-12 w-12 rounded-2xl object-cover shadow-[0_10px_22px_rgba(15,23,42,0.16)]" />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0f172a] text-sm font-black text-white shadow-[0_10px_22px_rgba(15,23,42,0.16)]">
              {String(item.provider_name || 'Host').slice(0, 1).toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-[#7c8aa0]">Host</p>
            <p className="mt-1 text-sm font-semibold text-[#0f172a]">{item.provider_name || 'Verified local host'}</p>
          </div>
        </div>
        <span className="inline-flex items-center rounded-full bg-[#0f172a] px-3 py-2 text-xs font-semibold text-white transition-colors group-hover:bg-[#167c7d]">
          {isFreeTour(item) ? 'Join free tour' : 'View details'}
        </span>
      </div>
    </Link>
  );
}

export default function Home() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const apiBase = useMemo(() => normalizeBaseUrl(AppConfig.api.baseUrl), []);
  const [items, setItems] = useState([]);
  const [destinationCoverMap, setDestinationCoverMap] = useState({});
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
          limit: '18',
        });
        const response = await fetch(`${apiBase}/listings/search?${params.toString()}`);
        const data = await response.json().catch(() => null);
        if (!response.ok) {
          const message = data?.message || data?.error || response.statusText || 'Error loading tours';
          throw new Error(message);
        }
        const rows = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
        const covers = await fetchDestinationCoverMap(apiBase, rows);
        if (mounted) {
          setItems(rows);
          setDestinationCoverMap(covers);
        }
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

  const freeTours = items.filter((item) => Array.isArray(item.tags) && item.tags.includes('free_tour'));
  const paidTours = items.filter((item) => !Array.isArray(item.tags) || !item.tags.includes('free_tour'));
  const featuredPaid = paidTours.slice(0, 4);
  const editorPicks = paidTours.slice(4, 7);
  const guideEntryHref = user ? '/operator/tours/new' : '/guide/register';

  const uniqueCities = new Set(items.map((item) => String(item.city || '').trim()).filter(Boolean));
  const uniqueHosts = new Set(items.map(getHostKey).filter(Boolean));

  const citySignals = useMemo(() => {
    const counts = new Map();
    for (const item of items) {
      const city = String(item.city || '').trim();
      if (!city) continue;
      counts.set(city, (counts.get(city) || 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
  }, [items]);

  const trustPoints = [
    {
      title: 'Traveler-first booking',
      copy: 'Find one experience, compare hosts, and book without digging through duplicated listings.',
      tone: 'bg-[linear-gradient(180deg,#efd8c3_0%,#f7e8da_100%)] border-[#dcc0a9]',
    },
    {
      title: 'Verified local hosts',
      copy: 'Operators and tour guides go through review before they show up in the marketplace.',
      tone: 'bg-[linear-gradient(180deg,#e3f3f1_0%,#f4fbfa_100%)] border-[#c8e2de]',
    },
    {
      title: 'Built to convert',
      copy: 'Faster pricing, simpler decisions, and a cleaner path from discovery to checkout.',
      tone: 'bg-[linear-gradient(180deg,#f3dfe9_0%,#fbf1f6_100%)] border-[#e3c7d6]',
    },
  ];

  return (
    <div className="page-shell">
      <div className="page-container space-y-16">
        <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-stretch">
          <div className="overflow-hidden rounded-[32px] border border-white/12 bg-[linear-gradient(135deg,#0f7f77_0%,#159291_45%,#dd8a63_100%)] p-8 shadow-[0_30px_80px_rgba(15,23,42,0.28)] md:p-10">
            <div className="flex h-full flex-col justify-between gap-8">
              <div className="space-y-5">
                <BrandLogo size="md" showTagline light className="mb-3" />
                <p className="page-kicker text-[#dcfffb]">{t('home.hero_kicker', 'Verified local experiences')}</p>
                <div className="space-y-4">
                  <h1 className="max-w-3xl text-4xl font-semibold leading-[1.05] text-white md:text-6xl">
                    {t('home.hero_title', 'Book better tours. Meet verified local hosts.')}
                  </h1>
                  <p className="max-w-2xl text-base leading-relaxed text-white/86 md:text-lg">
                    {t(
                      'home.hero_subtitle',
                      'WadaTrip helps travelers compare real experiences from local tour guides and operators without the clutter of duplicated marketplace listings.'
                    )}
                  </p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Link
                    to="/tours"
                    className="inline-flex h-12 items-center justify-center rounded-2xl bg-[#fff8f2] px-6 text-sm font-black uppercase tracking-[0.16em] text-[#0f7f77] transition-transform hover:scale-[1.02]"
                  >
                    {t('home.hero_primary', 'Explore tours')}
                  </Link>
                  <Link
                    to="/tours?free_tour=true"
                    className="inline-flex h-12 items-center justify-center rounded-2xl border border-white/30 px-6 text-sm font-semibold text-white transition-colors hover:bg-white/10"
                  >
                    Start with free tours
                  </Link>
                </div>
                <p className="text-sm text-white/75">
                  Start with free walking tours to meet hosts first, then book paid experiences when you are ready.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <StatCard label="Live tours" value={loading ? '...' : String(items.length || 0)} tone="cyan" />
                <StatCard label="Cities" value={loading ? '...' : String(uniqueCities.size || 0)} tone="coral" />
                <StatCard label="Verified hosts" value={loading ? '...' : String(uniqueHosts.size || 0)} tone="rose" />
              </div>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="rounded-[28px] border border-[#18303c] bg-[#10182b] p-6 shadow-[0_20px_60px_rgba(15,23,42,0.22)]">
              <p className="page-kicker text-[#16d7d0]">This week</p>
              <h2 className="mt-3 text-2xl font-semibold text-white">Where travelers are booking now</h2>
              <div className="mt-5 space-y-3">
                {citySignals.length ? citySignals.map(([city, count], index) => (
                  <div key={city} className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/5 px-4 py-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-white/45">0{index + 1}</p>
                      <p className="mt-1 text-sm font-semibold text-white">{city}</p>
                    </div>
                    <span className="rounded-full bg-[#173f44] px-3 py-2 text-xs font-semibold text-[#8ef1eb]">
                      {count} experiences
                    </span>
                  </div>
                )) : (
                  <p className="text-sm text-[#cad3df]">Publish a few more tours and this section becomes your destination heatboard.</p>
                )}
              </div>
            </div>

            <div className="rounded-[28px] border border-[#dcbda3] bg-[linear-gradient(180deg,#efd9c4_0%,#f6e7da_52%,#fbf2e9_100%)] p-6 text-[#0f172a] shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
              <p className="page-kicker text-[#167c7d]">Why this sells</p>
              <h2 className="mt-3 text-2xl font-semibold">One experience. Clear host choice.</h2>
              <p className="mt-3 text-sm leading-relaxed text-[#435164]">
                Travelers first see the destination and experience. Then they compare local hosts by trust, language, and price instead of scrolling through repetitive cards.
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {trustPoints.map((point, index) => (
            <div key={point.title} className={`rounded-[24px] border p-6 shadow-[0_14px_40px_rgba(15,23,42,0.06)] ${point.tone}`}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#dd8a63]">0{index + 1}</p>
              <h3 className="mt-3 text-xl font-semibold text-[#0f172a]">{point.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-[#435164]">{point.copy}</p>
            </div>
          ))}
        </section>

        <section className="space-y-6">
          <SectionHeader
            kicker={t('home.top_kicker', 'Featured tours')}
            title={t('home.top_title', 'Experiences ready to book now')}
            subtitle={t('home.top_subtitle', 'A traveler-first selection of tours that already have local hosts and clear pricing.')}
            actionLabel={t('home.see_all', 'See all tours')}
            actionHref="/tours"
          />

          {loading && <p className="text-[#cad3df]">{t('home.loading', 'Loading tours...')}</p>}
          {error && <p className="text-[#ff6d8e]">{error}</p>}
          {!loading && !error && featuredPaid.length === 0 && (
            <p className="text-[#cad3df]">{t('home.empty', 'No tours have been published yet.')}</p>
          )}

          <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-4">
            {featuredPaid.map((item, index) => (
              <ExperienceCard key={item.id} item={item} tone={index % 2 === 0 ? 'warm' : 'aqua'} destinationCoverMap={destinationCoverMap} />
            ))}
          </div>
        </section>

        <section className="space-y-6">
          <SectionHeader
            kicker={t('home.free_kicker', 'Free walking tours')}
            title={t('home.free_title', 'Low-friction ways to meet local hosts')}
            subtitle={t('home.free_subtitle', 'Use free walking tours to build trust, discover neighborhoods, and decide who you want to book again.')}
            actionLabel={t('home.see_all_free', 'See all free tours')}
            actionHref="/tours?free_tour=true"
          />

          {!loading && !error && freeTours.length === 0 && (
            <p className="text-[#cad3df]">{t('home.free_empty', 'No free walking tours published yet.')}</p>
          )}

          <div className="grid gap-6 md:grid-cols-3">
            {freeTours.slice(0, 3).map((item) => (
              <ExperienceCard key={item.id} item={item} tone="aqua" destinationCoverMap={destinationCoverMap} />
            ))}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[30px] border border-[#ddc8b5] bg-[linear-gradient(180deg,#f1dcc8_0%,#f8ecdf_100%)] p-7 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
            <p className="page-kicker text-[#dd8a63]">How booking works</p>
            <div className="mt-5 space-y-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#167c7d]">01</p>
                <h3 className="mt-2 text-xl font-semibold text-[#0f172a]">Pick the experience first</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#435164]">See one destination-led experience instead of ten repetitive listings with the same photo.</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#167c7d]">02</p>
                <h3 className="mt-2 text-xl font-semibold text-[#0f172a]">Compare hosts clearly</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#435164]">Choose the tour guide or operator that matches your budget, language, and travel style.</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#167c7d]">03</p>
                <h3 className="mt-2 text-xl font-semibold text-[#0f172a]">Book with confidence</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#435164]">Move from discovery to booking with cleaner pricing and fewer marketplace distractions.</p>
              </div>
            </div>
          </div>

          <div className="grid gap-6">
            <div className="rounded-[30px] border border-[#17323d] bg-[#10182b] p-7 shadow-[0_20px_60px_rgba(15,23,42,0.22)]">
              <p className="page-kicker text-[#16d7d0]">Editor picks</p>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                {editorPicks.map((item) => (
                  <Link key={item.id} to={buildTourHref(item)} className="rounded-[22px] border border-white/8 bg-white/5 p-4 transition-colors hover:bg-white/8">
                    {resolveListingImage(item, destinationCoverMap) ? (
                      <img
                        src={resolveListingImage(item, destinationCoverMap)}
                        alt={item.title}
                        className="mb-3 h-28 w-full rounded-[18px] object-cover"
                      />
                    ) : null}
                    <p className="text-[11px] uppercase tracking-[0.22em] text-white/45">{item.city || 'Destination'}</p>
                    <h3 className="mt-2 text-base font-semibold text-white">{item.title}</h3>
                    <p className="mt-3 text-sm text-[#cad3df]">{getListingPriceBadge(item, formatPrice)}</p>
                  </Link>
                ))}
              </div>
            </div>

            <div className="rounded-[30px] border border-[#dfc3d3] bg-[linear-gradient(180deg,#f2dce6_0%,#f9edf3_100%)] p-7 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
              <p className="page-kicker text-[#df5b95]">For hosts</p>
              <h2 className="mt-3 text-3xl font-semibold text-[#0f172a]">Publish tours. Reach travelers. Earn with WadaTrip.</h2>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#435164]">
                Apply once, get reviewed, and publish experiences into a marketplace designed to help travelers compare and book faster.
              </p>
              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <Link
                  to={guideEntryHref}
                  className="inline-flex h-12 items-center justify-center rounded-2xl bg-[#0f172a] px-6 text-sm font-black uppercase tracking-[0.16em] text-white transition-transform hover:scale-[1.02]"
                >
                  {t('home.guide_cta', 'Become a guide')}
                </Link>
                <Link
                  to="/tours"
                  className="inline-flex h-12 items-center justify-center rounded-2xl border border-[#d9bfd0] px-6 text-sm font-semibold text-[#0f172a] transition-colors hover:bg-white/70"
                >
                  {t('home.guide_secondary', 'See marketplace examples')}
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
