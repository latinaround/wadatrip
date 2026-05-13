import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AppConfig } from '../config/appConfig';
import { buildTourSlug } from '../utils/tourSlug';
import { fetchDestinationCoverMap, resolveListingImage } from '../utils/destinationMedia';
import { buildInstagramUrl, buildWhatsAppUrl, formatGuideRating } from '../utils/guideProfile';
import { Button } from '../components/ui/button';
import BrandLogo from '../components/BrandLogo';

const normalizeBaseUrl = (base) => (base || '').replace(/\/$/, '');

const formatPrice = (value, currency = 'USD') => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return 'Free';
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const normalizeLanguages = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }
  return [];
};

const buildTourHref = (item) => `/tours/${buildTourSlug({ title: item.title, city: item.city, id: item.id })}`;

const isLiveListing = (item) => {
  const status = String(item?.status || '').toLowerCase();
  return status === 'published' || status === 'approved';
};

const isVerifiedGuide = (provider) => {
  const status = String(provider?.status || '').toLowerCase();
  const verification = String(provider?.verification_status || '').toLowerCase();
  return status === 'approved' || status === 'verified' || verification === 'approved' || verification === 'verified';
};

function TourCard({ item, destinationCoverMap }) {
  const coverImage = resolveListingImage(item, destinationCoverMap);

  return (
    <Link
      to={buildTourHref(item)}
      className="group overflow-hidden rounded-[28px] border border-[#ddc3af] bg-[linear-gradient(145deg,#efd9c4_0%,#f7e9db_56%,#eef8f6_100%)] p-5 text-[#0f172a] shadow-[0_18px_52px_rgba(15,23,42,0.10)] transition-transform duration-200 hover:-translate-y-1"
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
        <div className="rounded-full border border-[#f1d6c1] bg-[#ffecde] px-3 py-2 text-xs font-semibold text-[#136f71] shadow-sm">
          {Array.isArray(item.tags) && item.tags.includes('free_tour') ? 'Free option' : formatPrice(item.price_from, item.currency || 'USD')}
        </div>
      </div>
      <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-[#435164]">
        {item.description || 'Hosted local experience ready to book.'}
      </p>
      <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.14em]">
        {item.duration_minutes ? (
          <span className="rounded-full bg-[#fff1e5] px-3 py-2 text-[#c36d1f]">
            {Math.max(1, Math.round(Number(item.duration_minutes) / 60))}h
          </span>
        ) : null}
        {item.category ? (
          <span className="rounded-full bg-[#e7f7f5] px-3 py-2 text-[#167c7d]">{item.category}</span>
        ) : null}
        <span className="rounded-full bg-[#0f172a] px-3 py-2 text-white">View tour</span>
      </div>
    </Link>
  );
}

export default function GuideProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const apiBase = useMemo(() => normalizeBaseUrl(AppConfig.api.baseUrl), []);
  const [provider, setProvider] = useState(null);
  const [destinationCoverMap, setDestinationCoverMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${apiBase}/providers/${encodeURIComponent(id || '')}`);
        const data = await response.json().catch(() => null);
        if (!response.ok) {
          const message = data?.message || data?.error || response.statusText || 'Guide not found';
          throw new Error(message);
        }
        const listings = Array.isArray(data?.listings) ? data.listings : [];
        const covers = await fetchDestinationCoverMap(apiBase, listings);
        if (mounted) {
          setProvider(data);
          setDestinationCoverMap(covers);
        }
      } catch (err) {
        if (mounted) setError(err?.message || 'Guide not found');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [apiBase, id]);

  const languages = useMemo(() => normalizeLanguages(provider?.languages), [provider?.languages]);
  const liveListings = useMemo(() => {
    const rows = Array.isArray(provider?.listings) ? provider.listings : [];
    return rows.filter(isLiveListing).sort((a, b) => {
      const aDate = new Date(a?.created_at || 0).getTime();
      const bDate = new Date(b?.created_at || 0).getTime();
      return bDate - aDate;
    });
  }, [provider?.listings]);
  const whatsappUrl = buildWhatsAppUrl(provider?.phone, provider?.name, liveListings[0]?.title || 'your tours');
  const instagramUrl = buildInstagramUrl(provider?.instagram_handle);
  const verified = isVerifiedGuide(provider);
  const activeCities = useMemo(() => {
    return Array.from(new Set(liveListings.map((item) => String(item.city || '').trim()).filter(Boolean)));
  }, [liveListings]);

  if (loading) {
    return (
      <div className="page-shell">
        <div className="page-container text-[#cad3df]">Loading guide profile...</div>
      </div>
    );
  }

  if (error || !provider) {
    return (
      <div className="page-shell">
        <div className="page-container space-y-4">
          <p className="text-[#cad3df]">{error || 'Guide not found'}</p>
          <Button variant="secondary" onClick={() => navigate(-1)}>Back</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="page-container space-y-8">
        <Button variant="secondary" onClick={() => navigate(-1)}>Back</Button>

        <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-stretch">
          <div className="overflow-hidden rounded-[32px] border border-white/12 bg-[linear-gradient(135deg,#0f7f77_0%,#14908d_42%,#dd8a63_100%)] p-8 shadow-[0_28px_80px_rgba(15,23,42,0.22)] md:p-10">
            <div className="space-y-5">
              <BrandLogo size="sm" light className="mb-2" />
              <p className="page-kicker text-[#dcfffb]">{provider.base_city || 'Local guide'}{provider.country_code ? ` · ${provider.country_code}` : ''}</p>
              <div className="flex items-center gap-4">
                {provider.photo_url ? (
                  <img src={provider.photo_url} alt={provider.name || 'Guide'} className="h-24 w-24 rounded-[28px] object-cover border border-white/20 shadow-[0_18px_36px_rgba(15,23,42,0.22)]" />
                ) : (
                  <div className="flex h-24 w-24 items-center justify-center rounded-[28px] border border-white/20 bg-white/14 text-3xl font-black text-white shadow-[0_18px_36px_rgba(15,23,42,0.22)]">
                    {String(provider.name || 'Guide').slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="space-y-2">
                  <h1 className="text-4xl font-semibold leading-[1.05] text-white md:text-5xl">{provider.name || 'Verified local guide'}</h1>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/80">{provider.type || 'guide'}</p>
                  <p className="text-sm font-semibold text-white/90">{formatGuideRating(provider.ratings_avg, provider.ratings_count)}</p>
                </div>
              </div>
              <p className="max-w-3xl text-base leading-relaxed text-white/86 md:text-lg">
                {provider.bio_short || 'Local host profile for travelers who want a clearer way to compare guides and tours.'}
              </p>
              <div className="flex flex-wrap items-center gap-3">
                {verified ? (
                  <span className="rounded-full bg-white/14 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white">Verified guide</span>
                ) : null}
                <span className="rounded-full bg-white/14 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white">{liveListings.length} live tours</span>
                {activeCities.length ? (
                  <span className="rounded-full bg-white/14 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white">{activeCities.length} destinations</span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="rounded-[30px] border border-[#dcc2ae] bg-[linear-gradient(180deg,#f1dcc8_0%,#f7e9db_52%,#fdf3eb_100%)] p-7 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
            <p className="page-kicker text-[#167c7d]">Guide profile</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="rounded-[22px] border border-[#e4cbbb] bg-[linear-gradient(180deg,#f7e8db_0%,#fdf4ec_100%)] p-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-[#7c8aa0]">Languages</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {languages.length ? languages.map((language) => (
                    <span key={language} className="rounded-full bg-[#e7f7f5] px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#167c7d]">
                      {language}
                    </span>
                  )) : <span className="text-sm text-[#526173]">Not specified</span>}
                </div>
              </div>
              <div className="rounded-[22px] border border-[#e4cbbb] bg-[linear-gradient(180deg,#f7e8db_0%,#fdf4ec_100%)] p-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-[#7c8aa0]">Base</p>
                <p className="mt-3 text-lg font-semibold text-[#0f172a]">
                  {provider.base_city || 'Local guide'}
                  {provider.country_code ? `, ${provider.country_code}` : ''}
                </p>
                <p className="mt-2 text-sm text-[#526173]">{verified ? 'Identity reviewed for marketplace trust.' : 'Profile submitted to the marketplace.'}</p>
              </div>
            </div>

            {whatsappUrl || instagramUrl ? (
              <div className="mt-5 rounded-[24px] border border-[#e4cbbb] bg-[linear-gradient(180deg,#f7e8db_0%,#fdf4ec_100%)] p-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-[#7c8aa0]">Contact</p>
                <div className="mt-3 flex flex-wrap gap-3">
                  {whatsappUrl ? (
                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full border border-[#8de1ac] bg-[#dcfce7] px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-[#106c38]"
                    >
                      Chat on WhatsApp
                    </a>
                  ) : null}
                  {instagramUrl ? (
                    <a
                      href={instagramUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full border border-[#f7bfd8] bg-[#fff0f8] px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-[#b33b74]"
                    >
                      View Instagram
                    </a>
                  ) : null}
                </div>
              </div>
            ) : null}

            {activeCities.length ? (
              <div className="mt-5 rounded-[24px] border border-[#e4cbbb] bg-[linear-gradient(180deg,#f7e8db_0%,#fdf4ec_100%)] p-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-[#7c8aa0]">Active destinations</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {activeCities.map((city) => (
                    <span key={city} className="rounded-full bg-[#fff1e5] px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#c36d1f]">
                      {city}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <section className="space-y-5">
          <div className="space-y-2">
            <p className="page-kicker text-[#167c7d]">Tours by this guide</p>
            <h2 className="text-3xl font-semibold text-white">Active experiences</h2>
            <p className="max-w-3xl text-sm leading-relaxed text-[#cad3df]">
              Travelers can compare these tours before booking, with the guide profile visible up front.
            </p>
          </div>

          {!liveListings.length ? (
            <div className="rounded-[28px] border border-[#17323d] bg-[#10182b] p-6 text-[#cad3df] shadow-[0_20px_60px_rgba(15,23,42,0.22)]">
              This guide does not have live tours published yet.
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
              {liveListings.map((item) => (
                <TourCard key={item.id} item={item} destinationCoverMap={destinationCoverMap} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
