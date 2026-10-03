// Nest HTTP + synthetic Prisma + fake email. No .env, real DB, Stripe or external IO.
const { test, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const fs = require('node:fs');
require('reflect-metadata');
process.env.JWT_SECRET = 'synthetic-date-request-secret';
process.env.ENABLE_TOUR_DATE_REQUESTS = 'true';
process.env.ADMIN_EMAILS = '';
process.env.ADMIN_USER_IDS = '';
for (const name of ['DATABASE_URL','DATABASE_URL_REMOTE','DATABASE_URL_LOCAL','RESEND_API_KEY','SENDGRID_API_KEY','STRIPE_SECRET','STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET']) delete process.env[name];
const { Module: NestModule } = require('@nestjs/common');
const { NestFactory } = require('@nestjs/core');
const jwt = require('jsonwebtoken');
const security = require('@wadatrip/common/security');
const tomorrow = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
const later = new Date(Date.now() + 8 * 86400000).toISOString().slice(0, 10);
const actor = id => ({ id, email: `${id}@example.invalid`, name: 'Synthetic User', verified: true, role: id === 'admin' ? 'admin' : 'traveler', admin: id === 'admin' });
let requests, notifications, listing, provider, used, capacity, writes;
const select = row => row && ({ id: row.id, listing_id: row.listing_id, requested_date: row.requested_date, num_people: row.num_people,
  status: row.status, response_date: row.response_date, responded_at: row.responded_at, created_at: row.created_at, listing: { title: listing.title } });
function matches(row, query = {}) {
  return Object.entries(query).every(([key, value]) => {
    if (key === 'OR') return value.some(condition => matches(row, condition));
    if (key === 'listing') return !value.provider || provider.user_id === value.provider.user_id;
    if (key === 'traveler_listing_date_request') return Object.entries(value).every(([k, v]) => String(row[k]) === String(v));
    if (value && typeof value === 'object' && !(value instanceof Date)) return Object.entries(value).every(([op, v]) => op === 'lt' ? row[key] < v : op === 'lte' ? row[key] <= v : op === 'gte' ? row[key] >= v : false);
    return value instanceof Date ? +row[key] === +value : row[key] === value;
  });
}
const prisma = {
  users: { findUnique: async ({ where }) => ['traveler','other','owner','intruder','admin'].includes(where.id) ? { ...actor(where.id), status: 'active' } : null },
  listings: { findUnique: async ({ where }) => where.id === listing.id ? listing : null },
  providers: { findUnique: async () => provider },
  bookings: { aggregate: async () => ({ _sum: { num_people: used }, _min: { num_people: used ? 1 : null } }), create: async () => { writes++; throw Error('Booking forbidden'); } },
  listing_availability: { update: async () => { writes++; throw Error('Inventory write forbidden'); } },
  $queryRaw: async (parts, ...values) => parts.join('?').includes('FROM users') ? [{ id: values[0] }]
    : parts.join('?').includes('FROM listings') ? (values[0] === listing.id ? [{ id: listing.id }] : [])
    : parts.join('?').includes('listing_availability') ? (capacity === null ? [] : [{ id: 'synthetic-slot', spots_total: capacity }]) : [],
  tour_date_requests: {
    count: async ({ where }) => requests.filter(row => matches(row, where)).length,
    findUnique: async ({ where, select: fields, include }) => {
      const row = requests.find(row => matches(row, where));
      if (!row) return null;
      if (include) return { ...row, user: { ...actor(row.user_id), status: 'active' }, listing: { ...listing, provider: { ...provider, owner: provider.user_id ? { ...actor(provider.user_id), status: 'active' } : null } } };
      return fields ? select(row) : row;
    },
    findMany: async ({ where }) => requests.filter(row => matches(row, where)).map(select),
    create: async ({ data }) => {
      const row = { id: `synthetic-request-${requests.length}`, status: 'requested', response_date: null, responded_at: null, created_at: new Date(), ...data };
      requests.push(row); addNotification(row.id, data.notifications.create.audience); return select(row);
    },
    update: async ({ where, data }) => {
      const row = requests.find(row => row.id === where.id);
      if (data.notifications) addNotification(row.id, data.notifications.create.audience);
      Object.assign(row, data); return select(row);
    },
  },
  tour_request_notifications: {
    findMany: async ({ where }) => notifications.filter(row => matches(row, where)).map(row => ({ ...row })),
    updateMany: async ({ where, data }) => {
      const rows = notifications.filter(row => matches(row, where));
      rows.forEach(row => Object.entries(data).forEach(([key, value]) => row[key] = value?.increment ? row[key] + value.increment : value));
      return { count: rows.length };
    },
  },
};
let transactionTail = Promise.resolve();
prisma.$transaction = async fn => {
  const previous = transactionTail; let release;
  transactionTail = new Promise(resolve => { release = resolve; }); await previous;
  try { return await fn(prisma); } finally { release(); }
};
function addNotification(id, audience) {
  notifications.push({ id: `synthetic-notification-${notifications.length}`, request_id: id, audience, status: 'pending', attempts: 0,
    next_attempt_at: new Date(0), lease_until: null, claim_id: null, created_at: new Date(), last_error: null });
}
const originalLoad = Module._load;
Module._load = function(name, ...args) {
  if (name === '@wadatrip/db') return { getPrisma: () => prisma };
  if (name === 'stripe' || name === '@prisma/client') throw Error('External payment/DB client forbidden');
  return originalLoad.call(this, name, ...args);
};
const domain = require('../apps/gateway/dist/apps/gateway/src/services/tour-date-request.service.js');
const { sendRequestNotifications } = require('../apps/gateway/dist/apps/gateway/src/services/tour-request-notifications.service.js');
const { TourDateRequestsController } = require('../apps/gateway/dist/apps/gateway/src/controllers/tour-date-requests.controller.js');
let app, origin;
before(async () => {
  class TestModule {}
  NestModule({ controllers: [TourDateRequestsController] })(TestModule);
  app = await NestFactory.create(TestModule, { logger: false }); await app.listen(0, '127.0.0.1'); origin = await app.getUrl();
});
beforeEach(() => {
  process.env.ENABLE_TOUR_DATE_REQUESTS = 'true'; delete process.env.TOUR_REQUESTS_EMAIL;
  requests = []; notifications = []; writes = 0; used = 0; capacity = 20;
  provider = { id: 'synthetic-provider', user_id: 'owner' };
  listing = { id: 'synthetic-listing', provider_id: provider.id, title: 'Synthetic Walk', status: 'published', price_from: 120, currency: 'USD', tags: [] };
});
after(async () => { await app?.close(); Module._load = originalLoad; });
const create = (id = 'traveler', extras = {}) => domain.createDateRequest(prisma, actor(id), { listing_id: listing.id, date: tomorrow, num_people: 2, ...extras });
async function http(path = '', id, body, method = 'GET', verified = true) {
  const token = id && jwt.sign({ sub: id, email: actor(id).email, email_verified: verified }, process.env.JWT_SECRET, { expiresIn: '5m' });
  const response = await fetch(`${origin}/tour-date-requests${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, data: await response.json() };
}
test('anonymous cannot create or read requests over real local HTTP', async () => {
  assert.equal((await http()).status, 401);
  assert.equal((await http('', null, { listing_id: listing.id, date: tomorrow, num_people: 2 }, 'POST')).status, 401);
  assert.equal(requests.length, 0);
});
test('request identity derives exclusively from JWT; response projection has no private identity', async () => {
  const response = await http('', 'traveler', { listing_id: listing.id, date: tomorrow, num_people: 2, user_id: 'admin', email: 'fake@example.invalid', role: 'admin', provider_id: 'intruder', capacity: 9999, price: 1 }, 'POST');
  assert.equal(response.status, 201); assert.equal(requests[0].user_id, 'traveler'); assert.equal(writes, 0);
  for (const key of ['email','user_id','phone','password_hash','token','capacity','price']) assert.equal(Object.hasOwn(response.data, key), false);
});
test('verified email is required for a contact request', async () => {
  assert.equal((await http('', 'traveler', { listing_id: listing.id, date: tomorrow, num_people: 2 }, 'POST', false)).status, 403);
});
test('traveler only sees own requests, provider only owns listings, admin has authorized inbox', async () => {
  await create();
  assert.equal((await http('', 'other')).data.items.length, 0);
  assert.equal((await http('?scope=operator', 'intruder')).data.items.length, 0);
  assert.equal((await http('?scope=operator', 'owner')).data.items.length, 1);
  assert.equal((await http('?scope=operator', 'admin')).data.items.length, 1);
});
for (const count of [0,-1,1.2,101,'2',null]) test(`invalid inquiry traveler count ${count} is rejected`, async () => {
  await assert.rejects(create('traveler', { num_people: count })); assert.equal(requests.length, 0);
});
for (const date of ['2000-01-01','2026-02-30','invalid']) test(`invalid/past request date ${date} is rejected`, async () => { await assert.rejects(create('traveler', { date })); });
test('missing and unpublished listings are rejected', async () => {
  await assert.rejects(create('traveler', { listing_id: 'missing' })); listing.status = 'pending'; await assert.rejects(create());
});
test('zero availability permits an inquiry but no booking, payment or inventory writes', async () => {
  capacity = null; await create(); assert.equal(requests.length, 1); assert.equal(notifications.length, 1); assert.equal(writes, 0);
});
test('concurrent duplicate requests produce one logical request and one alert (fixture transaction)', async () => {
  const [a,b] = await Promise.all([create(), create()]); assert.equal(a.id,b.id); assert.equal(requests.length,1); assert.equal(notifications.length,1);
  await assert.rejects(create('traveler', { num_people: 3 }));
});
test('20 pending inquiries bound abuse without treating the limit as tour capacity', async () => {
  for (let day = 1; day <= 20; day++) await create('traveler', { date: new Date(Date.now() + day * 86400000).toISOString().slice(0,10) });
  await assert.rejects(create('traveler', { date: new Date(Date.now() + 21 * 86400000).toISOString().slice(0,10) }));
});
test('operator cannot respond to another providers request', async () => {
  const request = await create(); await assert.rejects(domain.respondToDateRequest(prisma, actor('intruder'), request.id, { status:'declined' }));
  assert.equal((await http(`/${request.id}/respond`, 'intruder', { status:'declined' }, 'POST')).status,404);
});
test('available response requires a real slot, enough spots and valid canonical price', async () => {
  const request = await create(); const respond = () => domain.respondToDateRequest(prisma, actor('owner'), request.id, { status:'available', date:later });
  capacity = null; await assert.rejects(respond()); capacity = 1; await assert.rejects(respond());
  capacity = 20; listing.price_from = -1; await assert.rejects(respond());
  assert.equal(requests[0].status,'requested'); assert.equal(notifications.length,1);
});
test('operator offers a different real departure without reserving spots and retry is idempotent', async () => {
  const request = await create(); const payload = { status:'available',date:later };
  const result = await domain.respondToDateRequest(prisma,actor('owner'),request.id,payload);
  await domain.respondToDateRequest(prisma,actor('owner'),request.id,payload);
  assert.equal(result.status,'available'); assert.equal(result.response_date.toISOString().slice(0,10),later);
  assert.equal(notifications.length,2); assert.equal(writes,0);
  await assert.rejects(domain.respondToDateRequest(prisma,actor('owner'),request.id,{status:'declined'}));
});
test('a free tour inquiry and offer still validate real capacity', async () => {
  listing.price_from = 0; const request = await create();
  await domain.respondToDateRequest(prisma,actor('owner'),request.id,{status:'available',date:later}); assert.equal(writes,0);
});
test('an offer cannot bypass a closed booking deadline or unpublished listing', async () => {
  const request = await create();
  listing.departure_time='09:30'; listing.timezone='America/Lima'; listing.booking_cutoff_hours=8760;
  await assert.rejects(domain.respondToDateRequest(prisma,actor('owner'),request.id,{status:'available',date:later}),/Reservations are closed/);
  listing.status='pending'; await assert.rejects(domain.respondToDateRequest(prisma,actor('owner'),request.id,{status:'available',date:later}));
  assert.equal(notifications.length,1);
});
test('declined response notifies traveler without a false booking confirmation', async () => {
  const request=await create(); await domain.respondToDateRequest(prisma,actor('owner'),request.id,{status:'declined'});
  const sent=[];await sendRequestNotifications(prisma,async opts=>{sent.push(opts);return {sent:true};});
  assert.equal(sent.length,1);assert.equal(sent[0].to,actor('traveler').email);assert.match(sent[0].text,/cannot offer/);assert.match(sent[0].text,/No booking was created/);
});
test('only requesting traveler can close an inquiry; no booking cancellation occurs', async () => {
  const request = await create(); await assert.rejects(domain.cancelDateRequest(prisma,actor('other'),request.id));
  await domain.cancelDateRequest(prisma,actor('traveler'),request.id);
  await assert.rejects(domain.respondToDateRequest(prisma,actor('owner'),request.id,{status:'available',date:later})); assert.equal(writes,0);
});
test('closure is idempotent and cannot rewrite a declined terminal response', async () => {
  const request=await create();await domain.cancelDateRequest(prisma,actor('traveler'),request.id);await domain.cancelDateRequest(prisma,actor('traveler'),request.id);
  const other=await create('other');await domain.respondToDateRequest(prisma,actor('owner'),other.id,{status:'declined'});
  await assert.rejects(domain.cancelDateRequest(prisma,actor('other'),other.id),/already closed/);
});
test('disabled rollout is safe and reports disabled without reading new tables', async () => {
  process.env.ENABLE_TOUR_DATE_REQUESTS = 'false'; assert.equal((await http('/status')).data.enabled,false); assert.equal((await http('', 'traveler')).status,503);
});
test('email uses linked owner, no traveler PII, and successful alert is not sent twice', async () => {
  await create(); const sent = [];
  const send = async opts => { sent.push(opts); return { sent:true }; };
  await sendRequestNotifications(prisma,send); await sendRequestNotifications(prisma,send);
  assert.equal(sent.length,1); assert.equal(sent[0].to,actor('owner').email);
  assert.ok(!sent[0].text.includes(actor('traveler').email)); assert.match(sent[0].text,/not a booking/);
  assert.match(sent[0].idempotencyKey,/tour-request-synthetic/);
});
test('failed email preserves inquiry and can retry successfully', async () => {
  await create(); await sendRequestNotifications(prisma,async () => ({ sent:false, reason:'email_failed' }));
  assert.equal(requests[0].status,'requested'); assert.equal(notifications[0].status,'pending'); assert.equal(notifications[0].attempts,1);
  notifications[0].next_attempt_at = new Date(0); await sendRequestNotifications(prisma,async () => ({ sent:true })); assert.equal(notifications[0].status,'sent');
});
test('unlinked operator is a durable team inquiry, never emailed to an unverified provider address', async () => {
  provider.user_id = null; provider.email = 'unlinked@example.invalid'; await create(); let sent = 0;
  await sendRequestNotifications(prisma,async () => { sent++; return {sent:true}; }); assert.equal(sent,0); assert.equal(notifications[0].last_error,'recipient_not_configured');
  process.env.TOUR_REQUESTS_EMAIL = 'team@example.invalid'; notifications[0].next_attempt_at = new Date(0);
  await sendRequestNotifications(prisma,async opts => { assert.equal(opts.to,'team@example.invalid'); return {sent:true}; });
});
test('cancelled request skips stale email; crashes on fifth attempt become investigateable failed alerts', async () => {
  const request = await create(); await domain.cancelDateRequest(prisma,actor('traveler'),request.id);
  await sendRequestNotifications(prisma,async () => { throw Error('Stale email should not send'); }); assert.equal(notifications[0].status,'skipped');
  notifications[0].status='pending'; notifications[0].attempts=5; notifications[0].lease_until=new Date(0);
  await sendRequestNotifications(prisma); assert.equal(notifications[0].status,'failed'); assert.equal(notifications[0].last_error,'attempts_exhausted');
});
test('migration adds only isolated request tables with foreign keys and deduplication', () => {
  const sql=fs.readFileSync('libs/db/prisma/migrations/20261002000000_tour_date_requests/migration.sql','utf8').replace(/--[^\n]*/g,'');
  assert.doesNotMatch(sql,/^\s*(UPDATE|DELETE|DROP|TRUNCATE|ALTER)\b/m); assert.match(sql,/CREATE UNIQUE INDEX/); assert.match(sql,/REFERENCES "users"/);
  assert.equal(Object.keys(domain.requestSelect).some(key => /email|phone|token|payment/.test(key)),false);
});
