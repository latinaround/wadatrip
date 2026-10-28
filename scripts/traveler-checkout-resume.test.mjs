// Synthetic sessions and intercepted HTTP only. No Stripe or database access.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as service from '../apps/web/src/services/travelerBooking.js';

const pending = () => ({ id: 'synthetic-booking-a', status: 'payment_pending', payment_status: 'unpaid', amount_cents: 5000 });
const checkoutUrl = 'https://checkout.stripe.com/c/pay/cs_test_synthetic_resume';
function fixture(t, reply = {}) {
  const calls = [];
  let logouts = 0;
  let session = { user: { id: 'synthetic-traveler-a' }, token: 'synthetic-resume-token-a', loading: false,
    logout() { logouts++; session = { ...session, user: null, token: null }; } };
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    assert.equal(new URL(url).hostname, '127.0.0.1', 'External HTTP forbidden');
    calls.push({ url, ...init });
    reply.beforeReply?.();
    return new Response(JSON.stringify(reply.body ?? { url: checkoutUrl }), { status: reply.status ?? 200 });
  });
  return { calls, getSession: () => session, setSession: value => { session = value; }, logouts: () => logouts,
    run: (booking = pending()) => service.resumeTravelerCheckout({ apiBase: 'http://127.0.0.1:3015', getSession: () => session, booking }) };
}

test('resume uses one Bearer checkout request on the existing booking, with no price, identity or booking creation', async t => {
  const f = fixture(t);
  assert.equal(await f.run(), checkoutUrl);
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].url, 'http://127.0.0.1:3015/payments/bookings/synthetic-booking-a/checkout');
  assert.equal(f.calls[0].method, 'POST');
  assert.equal(f.calls[0].headers.Authorization, 'Bearer synthetic-resume-token-a');
  assert.equal(f.calls[0].body, undefined);
});
test('resume anonymous or loading session never makes a payment request', async t => {
  const f = fixture(t);
  for (const changes of [{ user: null }, { token: null }, { loading: true }]) {
    f.setSession({ user: { id: 'synthetic-traveler-a' }, token: 'synthetic-token', loading: false, ...changes });
    await assert.rejects(f.run(), error => error.status === 401);
  }
  assert.equal(f.calls.length, 0);
});
test('paid, cancelled, uncertain, free and malformed bookings cannot be resumed by the UI helper', async t => {
  const f = fixture(t);
  for (const changes of [
    { status: 'confirmed' }, { status: 'cancelled' }, { status: 'cancellation_pending' },
    { status: 'reconciliation_required' }, { status: 'completed' }, { payment_status: 'paid' },
    { payment_status: 'succeeded' }, { payment_status: 'refunded' }, { payment_status: 'failed' },
    { cancellation_requested_at: '2026-01-01T00:00:00Z' }, { amount_cents: 0 }, { amount_cents: null },
    { inventory_state: 'released' },
    { amount_cents: -1 }, { amount_cents: 1.5 }, { id: '' },
  ]) await assert.rejects(f.run({ ...pending(), ...changes }));
  assert.equal(f.calls.length, 0);
});
test('checkout 401 uses existing logout, without retry or redirect', async t => {
  const f = fixture(t, { status: 401, body: { message: 'Synthetic expired session' } });
  await assert.rejects(f.run(), error => error.status === 401);
  assert.equal(f.logouts(), 1); assert.equal(f.calls.length, 1);
});
test('late checkout 401 cannot log out the next traveler', async t => {
  let f;
  f = fixture(t, { status: 401, beforeReply: () => f.setSession({ ...f.getSession(), user: { id: 'synthetic-traveler-b' }, token: 'synthetic-token-b' }) });
  await assert.rejects(f.run(), error => error.status === 401);
  assert.equal(f.logouts(), 0); assert.equal(f.getSession().user.id, 'synthetic-traveler-b');
});
test('logout before checkout returns prevents redirect', async t => {
  let f;
  f = fixture(t, { beforeReply: () => f.getSession().logout() });
  await assert.rejects(f.run(), error => error.status === 401);
  assert.equal(f.calls.length, 1);
});
test('expired checkout or outage surfaces the error without creating a replacement booking', async t => {
  const f = fixture(t, { status: 409, body: { message: 'Synthetic checkout expired' } });
  await assert.rejects(f.run(), /Synthetic checkout expired/);
  assert.equal(f.calls.length, 1); assert.equal(f.logouts(), 0);
});
test('missing or unsafe checkout URL is never returned for navigation', async t => {
  for (const url of [undefined, 'javascript:alert(1)', 'https://example.invalid/pay', 'http://checkout.stripe.com/pay', 'https://user:password@checkout.stripe.com/pay']) {
    const f = fixture(t, { body: { url } });
    await assert.rejects(f.run(), /Checkout URL/);
    t.mock.restoreAll();
  }
});
