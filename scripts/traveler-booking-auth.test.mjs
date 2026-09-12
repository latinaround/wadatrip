// Run after building common and gateway. Synthetic sessions, mocked HTTP/DB, no external calls.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import Module, { createRequire } from 'node:module';
import { bookTravelerExperience, SIGN_IN_REQUIRED } from '../apps/web/src/services/travelerBooking.js';

function fixture(t, responses = []) {
  const calls = [];
  let logouts = 0;
  let session = {
    user: { id: 'traveler-a' }, token: 'synthetic-traveler-token', loading: false,
    logout() { logouts++; session = { ...session, user: null, token: null }; },
  };
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    assert.equal(new URL(url).hostname, '127.0.0.1');
    calls.push({ url, ...init });
    const next = responses.shift();
    assert.ok(next, 'Unexpected HTTP request');
    next.beforeReply?.();
    return new Response(JSON.stringify(next.data), { status: next.status ?? 200 });
  });
  const booking = { listing_id: 'listing-a', num_people: 2, date: '2026-12-01' };
  return {
    calls, booking, getSession: () => session, logouts: () => logouts,
    setSession: value => { session = value; },
    run: (options = {}) => bookTravelerExperience({
      apiBase: 'http://127.0.0.1:3015', getSession: () => session, booking, ...options,
    }),
  };
}

const booked = () => ({ status: 201, data: { id: 'booking-a' } });
const checkedOut = () => ({ data: { url: 'http://127.0.0.1:3015/synthetic-checkout' } });
const requiresSignIn = error => error.status === 401 && error.message === SIGN_IN_REQUIRED;

test('authenticated traveler sends Bearer on booking and successful booking checkout', async t => {
  const f = fixture(t, [booked(), checkedOut()]);
  const result = await f.run();
  assert.equal(f.calls.length, 2);
  assert.equal(f.calls[0].url, 'http://127.0.0.1:3015/bookings');
  assert.equal(f.calls[1].url, 'http://127.0.0.1:3015/payments/bookings/booking-a/checkout');
  for (const call of f.calls) {
    assert.equal(call.method, 'POST');
    assert.equal(call.headers.Authorization, 'Bearer synthetic-traveler-token');
  }
  assert.equal(result.checkoutUrl, 'http://127.0.0.1:3015/synthetic-checkout');
  assert.equal(f.logouts(), 0);
});

test('anonymous, incomplete or still-loading session never sends booking or checkout', async t => {
  const f = fixture(t);
  for (const changes of [
    { user: null, token: null }, { user: null }, { token: null }, { loading: true },
  ]) {
    f.setSession({ user: { id: 'traveler-a' }, token: 'synthetic-token', loading: false, ...changes });
    await assert.rejects(f.run(), requiresSignIn);
  }
  assert.equal(f.calls.length, 0);
});

test('booking 401 invalidates the existing session and never executes checkout', async t => {
  const f = fixture(t, [{ status: 401, data: { id: 'must-not-checkout', message: 'expired JWT' } }]);
  await assert.rejects(f.run(), requiresSignIn);
  assert.equal(f.calls.length, 1);
  assert.equal(f.logouts(), 1);
  assert.equal(f.getSession().token, null);
});

test('checkout 401 invalidates the session and never returns a redirect or retries', async t => {
  const f = fixture(t, [booked(), { status: 401, data: { url: 'http://127.0.0.1/ignore' } }]);
  await assert.rejects(f.run(), requiresSignIn);
  assert.equal(f.calls.length, 2);
  assert.equal(f.logouts(), 1);
  assert.equal(f.getSession().token, null);
});

test('booking payload excludes user_id, email, role and other client-selected identity', async t => {
  const f = fixture(t, [booked(), checkedOut()]);
  await f.run({ booking: {
    ...f.booking, user_id: 'someone-else', user_email: 'synthetic@example.test', email: 'synthetic@example.test',
    role: 'admin', user_name: 'Impersonated', name: 'Impersonated', actor: { admin: true },
    price: 1, total_price: 1, amount_cents: 1, amount: 1, currency: 'EUR', quantity: 999,
  } });
  assert.deepEqual(JSON.parse(f.calls[0].body), f.booking);
  assert.equal(f.calls[1].body, undefined);
});

test('ordinary booking failure also prevents checkout without logging the traveler out', async t => {
  const f = fixture(t, [{ status: 400, data: { message: 'invalid date' } }]);
  await assert.rejects(f.run(), /invalid date/);
  assert.equal(f.calls.length, 1);
  assert.equal(f.logouts(), 0);
});

test('free tour still requires Bearer but never starts checkout', async t => {
  const f = fixture(t, [{ status: 201, data: { id: 'booking-a', amount_cents: 0 } }]);
  const result = await f.run();
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].headers.Authorization, 'Bearer synthetic-traveler-token');
  assert.equal(result.booking.id, 'booking-a');
  assert.equal(result.checkoutUrl, undefined);
});

test('unavailable date or capacity error is shown without checkout or logout', async t => {
  const f = fixture(t, [{ status: 409, data: { message: 'Not enough spots for this traveler count' } }]);
  await assert.rejects(f.run(), /Not enough spots/);
  assert.equal(f.calls.length, 1);
  assert.equal(f.logouts(), 0);
});

test('logout while booking is in flight stops checkout', async t => {
  const f = fixture(t, [{ ...booked(), beforeReply: () => f.getSession().logout() }]);
  await assert.rejects(f.run(), requiresSignIn);
  assert.equal(f.calls.length, 1);
});

test('late 401 for traveler A cannot log out traveler B', async t => {
  const f = fixture(t, [{ status: 401, data: {}, beforeReply: () => f.setSession({
    ...f.getSession(), user: { id: 'traveler-b' }, token: 'synthetic-token-b',
  }) }]);
  await assert.rejects(f.run(), requiresSignIn);
  assert.equal(f.calls.length, 1);
  assert.equal(f.logouts(), 0);
  assert.equal(f.getSession().user.id, 'traveler-b');
});

test('changing session before checkout returns prevents handing its URL to another traveler', async t => {
  const f = fixture(t, [booked(), { ...checkedOut(), beforeReply: () => f.getSession().logout() }]);
  await assert.rejects(f.run(), requiresSignIn);
  assert.equal(f.calls.length, 2);
});

test('free tour notification uses the authenticated DB name, never client identity', async t => {
  const require = createRequire(import.meta.url);
  const overrides = {
    NODE_ENV: 'test', FF_PROVIDER_HUB: 'false', JWT_SECRET: 'synthetic-free-tour-test-key',
    SENDGRID_API_KEY: 'synthetic-mail-key', EMAIL_FROM: 'sender@example.test',
    ADMIN_EMAILS: '', ADMIN_USER_IDS: '',
  };
  const previous = Object.fromEntries(Object.keys(overrides).map(key => [key, process.env[key]]));
  Object.assign(process.env, overrides);
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
  const traveler = { id: 'traveler-a', name: 'Synthetic Traveler', email: 'traveler@example.test', status: 'active', role: 'traveler' };
  const messages = [];
  const prisma = {
    users: { findUnique: async ({ where }) => where.id === traveler.id ? traveler : null },
    listings: { findUnique: async () => ({ id: 'free-tour', provider_id: 'provider-a', title: 'Synthetic free tour', tags: ['free_tour'], city: 'Test City', price_from: null, currency: 'USD', status: 'published' }) },
    providers: { findUnique: async () => ({ id: 'provider-a', email: 'provider@example.test' }) },
    bookings: { create: async ({ data }) => ({ id: 'free-booking', ...data }) },
  };
  const originalLoad = Module._load;
  require('./helpers/capacity-fixture.cjs').addCapacityFixture(prisma);
  t.mock.method(Module, '_load', function (request, ...args) {
    if (request === '@wadatrip/db') return { getPrisma: () => prisma };
    if (request === '@prisma/client') throw new Error('Real database access forbidden in this test');
    return originalLoad.call(this, request, ...args);
  });
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    // Capture the existing mail adapter call; never delegate to a real fetch.
    assert.equal(url, 'https://api.sendgrid.com/v3/mail/send');
    messages.push(JSON.parse(init.body));
    return new Response(null, { status: 202 });
  });
  const modulePath = require.resolve('../apps/gateway/dist/apps/gateway/src/controllers/bookings.controller.js');
  const cached = require.cache[modulePath];
  delete require.cache[modulePath];
  t.after(() => { if (cached) require.cache[modulePath] = cached; else delete require.cache[modulePath]; });
  const { BookingsController } = require(modulePath);
  const jwt = require('jsonwebtoken');
  const token = jwt.sign({ sub: traveler.id, name: 'Untrusted claim name' }, overrides.JWT_SECRET, { expiresIn: '5m' });
  const controller = new BookingsController();

  for (const [name, clientIdentity, expectedName] of [
    ['Synthetic Traveler', {}, 'Synthetic Traveler'],
    ['Synthetic Traveler', { user_name: 'Forged Name', user_id: 'other-user', user_email: 'forged@example.test', role: 'admin' }, 'Synthetic Traveler'],
    [null, {}, 'Traveler'],
  ]) {
    traveler.name = name;
    const result = await controller.create({ headers: { authorization: `Bearer ${token}` } }, {
      listing_id: 'free-tour', date: '2026-12-01', num_people: 2, ...clientIdentity,
    });
    assert.equal(result.user_id, traveler.id);
    assert.equal(result.status, 'confirmed');
    assert.equal(result.payment_status, 'paid');
    assert.equal(result.amount_cents, 0);
    const message = messages.at(-1);
    assert.equal(message.personalizations[0].to[0].email, 'provider@example.test');
    assert.ok(message.content[0].value.includes(`Name: ${expectedName}\n`));
    assert.ok(message.content[0].value.includes('Email: traveler@example.test\n'));
    assert.ok(!/Forged Name|forged@example|Untrusted claim/.test(message.content[0].value));
  }
  assert.equal(messages.length, 3);
});
