import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppConfig } from '../config/appConfig';
import { findListingIdFromSlug, isLikelyListingId } from '../utils/tourSlug';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

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

function HostOptionCard({ item, selected, onSelect }) {
  const freeTour = Array.isArray(item.tags) && item.tags.includes('free_tour');
  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      className={`w-full rounded-[24px] border p-5 text-left transition-all ${selected
        ? 'border-[#167c7d] bg-[#f2fcfb] shadow-[0_14px_36px_rgba(22,124,125,0.12)]'
        : 'border-[#ebddd0] bg-[#fffdfb] hover:border-[#d8ecea] hover:bg-[#f8fefd]'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-[#7c8aa0]">Host</p>
          <h3 className="mt-1 text-lg font-semibold text-[#0f172a]">{item.provider_name || 'Verified local host'}</h3>
        </div>
        <span className="rounded-full bg-white px-3 py-2 text-xs font-semibold text-[#167c7d] shadow-sm">
          {freeTour ? 'Free option' : formatPrice(item.price_from, item.currency || 'USD')}
        </span>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-[#526173]">
        {item.provider_bio_short || item.description || 'Local operator ready to host this experience.'}
      </p>
      <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.14em]">
        <span className="rounded-full bg-[#eefbfb] px-3 py-2 text-[#167c7d]">Verified host</span>
        {item.duration_hours ? <span className="rounded-full bg-[#fff4eb] px-3 py-2 text-[#c36d1f]">{item.duration_hours}h</span> : null}
        {item.language ? <span className="rounded-full bg-[#fff8fb] px-3 py-2 text-[#b55282]">{item.language}</span> : null}
      </div>
    </button>
  );
}

function TrustItem({ label, copy }) {
  return (
    <div className="rounded-[22px] border border-[#ebddd0] bg-[#fffdfb] p-5 shadow-[0_10px_28px_rgba(15,23,42,0.05)]">
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

        if (mounted) {
          setTour(data);
          setExperienceHosts(hosts);
          setSelectedHost(selected);
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
          <div className="overflow-hidden rounded-[32px] border border-white/12 bg-[linear-gradient(135deg,#0f7f77_0%,#14908d_42%,#dd8a63_100%)] p-8 shadow-[0_28px_80px_rgba(15,23,42,0.22)] md:p-10">
            <div className="space-y-5">
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

          <div className="rounded-[30px] border border-[#ecdccc] bg-[#fffaf5] p-7 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
            <p className="page-kicker text-[#167c7d]">Reserve this experience</p>
            <div className="mt-4 flex items-end justify-between gap-4">
              <div>
                <p className="text-sm text-[#64748b]">Starting from</p>
                <p className="mt-1 text-3xl font-semibold text-[#0f172a]">
                  {isFreeTour ? 'Free' : formatPrice(currentHost?.price_from, currentHost?.currency || 'USD')}
                </p>
              </div>
              <div className="rounded-full bg-[#eefbfb] px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#167c7d]">
                {currentHost?.provider_name || 'Verified host'}
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <Input
                value={bookingForm.name}
                onChange={(event) => handleBookingChange('name', event.target.value)}
                placeholder="Full name"
                className="!rounded-2xl !border-[#d8ecea] !bg-white !text-[#0f172a]"
              />
              <Input
                type="email"
                value={bookingForm.email}
                onChange={(event) => handleBookingChange('email', event.target.value)}
                placeholder="Email"
                className="!rounded-2xl !border-[#d8ecea] !bg-white !text-[#0f172a]"
              />
              <Input
                type="number"
                min="1"
                value={bookingForm.num_people}
                onChange={(event) => handleBookingChange('num_people', event.target.value)}
                placeholder="Travelers"
                className="!rounded-2xl !border-[#d8ecea] !bg-white !text-[#0f172a]"
              />
              <Input
                type="date"
                value={bookingForm.date}
                onChange={(event) => handleBookingChange('date', event.target.value)}
                className="!rounded-2xl !border-[#d8ecea] !bg-white !text-[#0f172a]"
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
