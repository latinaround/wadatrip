import { useId } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { formatBookingDeparture } from '../utils/accountDisplay.js';

// Read-only presentation of the authenticated booking. A redirect is never proof of payment.
export default function BookingDetails({ booking }) {
  const { t, i18n } = useTranslation();
  const headingId = useId();
  const missing = t('booking_summary.unavailable');
  const terms = booking.booking_terms;
  const currency = String(booking.currency || '').trim().toUpperCase();
  let total = missing;
  if (Number.isSafeInteger(booking.amount_cents) && booking.amount_cents >= 0 && /^[A-Z]{3}$/.test(currency)) {
    try {
      total = new Intl.NumberFormat(i18n.resolvedLanguage, {
        style: 'currency', currency, currencyDisplay: 'code',
      }).format(booking.amount_cents / 100);
    } catch { /* Unknown historical currency must not become an invented amount. */ }
  }
  const departure = booking.date || terms?.departure_at ? formatBookingDeparture({
    date: booking.date, departureAt: terms?.departure_at, timezone: terms?.timezone,
  }, i18n.resolvedLanguage) : missing;
  const fields = [
    ['host', booking.provider?.name || missing],
    ['departure', departure],
    ['travelers', Number.isSafeInteger(booking.num_people) && booking.num_people >= 1 ? booking.num_people : missing],
    ['total', total],
    // The current listing can change after purchase. Use the contractual snapshot only.
    ['meeting', terms?.meeting_point || missing],
    ['reference', booking.id],
  ];
  return (
    <section aria-labelledby={headingId} className="rounded-2xl border border-white/20 bg-white/5 p-5 text-left">
      <h2 id={headingId} className="text-xl font-semibold">{t('booking_summary.title')}</h2>
      {booking.listing?.title && <p className="mt-2 text-lg font-semibold">{booking.listing.title}</p>}
      <dl className="mt-4 grid gap-4 sm:grid-cols-2">
        {fields.map(([key, value]) => <div key={key} className="min-w-0">
          <dt className="text-sm text-[#cad3df]">{t(`booking_summary.${key}`)}</dt>
          <dd className="mt-1 whitespace-pre-line break-words font-medium">{value}</dd>
        </div>)}
      </dl>
      <p className="mt-5 text-sm">{t('booking_summary.help')} <Link className="font-semibold text-[#22d3ee] underline" to="/contact">{t('booking_summary.support')}</Link></p>
    </section>
  );
}
