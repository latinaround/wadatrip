const numericCents = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const cents = Number(value);
  return Number.isFinite(cents) ? cents : null;
};

// Only persisted processor mode proves a Sandbox payment. Unknown historical
// records stay visible; names, email addresses and processor ID formats prove nothing.
export const separateTestActivity = (bookings = [], payments = []) => {
  const modesByBooking = new Map();
  for (const payment of payments) {
    if (!payment.bookingId) continue;
    const modes = modesByBooking.get(payment.bookingId) || new Set();
    modes.add(payment.processorMode);
    modesByBooking.set(payment.bookingId, modes);
  }
  const isTestBooking = booking => {
    const modes = modesByBooking.get(booking.id);
    // Never hide a booking with evidence of a real payment, even if data conflicts.
    if (booking.processorMode === 'live' || modes?.has('live')) return false;
    return booking.processorMode === 'test' || modes?.has('test');
  };
  return {
    bookings: bookings.filter(booking => !isTestBooking(booking)),
    testBookings: bookings.filter(isTestBooking),
    payments: payments.filter(payment => payment.processorMode !== 'test'),
    testPayments: payments.filter(payment => payment.processorMode === 'test'),
  };
};

// Presentation only: never change the stored lifecycle or infer Test/Live mode.
export const partitionBookingHistory = (bookings = [], now = Date.now()) => {
  const current = [], historical = [];
  const financialAttention = new Set(['payment_pending', 'cancellation_pending', 'reconciliation_required',
    'refund_required', 'processing', 'requires_action', 'requires_capture', 'requires_confirmation', 'requires_payment_method']);
  for (const booking of bookings) {
    const status = String(booking.status || '').toLowerCase();
    const payment = String(booking.paymentStatus || '').toLowerCase();
    let archive = false;
    if (!financialAttention.has(status) && payment !== 'pending' && !financialAttention.has(payment)) {
      const inactive = ['cancelled', 'canceled', 'rejected', 'completed', 'payment_failed'].includes(status);
      // A cancelled but paid record may still need financial review.
      const unsettledCancellation = inactive && status !== 'completed' && ['paid', 'succeeded', 'partially_refunded'].includes(payment);
      if (!unsettledCancellation && inactive) archive = true;
      else if (!unsettledCancellation && ['pending', 'confirmed'].includes(status)) {
        const departure = booking.departureAt ? Date.parse(booking.departureAt) : NaN;
        if (Number.isFinite(departure)) archive = departure < now;
        else {
          const day = String(booking.date || '').match(/^\d{4}-\d{2}-\d{2}/)?.[0];
          const parsed = day ? new Date(`${day}T00:00:00Z`) : null;
          if (parsed && Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === day) {
            try {
              const parts = new Intl.DateTimeFormat('en-US', { timeZone: booking.timezone || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(now));
              const value = type => parts.find(part => part.type === type).value;
              archive = day < `${value('year')}-${value('month')}-${value('day')}`;
            } catch { /* Ambiguous historical dates stay visible for review. */ }
          }
        }
      }
    }
    (archive ? historical : current).push(booking);
  }
  return { current, historical };
};

export const paymentAmountCents = (payment = {}) => {
  for (const value of [
    payment.amount_charged_cents,
    payment.amount_gross_cents,
    payment.amount_cents,
  ]) {
    const cents = numericCents(value);
    if (cents !== null) return cents;
  }

  for (const value of [payment.amount, payment.total]) {
    const amount = Number(value);
    if (Number.isFinite(amount)) return Math.round(amount * 100);
  }

  return 0;
};

export const formatBookingDeparture = (booking = {}, locale) => {
  const departureAt = booking.departureAt;
  const timezone = booking.timezone;
  if (departureAt && timezone) {
    const departure = new Date(departureAt);
    if (!Number.isNaN(departure.getTime())) {
      try {
        const label = new Intl.DateTimeFormat(locale, {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          timeZone: timezone,
        }).format(departure);
        return `${label} (${timezone})`;
      } catch {
        // Fall through to the canonical booking day when legacy timezone data is invalid.
      }
    }
  }

  const day = String(booking.date || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!day) return booking.date || 'No date';
  const dateOnly = new Date(Date.UTC(Number(day[1]), Number(day[2]) - 1, Number(day[3]), 12));
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(dateOnly);
};
