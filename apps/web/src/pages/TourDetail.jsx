import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppConfig } from '../config/appConfig';
import { findListingIdFromSlug, isLikelyListingId } from '../utils/tourSlug';
import { fetchDestinationCoverMap, resolveListingImage, resolveProviderAvatar } from '../utils/destinationMedia';
import { buildGuideHref, buildInstagramUrl, buildWhatsAppUrl, formatGuideRating } from '../utils/guideProfile';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import BrandLogo from '../components/BrandLogo';

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

const buildExperienceKey = (item) => {
  const city = String(item?.city || '').trim().toLowerCase();
  const title = String(item?.title || '').trim().toLowerCase();
  return `${title}::${city}`;
};

const getInitials = (name) =>
  String(name || 'Host')
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

function HostOptionCard({ item, selected, onSelect }) {
  const freeTour = Array.isArray(item.tags) && item.tags.includes('free_tour');
  const initials = getInitials(item.provider_name);
  const avatar = resolveProviderAvatar(item);
  const whatsappUrl = buildWhatsAppUrl(item.provider_phone, item.provider_name, item.title);
  const instagramUrl = buildInstagramUrl(item.provider_instagram_handle);
  const guideHref = buildGuideHref(item.provider_id);

  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      className={`w-full rounded-[24px] border p-5 text-left transition-all ${selected
        ? 'border-[#167c7d] bg-[linear-gradient(180deg,#e7f7f5_0%,#f3fcfb_100%)] shadow-[0_14px_36px_rgba(22,124,125,0.12)]'
        : 'border-[#e1cdbd] bg-[linear-gradient(180deg,#f7e8db_0%,#fdf5ee_100%)] hover:border-[#d8ecea] hover:bg-[#f8fefd]'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {avatar ? (
            <img src={avatar} alt={item.provider_name || 'Host'} className="h-12 w-12 rounded-2xl object-cover shadow-[0_10px_24px_rgba(21,146,145,0.24)]" />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#16d7d0_0%,#159291_100%)] text-sm font-black text-white shadow-[0_10px_24px_rgba(21,146,145,0.24)]">
              {initials}
            </div>
          )}
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-[#7c8aa0]">Host</p>
            <h3 className="mt-1 text-lg font-semibold text-[#0f172a]">{item.provider_name || 'Verified local host'}</h3>
            <p className="mt-1 text-xs font-semibold text-[#526173]">
              {formatGuideRating(item.provider_ratings_avg, item.provider_ratings_count)}
            </p>
          </div>
        </div>
        <span className="rounded-full border border-[#ecd0bc] bg-[#ffebdc] px-3 py-2 text-xs font-semibold text-[#136f71] shadow-sm">
          {freeTour ? 'Free option' : formatPrice(item.price_from, item.currency || 'USD')}
        </span>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-[#526173]">
        {item.provider_bio_short || item.description || 'Local operator ready to host this experience.'}
      </p>
      {guideHref || whatsappUrl || instagramUrl ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {guideHref ? (
            <a
              href={guideHref}
              className="rounded-full border border-[#c8e2de] bg-[#e7f7f5] px-3 py-2 text-xs font-semibold text-[#167c7d]"
              onClick={(event) => event.stopPropagation()}
            >
              Guide profile
            </a>
          ) : null}
          {whatsappUrl ? (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-[#8de1ac] bg-[#dcfce7] px-3 py-2 text-xs font-semibold text-[#106c38]"
              onClick={(event) => event.stopPropagation()}
            >
              WhatsApp
            </a>
          ) : null}
          {instagramUrl ? (
            <a
              href={instagramUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-[#f7bfd8] bg-[#fff0f8] px-3 py-2 text-xs font-semibold text-[#b33b74]"
              onClick={(event) => event.stopPropagation()}
            >
              Instagram
            </a>
          ) : null}
        </div>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.14em]">
        <span className="rounded-full bg-[#e7f7f5] px-3 py-2 text-[#167c7d]">Verified host</span>
        {item.duration_hours ? <span className="rounded-full bg-[#fff1e5] px-3 py-2 text-[#c36d1f]">{item.duration_hours}h</span> : null}
        {item.language ? <span className="rounded-full bg-[#f7e9f0] px-3 py-2 text-[#b55282]">{item.language}</span> : null}
      </div>
    </button>
  );
}

function TrustItem({ label, copy }) {
  return (
    <div className="rounded-[22px] border border-[#dec8b6] bg-[linear-gradient(180deg,#f5e4d3_0%,#fcf4ec_100%)] p-5 shadow-[0_10px_28px_rgba(15,23,42,0.05)]">
      <p className="text-[11px] uppercase tracking-[0.22em] text-[#167c7d]">{label}</p>
      <p className="mt-2 text-sm leading-relaxed text-[#526173]">{copy}</p>
    </div>
  );
}

export default function TourDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const apiBase = useMemo(() => normalizeBaseUrl(AppConfig.api.baseUrl), []);
  const [tour, setTour] = useState(null);
  const [experienceHosts, setExperienceHosts] = useState([]);
  const [destinationCoverMap, setDestinationCoverMap] = useState({});
  const [selectedHost, setSelectedHost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [bookingError, setBookingError] = useState(null);
  const [bookingSuccess, setBookingSuccess] = useState(null);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingForm, setBookingForm] = useState({
    name: '',
    email: '',
    num_people: 1,
    date: '',
  });

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        let data = null;
        let rows = [];
        const isId = isLikelyListingId(id);
        let listingId = id;
        const fallback = await fetch(`${apiBase}/listings/search?status=published&limit=100`);
        const fallbackData = await fallback.json().catch(() => null);
        rows = Array.isArray(fallbackData?.items) ? fallbackData.items : [];

        if (!isId) {
          listingId = findListingIdFromSlug(id, rows);
          data = rows.find((item) => String(item.id) === String(listingId)) || null;
        }

        if (!data && listingId) {
          const response = await fetch(`${apiBase}/listings/${encodeURIComponent(listingId)}`);
          if (response.ok) {
            data = await response.json().catch(() => null);
          }
        }

        if (!data) throw new Error('Tour not found');

        const experienceKey = buildExperienceKey(data);
        const groupedHosts = rows.filter((item) => buildExperienceKey(item) === experienceKey);
        const hosts = groupedHosts.length ? groupedHosts : [data];
        const selected = hosts.find((item) => String(item.id) === String(data.id)) || hosts[0] || data;
        const covers = await fetchDestinationCoverMap(apiBase, hosts);

        if (mounted) {
          setTour(data);
          setExperienceHosts(hosts);
          setSelectedHost(selected);
          setDestinationCoverMap(covers);
        }
      } catch (err) {
        if (mounted) setError(err?.message || 'Error loading tour');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [apiBase, id]);

  const currentHost = selectedHost || tour;
  const isFreeTour = Array.isArray(currentHost?.tags) && currentHost.tags.includes('free_tour');
  const currentHostInitials = getInitials(currentHost?.provider_name);
  const currentHostAvatar = resolveProviderAvatar(currentHost);
  const heroImage = resolveListingImage(currentHost || tour, destinationCoverMap);
  const currentHostWhatsappUrl = buildWhatsAppUrl(currentHost?.provider_phone, currentHost?.provider_name, currentHost?.title);
  const currentHostInstagramUrl = buildInstagramUrl(currentHost?.provider_instagram_handle);
  const currentGuideHref = buildGuideHref(currentHost?.provider_id);

  const handleBookingChange = (field, value) => {
    setBookingForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleBooking = async () => {
    if (!currentHost) return;
    setBookingError(null);
    setBookingSuccess(null);
    setBookingLoading(true);
    try {
      const numPeople = Math.max(1, Number(bookingForm.num_people || 1));
      const unitPrice = Number(currentHost.price_from || 0);
      const totalPrice = isFreeTour ? 0 : unitPrice > 0 ? unitPrice * numPeople : null;
      const amountCents = totalPrice != null ? Math.round(Number(totalPrice) * 100) : null;

      const bookingResponse = await fetch(`${apiBase}/bookings/simple`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listing_id: currentHost.id,
          name: bookingForm.name || 'Guest User',
          email: bookingForm.email || 'guest@wadatrip.com',
          num_people: numPeople,
          date: bookingForm.date || undefined,
          total_price: totalPrice,
          amount_cents: amountCents,
        }),
      });

      const bookingData = await bookingResponse.json().catch(() => null);
      if (!bookingResponse.ok || !bookingData?.id) {
        const message = bookingData?.message || bookingData?.error || bookingResponse.statusText || 'Booking failed';
        throw new Error(message);
      }

      if (isFreeTour) {
        setBookingSuccess('Registration confirmed. Your host will contact you.');
        return;
      }

      const checkoutResponse = await fetch(
        `${apiBase}/payments/bookings/${encodeURIComponent(bookingData.id)}/checkout`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' } },
      );
      const checkoutData = await checkoutResponse.json().catch(() => null);
      if (!checkoutResponse.ok || !checkoutData?.url) {
        const message = checkoutData?.message || checkoutData?.error || checkoutResponse.statusText || 'Checkout URL missing';
        throw new Error(message);
      }

      setBookingSuccess('Booking created. Redirecting to Stripe...');
      window.location.href = checkoutData.url;
    } catch (err) {
      setBookingError(err?.message || 'Error creating booking');
    } finally {
      setBookingLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="page-shell">
        <div className="page-container text-[#cad3df]">Loading experience...</div>
      </div>
    );
  }

  if (error || !tour) {
    return (
      <div className="page-shell">
        <div className="page-container space-y-4">
          <p className="text-[#cad3df]">{error || 'Tour not found'}</p>
          <Button variant="secondary" onClick={() => navigate(-1)}>Back</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="page-container space-y-8">
        <Button variant="secondary" onClick={() => navigate(-1)}>Back</Button>

        <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
          <div
            className="overflow-hidden rounded-[32px] border border-white/12 bg-[linear-gradient(135deg,#0f7f77_0%,#14908d_42%,#dd8a63_100%)] p-8 shadow-[0_28px_80px_rgba(15,23,42,0.22)] md:p-10"
            style={
              heroImage
                ? {
                    backgroundImage: `linear-gradient(135deg, rgba(15,127,119,0.75) 0%, rgba(20,144,141,0.64) 42%, rgba(221,138,99,0.70) 100%), url(${heroImage})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }
                : undefined
            }
          >
            <div className="space-y-5">
              <BrandLogo size="sm" light className="mb-2" />
              <p className="page-kicker text-[#dcfffb]">{tour.city || 'Destination'} {tour.country_code ? `· ${tour.country_code}` : ''}</p>
              <h1 className="max-w-3xl text-4xl font-semibold leading-[1.05] text-white md:text-6xl">{tour.title}</h1>
              <p className="max-w-2xl text-base leading-relaxed text-white/86 md:text-lg">
                {tour.description || 'Local experience hosted by verified tour guides and operators.'}
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-white/14 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white">{experienceHosts.length} host options</span>
                <span className="rounded-full bg-white/14 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white">Verified marketplace</span>
                <span className="rounded-full bg-white/14 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white">Secure checkout</span>
              </div>
            </div>
          </div>

          <div className="rounded-[30px] border border-[#dcc2ae] bg-[linear-gradient(180deg,#f1dcc8_0%,#f7e9db_52%,#fdf3eb_100%)] p-7 shadow-[0_18px_50px_rgba(15,23,42,0.08)] lg:sticky lg:top-24">
            <p className="page-kicker text-[#167c7d]">Reserve this experience</p>
            <div className="mt-4 flex items-end justify-between gap-4">
              <div>
                <p className="text-sm text-[#64748b]">Starting from</p>
                <p className="mt-1 text-3xl font-semibold text-[#0f172a]">
                  {isFreeTour ? 'Free' : formatPrice(currentHost?.price_from, currentHost?.currency || 'USD')}
                </p>
              </div>
              <div className="rounded-full bg-[#e7f7f5] px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#167c7d]">
                {currentHost?.provider_name || 'Verified host'}
              </div>
            </div>

            <div className="mt-5 rounded-[24px] border border-[#e4cbbb] bg-[linear-gradient(180deg,#f7e8db_0%,#fdf4ec_100%)] p-4">
              <div className="flex items-start gap-3">
                {currentHostAvatar ? (
                  <img src={currentHostAvatar} alt={currentHost?.provider_name || 'Host'} className="h-14 w-14 rounded-2xl object-cover shadow-[0_12px_28px_rgba(21,146,145,0.22)]" />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#16d7d0_0%,#159291_100%)] text-base font-black text-white shadow-[0_12px_28px_rgba(21,146,145,0.22)]">
                    {currentHostInitials}
                  </div>
                )}
                <div className="space-y-1">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-[#7c8aa0]">Meet your host</p>
                  <h3 className="text-lg font-semibold text-[#0f172a]">{currentHost?.provider_name || 'Verified local host'}</h3>
                  <p className="text-xs font-semibold text-[#526173]">
                    {formatGuideRating(currentHost?.provider_ratings_avg, currentHost?.provider_ratings_count)}
                  </p>
                  <p className="text-sm leading-relaxed text-[#526173]">{currentHost?.provider_bio_short || 'Verified local guide or operator ready to host this experience.'}</p>
                  {currentGuideHref || currentHostWhatsappUrl || currentHostInstagramUrl ? (
                    <div className="flex flex-wrap gap-2 pt-2">
                      {currentGuideHref ? (
                        <a
                          href={currentGuideHref}
                          className="rounded-full border border-[#c8e2de] bg-[#e7f7f5] px-3 py-2 text-xs font-semibold text-[#167c7d]"
                        >
                          View guide profile
                        </a>
                      ) : null}
                      {currentHostWhatsappUrl ? (
                        <a
                          href={currentHostWhatsappUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-full border border-[#8de1ac] bg-[#dcfce7] px-3 py-2 text-xs font-semibold text-[#106c38]"
                        >
                          Chat on WhatsApp
                        </a>
                      ) : null}
                      {currentHostInstagramUrl ? (
                        <a
                          href={currentHostInstagramUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-full border border-[#f7bfd8] bg-[#fff0f8] px-3 py-2 text-xs font-semibold text-[#b33b74]"
                        >
                          View Instagram
                        </a>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <Input
                value={bookingForm.name}
                onChange={(event) => handleBookingChange('name', event.target.value)}
                placeholder="Full name"
                className="!rounded-2xl !border-[#d7e6e3] !bg-[#fff5ec] !text-[#172033]"
              />
              <Input
                type="email"
                value={bookingForm.email}
                onChange={(event) => handleBookingChange('email', event.target.value)}
                placeholder="Email"
                className="!rounded-2xl !border-[#d7e6e3] !bg-[#fff5ec] !text-[#172033]"
              />
              <Input
                type="number"
                min="1"
                value={bookingForm.num_people}
                onChange={(event) => handleBookingChange('num_people', event.target.value)}
                placeholder="Travelers"
                className="!rounded-2xl !border-[#d7e6e3] !bg-[#fff5ec] !text-[#172033]"
              />
              <Input
                type="date"
                value={bookingForm.date}
                onChange={(event) => handleBookingChange('date', event.target.value)}
                className="!rounded-2xl !border-[#d7e6e3] !bg-[#fff5ec] !text-[#172033]"
              />
            </div>

            {bookingError && <p className="mt-4 text-sm text-[#d15371]">{bookingError}</p>}
            {bookingSuccess && <p className="mt-4 text-sm text-[#167c7d]">{bookingSuccess}</p>}

            <Button className="mt-5 h-12 w-full rounded-2xl bg-[#0f172a] text-sm font-black uppercase tracking-[0.16em] text-white hover:scale-[1.01] hover:bg-[#167c7d]" onClick={handleBooking} disabled={bookingLoading}>
              {bookingLoading ? 'Processing...' : isFreeTour ? 'Reserve Your Spot' : 'Book And Pay'}
            </Button>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <TrustItem label="Why travelers book" copy="Cleaner listings, verified hosts, and less duplicated marketplace noise." />
          <TrustItem label="What changes here" copy="You choose the experience first, then pick the host that fits your style and budget." />
          <TrustItem label="Before you pay" copy="Confirm the date, traveler count, and host you want before moving to checkout." />
        </section>

        <section className="space-y-5">
          <div className="space-y-2">
            <p className="page-kicker text-[#167c7d]">Available hosts</p>
            <h2 className="text-3xl font-semibold text-white">Meet your host options</h2>
            <p className="max-w-3xl text-sm leading-relaxed text-[#cad3df]">
              Compare verified tour guides and operators for the same experience. Choose by trust, style, and price instead of browsing repetitive cards.
            </p>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {experienceHosts.map((item) => (
              <HostOptionCard
                key={item.id}
                item={item}
                selected={String(currentHost?.id) === String(item.id)}
                onSelect={setSelectedHost}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
