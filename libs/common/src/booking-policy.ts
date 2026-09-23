import { BadRequestException, ConflictException } from '@nestjs/common';

export const CANCELLATION_POLICY_VERSION = 'flexible_24h_v1';
export const CANCELLATION_POLICY_TEXT = 'Cancelación con al menos 24 horas de anticipación: reembolso completo. Con menos de 24 horas o si no te presentas: sin reembolso, siempre que el operador cumpla lo contratado. Si el operador cancela o no puede realizar el tour por seguridad: reembolso completo o cambio de fecha a tu elección. Se mantienen los derechos legales del consumidor.';
const HOUR = 3600000;

// Existing inventory keys are calendar days. Convert a local departure without using the server timezone.
// Ambiguous or nonexistent DST times fail closed; no guessed offsets or parsing of human instructions.
export function departureInstant(date: string, time: string, timezone: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time || '')) {
    throw new BadRequestException('A valid departure date and time are required');
  }
  let formatter: Intl.DateTimeFormat;
  try { formatter = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }); }
  catch { throw new BadRequestException('A valid departure timezone is required'); }
  if (!timezone) throw new BadRequestException('A departure timezone is required');
  const local = new Date(`${date}T${time}:00.000Z`);
  if (!Number.isFinite(+local) || local.toISOString().slice(0, 10) !== date) throw new BadRequestException('Invalid departure date');
  const parts = (instant: number) => Object.fromEntries(formatter.formatToParts(new Date(instant)).map(p => [p.type, p.value]));
  const encoded = (instant: number) => { const p = parts(instant); return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second); };
  const offsets = new Set([-48, -24, 0, 24, 48].map(h => { const probe = +local + h * HOUR; return encoded(probe) - probe; }));
  const candidates = [...offsets].map(offset => +local - offset).filter(instant => encoded(instant) === +local);
  if (candidates.length !== 1) throw new ConflictException('Departure time is ambiguous or does not exist in this timezone');
  return new Date(candidates[0]);
}

export function bookingTerms(listing: any, date: string, now = new Date()) {
  const cutoff = listing?.booking_cutoff_hours;
  const version = listing?.cancellation_policy_version;
  if (cutoff == null && !version && !listing?.departure_time) return null; // Historical contract, no invented policy.
  if (cutoff != null && (!Number.isInteger(cutoff) || cutoff < 0 || cutoff > 8760)) throw new ConflictException('Invalid booking cutoff');
  if (version && version !== CANCELLATION_POLICY_VERSION) throw new ConflictException('Unsupported cancellation policy');
  const departure = departureInstant(date, listing.departure_time, listing.timezone);
  const closes = new Date(+departure - (cutoff ?? 0) * HOUR);
  return { version: version || null, departure_at: departure.toISOString(), timezone: listing.timezone,
    booking_closes_at: closes.toISOString(), cancellation_deadline: new Date(+departure - 24 * HOUR).toISOString(),
    cancellation_policy: version ? CANCELLATION_POLICY_TEXT : listing.cancellation_policy || null,
    meeting_point: listing.meeting_point || null, bookings_open: +now <= +closes && +now < +departure };
}

export function acceptedBookingTerms(listing: any, date: string, body: any, now = new Date()) {
  const terms = bookingTerms(listing, date, now);
  if (!terms) return null;
  if (!terms.bookings_open) throw new ConflictException('Booking cutoff reached: reservations are closed');
  if (terms.version && body?.policy_version !== terms.version) throw new ConflictException('Review and accept the current cancellation policy before booking');
  return { ...terms, accepted_at: now.toISOString() };
}

export function requirePaymentBeforeCutoff(booking: any, now = new Date()) {
  const terms = booking.booking_terms;
  if (!terms) return;
  const deadline = Date.parse(terms.booking_closes_at);
  if (!Number.isFinite(deadline) || +now > deadline) throw new ConflictException('Booking cutoff reached: reservations are closed');
}

export function cancellationDecision(booking: any, source: 'traveler' | 'operator', now = new Date()) {
  if (booking.booking_terms?.version !== CANCELLATION_POLICY_VERSION) throw new ConflictException('This historical booking requires cancellation review');
  const deadline = Date.parse(booking.booking_terms.cancellation_deadline);
  if (!Number.isFinite(deadline)) throw new ConflictException('Cancellation deadline is unknown');
  return { cancellation_requested_at: now, cancellation_source: source,
    cancellation_refund_due: source === 'operator' || +now <= deadline };
}

// Only this named policy is automated. Arbitrary operator prose never drives money decisions.
export function policyConfiguration(body: any) {
  if (body?.cancellation_policy_version !== CANCELLATION_POLICY_VERSION) throw new BadRequestException('Choose the supported cancellation policy');
  if (!Number.isInteger(body.booking_cutoff_hours) || body.booking_cutoff_hours < 0 || body.booking_cutoff_hours > 8760) throw new BadRequestException('Invalid booking cutoff');
  departureInstant('2026-01-15', body.departure_time, body.timezone);
  if (typeof body.meeting_point !== 'string' || !body.meeting_point.trim() || body.meeting_point.length > 2000) throw new BadRequestException('A public meeting point is required');
  return { departure_time: body.departure_time, timezone: body.timezone,
    booking_cutoff_hours: body.booking_cutoff_hours, meeting_point: body.meeting_point.trim(),
    cancellation_policy_version: CANCELLATION_POLICY_VERSION, cancellation_policy: CANCELLATION_POLICY_TEXT };
}
