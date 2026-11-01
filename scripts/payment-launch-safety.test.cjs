const registryFixture=require('./session-fixture.cjs');registryFixture.install();
// Synthetic JWT, mocked DB/processor. No external requests or real credentials.
const { test, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
require('reflect-metadata');
const jwt = require('jsonwebtoken');
process.env.JWT_SECRET = 'synthetic-launch-jwt';
process.env.STRIPE_SECRET_KEY = 'sk_test_synthetic_launch_fixture';
delete process.env.STRIPE_SECRET;
delete process.env.ADMIN_EMAILS;
delete process.env.ADMIN_USER_IDS;
const actor = { id: 'synthetic-user', name: 'Synthetic User', email: 'synthetic@example.invalid', status: 'active', role: 'traveler' };
const request = { headers: { authorization: 'Bearer ' + jwt.sign({ sub: actor.id }, process.env.JWT_SECRET, { expiresIn: '5m' }) } };
let io;
const booking = { id: 'synthetic-booking', user_id: actor.id, provider_id: 'synthetic-provider', status: 'pending',
  amount_cents: 5000, total_price: '50.00', currency: 'usd', num_people: 1,
  listing: { price_from: '50.00', currency: 'USD', status: 'published', tags: [] },
  provider: { stripe_account_id: 'acct_synthetic_test' } };
const prisma = { users: { findUnique: async () => actor }, bookings: { findUnique: async () => booking },
  itineraries: { findUnique: async () => ({ id: 'synthetic-itinerary', status: 'published', price: 50, currency: 'USD', operator_stripe_account_id: 'acct_synthetic_test' }) } };
class FakeStripe {
  constructor() {
    io.push('construct');
    this.accounts = { retrieve: async () => { io.push('account'); return { details_submitted: true, payouts_enabled: true, capabilities: { transfers: 'active' }, requirements: {} }; } };
    this.checkout = { sessions: { create: async () => { io.push('charge'); return { url: 'http://127.0.0.1/synthetic-checkout' }; } } };
  }
}
const originalLoad = Module._load;
Module._load = function(name, ...args) {
  if (name === '@wadatrip/db') return { getPrisma:()=>registryFixture.enable(prisma) };
  if (name === 'stripe') return FakeStripe;
  return originalLoad.call(this, name, ...args);
};
const { PaymentsController } = require('../apps/gateway/dist/apps/gateway/src/controllers/payments.controller.js');
const config = require('../apps/gateway/dist/apps/gateway/src/services/payment-config.service.js');
const { assertPaymentMode } = require('@wadatrip/common/payment-lifecycle');
const { paymentObject, reconcileBookingPayment, handleStripeEvent } = require('../apps/gateway/dist/apps/gateway/src/services/booking-payment.service.js');
const { processAutomationBatch } = require('../apps/gateway/dist/apps/gateway/src/services/booking-automation.service.js');
Module._load = originalLoad;
// Stripe is loaded lazily inside controller methods.
Module._load = function(name, ...args) { if (name === 'stripe') return FakeStripe; return originalLoad.call(this, name, ...args); };
after(() => { Module._load = originalLoad; });
beforeEach(() => { io = []; delete process.env.PAYMENTS_ACCEPT_NEW; delete process.env.PAYMENTS_LIVE_ENABLED; delete process.env.PAYMENTS_LIVE_PROVIDER_IDS; process.env.STRIPE_SECRET_KEY = 'sk_test_synthetic_launch_fixture'; });
const disabled = error => error.getStatus?.() === 503;

test('legacy itinerary route cannot create an external charge', async () => {
  await assert.rejects(new PaymentsController().checkoutItinerary('synthetic-itinerary', request), disabled);
  assert.deepEqual(io, []);
});

test('closed payment gate stops checkout before constructing the processor', async () => {
  process.env.PAYMENTS_ACCEPT_NEW = 'false';
  await assert.rejects(new PaymentsController().checkout(booking.id, request), disabled);
  assert.deepEqual(io, []);
});

test('Live key without explicit release permission cannot start checkout', async () => {
  process.env.STRIPE_SECRET_KEY = 'sk_live_synthetic_launch_fixture';
  await assert.rejects(new PaymentsController().checkout(booking.id, request), disabled);
  assert.deepEqual(io, []);
});

test('direct PaymentIntent route remains disabled for the hosted-checkout pilot', async () => {
  await assert.rejects(new PaymentsController().createIntent({ booking_id: booking.id }, request), disabled);
  assert.deepEqual(io, []);
});

test('conflicting key aliases and unknown credential formats fail closed', () => {
  assert.throws(() => config.stripePaymentMode({ STRIPE_SECRET_KEY: 'sk_test_synthetic', STRIPE_SECRET: 'sk_live_synthetic' }));
  assert.throws(() => config.stripePaymentMode({ STRIPE_SECRET_KEY: 'untyped-synthetic' }));
});

test('Live admission requires enabled gate, exact provider allowlist and an explicit fee', () => {
  const env = { OPERATOR_BETA_PREPARATION_ONLY: 'false', STRIPE_SECRET_KEY: 'sk_live_synthetic', PAYMENTS_LIVE_ENABLED: 'true', PAYMENTS_ACCEPT_NEW: 'true', PAYMENTS_LIVE_PROVIDER_IDS: 'synthetic-provider', WADATRIP_FEE_PCT: '12' };
  assert.equal(config.requireNewPaymentAccess('synthetic-provider', env), 'live');
  assert.throws(() => config.requireNewPaymentAccess('another-provider', env));
  assert.throws(() => config.requireNewPaymentAccess('synthetic-provider', { ...env, WADATRIP_FEE_PCT: '' }));
  assert.throws(() => config.requireNewPaymentAccess('synthetic-provider', { ...env, PAYMENTS_ACCEPT_NEW: 'false' }));
});

test('Live admission rejects invalid fee configuration before processor setup', () => {
  const env = { OPERATOR_BETA_PREPARATION_ONLY: 'false', STRIPE_SECRET_KEY: 'sk_live_synthetic', PAYMENTS_LIVE_ENABLED: 'true', PAYMENTS_ACCEPT_NEW: 'true', PAYMENTS_LIVE_PROVIDER_IDS: 'synthetic-provider' };
  for (const fee of ['not-a-percentage', '-1', '101', 'Infinity']) {
    assert.throws(() => config.requireNewPaymentAccess('synthetic-provider', { ...env, WADATRIP_FEE_PCT: fee }),
      error => error.getStatus?.() === 400);
  }
});

test('Live never reuses the original legacy or explicit Test payout account', () => {
  const p = { stripe_account_id: 'acct_legacy', stripe_test_account_id: 'acct_test', stripe_live_account_id: 'acct_live' };
  assert.equal(config.payoutAccountForMode(p, 'test'), 'acct_test');
  assert.equal(config.payoutAccountForMode(p, 'live'), 'acct_live');
  assert.equal(config.payoutAccountForMode({ stripe_account_id: 'acct_legacy', stripe_test_account_id: 'acct_test' }, 'live'), undefined);
});

test('historical unknown modes remain investigable in Test but cannot authorize Live IO', async () => {
  assert.doesNotThrow(() => assertPaymentMode({ processor_mode: null }, 'test'));
  assert.throws(() => assertPaymentMode({ processor_mode: null }, 'live'));
  assert.throws(() => assertPaymentMode({ processor_mode: 'test' }, 'live'));
  assert.throws(() => assertPaymentMode({ processor_mode: 'live' }, 'test'));
  process.env.STRIPE_SECRET_KEY = 'sk_live_synthetic_launch_fixture';
  await assert.rejects(paymentObject({}, {}, { processor_mode: 'test' }), /mode/);
  assert.deepEqual(io, []);
});

test('wrong-mode or missing-mode webhook is rejected before durable receipt or processor calls', async () => {
  const db = { paymentEvent: { upsert: async () => { throw new Error('Must not write'); } } };
  for (const livemode of [true, undefined]) {
    await assert.rejects(handleStripeEvent(db, {}, { id: 'evt_synthetic_mode', livemode }), /mode/);
  }
});

test('wrong-mode external objects are rejected, including objects without mode evidence', () => {
  assert.doesNotThrow(() => config.assertStripeObjectMode({ livemode: false }, 'test'));
  assert.throws(() => config.assertStripeObjectMode({ livemode: true }, 'test'));
  assert.throws(() => config.assertStripeObjectMode({}, 'test'));
});

test('closing new payments does not block recovery of a booking without an external flow', async () => {
  process.env.PAYMENTS_ACCEPT_NEW = 'false';
  const result = await reconcileBookingPayment({ bookings: { findUnique: async () => ({ id: 'free-booking', amount_cents: 0 }) }, paymentRecord: { findUnique: async () => null } }, {}, 'free-booking');
  assert.equal(result.id, 'free-booking');
});

test('automation only selects records with the configured mode, leaving unknown history out', async () => {
  for (const mode of ['test', 'live']) {
    process.env.STRIPE_SECRET_KEY = `sk_${mode}_synthetic_launch_fixture`;
    let where;
    await processAutomationBatch({ paymentRecord: { findMany: async args => { where = args.where; return []; } } }, {});
    assert.equal(where.processor_mode, mode);
  }
});

test('mode migration is additive and never assigns an inferred historical mode', () => {
  const fs = require('node:fs');
  const sql = fs.readFileSync(require('node:path').join(__dirname, '../libs/db/prisma/migrations/20261014000000_payment_mode_isolation/migration.sql'), 'utf8');
  const statements = sql.replace(/--[^\n]*/g, '');
  assert.doesNotMatch(statements, /\b(?:UPDATE|DELETE|TRUNCATE|DROP)\b/i);
  assert.doesNotMatch(statements, /processor_mode[^;]*DEFAULT/i);
  assert.match(statements, /CHECK.*processor_mode.*IS NULL/);
});

test('mode readiness report is read-only and covers references without a ledger', () => {
  const fs = require('node:fs');
  const sql = fs.readFileSync(require('node:path').join(__dirname, 'payment-mode-readiness.sql'), 'utf8');
  const statements = sql.replace(/--[^\n]*/g, '');
  assert.match(statements, /REPEATABLE READ READ ONLY/);
  assert.doesNotMatch(statements, /\b(?:DELETE|UPDATE|INSERT|ALTER|DROP|TRUNCATE|CREATE|GRANT|REVOKE)\b/i);
  assert.match(statements, /LEFT JOIN "PaymentRecord" p ON p.booking_id=b.id/);
  assert.match(statements, /booking_external_reference_without_known_mode/);
  assert.doesNotMatch(statements, /\b(?:email|phone|secret|token|payload)\b/i);
});
