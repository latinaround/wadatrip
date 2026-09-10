// Build common, gateway and Provider Hub first. All DB, mail and Stripe IO is simulated.
// node --test --test-isolation=none scripts/booking-price.test.cjs
const { test, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
require('reflect-metadata');
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'synthetic-price-test-secret';
process.env.INTERNAL_SERVICE_TOKEN = 'synthetic-internal-price-test';
process.env.STRIPE_SECRET_KEY = 'synthetic-stripe-mock-key';
process.env.FF_PROVIDER_HUB = 'false';
process.env.ADMIN_EMAILS = '';
process.env.ADMIN_USER_IDS = '';
for (const key of ['DATABASE_URL', 'DATABASE_URL_LOCAL', 'DATABASE_URL_REMOTE', 'SENDGRID_API_KEY', 'EMAIL_FROM', 'STRIPE_SECRET', 'STRIPE_WEBHOOK_SECRET']) delete process.env[key];
const jwt = require('jsonwebtoken');
const user = { id: 'traveler', email: 'traveler@example.test', name: 'Synthetic Traveler', status: 'active', role: 'traveler' };
const provider = { id: 'provider', user_id: 'owner', stripe_account_id: null };
const token = jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: '10m' });
const req = { headers: { authorization: `Bearer ${token}`, 'x-internal-service-token': process.env.INTERNAL_SERVICE_TOKEN } };
let listing, bookings, stripeCalls;
const prisma = {
  users: { findUnique: async ({ where }) => where.id === user.id ? user : null },
  providers: { findUnique: async () => provider },
  listings: { findUnique: async ({ where }) => listing?.id === where.id ? listing : null },
  bookings: {
    create: async ({ data }) => { const b = { id: `booking-${bookings.length}`, ...data }; bookings.push(b); return b; },
    findUnique: async ({ where }) => { const b = bookings.find(b => b.id === where.id); return b ? { ...b, provider, listing } : null; },
    update: async ({ where, data }) => { const b = bookings.find(b => b.id === where.id); Object.assign(b, data); return b; },
  },
};
class FakeStripe {
  constructor(key) {
    assert.equal(key, 'synthetic-stripe-mock-key');
    this.checkout = { sessions: { create: async data => {
      stripeCalls.push({ type: 'checkout', data });
      return { id: 'synthetic-session', url: 'http://127.0.0.1/synthetic-checkout' };
    } } };
    this.paymentIntents = { create: async data => {
      stripeCalls.push({ type: 'intent', data });
      return { id: 'synthetic-intent', client_secret: 'synthetic-client-secret' };
    } };
  }
}
const originalLoad = Module._load;
Module._load = function(request, ...args) {
  if (request === '@wadatrip/db') return { getPrisma: () => prisma };
  if (request === '@prisma/client') throw new Error('Real DB forbidden');
  if (request === 'stripe') return FakeStripe;
  return originalLoad.call(this, request, ...args);
};
const originalFetch = global.fetch;
global.fetch = () => { throw new Error('External requests forbidden'); };
function controller(service, name) {
  return require(path.resolve(service, 'dist', service, 'src/controllers', `${name}.controller.js`));
}
const gateway = new (controller('apps/gateway', 'bookings').BookingsController)();
const hub = new (controller('services/provider-hub', 'bookings').BookingsController)();
const payments = new (controller('apps/gateway', 'payments').PaymentsController)();
const axios = require('axios');
const originalPost = axios.post;
axios.post = async (url, body, config) => {
  assert.equal(url, 'http://127.0.0.1:3014/bookings');
  assert.equal(config.headers.Authorization, req.headers.authorization);
  assert.equal(config.headers['x-internal-service-token'], process.env.INTERNAL_SERVICE_TOKEN);
  return { data: await hub.create(req, body) };
};
process.env.PROVIDER_HUB_URL = 'http://127.0.0.1:3014';
process.env.FF_PROVIDER_HUB = 'true';
delete require.cache[require.resolve(path.resolve('apps/gateway/dist/apps/gateway/src/controllers/bookings.controller.js'))];
const proxied = new (controller('apps/gateway', 'bookings').BookingsController)();
process.env.FF_PROVIDER_HUB = 'false';
after(() => { Module._load = originalLoad; global.fetch = originalFetch; axios.post = originalPost; });
beforeEach(() => {
  listing = { id: 'listing', provider_id: provider.id, title: 'Synthetic tour', price_from: '120.00', currency: 'USD', status: 'published', tags: [] };
  bookings = []; stripeCalls = [];
});
const input = (extra = {}) => ({ listing_id: 'listing', date: '2026-12-01', num_people: 1, ...extra });
const badRequest = error => error.getStatus?.() === 400;

for (const [name, service] of [['gateway', gateway], ['hub', hub], ['gateway -> Hub', proxied]]) {
  for (const value of [1, 999999, undefined]) {
    test(`${name}: client price ${value} cannot replace listing price 120`, async () => {
      const extras = value === undefined ? {} : { price: value, total_price: value, amount_cents: value, amount: value, total_amount: value, price_cents: value };
      const result = await service.create(req, input(extras));
      assert.equal(result.total_price, '120.00');
      assert.equal(result.amount_cents, 12000);
      assert.equal(bookings[0].amount_cents, 12000);
    });
  }
  test(`${name}: currency and quantity aliases cannot override canonical USD/num_people`, async () => {
    const b = await service.create(req, input({ currency: 'EUR', quantity: 999, guests: 999, participants: 999, num_people: 3 }));
    assert.equal(b.total_price, '360.00');
    assert.equal(b.num_people, 3);
    assert.equal(b.currency, 'usd');
  });
  test(`${name}: exact decimal arithmetic for multiple travelers`, async () => {
    listing.price_from = '1.01';
    const b = await service.create(req, input({ num_people: 3 }));
    assert.equal(b.total_price, '3.03');
    assert.equal(b.amount_cents, 303);
  });
  test(`${name}: zero listings and existing tagged free tours retain zero total`, async () => {
    for (const [price, tags] of [['0', []], ['0', ['free_tour']], [null, ['free_tour']]]) {
      listing.price_from = price; listing.tags = tags;
      const b = await service.create(req, input({ total_price: 999, amount_cents: 999 }));
      assert.equal(b.total_price, '0.00');
      assert.equal(b.amount_cents, 0);
      assert.equal(b.status, 'confirmed');
      assert.equal(b.payment_status, 'paid');
    }
  });
  test(`${name}: negative, absent, malformed and overflowing canonical prices rejected`, async () => {
    for (const price of ['-1', 'NaN', 'Infinity', 'abc', '', null, '0.001', '99999999999']) {
      listing.price_from = price;
      await assert.rejects(service.create(req, input()), badRequest);
    }
    assert.equal(bookings.length, 0);
  });
  test(`${name}: missing or unsupported canonical currency rejected`, async () => {
    for (const currency of [null, '', 'EUR', 'US', 'XYZ']) {
      listing.currency = currency;
      await assert.rejects(service.create(req, input({ currency: 'USD' })), badRequest);
    }
    assert.equal(bookings.length, 0);
  });
  test(`${name}: missing and non-public listings rejected; approved remains bookable`, async () => {
    await assert.rejects(service.create(req, input({ listing_id: 'missing' })), badRequest);
    for (const status of ['draft', 'pending', 'inactive', 'rejected']) {
      listing.status = status;
      await assert.rejects(service.create(req, input()), badRequest);
    }
    assert.equal(bookings.length, 0);
    listing.status = 'approved';
    assert.equal((await service.create(req, input())).amount_cents, 12000);
  });
  test(`${name}: invalid participants cannot produce fractional/negative bookings`, async () => {
    for (const num_people of [0, -1, 1.5, true, [], 'NaN', 2147483648]) {
      await assert.rejects(service.create(req, input({ num_people })), badRequest);
    }
    assert.equal(bookings.length, 0);
  });
  test(`${name}: simple route also ignores browser price`, async () => {
    const b = await service.createSimple(req, input({ total_price: 1, amount_cents: 1 }));
    assert.equal(b.amount_cents, 12000);
  });
}

test('checkout and PaymentIntent use stored amount/currency despite malicious browser inputs', async () => {
  const b = await gateway.create(req, input({ num_people: 2 }));
  await payments.checkout(b.id, { ...req, body: { amount: 1, currency: 'EUR' }, query: { amount: 1 } });
  await payments.createIntent({ booking_id: b.id, amount: 1, currency: 'EUR', price: 1 }, req);
  const checkout = stripeCalls[0].data.line_items[0];
  assert.equal(checkout.quantity, 1);
  assert.equal(checkout.price_data.unit_amount, b.amount_cents);
  assert.equal(checkout.price_data.unit_amount, 24000);
  assert.equal(checkout.price_data.currency, b.currency);
  assert.equal(stripeCalls[1].data.amount, b.amount_cents);
  assert.equal(stripeCalls[1].data.currency, 'usd');
});
test('legacy browser-priced bookings, inconsistent totals and changed listing prices cannot be charged', async () => {
  const b = await gateway.create(req, input());
  for (const values of [
    { total_price: '1.00', amount_cents: 100, currency: 'usd' },
    { total_price: '120.00', amount_cents: 1, currency: 'usd' },
    { total_price: '120.00', amount_cents: null, currency: 'usd' },
    { total_price: '120.00', amount_cents: 12000, currency: 'EUR' },
  ]) {
    Object.assign(b, values);
    await assert.rejects(payments.checkout(b.id, req), badRequest);
    await assert.rejects(payments.createIntent({ booking_id: b.id, amount: 12000 }, req), badRequest);
  }
  Object.assign(b, { total_price: '120.00', amount_cents: 12000, currency: 'usd' });
  listing.price_from = '130';
  await assert.rejects(payments.checkout(b.id, req), badRequest);
  assert.equal(stripeCalls.length, 0);
});
test('zero totals never reach Stripe, and sub-minimum totals are not silently increased', async () => {
  for (const price of ['0', '0.49']) {
    listing.price_from = price;
    const b = await gateway.create(req, input());
    await assert.rejects(payments.checkout(b.id, req), badRequest);
    await assert.rejects(payments.createIntent({ booking_id: b.id, amount: 9999 }, req), badRequest);
    assert.equal(b.total_price, `${price === '0' ? '0.00' : price}`);
  }
  assert.equal(stripeCalls.length, 0);
});
