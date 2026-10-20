// Real Nest routes + JWT, synthetic Prisma only. No Stripe, remote DB, email, or .env.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const ModuleLoader = require('node:module');
require('reflect-metadata');
process.env.JWT_SECRET = 'synthetic-inbox-test-secret-only';
process.env.NODE_ENV = 'test';
process.env.ADMIN_REQUIRE_MFA = 'false';
process.env.ADMIN_EMAILS = '';
process.env.ADMIN_USER_IDS = '';
process.env.FF_PROVIDER_HUB = 'false';
for (const name of ['DATABASE_URL', 'DATABASE_URL_LOCAL', 'DATABASE_URL_REMOTE', 'STRIPE_SECRET_KEY', 'STRIPE_SECRET', 'STRIPE_WEBHOOK_SECRET']) delete process.env[name];
const jwt = require('jsonwebtoken');
const users = ['owner-a', 'owner-b', 'traveler', 'admin', 'inactive'].map(id => ({ id, email: `${id}@example.test`, name: id, role: id === 'admin' ? 'admin' : 'traveler', status: id === 'inactive' ? 'inactive' : 'active' }));
let bookings, receipts;
const key = (booking, user) => `${booking}:${user}`;
function matches(row, where) {
  return Object.entries(where || {}).every(([field, value]) => {
    if (field === 'AND') return value.every(w => matches(row, w));
    if (field === 'OR') return value.some(w => matches(row, w));
    if (field === 'operator_reviews') return !receipts.has(key(row.id, value.none.user_id));
    if (field === 'payment') return value.is === null ? row.payment === null : row.payment !== null && matches(row.payment, value.is);
    if (field === 'provider') return matches(row.provider, value);
    if (value && typeof value === 'object') {
      if (Object.hasOwn(value, 'not')) return row[field] != null && row[field] !== value.not;
      if (value.notIn) return row[field] != null && !value.notIn.includes(row[field]);
    }
    return row[field] === value;
  });
}
const prisma = {
  users: { findUnique: async ({ where }) => users.find(u => u.id === where.id) },
  providers: { findFirst: async ({ where }) => ['owner-a', 'owner-b'].includes(where.user_id) ? { id: `provider-${where.user_id}` } : null },
  bookings: {
    count: async ({ where }) => bookings.filter(b => matches(b, where)).length,
    findMany: async ({ where, take }) => bookings.filter(b => matches(b, where)).sort((a, b) => b.created_at - a.created_at || b.id.localeCompare(a.id)).slice(0, take),
    findFirst: async ({ where }) => bookings.find(b => matches(b, where)) || null,
  },
  operator_booking_reviews: {
    createMany: async ({ data, skipDuplicates }) => {
      assert.equal(skipDuplicates, true);
      for (const row of data) if (!receipts.has(key(row.booking_id, row.user_id))) receipts.set(key(row.booking_id, row.user_id), { ...row, reviewed_at: new Date() });
    },
    findUniqueOrThrow: async ({ where }) => {
      const pair = where.booking_id_user_id;
      const row = receipts.get(key(pair.booking_id, pair.user_id));
      assert.ok(row); return row;
    },
  },
  $transaction: async fn => fn(prisma),
};
const originalLoad = ModuleLoader._load;
ModuleLoader._load = function(name, parent, main) {
  if (name === '@wadatrip/db') return { getPrisma: () => prisma };
  if (name === '@prisma/client' || name === 'stripe') throw new Error('External financial/database client forbidden');
  return originalLoad.call(this, name, parent, main);
};
const { BookingsController } = require(path.resolve('apps/gateway/dist/apps/gateway/src/controllers/bookings.controller.js'));
const { Module } = require('@nestjs/common');
const { NestFactory } = require('@nestjs/core');
const rawFetch = global.fetch;
let app, origin;
before(async () => {
  class TestModule {}
  Module({ controllers: [BookingsController] })(TestModule);
  app = await NestFactory.create(TestModule, { logger: false });
  await app.listen(0, '127.0.0.1');
  origin = `http://127.0.0.1:${app.getHttpServer().address().port}`;
});
after(async () => { await app?.close(); ModuleLoader._load = originalLoad; });
function booking(id, owner = 'owner-a', mode = 'live', status = 'confirmed') {
  return { id, status, provider: { user_id: owner }, date: '2026-11-30', created_at: new Date('2026-10-01'),
    num_people: 1, amount_cents: 5000, currency: 'USD', listing: { title: 'Synthetic tour' },
    payment: { processor_mode: mode }, booking_terms: { departure_at: '2026-11-30T16:00:00Z', timezone: 'America/Lima', operational_contact: 'PRIVATE-NO-EXPORT' },
    email: 'PRIVATE-NO-EXPORT', stripe_payment_intent_id: 'PRIVATE-NO-EXPORT' };
}
beforeEach(() => {
  bookings = [booking('live-a'), booking('test-a', 'owner-a', 'test'), booking('unknown-a', 'owner-a', null),
    booking('legacy-a'), booking('free-a'), booking('pending-a', 'owner-a', 'live', 'payment_pending'),
    booking('cancelled-a', 'owner-a', 'live', 'cancelled'), booking('other-b', 'owner-b')];
  bookings.find(b => b.id === 'legacy-a').payment = null;
  const free = bookings.find(b => b.id === 'free-a'); free.payment = null; free.amount_cents = 0;
  receipts = new Map();
});
async function http(user, suffix = '', method = 'GET', { verified = true, expired = false } = {}) {
  const headers = user ? { Authorization: `Bearer ${jwt.sign({ sub: user, email: `${user}@example.test`, email_verified: verified }, process.env.JWT_SECRET, { expiresIn: expired ? -1 : 300 })}` } : {};
  const url = origin + '/operator/booking-inbox' + suffix;
  assert.equal(new URL(url).hostname, '127.0.0.1');
  const response = await rawFetch(url, { method, headers });
  return { status: response.status, body: await response.json() };
}
test('anonymous and expired sessions cannot read or review reservations', async () => {
  for (const suffix of ['', '/live-a/review']) {
    const method = suffix ? 'POST' : 'GET';
    assert.equal((await http(null, suffix, method)).status, 401);
    assert.equal((await http('owner-a', suffix, method, { expired: true })).status, 401);
  }
  assert.equal(receipts.size, 0);
});
test('inactive users and unverified owners cannot use the inbox', async () => {
  assert.equal((await http('inactive')).status, 401);
  assert.equal((await http('owner-a', '', 'GET', { verified: false })).status, 403);
  assert.equal((await http('owner-a', '/live-a/review', 'POST', { verified: false })).status, 403);
});
test('traveler and admin do not inherit an operator inbox', async () => {
  for (const user of ['traveler', 'admin']) {
    assert.deepEqual((await http(user)).body, { is_operator: false, groups: {} });
    assert.equal((await http(user, '/live-a/review', 'POST')).status, 404);
  }
});
test('ownership derives only from JWT; query identity cannot change scope', async () => {
  const result = await http('owner-a', '?provider_id=provider-owner-b&user_id=owner-b&role=admin');
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.groups.reservations.items.map(x => x.id).sort(), ['free-a', 'live-a']);
  assert.equal((await http('owner-a', '/other-b/review', 'POST')).status, 404);
});
test('Sandbox, Live/free and historical unknown modes have separate authoritative counts', async () => {
  const { body } = await http('owner-a');
  assert.equal(body.groups.reservations.total, 2);
  assert.equal(body.groups.sandbox.total, 1);
  assert.equal(body.groups.unverified.total, 2);
  assert.deepEqual(body.groups.unverified.items.map(x => x.id).sort(), ['legacy-a', 'unknown-a']);
});
test('projection excludes personal, financial identifiers and raw booking terms', async () => {
  const { body } = await http('owner-a');
  assert.doesNotMatch(JSON.stringify(body), /PRIVATE|email|stripe_|operational_contact|booking_terms|user_id/);
});
test('reading does not clear alerts; only explicit review clears one', async () => {
  await http('owner-a'); await http('owner-a'); assert.equal(receipts.size, 0);
  const before = JSON.stringify(bookings);
  assert.equal((await http('owner-a', '/test-a/review', 'POST')).status, 201);
  assert.equal((await http('owner-a')).body.groups.sandbox.total, 0);
  assert.equal((await http('owner-a')).body.groups.reservations.total, 2);
  assert.equal(JSON.stringify(bookings), before, 'No payment, inventory or booking mutation');
});
test('review persists between HTTP clients and duplicate/concurrent requests are idempotent', async () => {
  const results = await Promise.all([http('owner-a', '/live-a/review', 'POST'), http('owner-a', '/live-a/review', 'POST')]);
  assert.equal(receipts.size, 1);
  assert.equal(results[0].body.reviewed_at, results[1].body.reviewed_at);
  assert.equal((await http('owner-a')).body.groups.reservations.total, 1);
  assert.equal((await http('owner-b')).body.groups.reservations.total, 1);
});
test('cancelled, pending, non-existent bookings cannot be marked as confirmed alerts', async () => {
  for (const id of ['cancelled-a', 'pending-a', 'missing']) assert.equal((await http('owner-a', `/${id}/review`, 'POST')).status, 404);
  assert.equal(receipts.size, 0);
});
test('counts cover more than one page; reviewing loads the next unreviewed reservations', async () => {
  bookings = Array.from({ length: 25 }, (_, i) => booking(`synthetic-${String(i).padStart(2, '0')}`));
  const first = (await http('owner-a')).body.groups.reservations;
  assert.equal(first.total, 25); assert.equal(first.items.length, 20);
  await http('owner-a', `/${first.items[0].id}/review`, 'POST');
  const next = (await http('owner-a')).body.groups.reservations;
  assert.equal(next.total, 24); assert.equal(next.items.length, 20);
  assert.ok(!next.items.some(b => b.id === first.items[0].id));
});
