const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createCapacityBooking } = require('@wadatrip/common/booking-capacity');
const { bookingTerms, acceptedBookingTerms, departureInstant, cancellationDecision } = require('@wadatrip/common/booking-policy');
const { bookingTransition } = require('../libs/common/dist/booking-transition.js');

function fixture() {
  const listing = { id: 'synthetic-tour', provider_id: 'synthetic-provider', status: 'published', price_from: 50,
    currency: 'USD', tags: [], timezone: 'America/Lima', departure_time: '09:30', booking_cutoff_hours: 24,
    cancellation_policy_version: 'flexible_24h_v1', meeting_point: 'Synthetic meeting point' };
  const created = [];
  const prisma = { listings: { findUnique: async () => listing }, bookings: {
    aggregate: async () => ({ _sum: { num_people: 0 } }),
    create: async ({ data }) => { const b = { id: 'synthetic-booking', ...data }; created.push(b); return b; },
  }, listing_availability: { update: async ({ data }) => data },
  $queryRaw: async (q) => q.join('').includes('listing_availability')
    ? [{ id: 'synthetic-slot', date: new Date('2026-10-10'), spots_total: 20 }] : [{ id: listing.id }],
  $transaction: async fn => fn(prisma) };
  return { listing, created, prisma, body: { listing_id: listing.id, date: '2026-10-10', num_people: 1, policy_version: 'flexible_24h_v1' } };
}

test('server refuses a booking one millisecond after the 24-hour Lima cutoff', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-09T14:30:00.001Z') });
  const f = fixture();
  await assert.rejects(createCapacityBooking(f.prisma, { id: 'synthetic-traveler' }, f.body), /closed|cutoff/i);
  assert.equal(f.created.length, 0);
});

test('late cancellation of a settled booking does not automatically award a refund', () => {
  const next = bookingTransition({ status: 'confirmed', inventory_state: 'held', cancellation_refund_due: false },
    { status: 'succeeded' }, 'cancellation_requested');
  assert.equal(next.status, 'cancelled');
  assert.equal(next.financial, 'succeeded');
  assert.equal(next.resolution, null);
  assert.equal(next.inventory, 'RELEASE');
});

test('terms snapshot requires explicit policy acceptance and uses the listing timezone', () => {
  const listing = { timezone: 'America/Lima', departure_time: '09:30', booking_cutoff_hours: 24,
    cancellation_policy_version: 'flexible_24h_v1', meeting_point: 'Synthetic point' };
  const terms = bookingTerms(listing, '2026-10-10', new Date('2026-10-08T12:00:00.000Z'));
  assert.equal(terms.departure_at, '2026-10-10T14:30:00.000Z');
  assert.equal(terms.bookings_open, true);
  assert.throws(() => acceptedBookingTerms(listing, '2026-10-10', {}), /accept/i);
  const accepted = acceptedBookingTerms(listing, '2026-10-10', { policy_version: 'flexible_24h_v1' });
  assert.equal(accepted.version, 'flexible_24h_v1');
  assert.equal(accepted.timezone, 'America/Lima');
});

test('policy cancellation freezes refund eligibility at the request time', () => {
  const booking = { booking_terms: { version: 'flexible_24h_v1', cancellation_deadline: '2026-10-09T14:30:00.000Z' } };
  assert.equal(cancellationDecision(booking, 'traveler', new Date('2026-10-09T14:29:59.999Z')).cancellation_refund_due, true);
  assert.equal(cancellationDecision(booking, 'traveler', new Date('2026-10-09T14:30:00.001Z')).cancellation_refund_due, false);
  assert.equal(cancellationDecision(booking, 'operator', new Date('2026-10-11T00:00:00.000Z')).cancellation_refund_due, true);
});
