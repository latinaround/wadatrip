import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppConfig } from '../config/appConfig';
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

export default function TourDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const apiBase = useMemo(() => normalizeBaseUrl(AppConfig.api.baseUrl), []);
  const [tour, setTour] = useState(null);
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
        const response = await fetch(`${apiBase}/listings/${encodeURIComponent(id)}`);
        if (response.ok) {
          data = await response.json().catch(() => null);
        } else {
          const fallback = await fetch(`${apiBase}/listings/search?limit=50`);
          const fallbackData = await fallback.json().catch(() => null);
          const items = Array.isArray(fallbackData?.items) ? fallbackData.items : [];
          data = items.find((item) => String(item.id) === String(id)) || null;
        }
        if (!data) throw new Error('Tour not found');
        if (mounted) setTour(data);
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

  const handleBookingChange = (field, value) => {
    setBookingForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleBooking = async () => {
    if (!tour) return;
    setBookingError(null);
    setBookingSuccess(null);
    setBookingLoading(true);
    try {
      const numPeople = Math.max(1, Number(bookingForm.num_people || 1));
      const unitPrice = Number(tour.price_from || 0);
      const totalPrice = unitPrice > 0 ? unitPrice * numPeople : null;
      const amountCents = totalPrice ? Math.round(totalPrice * 100) : null;

      const bookingResponse = await fetch(`${apiBase}/bookings/simple`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listing_id: tour.id,
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
        <div className="page-container">Loading tour...</div>
      </div>
    );
  }

  if (error || !tour) {
    return (
      <div className="page-shell">
        <div className="page-container space-y-4">
          <p>{error || 'Tour not found'}</p>
          <Button variant="secondary" onClick={() => navigate(-1)}>Back</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="page-container space-y-8">
        <Button variant="secondary" onClick={() => navigate(-1)}>Back</Button>

        <div className="page-card p-6">
          <div className="space-y-3">
            <p className="text-xs uppercase text-slate-500">{tour.city || '-'} {tour.country_code ? `(${tour.country_code})` : ''}</p>
            <h1 className="text-3xl font-bold text-slate-900">{tour.title}</h1>
            {tour.provider_name && (
              <p className="text-sm text-slate-600">
                Operated by {tour.provider_name}
                {tour.provider_country ? ` (${tour.provider_country})` : ''}
              </p>
            )}
            <p className="text-slate-600">{tour.description || 'Experience hosted by a local partner.'}</p>
            <div className="text-2xl font-semibold text-teal-700">
              {formatPrice(tour.price_from, tour.currency || 'USD')}
            </div>
          </div>
        </div>

        <div className="page-card p-6 space-y-4">
          <h2 className="text-xl font-semibold text-slate-900">Book now</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              value={bookingForm.name}
              onChange={(event) => handleBookingChange('name', event.target.value)}
              placeholder="Full name"
              className="border-slate-200 bg-white text-slate-900 placeholder:text-slate-400"
            />
            <Input
              type="email"
              value={bookingForm.email}
              onChange={(event) => handleBookingChange('email', event.target.value)}
              placeholder="Email"
              className="border-slate-200 bg-white text-slate-900 placeholder:text-slate-400"
            />
            <Input
              type="number"
              min="1"
              value={bookingForm.num_people}
              onChange={(event) => handleBookingChange('num_people', event.target.value)}
              placeholder="Travelers"
              className="border-slate-200 bg-white text-slate-900 placeholder:text-slate-400"
            />
            <Input
              type="date"
              value={bookingForm.date}
              onChange={(event) => handleBookingChange('date', event.target.value)}
              className="border-slate-200 bg-white text-slate-900 placeholder:text-slate-400"
            />
          </div>
          {bookingError && <p className="text-rose-600">{bookingError}</p>}
          {bookingSuccess && <p className="text-teal-700">{bookingSuccess}</p>}
          <Button className="bg-orange-500 text-white hover:bg-orange-600" onClick={handleBooking} disabled={bookingLoading}>
            {bookingLoading ? 'Processing...' : 'Book and pay'}
          </Button>
        </div>
      </div>
    </div>
  );
}
