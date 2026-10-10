const numericCents = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const cents = Number(value);
  return Number.isFinite(cents) ? cents : null;
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
