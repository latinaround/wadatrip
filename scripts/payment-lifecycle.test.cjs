// Synthetic DB/processor only. No imports of PrismaClient or Stripe, no external IO.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const originalLoad = Module._load, originalFetch = global.fetch;
Module._load = function(name, ...rest) {
  if (['stripe', '@prisma/client', '@wadatrip/db'].includes(name)) throw new Error('Real payment/database IO forbidden');
  return originalLoad.call(this, name, ...rest);
};
global.fetch = () => { throw new Error('Network forbidden'); };
after(() => { Module._load = originalLoad; global.fetch = originalFetch; });
const { createCapacityBooking, updateCapacityBooking } = require('@wadatrip/common/booking-capacity');
const { preparePayment, applyPaymentObservation } = require('@wadatrip/common/payment-lifecycle');
const { paymentObject, reconcileBookingPayment, handleStripeEvent } = require('../apps/gateway/dist/apps/gateway/src/services/booking-payment.service.js');
const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
const conflict = e => e.getStatus?.() === 409;

test('BLOCKER preparation: blank historical reference never authorizes a new charge', async () => {
  const f = fixture(), b = await f.create(); f.state().bookings[0].checkout_session_id = '';
  await assert.rejects(f.prepare(b.id), conflict); assert.equal(f.state().payments.length, 0);
});
test('BLOCKER preparation: legacy succeeded without ledger never authorizes a new charge', async () => {
  const f = fixture(), b = await f.create(); f.state().bookings[0].payment_status = 'succeeded';
  await assert.rejects(f.prepare(b.id), conflict); assert.equal(f.state().payments.length, 0);
});

test('BLOCKER historical contradiction: paid booking with pending ledger fails closed instead of losing money evidence', async () => {
  const f = fixture(), b = await f.create(); await f.prepare(b.id);
  Object.assign(f.state().bookings[0], { status: 'confirmed', payment_status: 'paid' });
  f.state().payments[0].flow = null;
  await assert.rejects(applyPaymentObservation(f.prisma, 'contradictory-history', 'failed', f.observe(b, 'failed')), conflict);
  assert.equal(f.state().bookings[0].payment_status, 'paid');
  assert.equal(f.state().payments[0].status, 'pending');
  assert.equal(f.state().events[0].status, 'failed');
  assert.equal(f.state().slot.spots_available, 0);
});

test('BLOCKER reconciliation: resolving review cannot manufacture a successful payment', () => {
  const { bookingTransition } = require('../libs/common/dist/booking-transition.js');
  assert.throws(() => bookingTransition({ status: 'reconciliation_required', inventory_state: 'held' },
    { status: 'pending', resolution: 'reconciliation_required' }, 'reconciliation_resolved', true), conflict);
});

test('BLOCKER association authority: metadata alone cannot settle an unbound historical external payment', async () => {
  const f = fixture(), b = await f.create();
  await applyPaymentObservation(f.prisma, 'unbound-history', 'paid', f.observe(b, 'succeeded', { intentId: 'unbound-external' }));
  assert.equal(f.state().bookings[0].status, 'reconciliation_required');
  assert.equal(f.state().bookings[0].payment_status, 'unpaid');
  assert.equal(f.state().bookings[0].payment_intent_id, undefined);
  assert.equal(f.state().slot.spots_available, 0);
});

test('historical ledger null amount retains unknown expected money and explicit review', async () => {
  const f = fixture(), b = await f.create(); await f.prepare(b.id);
  Object.assign(f.state().payments[0], { flow: null, amount_gross_cents: null, amount_net_cents: null });
  await applyPaymentObservation(f.prisma, 'null-ledger-amount', 'paid', f.observe(b));
  assert.equal(f.state().payments[0].amount_gross_cents, null);
  assert.equal(f.state().payments[0].amount_charged_cents, 12000);
  assert.equal(f.state().bookings[0].status, 'reconciliation_required');
  assert.equal(f.state().bookings[0].inventory_state, 'held');
});
test('orphan historical ledger is not invented into a booking and leaves an investigable failed event', async () => {
  const f = fixture();
  f.state().payments.push({ id: 'orphan-ledger', booking_id: 'missing-booking', status: 'paid', amount_gross_cents: null });
  await assert.rejects(applyPaymentObservation(f.prisma, 'orphan-event', 'paid', f.observe({ id: 'missing-booking' })));
  assert.equal(f.state().bookings.length, 0); assert.equal(f.state().payments[0].status, 'paid');
  assert.equal(f.state().events[0].status, 'failed');
  assert.equal(f.state().events[0].payload.bookingId, 'missing-booking');
});
test('same external intent cannot be attached to another booking', async () => {
  const f = fixture({ capacity: 2 }), a = await f.create(), b = await f.create();
  const pa = await f.prepare(a.id, 'intent'), pb = await f.prepare(b.id, 'intent');
  const object = await paymentObject(f.prisma, f.stripe, pa);
  await assert.rejects(applyPaymentObservation(f.prisma, 'duplicate-ownership', 'paid',
    f.observe(b, 'succeeded', { intentId: object.id, paymentId: pb.id })), conflict);
  assert.equal(f.state().payments.find(p => p.id === pb.id).status, 'pending');
  assert.equal(f.state().bookings.find(row => row.id === b.id).payment_intent_id, undefined);
});
test('historical over-capacity occupancy rejects new allocation without rewriting history', async () => {
  const f = fixture(), b = await f.create(); f.state().bookings[0].num_people = 2;
  await assert.rejects(f.create(), conflict);
  assert.equal(f.state().bookings.length, 1); assert.equal(f.state().bookings[0].num_people, 2);
  assert.equal(f.state().slot.spots_total, 1);
});
test('duplicate concurrent event processing applies one financial transition', async () => {
  const logs = [], info = console.info; console.info = value => logs.push(JSON.parse(value));
  try {
    const f = fixture(), b = await f.create(); await f.prepare(b.id);
    await Promise.all([applyPaymentObservation(f.prisma, 'same-concurrent-event', 'paid', f.observe(b)),
      applyPaymentObservation(f.prisma, 'same-concurrent-event', 'paid', f.observe(b))]);
    assert.equal(f.state().events.length, 1);
    assert.equal(logs.filter(e => e.event_id === 'same-concurrent-event' && e.result === 'committed').length, 1);
    assert.equal(f.state().slot.spots_available, 0);
  } finally { console.info = info; }
});
test('failed processing logs a category without exposing exception contents', async () => {
  const logs = [], info = console.info; console.info = value => logs.push(value);
  try {
    const f = fixture(), b = await f.create(); await f.prepare(b.id);
    f.prisma.bookings.update = async () => { throw new Error('private@example.test synthetic_sensitive_token'); };
    await assert.rejects(applyPaymentObservation(f.prisma, 'safe-failure-log', 'paid', f.observe(b)));
    assert.ok(logs.some(s => s.includes('dependency_or_processing_failure')));
    assert.doesNotMatch(logs.join(''), /private@example|synthetic_sensitive_token/);
    assert.equal(f.state().events[0].status, 'failed');
  } finally { console.info = info; }
});

test('BLOCKER settlement: malformed observed amount never records verified money', async () => {
  const f = fixture(), b = await f.create(); await f.prepare(b.id);
  await assert.rejects(applyPaymentObservation(f.prisma, 'malformed-money', 'paid', f.observe(b, 'succeeded', { amount: NaN })));
  assert.equal(f.state().payments[0].status, 'pending');
  assert.equal(f.state().events[0].status, 'failed');
});
test('BLOCKER settlement: canonical full refund closes financial mismatch without requiring a guessed price', async () => {
  const f = fixture(), b = await f.create(); await f.prepare(b.id);
  await applyPaymentObservation(f.prisma, 'mismatched-money', 'paid', f.observe(b, 'succeeded', { amount: 1 }));
  await applyPaymentObservation(f.prisma, 'refunded-mismatched-money', 'refund', f.observe(b, 'refunded', { amount: 1 }));
  assert.equal(f.state().payments[0].status, 'refunded');
  assert.equal(f.state().payments[0].resolution, null);
  assert.equal(f.state().bookings[0].status, 'cancelled');
  assert.equal(f.state().slot.spots_available, 1);
});

test('BLOCKER checkout association: retrieved session cannot be returned with another ledger metadata', async () => {
  const f = fixture(), b = await f.create(), p = await f.prepare(b.id);
  const object = await paymentObject(f.prisma, f.stripe, p);
  f.objects.get(object.id).metadata.payment_record_id = 'wrong-ledger';
  await assert.rejects(paymentObject(f.prisma, f.stripe, f.state().payments[0]), conflict);
});

test('BLOCKER observability: committed money transitions are traceable without logging private payloads', async () => {
  const logs = [], info = console.info;
  console.info = value => logs.push(value);
  try {
    const f = fixture(), b = await f.create(); await f.prepare(b.id);
    f.state().bookings[0].email = 'private@example.test';
    await applyPaymentObservation(f.prisma, 'audit-event', 'paid', f.observe(b));
    const entry = logs.map(s => JSON.parse(s)).find(e => e.event_id === 'audit-event' && e.result === 'committed');
    assert.ok(entry, 'Missing committed financial transition');
    assert.equal(entry.booking_id, b.id); assert.ok(entry.payment_record_id);
    assert.equal(entry.previous_booking_state, 'payment_pending');
    assert.equal(entry.new_booking_state, 'confirmed');
    assert.equal(entry.inventory_action, 'KEEP');
    assert.equal(entry.expected_amount_cents, 12000); assert.equal(entry.observed_amount_cents, 12000);
    assert.doesNotMatch(logs.join(''), /private@example|client_secret|request_payload|synthetic-not-a-real-secret/);
  } finally { console.info = info; }
});

test('BLOCKER association: blank historical external ID fails closed before external IO', async () => {
  const f = fixture(), b = await f.create();
  Object.assign(f.state().bookings[0], { checkout_session_id: '', amount_cents: null });
  await updateCapacityBooking(f.prisma, b.id, { status: 'cancelled' });
  await assert.rejects(reconcileBookingPayment(f.prisma, f.stripe, b.id), conflict);
  assert.equal(f.state().bookings[0].status, 'cancellation_pending');
});
test('BLOCKER association: legacy ledger-only reference can be recovered without creating another flow', async () => {
  const f = fixture(), b = await f.create(), p = await f.prepare(b.id, 'intent');
  const object = await paymentObject(f.prisma, f.stripe, p);
  f.state().payments[0].flow = null; f.state().bookings[0].payment_intent_id = null;
  await updateCapacityBooking(f.prisma, b.id, { status: 'cancelled' });
  const result = await reconcileBookingPayment(f.prisma, f.stripe, b.id);
  assert.equal(result.status, 'cancelled'); assert.equal(f.creates(), 1);
});
test('BLOCKER association: nested intent ledger mismatch forbids checkout expiration', async () => {
  const f = fixture(), b = await f.create(), p = await f.prepare(b.id);
  const object = await paymentObject(f.prisma, f.stripe, p);
  f.objects.get(object.id).payment_intent = { id: 'nested-intent', status: 'processing', metadata: { booking_id: b.id, payment_record_id: 'another-ledger' } };
  await updateCapacityBooking(f.prisma, b.id, { status: 'cancelled' });
  await assert.rejects(reconcileBookingPayment(f.prisma, f.stripe, b.id), conflict);
  assert.equal(f.objects.get(object.id).status, 'open');
});
test('BLOCKER association: observation cannot replace a different legacy booking reference', async () => {
  const f = fixture(), b = await f.create();
  f.state().bookings[0].payment_intent_id = 'canonical-intent';
  await applyPaymentObservation(f.prisma, 'wrong-legacy-reference', 'paid', f.observe(b, 'succeeded', { intentId: 'different-intent' }));
  assert.equal(f.state().bookings[0].payment_intent_id, 'canonical-intent');
  assert.equal(f.state().bookings[0].status, 'reconciliation_required');
});
test('BLOCKER historical failure: unverified legacy failed with live flow cannot release seats', async () => {
  const f = fixture(), b = await f.create(), p = await f.prepare(b.id, 'intent');
  await paymentObject(f.prisma, f.stripe, p);
  Object.assign(f.state().payments[0], { status: 'failed', flow: null });
  await updateCapacityBooking(f.prisma, b.id, { status: 'cancelled' });
  assert.equal(f.state().bookings[0].status, 'cancellation_pending');
  assert.equal(f.state().slot.spots_available, 0);
});

test('BLOCKER P5: legacy paid booking without ledger cannot become failed', async () => {
  const f = fixture(), b = await f.create();
  Object.assign(f.state().bookings[0], { status: 'confirmed', payment_status: 'paid' });
  await applyPaymentObservation(f.prisma, 'no-ledger-paid', 'failed', f.observe(b, 'failed'));
  assert.equal(f.state().bookings[0].payment_status, 'paid');
  assert.equal(f.state().payments[0].status, 'succeeded');
});
test('BLOCKER P5: unknown historical expected amount is not fabricated as zero', async () => {
  const f = fixture(), b = await f.create();
  f.state().bookings[0].amount_cents = null;
  await applyPaymentObservation(f.prisma, 'unknown-expected', 'paid', f.observe(b));
  assert.equal(f.state().payments[0].amount_gross_cents, null);
  assert.equal(f.state().payments[0].amount_charged_cents, 12000);
  assert.equal(f.state().bookings[0].status, 'reconciliation_required');
});
test('BLOCKER P5: duplicate external ID across bookings blocks external cancellation', async () => {
  const f = fixture(), b = await f.create(), p = await f.prepare(b.id, 'intent');
  const object = await paymentObject(f.prisma, f.stripe, p);
  f.state().payments.push({ ...f.state().payments[0], id: 'duplicate-ledger', booking_id: 'other-booking' });
  await updateCapacityBooking(f.prisma, b.id, { status: 'cancelled' });
  await assert.rejects(reconcileBookingPayment(f.prisma, f.stripe, b.id), conflict);
  assert.equal(f.objects.get(object.id).status, 'requires_payment_method');
});
test('BLOCKER P5: invalid participants cannot hide inside a nonnegative occupancy sum', async () => {
  const f = fixture({ capacity: 3 }), b = await f.create();
  Object.assign(f.state().bookings[0], { num_people: 2 });
  f.state().bookings.push({ ...f.state().bookings[0], id: 'invalid-participants', num_people: -1 });
  await assert.rejects(f.create(), conflict);
});

test('BLOCKER P3: first legitimate late settlement uses reserved inventory, not new-booking dates', async () => {
  const f = fixture(), b = await f.create(); await f.prepare(b.id);
  f.state().bookings[0].date = new Date('2020-01-01');
  f.state().slot.date = new Date('2020-01-01');
  await applyPaymentObservation(f.prisma, 'first-late', 'paid', f.observe(b));
  assert.equal(f.state().bookings[0].status, 'confirmed');
});
test('BLOCKER P3: partial refund preserves a valid reservation and its inventory', async () => {
  const f = fixture(), b = await f.create(); await f.prepare(b.id);
  await applyPaymentObservation(f.prisma, 'paid-before-partial', 'paid', f.observe(b));
  await applyPaymentObservation(f.prisma, 'partial-keep', 'partial', f.observe(b, 'partial_refund'));
  assert.equal(f.state().bookings[0].status, 'confirmed');
  assert.equal(f.state().slot.spots_available, 0);
});
test('BLOCKER P3: partial then full refund closes the lifecycle consistently', async () => {
  const f = fixture(), b = await f.create(); await f.prepare(b.id);
  await applyPaymentObservation(f.prisma, 'partial-close', 'partial', f.observe(b, 'partial_refund'));
  await applyPaymentObservation(f.prisma, 'full-close', 'full', f.observe(b, 'refunded'));
  assert.equal(f.state().bookings[0].status, 'cancelled');
  assert.equal(f.state().payments[0].resolution, null);
});
test('BLOCKER P3: financial investigation does not implicitly release held seats', async () => {
  const f = fixture(), b = await f.create(); await f.prepare(b.id);
  await applyPaymentObservation(f.prisma, 'review-hold', 'paid', f.observe(b, 'succeeded', { amount: 1 }));
  assert.equal(f.state().bookings[0].status, 'reconciliation_required');
  assert.equal(f.state().slot.spots_available, 0);
});

test('BLOCKER P2: existing unprocessed event is resumed', async () => {
  const f = fixture(), b = await f.create(); await f.prepare(b.id);
  f.state().events.push({ id: 'received', processed_at: null });
  await applyPaymentObservation(f.prisma, 'received', 'paid', f.observe(b));
  assert.equal(f.state().bookings[0].status, 'confirmed');
  assert.ok(f.state().events[0].processed_at);
});
test('BLOCKER P2: external lookup failure leaves a durable retryable event', async () => {
  const f = fixture(), b = await f.create(), p = await f.prepare(b.id, 'intent');
  const object = await paymentObject(f.prisma, f.stripe, p);
  const retrieve = f.stripe.paymentIntents.retrieve;
  f.stripe.paymentIntents.retrieve = async () => { throw new Error('Synthetic external outage'); };
  const event = { id: 'retryable-event', type: 'payment_intent.succeeded', data: { object: { id: object.id } } };
  await assert.rejects(handleStripeEvent(f.prisma, f.stripe, event));
  assert.equal(f.state().events[0]?.status, 'failed');
  f.stripe.paymentIntents.retrieve = retrieve;
  Object.assign(f.objects.get(object.id), { status: 'succeeded', amount_received: 12000 });
  await handleStripeEvent(f.prisma, f.stripe, event);
  assert.equal(f.state().events[0].status, 'processed');
  assert.equal(f.state().bookings[0].status, 'confirmed');
});

test('BLOCKER P1: unknown historical amount with a live checkout retains capacity', async () => {
  const f = fixture(), b = await f.create(), p = await f.prepare(b.id);
  await paymentObject(f.prisma, f.stripe, p);
  f.state().bookings[0].amount_cents = null;
  const result = await updateCapacityBooking(f.prisma, b.id, { status: 'cancelled' });
  assert.equal(result.status, 'cancellation_pending');
  await assert.rejects(f.create(), conflict);
});
test('BLOCKER P1: external association is verified before any cancellation', async () => {
  const f = fixture(), b = await f.create(), p = await f.prepare(b.id, 'intent');
  const object = await paymentObject(f.prisma, f.stripe, p);
  await updateCapacityBooking(f.prisma, b.id, { status: 'cancelled' });
  f.objects.get(object.id).metadata.booking_id = 'different-synthetic-booking';
  await assert.rejects(reconcileBookingPayment(f.prisma, f.stripe, b.id));
  assert.equal(f.objects.get(object.id).status, 'requires_payment_method');
});
test('BLOCKER P1: legacy paid cannot regress on an old failed observation', async () => {
  const f = fixture(), b = await f.create(); await f.prepare(b.id);
  Object.assign(f.state().payments[0], { status: 'paid', flow: null });
  Object.assign(f.state().bookings[0], { status: 'confirmed', payment_status: 'paid' });
  await applyPaymentObservation(f.prisma, 'legacy-failure', 'failed', f.observe(b, 'failed'));
  assert.equal(f.state().payments[0].status, 'succeeded');
  assert.equal(f.state().bookings[0].status, 'confirmed');
});

function fixture({ capacity = 1, free = false } = {}) {
  const listing = { id: 'synthetic-listing', provider_id: 'synthetic-provider', price_from: free ? '0' : '120', currency: 'USD', status: 'published', tags: [] };
  let state = { bookings: [], payments: [], events: [], slot: { id: 'slot', date: new Date(tomorrow), spots_total: capacity, spots_available: capacity } };
  let lock = Promise.resolve(), counter = 0;
  function table(key) {
    const find = where => state[key].find(r => Object.entries(where).every(([k, v]) => v === null ? r[k] == null : r[k] === v));
    return {
      findMany: async ({ where = {} } = {}) => state[key].filter(r => !where.OR || where.OR.some(clause => Object.entries(clause).every(([k, v]) => r[k] === v))).map(r => ({ ...r })),
      upsert: async ({ where, create, update }) => {
        const r = find(where); if (r) { Object.assign(r, update); return { ...r }; }
        const row = { processed_at: null, attempts: 0, ...create }; state[key].push(row); return { ...row };
      },
      updateMany: async ({ where, data }) => {
        const r = find(where); if (!r) return { count: 0 };
        for (const [k, v] of Object.entries(data)) r[k] = v?.increment ? (r[k] || 0) + v.increment : v;
        return { count: 1 };
      },
      findUnique: async ({ where }) => {
        const r = find(where);
        return r ? { ...r, ...(key === 'bookings' ? { listing, provider: { id: listing.provider_id } } : {}) } : null;
      },
      create: async ({ data }) => {
        if (key === 'payments') assert.ok(!state.payments.some(p => p.booking_id === data.booking_id));
        if (data.id) assert.ok(!state[key].some(r => r.id === data.id));
        const row = { id: `${key}-${++counter}`, created_at: new Date(), ...data };
        state[key].push(row); return { ...row };
      },
      update: async ({ where, data }) => { const r = find(where); assert.ok(r); Object.assign(r, data); return { ...r }; },
    };
  }
  const prisma = {
    bookings: { ...table('bookings'), aggregate: async ({ where }) => ({ _min: { num_people: Math.min(...state.bookings.map(b => b.num_people)) }, _sum: { num_people: state.bookings
      .filter(b => b.listing_id === where.listing_id && (b.inventory_state === 'held' || (b.inventory_state == null && !['cancelled', 'rejected'].includes(b.status))) && b.id !== where.id?.not
        && +new Date(b.date) >= +where.date.gte && +new Date(b.date) < +where.date.lt)
      .reduce((n, b) => n + b.num_people, 0) } }) },
    listings: { findUnique: async () => listing },
    paymentRecord: table('payments'), paymentEvent: table('events'),
    listing_availability: {
      findMany: async () => [state.slot],
      update: async ({ data }) => { Object.assign(state.slot, data); return { ...state.slot }; },
    },
    $transaction: async (fn, options) => {
      assert.equal(options.isolationLevel, 'ReadCommitted');
      let release, snapshot;
      const tx = { ...prisma, $queryRaw: async (sql, ...args) => {
        assert.match(sql.join(''), /FOR UPDATE/);
        if (sql.join('').includes('FROM "PaymentEvent"')) return [{ id: args[0] }]; // DB integration must validate this lock.
        if (sql.join('').includes('FROM listings')) {
          const previous = lock; lock = new Promise(resolve => { release = resolve; }); await previous;
          snapshot = structuredClone(state);
          return args[0] === listing.id ? [{ id: listing.id }] : [];
        }
        assert.ok(snapshot); return [state.slot];
      } };
      try { return await fn(tx); }
      catch (e) { if (snapshot) state = snapshot; throw e; }
      finally { release?.(); }
    },
  };
  const objects = new Map(), keys = new Map(); let creates = 0;
  function processor(flow) {
    return {
      create: async (request, { idempotencyKey }) => {
        if (!keys.has(idempotencyKey)) {
          creates++;
          const obj = { id: `${flow}-${creates}`, metadata: request.metadata,
            status: flow === 'checkout' ? 'open' : 'requires_payment_method',
            payment_status: 'unpaid', amount_total: 12000, amount: 12000, currency: 'usd',
            url: 'http://127.0.0.1/checkout', client_secret: 'synthetic-not-a-real-secret' };
          keys.set(idempotencyKey, obj); objects.set(obj.id, obj);
        }
        return structuredClone(keys.get(idempotencyKey));
      },
      retrieve: async id => { assert.ok(objects.has(id)); return structuredClone(objects.get(id)); },
      expire: async id => { const obj = objects.get(id); if (obj.status !== 'open') throw new Error('Not open'); obj.status = 'expired'; return { ...obj }; },
      cancel: async id => { const obj = objects.get(id); if (obj.status === 'succeeded') throw new Error('Already paid'); obj.status = 'canceled'; return { ...obj }; },
    };
  }
  const stripe = { checkout: { sessions: processor('checkout') }, paymentIntents: processor('intent'), charges: { retrieve: async () => { throw new Error('Unexpected charge lookup'); } } };
  const create = async () => (await createCapacityBooking(prisma, { id: 'synthetic-traveler' }, { listing_id: listing.id, date: tomorrow, num_people: 1 })).created;
  const prepare = (id, flow = 'checkout') => preparePayment(prisma, id, flow, (b, paymentId) => ({ metadata: { booking_id: b.id, payment_record_id: paymentId }, amount: b.amount_cents, currency: b.currency }));
  const observe = (b, outcome = 'succeeded', extra = {}) => ({ bookingId: b.id, outcome, amount: 12000, currency: 'usd', ...extra });
  return { prisma, stripe, create, prepare, observe, state: () => state, objects, creates: () => creates };
}

test('cancellation during payment_pending retains seats until session expiration is verified', async () => {
  const f = fixture(), b = await f.create(), p = await f.prepare(b.id);
  await paymentObject(f.prisma, f.stripe, p);
  const pending = await updateCapacityBooking(f.prisma, b.id, { status: 'cancelled' });
  assert.equal(pending.status, 'cancellation_pending'); assert.equal(f.state().slot.spots_available, 0);
  await assert.rejects(f.create(), conflict);
  const cancelled = await reconcileBookingPayment(f.prisma, f.stripe, b.id);
  assert.equal(cancelled.status, 'cancelled'); assert.equal(f.state().payments[0].status, 'failed');
  assert.equal(f.state().slot.spots_available, 1);
});

test('succeeded after valid cancellation records charge and refund_required, never confirmation', async () => {
  const f = fixture(), b = await f.create();
  await updateCapacityBooking(f.prisma, b.id, { status: 'cancelled' });
  await f.create();
  const result = await applyPaymentObservation(f.prisma, 'late', 'payment_intent.succeeded', f.observe(b));
  assert.equal(result.status, 'reconciliation_required'); assert.equal(result.payment_status, 'paid');
  assert.equal(f.state().payments[0].status, 'succeeded'); assert.equal(f.state().payments[0].amount_charged_cents, 12000);
  assert.equal(f.state().payments[0].resolution, 'refund_required'); assert.equal(f.state().slot.spots_available, 0);
});

test('payment wins cancellation race: ledger paid, refund required, no false cancelled/confirmed', async () => {
  const f = fixture(), b = await f.create(); await f.prepare(b.id);
  await updateCapacityBooking(f.prisma, b.id, { status: 'cancelled' });
  const result = await applyPaymentObservation(f.prisma, 'won', 'payment_intent.succeeded', f.observe(b));
  assert.equal(result.status, 'reconciliation_required'); assert.equal(f.state().payments[0].resolution, 'refund_required');
});

test('duplicate webhook commits one financial result and event', async () => {
  const f = fixture(), b = await f.create(); await f.prepare(b.id);
  await Promise.all([1, 2].map(() => applyPaymentObservation(f.prisma, 'same-event', 'succeeded', f.observe(b))));
  assert.equal(f.state().events.length, 1); assert.equal(f.state().bookings[0].status, 'confirmed');
});

test('out-of-order failure/pending never reverse succeeded; succeeded never reverses refunded', async () => {
  const f = fixture(), b = await f.create(); await f.prepare(b.id);
  for (const [id, state] of [['1', 'succeeded'], ['2', 'failed'], ['3', 'pending']]) await applyPaymentObservation(f.prisma, id, state, f.observe(b, state));
  assert.equal(f.state().bookings[0].status, 'confirmed'); assert.equal(f.state().payments[0].status, 'succeeded');
  await applyPaymentObservation(f.prisma, '4', 'refunded', f.observe(b, 'refunded'));
  await applyPaymentObservation(f.prisma, '5', 'succeeded', f.observe(b));
  assert.equal(f.state().bookings[0].status, 'cancelled'); assert.equal(f.state().payments[0].status, 'refunded');
});

test('two concurrent checkouts share a PaymentRecord and processor key: one logical charge', async () => {
  const f = fixture(), b = await f.create();
  const [p, q] = await Promise.all([f.prepare(b.id), f.prepare(b.id)]);
  assert.equal(p.id, q.id);
  const [x, y] = await Promise.all([paymentObject(f.prisma, f.stripe, p), paymentObject(f.prisma, f.stripe, q)]);
  assert.equal(x.id, y.id); assert.equal(f.creates(), 1); assert.equal(f.state().payments.length, 1);
  await assert.rejects(f.prepare(b.id, 'intent'), conflict);
});

test('two travelers competing for final seat: one transaction succeeds', async () => {
  const f = fixture(); const outcomes = await Promise.allSettled([f.create(), f.create()]);
  assert.equal(outcomes.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(f.state().bookings.length, 1); assert.equal(f.state().slot.spots_available, 0);
});

test('expired checkout without live intent releases inventory; late webhook cannot reverse refund', async () => {
  const f = fixture(), b = await f.create(), p = await f.prepare(b.id);
  const obj = await paymentObject(f.prisma, f.stripe, p); f.objects.get(obj.id).status = 'expired';
  const result = await reconcileBookingPayment(f.prisma, f.stripe, b.id);
  assert.equal(result.status, 'cancelled'); assert.equal(f.state().slot.spots_available, 1);
});

test('free tour confirms with inventory and never starts Stripe', async () => {
  const f = fixture({ free: true }), b = await f.create();
  assert.equal(b.status, 'confirmed'); assert.equal(b.amount_cents, 0);
  await assert.rejects(f.prepare(b.id), e => e.getStatus?.() === 400);
  await assert.rejects(f.create(), conflict); assert.equal(f.creates(), 0);
});

test('succeeded with valid capacity confirms atomically with ledger', async () => {
  const f = fixture(), b = await f.create(); await f.prepare(b.id);
  const result = await applyPaymentObservation(f.prisma, 'paid', 'succeeded', f.observe(b));
  assert.equal(result.status, 'confirmed'); assert.equal(result.payment_status, 'paid');
  assert.equal(f.state().payments[0].status, 'succeeded'); assert.ok(f.state().events[0].processed_at);
});

test('succeeded without capacity records refund_required without growing capacity', async () => {
  const f = fixture(), b = await f.create(); await f.prepare(b.id);
  f.state().slot.spots_total = 0; // Administrative/external inventory change.
  const result = await applyPaymentObservation(f.prisma, 'no-capacity', 'succeeded', f.observe(b));
  assert.equal(result.status, 'reconciliation_required'); assert.equal(f.state().payments[0].resolution, 'refund_required');
  assert.equal(f.state().slot.spots_total, 0);
});

test('notifications never confirm pending, cancelling, reconciliation or cancelled states', async () => {
  const { bookingStatusMessage } = await import('../apps/web/src/services/bookingStatus.js');
  for (const status of ['pending', 'payment_pending', 'cancellation_pending', 'reconciliation_required', 'cancelled']) {
    for (const payment_status of ['paid', 'unpaid', 'refunded']) assert.notEqual(bookingStatusMessage({ status, payment_status }).kind, 'confirmed');
  }
  assert.equal(bookingStatusMessage({ status: 'confirmed', payment_status: 'paid' }).kind, 'confirmed');
  assert.notEqual(bookingStatusMessage({ status: 'confirmed', payment_status: 'unpaid' }).kind, 'confirmed');
});

test('crash after external creation replays same operation, never a second payment', async () => {
  const f = fixture(), b = await f.create(), p = await f.prepare(b.id);
  const original = f.prisma.paymentRecord.update;
  f.prisma.paymentRecord.update = async () => { throw new Error('DB unavailable after external creation'); };
  await assert.rejects(paymentObject(f.prisma, f.stripe, p));
  f.prisma.paymentRecord.update = original;
  await paymentObject(f.prisma, f.stripe, p);
  assert.equal(f.creates(), 1);
});

test('creation cannot be retried beyond processor idempotency retention', async () => {
  const f = fixture(), b = await f.create(), p = await f.prepare(b.id);
  p.created_at = new Date(Date.now() - 24 * 3600000);
  await assert.rejects(paymentObject(f.prisma, f.stripe, p), conflict);
  assert.equal(f.creates(), 0); assert.equal(f.state().slot.spots_available, 0);
  assert.equal(f.state().payments[0].resolution, 'reconciliation_required');
});

test('payment_failed webhook reads current processor state; retryable decline retains inventory', async () => {
  const f = fixture(), b = await f.create(), p = await f.prepare(b.id, 'intent');
  const obj = await paymentObject(f.prisma, f.stripe, p);
  await handleStripeEvent(f.prisma, f.stripe, { id: 'decline', type: 'payment_intent.payment_failed', data: { object: { id: obj.id } } });
  assert.equal(f.state().bookings[0].status, 'payment_pending'); assert.equal(f.state().slot.spots_available, 0);
  Object.assign(f.objects.get(obj.id), { status: 'succeeded', amount_received: 12000 });
  await handleStripeEvent(f.prisma, f.stripe, { id: 'old-decline', type: 'payment_intent.payment_failed', data: { object: { id: obj.id } } });
  assert.equal(f.state().bookings[0].status, 'confirmed');
});

test('cancellation before external response is persisted recovers and expires same session', async () => {
  const f = fixture(), b = await f.create(), p = await f.prepare(b.id);
  await updateCapacityBooking(f.prisma, b.id, { status: 'cancelled' });
  await reconcileBookingPayment(f.prisma, f.stripe, b.id);
  assert.equal(f.creates(), 1); assert.equal(f.state().bookings[0].status, 'cancelled');
});

test('network uncertainty during cancellation retains seats and explicit cancellation_pending', async () => {
  const f = fixture(), b = await f.create(), p = await f.prepare(b.id);
  await paymentObject(f.prisma, f.stripe, p);
  await updateCapacityBooking(f.prisma, b.id, { status: 'cancelled' });
  f.stripe.checkout.sessions.retrieve = async () => { throw new Error('Synthetic network outage'); };
  await assert.rejects(reconcileBookingPayment(f.prisma, f.stripe, b.id));
  assert.equal(f.state().bookings[0].status, 'cancellation_pending'); assert.equal(f.state().slot.spots_available, 0);
});

test('transaction failure rolls back event, financial result and booking together', async () => {
  const f = fixture(), b = await f.create(); await f.prepare(b.id);
  const original = f.prisma.paymentEvent.update;
  f.prisma.paymentEvent.update = async () => { throw new Error('Synthetic commit failure'); };
  await assert.rejects(applyPaymentObservation(f.prisma, 'retry-event', 'paid', f.observe(b)));
  assert.equal(f.state().events.length, 1); assert.equal(f.state().events[0].status, 'failed');
  assert.equal(f.state().events[0].processed_at, null); assert.equal(f.state().payments[0].status, 'pending');
  assert.equal(f.state().bookings[0].status, 'payment_pending');
  f.prisma.paymentEvent.update = original;
  await applyPaymentObservation(f.prisma, 'retry-event', 'paid', f.observe(b));
  assert.equal(f.state().bookings[0].status, 'confirmed');
});

test('repeated cancellation cannot reacquire already reassigned seats', async () => {
  const f = fixture(), b = await f.create();
  await updateCapacityBooking(f.prisma, b.id, { status: 'cancelled' }); await f.create();
  const result = await updateCapacityBooking(f.prisma, b.id, { status: 'cancelled' });
  assert.equal(result.status, 'cancelled'); assert.equal(f.state().slot.spots_available, 0);
});

test('settled booking refuses all additional external payment creation', async () => {
  const f = fixture(), b = await f.create(); await f.prepare(b.id);
  await applyPaymentObservation(f.prisma, 'paid-no-retry', 'paid', f.observe(b));
  await assert.rejects(f.prepare(b.id), conflict); await assert.rejects(f.prepare(b.id, 'intent'), conflict);
  assert.equal(f.creates(), 0);
});

test('identity mismatch is durable and never confirms or frees pending inventory', async () => {
  const f = fixture(), b = await f.create(); await f.prepare(b.id);
  const result = await applyPaymentObservation(f.prisma, 'mismatch', 'paid', f.observe(b, 'succeeded', { paymentId: 'unexpected-payment', amount: 1, intentId: 'unexpected' }));
  assert.equal(result.status, 'reconciliation_required'); assert.equal(f.state().slot.spots_available, 0);
  assert.equal(f.state().events[0].payload.amount, 1); assert.equal(f.state().payments[0].resolution, 'reconciliation_required');
});

test('wrong amount on canonical payment records actual money and requests reconciliation', async () => {
  const f = fixture(), b = await f.create(); await f.prepare(b.id);
  const result = await applyPaymentObservation(f.prisma, 'wrong-amount', 'paid', f.observe(b, 'succeeded', { amount: 1 }));
  assert.equal(result.status, 'reconciliation_required'); assert.equal(result.payment_status, 'paid');
  assert.equal(f.state().payments[0].status, 'succeeded'); assert.equal(f.state().payments[0].amount_charged_cents, 1);
  assert.equal(f.state().payments[0].amount_gross_cents, 12000);
});

test('expiration with a still-processing intent does not release seats', async () => {
  const f = fixture(), b = await f.create(), p = await f.prepare(b.id);
  const object = await paymentObject(f.prisma, f.stripe, p);
  Object.assign(f.objects.get(object.id), { status: 'expired', payment_intent: {
    id: 'processing-intent', status: 'processing', amount: 12000, currency: 'usd', metadata: p.request_payload.metadata,
  } });
  const result = await reconcileBookingPayment(f.prisma, f.stripe, b.id);
  assert.equal(result.status, 'payment_pending'); assert.equal(f.state().slot.spots_available, 0);
});

test('a late duplicate success after the tour date does not invalidate an already settled booking', async () => {
  const f = fixture(), b = await f.create(); await f.prepare(b.id);
  await applyPaymentObservation(f.prisma, 'first-success', 'paid', f.observe(b));
  f.state().bookings[0].date = new Date('2020-01-01');
  f.state().slot.date = new Date('2020-01-01');
  const result = await applyPaymentObservation(f.prisma, 'later-success', 'paid', f.observe(b));
  assert.equal(result.status, 'confirmed'); assert.equal(f.state().payments[0].resolution, null);
});

test('direct PaymentIntent cancellation verifies canceled before releasing inventory', async () => {
  const f = fixture(), b = await f.create(), p = await f.prepare(b.id, 'intent');
  await paymentObject(f.prisma, f.stripe, p);
  await updateCapacityBooking(f.prisma, b.id, { status: 'cancelled' });
  const result = await reconcileBookingPayment(f.prisma, f.stripe, b.id);
  assert.equal(result.status, 'cancelled'); assert.equal(f.state().payments[0].status, 'failed');
  assert.equal(f.state().slot.spots_available, 1);
});

test('processor payment wins expiration request: verified charge is recorded for refund', async () => {
  const f = fixture(), b = await f.create(), p = await f.prepare(b.id);
  const object = await paymentObject(f.prisma, f.stripe, p);
  await updateCapacityBooking(f.prisma, b.id, { status: 'cancelled' });
  f.stripe.checkout.sessions.expire = async () => {
    Object.assign(f.objects.get(object.id), { status: 'complete', payment_status: 'paid' });
    throw new Error('Payment completed during expiration');
  };
  const result = await reconcileBookingPayment(f.prisma, f.stripe, b.id);
  assert.equal(result.status, 'reconciliation_required'); assert.equal(result.payment_status, 'paid');
  assert.equal(f.state().payments[0].resolution, 'refund_required');
});

test('partial refund stays under review when an older success event is delivered', async () => {
  const f = fixture(), b = await f.create(); await f.prepare(b.id);
  await applyPaymentObservation(f.prisma, 'initial-paid', 'paid', f.observe(b));
  await applyPaymentObservation(f.prisma, 'partial-refund', 'partial', f.observe(b, 'partial_refund'));
  await applyPaymentObservation(f.prisma, 'delayed-paid', 'paid', f.observe(b));
  assert.equal(f.state().payments[0].status, 'succeeded');
  assert.equal(f.state().payments[0].resolution, 'reconciliation_required');
  assert.equal(f.state().bookings[0].status, 'confirmed');
  assert.equal(f.state().slot.spots_available, 0);
});
