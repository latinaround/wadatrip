// Build common first. No real DB/Stripe/network. The mutex models row-lock ordering, not PostgreSQL itself.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createCapacityBooking, updateCapacityBooking, requireReservedCapacity } = require('@wadatrip/common/booking-capacity');
const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
const later = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
const actor = { id: 'synthetic-traveler' };
const rejected = error => [400, 409].includes(error.getStatus?.());

function fixture({ total = 3, tags = [], price = '120.00' } = {}) {
  const listing = { id: 'listing', provider_id: 'synthetic-provider', status: 'published', price_from: price, currency: 'USD', tags };
  const rows = [];
  const slots = [{ id: 'slot', listing_id: listing.id, date: new Date(tomorrow), spots_total: total, spots_available: total }];
  let lock = Promise.resolve(), nextId = 0, transactions = 0;
  const prisma = { $transaction: async (fn, options) => {
    assert.equal(options.isolationLevel, 'ReadCommitted');
    transactions++;
    let release, locked = false, snapshot;
    const tx = {
      paymentRecord: { findUnique: async () => null },
      $queryRaw: async (sql, ...args) => {
        if (sql.join('').includes('FROM listings')) {
          assert.ok(sql.join('').includes('FOR UPDATE'));
          const previous = lock;
          lock = new Promise(resolve => { release = resolve; });
          await previous;
          locked = true;
          snapshot = { rows: structuredClone(rows), slots: structuredClone(slots) };
          return args[0] === listing.id ? [{ id: listing.id }] : [];
        }
        assert.ok(locked, 'Listing must be locked before checking availability');
        assert.ok(sql.join('').includes('FOR UPDATE'));
        return slots.filter(s => s.listing_id === args[0] && s.date >= args[1] && s.date < args[2]);
      },
      listings: { findUnique: async () => { assert.ok(locked); return listing; } },
      bookings: {
        findUnique: async ({ where }) => { const row = rows.find(r => r.id === where.id); return row ? { ...row } : null; },
        aggregate: async ({ where }) => {
          assert.ok(locked, 'Occupancy must be read inside the listing lock');
          return { _sum: { num_people: rows.filter(r => r.listing_id === where.listing_id
            && +new Date(r.date) >= +where.date.gte && +new Date(r.date) < +where.date.lt
            && (r.inventory_state === 'held' || (r.inventory_state == null && !['cancelled', 'rejected'].includes(r.status))) && r.id !== where.id?.not)
            .reduce((sum, r) => sum + r.num_people, 0) } };
        },
        create: async ({ data }) => { assert.ok(locked); const b = { id: `b-${nextId++}`, ...data }; rows.push(b); return b; },
        update: async ({ where, data }) => { assert.ok(locked); const b = rows.find(r => r.id === where.id); Object.assign(b, data); return b; },
      },
      listing_availability: {
        findMany: async ({ where }) => slots.filter(s => s.listing_id === where.listing_id && s.date >= where.date.gte && s.date < where.date.lt),
        update: async ({ where, data }) => { assert.ok(locked); const s = slots.find(s => s.id === where.id); Object.assign(s, data); return s; },
      },
      trips: { findUnique: async () => null },
    };
    try { return await fn(tx); }
    catch (err) {
      if (snapshot) { rows.splice(0, rows.length, ...snapshot.rows); slots.splice(0, slots.length, ...snapshot.slots); }
      throw err;
    } finally { if (release) release(); }
  } };
  const create = (extra = {}) => createCapacityBooking(prisma, actor, { listing_id: 'listing', date: tomorrow, num_people: 1, ...extra });
  return { prisma, listing, rows, slots, create, transactions: () => transactions,
    existing: (status, people, extra = {}) => rows.push({ id: `existing-${rows.length}`, listing_id: 'listing', date: new Date(tomorrow), num_people: people, status, ...extra }) };
}

for (const people of [0, -1, 1.5, 100000]) test(`traveler count ${people} rejected by server/canonical capacity`, async () => {
  const f = fixture(); await assert.rejects(f.create({ num_people: people }), rejected); assert.equal(f.rows.length, 0);
});
test('past, invalid and impossible calendar dates rejected', async () => {
  const f = fixture();
  for (const date of ['2020-01-01', 'bad-date', '2027-02-30', '2027-13-01', null]) await assert.rejects(f.create({ date }), rejected);
  assert.equal(f.rows.length, 0);
});
test('missing listing, missing date slot and empty availability rejected', async () => {
  const f = fixture();
  await assert.rejects(f.create({ listing_id: 'missing' }), rejected);
  await assert.rejects(f.create({ date: later }), rejected);
  f.slots.splice(0);
  await assert.rejects(f.create(), rejected);
});
test('duplicate availability rows and invalid capacity fail closed', async () => {
  const f = fixture(); f.slots.push({ ...f.slots[0], id: 'duplicate' });
  await assert.rejects(f.create(), rejected);
  f.slots.pop(); f.slots[0].spots_total = -1;
  await assert.rejects(f.create(), rejected);
});
test('listing date bounds respected', async () => {
  const f = fixture(); f.listing.start_date = new Date(later);
  await assert.rejects(f.create(), rejected);
  f.listing.start_date = null; f.listing.end_date = new Date('2020-01-01');
  await assert.rejects(f.create(), rejected);
});
test('available capacity allows booking and stores derived remaining spots', async () => {
  const f = fixture(); const { created } = await f.create({ num_people: 3 });
  assert.equal(created.num_people, 3); assert.equal(created.total_price, '360.00');
  assert.equal(f.slots[0].spots_available, 0);
});
test('cancelled/rejected bookings do not consume spots; stale cache cannot override occupancy', async () => {
  const f = fixture(); f.existing('cancelled', 3); f.existing('rejected', 3); f.slots[0].spots_available = 0;
  await f.create({ num_people: 3 }); assert.equal(f.slots[0].spots_available, 0);
});
for (const status of ['pending', 'confirmed', 'completed', 'historical-unknown']) test(`${status} consumes capacity`, async () => {
  const f = fixture(); f.existing(status, 2);
  await assert.rejects(f.create({ num_people: 2 }), rejected);
  await f.create(); assert.equal(f.slots[0].spots_available, 0);
});
test('bookings for other days do not consume this day', async () => {
  const f = fixture(); f.existing('confirmed', 3, { date: new Date(later) }); await f.create({ num_people: 3 });
});
test('free tour capacity uses the same transaction and limits', async () => {
  const f = fixture({ total: 2, tags: ['free_tour'], price: null });
  const { created } = await f.create({ num_people: 2 });
  assert.equal(created.amount_cents, 0); assert.equal(created.status, 'confirmed');
  await assert.rejects(f.create(), rejected);
});
test('client capacity/availability/status payload cannot supply additional seats', async () => {
  const f = fixture({ total: 1 });
  await assert.rejects(f.create({ num_people: 2, capacity: 9999, spots_total: 9999, spots_available: 9999, availability: [{ date: tomorrow }], status: 'cancelled' }), rejected);
  assert.equal(f.rows.length, 0);
});
test('two consecutive bookings cannot exceed capacity', async () => {
  const f = fixture(); await f.create({ num_people: 2 });
  await assert.rejects(f.create({ num_people: 2 }), rejected); assert.equal(f.rows.length, 1);
});
test('two overlapping transactions competing for the last spots produce only one booking', async () => {
  const f = fixture({ total: 2 });
  const results = await Promise.allSettled([f.create({ num_people: 2 }), f.create({ num_people: 2 })]);
  assert.equal(f.transactions(), 2);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(results.filter(r => r.status === 'rejected').length, 1);
  assert.equal(f.rows.length, 1); assert.equal(f.slots[0].spots_available, 0);
});
test('cancellation releases capacity; reactivation cannot steal reallocated spots', async () => {
  const f = fixture({ total: 2 }); const { created } = await f.create({ num_people: 2 });
  await updateCapacityBooking(f.prisma, created.id, { status: 'cancelled' });
  assert.equal(f.slots[0].spots_available, 2);
  await f.create({ num_people: 2 });
  await assert.rejects(updateCapacityBooking(f.prisma, created.id, { status: 'confirmed', payment_status: 'paid' }), rejected);
  assert.equal(f.rows.find(r => r.id === created.id).status, 'cancelled');
});
test('overlapping reactivation and new booking cannot oversell', async () => {
  const f = fixture({ total: 1, price: '0' }); f.existing('cancelled', 1, { amount_cents: 0 });
  const results = await Promise.allSettled([updateCapacityBooking(f.prisma, 'existing-0', { status: 'confirmed' }), f.create()]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(f.rows.filter(r => r.status !== 'cancelled').length, 1);
});
test('payment requires a current reservation backed by capacity', async () => {
  const f = fixture(); const { created } = await f.create();
  await requireReservedCapacity(f.prisma, created.id);
  await updateCapacityBooking(f.prisma, created.id, { status: 'cancelled' });
  await assert.rejects(requireReservedCapacity(f.prisma, created.id), rejected);
});
test('capacity cache and booking roll back together on a later failure', async () => {
  const f = fixture();
  await assert.rejects(f.create({ trip_id: 'not-owned' }), rejected);
  assert.equal(f.rows.length, 0); assert.equal(f.slots[0].spots_available, 3);
});
