// Synthetic outbox only. No real database, email provider, Stripe or network IO.
const { test, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const fs = require('node:fs');

const originalLoad = Module._load;
Module._load = function(name, ...args) {
  if (name === '@wadatrip/db') return { getPrisma: () => prisma };
  if (name === 'stripe' || name === '@prisma/client') throw new Error('External dependency forbidden');
  return originalLoad.call(this, name, ...args);
};
after(() => { Module._load = originalLoad; });

let notifications;
let booking;

function matches(row, where = {}) {
  return Object.entries(where).every(([key, value]) => {
    if (key === 'OR') return value.some(condition => matches(row, condition));
    if (value && typeof value === 'object' && !(value instanceof Date)) {
      if (Object.hasOwn(value, 'lt')) return row[key] < value.lt;
      if (Object.hasOwn(value, 'lte')) return row[key] <= value.lte;
      if (Object.hasOwn(value, 'gte')) return row[key] >= value.gte;
    }
    return value instanceof Date ? +row[key] === +value : row[key] === value;
  });
}

const prisma = {
  booking_notifications: {
    findMany: async ({ where, take }) => notifications.filter(row => matches(row, where)).slice(0, take).map(row => ({ ...row })),
    updateMany: async ({ where, data }) => {
      const rows = notifications.filter(row => matches(row, where));
      for (const row of rows) for (const [key, value] of Object.entries(data)) {
        row[key] = value?.increment ? row[key] + value.increment : value;
      }
      return { count: rows.length };
    },
  },
  bookings: { findUnique: async ({ where }) => where.id === booking.id ? structuredClone(booking) : null },
};

const { sendBookingNotifications } = require('../apps/gateway/dist/apps/gateway/src/services/booking-notifications.service.js');

function row(kind, audience, id = `${kind}-${audience}`) {
  return { id, booking_id: 'synthetic-booking', kind, audience, status: 'pending', attempts: 0,
    next_attempt_at: new Date(0), lease_until: null, claim_id: null, last_error: null, created_at: new Date(0) };
}

beforeEach(() => {
  notifications = [];
  booking = {
    id: 'synthetic-booking', status: 'confirmed', payment_status: 'paid', inventory_state: 'held',
    amount_cents: 5000, currency: 'usd', num_people: 2, date: new Date('2026-11-30T00:00:00.000Z'),
    booking_terms: { departure_at: '2026-11-30T14:30:00.000Z', timezone: 'America/Lima', meeting_point: 'Synthetic public point' },
    user: { name: 'Synthetic Traveler', email: 'traveler@example.invalid', status: 'active' },
    provider: { name: 'Synthetic Host', email: 'host-legacy@example.invalid', owner: { email: 'host@example.invalid', status: 'active' } },
    listing: { title: 'Synthetic Lima Walk', meeting_point: 'Synthetic public point' },
    payment: { status: 'succeeded' },
  };
});

test('confirmed booking notifies traveler and operator once with stable idempotency keys', async () => {
  notifications.push(row('confirmed', 'traveler'), row('confirmed', 'operator'));
  const sent = [];
  const sender = async options => { sent.push(options); return { sent: true }; };
  await Promise.all([sendBookingNotifications(prisma, sender), sendBookingNotifications(prisma, sender)]);
  await sendBookingNotifications(prisma, sender);
  assert.equal(sent.length, 2);
  assert.deepEqual(sent.map(item => item.to).sort(), ['host@example.invalid', 'traveler@example.invalid']);
  assert.deepEqual(sent.map(item => item.idempotencyKey).sort(), ['booking-notification-confirmed-operator', 'booking-notification-confirmed-traveler']);
  assert.ok(sent.every(item => !item.text.includes('payment_intent') && !item.text.includes('token')));
  assert.ok(notifications.every(item => item.status === 'sent' && item.attempts === 1));
});

test('reconciliation, cancellation pending and released inventory never send confirmation', async () => {
  for (const state of [
    { status: 'reconciliation_required', inventory_state: 'held' },
    { status: 'cancellation_pending', inventory_state: 'held' },
    { status: 'confirmed', inventory_state: 'released' },
  ]) {
    notifications = [row('confirmed', 'traveler')]; Object.assign(booking, state);
    let calls = 0;
    await sendBookingNotifications(prisma, async () => { calls++; return { sent: true }; });
    assert.equal(calls, 0); assert.equal(notifications[0].status, 'skipped');
  }
});

test('cancelled booking sends cancellation but skips a stale unsent confirmation', async () => {
  Object.assign(booking, { status: 'cancelled', inventory_state: 'released' });
  notifications.push(row('confirmed', 'traveler'), row('cancelled', 'traveler'));
  const sent = [];
  await sendBookingNotifications(prisma, async options => { sent.push(options); return { sent: true }; });
  assert.equal(sent.length, 1); assert.match(sent[0].subject, /cancelled/i);
  assert.equal(notifications.find(item => item.kind === 'confirmed').status, 'skipped');
  assert.equal(notifications.find(item => item.kind === 'cancelled').status, 'sent');
});

test('failed delivery remains retryable and later succeeds without changing notification identity', async () => {
  notifications.push(row('confirmed', 'traveler'));
  await sendBookingNotifications(prisma, async () => ({ sent: false, reason: 'email_failed' }));
  assert.equal(notifications[0].status, 'pending'); assert.equal(notifications[0].attempts, 1);
  notifications[0].next_attempt_at = new Date(0);
  let key;
  await sendBookingNotifications(prisma, async options => { key = options.idempotencyKey; return { sent: true }; });
  assert.equal(key, 'booking-notification-confirmed-traveler');
  assert.equal(notifications[0].status, 'sent'); assert.equal(notifications[0].attempts, 2);
});

test('missing recipient exhausts safely without logging an email address or message body', async () => {
  notifications.push(row('confirmed', 'traveler')); booking.user.status = 'disabled';
  const logs = [], info = console.info; console.info = value => logs.push(value);
  try {
    for (let attempt = 0; attempt < 5; attempt++) {
      notifications[0].next_attempt_at = new Date(0);
      await sendBookingNotifications(prisma, async () => { throw new Error('should not call sender'); });
    }
  } finally { console.info = info; }
  assert.equal(notifications[0].status, 'failed');
  assert.equal(notifications[0].last_error, 'recipient_not_configured');
  assert.doesNotMatch(logs.join(''), /traveler@example|Synthetic Traveler|meeting point/i);
});

test('disabled operator owner never falls back to an unverified legacy profile email', async () => {
  notifications.push(row('confirmed', 'operator')); booking.provider.owner.status = 'disabled';
  let calls = 0;
  await sendBookingNotifications(prisma, async () => { calls++; return { sent: true }; });
  assert.equal(calls, 0);
  assert.equal(notifications[0].status, 'pending');
  assert.equal(notifications[0].last_error, 'recipient_not_configured');
});

test('migration is additive, constrained and does not backfill historical bookings', () => {
  const sql = fs.readFileSync('libs/db/prisma/migrations/20261012000000_booking_notifications/migration.sql', 'utf8').replace(/--[^\n]*/g, '');
  assert.doesNotMatch(sql, /^\s*(UPDATE|DELETE|DROP|TRUNCATE)\b/m);
  assert.match(sql, /REFERENCES "bookings"/);
  assert.match(sql, /CREATE UNIQUE INDEX "booking_notifications_booking_id_kind_audience_key"/);
  assert.match(sql, /CHECK \("kind" IN \('confirmed', 'cancelled'\)\)/);
  assert.doesNotMatch(sql, /INSERT\s+INTO/i);
});
