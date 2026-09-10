// Run after building common, gateway and Provider Hub:
// node --test --test-isolation=none scripts/security-p0.test.cjs
// Real Nest HTTP routes, synthetic Prisma data, no external services or .env loading.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const ModuleLoader = require('node:module');
require('reflect-metadata');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'p0-only-synthetic-secret-not-for-production';
process.env.INTERNAL_SERVICE_TOKEN = 'p0-only-synthetic-internal-token';
process.env.ADMIN_EMAILS = 'allowed-admin@example.test';
process.env.ADMIN_USER_IDS = '';
process.env.FF_PROVIDER_HUB = 'false';
process.env.FF_ALERTS = 'false';
for (const key of ['DATABASE_URL', 'DATABASE_URL_LOCAL', 'DATABASE_URL_REMOTE', 'STRIPE_SECRET',
  'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'SENDGRID_API_KEY', 'REDIS_URL', 'REDIS_HOST', 'REDIS_PORT']) delete process.env[key];

const jwt = require('jsonwebtoken');
const axios = require('axios');
axios.defaults.proxy = false;
const axiosGuard = axios.interceptors.request.use(config => {
  assert.equal(new URL(config.url).hostname, '127.0.0.1', 'Axios must remain local in these tests');
  return config;
});
const { Module } = require('@nestjs/common');
const { NestFactory, APP_GUARD } = require('@nestjs/core');
const common = require('@wadatrip/common/security');
const publicData = require('@wadatrip/common/public-data');
const rawFetch = global.fetch;
global.fetch = (url, init) => {
  const host = new URL(url).hostname;
  assert.equal(host, '127.0.0.1', 'These tests must never contact an external service');
  return rawFetch(url, init);
};

const privateFields = {
  email: 'private@example.test', phone: 'PRIVATE-PHONE', password_hash: 'PRIVATE-HASH',
  firebase_uid: 'PRIVATE-FIREBASE', stripe_account_id: 'PRIVATE-ACCOUNT',
  payment_intent_id: 'PRIVATE-PAYMENT', checkout_session_id: 'PRIVATE-CHECKOUT',
  verification_notes: 'PRIVATE-NOTES', extracted_id_number: 'PRIVATE-ID',
  verification_status: 'PRIVATE-VERIFICATION', secret: 'PRIVATE-SECRET', token: 'PRIVATE-TOKEN',
};
const rows = {
  users: [
    ...['a', 'b', 'owner-a', 'owner-b', 'admin', 'disabled', 'allowlisted'].map(id => ({
      ...privateFields, id, name: id, email: id === 'allowlisted' ? 'allowed-admin@example.test' : `${id}@example.test`,
      status: id === 'disabled' ? 'inactive' : 'active', role: id === 'admin' ? 'admin' : 'traveler',
    })),
  ],
  providers: ['a', 'b'].map(id => ({
    ...privateFields, id: `provider-${id}`, user_id: `owner-${id}`, type: 'guide', name: `Guide ${id}`,
    status: 'verified', verified_level: 'community', languages: ['en'], base_city: 'Test City',
    country_code: 'US', ratings_avg: 4, ratings_count: 2, photo_url: null, instagram_handle: null,
    bio_short: 'Public bio', created_at: '2026-01-01T00:00:00.000Z',
    documents: [{ id: 'doc', url: 'https://example.test/private', doc_type: 'identity', status: 'pending' }],
  })),
  listings: ['a', 'b', 'draft-a', 'draft-b'].map(id => ({
    ...privateFields, id: `listing-${id}`, provider_id: `provider-${id.endsWith('a') ? 'a' : 'b'}`,
    operator_id: `owner-${id.endsWith('a') ? 'a' : 'b'}`, title: `Tour ${id}`, description: 'Public description',
    category: 'tour', city: 'Test City', country_code: 'US', price_from: '25', currency: 'USD',
    status: id.startsWith('draft') ? 'draft' : 'published', tags: [], created_at: '2026-01-01T00:00:00.000Z',
  })),
  bookings: ['a', 'b'].map(id => ({
    id: `booking-${id}`, user_id: id, provider_id: `provider-${id}`, listing_id: `listing-${id}`,
    status: 'pending', payment_status: 'unpaid', date: '2026-12-01', num_people: 1, total_price: '25',
    amount_cents: 2500, payment_intent_id: null, checkout_session_id: null,
  })),
};
const mutations = [];
const relationModels = {
  bookings: { provider: 'providers', user: 'users', listing: 'listings' },
  listings: { provider: 'providers' }, providers: { listings: 'listings', documents: 'documents' },
};
function related(model, row, field) {
  if (model === 'providers' && field === 'listings') return rows.listings.filter(r => r.provider_id === row.id);
  if (field === 'documents') return row.documents;
  const target = relationModels[model]?.[field];
  if (target) return rows[target].find(r => r.id === row[`${field}_id`]);
  return row[field];
}
function matches(model, row, where = {}) {
  return Object.entries(where).every(([key, value]) => {
    if (key === 'OR') return value.some(branch => matches(model, row, branch));
    if (key === 'AND') return value.every(branch => matches(model, row, branch));
    const actual = related(model, row, key);
    if (value && typeof value === 'object') {
      if ('in' in value) return value.in.includes(actual);
      if ('contains' in value) return String(actual).toLowerCase().includes(value.contains.toLowerCase());
      return !!actual && matches(relationModels[model]?.[key], actual, value);
    }
    return actual === value;
  });
}
function project(model, row, args = {}) {
  if (!row) return null;
  const result = args.select ? {} : { ...row };
  for (const [field, selection] of Object.entries(args.select || args.include || {})) {
    let value = related(model, row, field);
    if (selection && typeof selection === 'object') {
      const target = relationModels[model]?.[field];
      value = Array.isArray(value)
        ? value.filter(r => matches(target, r, selection.where)).map(r => project(target, r, selection))
        : project(target, value, selection);
    }
    if (selection) result[field] = value;
  }
  return result;
}
const prisma = Object.fromEntries(Object.keys(rows).map(model => [model, {
  findUnique: async args => project(model, rows[model].find(r => matches(model, r, args.where)), args),
  findFirst: async args => project(model, rows[model].find(r => matches(model, r, args.where)), args),
  findMany: async args => rows[model].filter(r => matches(model, r, args.where))
    .slice(args.skip || 0, (args.skip || 0) + (args.take || rows[model].length)).map(r => project(model, r, args)),
  count: async args => rows[model].filter(r => matches(model, r, args.where)).length,
  update: async args => {
    mutations.push({ model, ...args });
    const row = rows[model].find(r => matches(model, r, args.where));
    assert.ok(row, 'Update must address an existing fixture');
    return project(model, { ...row, ...args.data }, args);
  },
  updateMany: async args => {
    mutations.push({ model, ...args });
    return { count: rows[model].filter(r => matches(model, r, args.where)).length };
  },
  create: async args => { mutations.push({ model, ...args }); return { id: 'created-fixture', ...args.data }; },
  delete: async args => { mutations.push({ model, ...args }); return {}; },
}]));
// Replace only DB access. Business logic, JWT verification, guards and Nest routing are real.
const originalLoad = ModuleLoader._load;
ModuleLoader._load = function(request, parent, main) {
  if (request === '@wadatrip/db') return { getPrisma: () => prisma };
  if (request === '@prisma/client') throw new Error('Real Prisma must never load in security HTTP tests');
  return originalLoad.call(this, request, parent, main);
};
const fromBuild = (service, file) => require(path.resolve(service, 'dist', service, 'src', file));
const gatewayBookings = fromBuild('apps/gateway', 'controllers/bookings.controller.js').BookingsController;
const gatewayProviders = fromBuild('apps/gateway', 'controllers/providers.controller.js').ProvidersController;
const gatewayPayments = fromBuild('apps/gateway', 'controllers/payments.controller.js').PaymentsController;
const gatewayWebhook = fromBuild('apps/gateway', 'controllers/webhooks.controller.js').WebhooksController;
const hubBookings = fromBuild('services/provider-hub', 'controllers/bookings.controller.js').BookingsController;
const hubProviders = fromBuild('services/provider-hub', 'controllers/providers.controller.js').ProvidersController;
const hubListings = fromBuild('services/provider-hub', 'controllers/listings.controller.js').ListingsController;
const hubAdmin = fromBuild('services/provider-hub', 'controllers/admin.providers.controller.js').AdminProvidersController;
const hubHealth = fromBuild('services/provider-hub', 'controllers/health.controller.js').HealthController;
const { InternalServiceGuard, ProviderUploadGuard } = fromBuild('services/provider-hub', 'security.guard.js');
const { IdentityVerificationService } = fromBuild('services/provider-hub', 'services/identity-verification.service.js');
const { IdentityVerificationQueueService } = fromBuild('services/provider-hub', 'services/identity-verification-queue.service.js');
const apps = [];
let gateway, hub, proxiedGateway, createAdminSession;
before(async () => {
  for (const isHub of [false, true]) {
    class TestModule {}
    Module({
      controllers: isHub ? [hubBookings, hubProviders, hubListings, hubAdmin, hubHealth]
        : [gatewayBookings, gatewayProviders, gatewayPayments, gatewayWebhook],
      providers: isHub ? [
        { provide: APP_GUARD, useClass: InternalServiceGuard }, ProviderUploadGuard,
        { provide: IdentityVerificationService, useValue: {} },
        { provide: IdentityVerificationQueueService, useValue: {} },
      ] : [],
    })(TestModule);
    const app = await NestFactory.create(TestModule, { logger: false, abortOnError: false });
    await app.listen(0, '127.0.0.1');
    apps.push(app);
    const url = `http://127.0.0.1:${app.getHttpServer().address().port}`;
    if (isHub) hub = url; else gateway = url;
  }
  process.env.FF_PROVIDER_HUB = 'true';
  process.env.PROVIDER_HUB_URL = hub;
  const proxied = ['bookings', 'providers'].map(name => {
    const file = path.resolve(`apps/gateway/dist/apps/gateway/src/controllers/${name}.controller.js`);
    delete require.cache[file];
    const controller = require(file);
    return controller[name === 'bookings' ? 'BookingsController' : 'ProvidersController'];
  });
  class ProxyTestModule {}
  Module({ controllers: proxied })(ProxyTestModule);
  const proxy = await NestFactory.create(ProxyTestModule, { logger: false, abortOnError: false });
  await proxy.listen(0, '127.0.0.1');
  apps.push(proxy);
  proxiedGateway = `http://127.0.0.1:${proxy.getHttpServer().address().port}`;
  process.env.FF_PROVIDER_HUB = 'false';
  ({ createAdminSession } = await import(pathToFileURL(path.resolve('apps/web/src/admin/session.js'))));
});
after(async () => {
  await Promise.all(apps.map(app => app.close()));
  ModuleLoader._load = originalLoad;
  global.fetch = rawFetch;
  axios.interceptors.request.eject(axiosGuard);
});
function token(id, overrides = {}, options = {}) {
  const user = rows.users.find(u => u.id === id);
  return jwt.sign({ sub: id, email: user?.email, email_verified: true, ...overrides }, process.env.JWT_SECRET,
    { expiresIn: '10m', ...options });
}
async function http(base, route, user, { method = 'GET', body, internal = true, bearer } = {}) {
  const headers = {};
  if (user || bearer) headers.Authorization = `Bearer ${bearer || token(user)}`;
  if (base === hub && internal) headers['x-internal-service-token'] = process.env.INTERNAL_SERVICE_TOKEN;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(base + route, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: response.status, body: await response.json() };
}
function assertPublic(record) {
  if (!record || typeof record !== 'object') return;
  for (const [key, value] of Object.entries(record)) {
    assert.ok(!Object.hasOwn(privateFields, key), `Private field in public response: ${key}`);
    assert.ok(!/PRIVATE-|private@example/.test(String(value)), `Private fixture value in ${key}`);
    if (value && typeof value === 'object') assertPublic(value);
  }
}

for (const service of ['gateway', 'hub', 'gateway -> Hub']) {
  test(`${service}: HTTP authorization and public projections`, async t => {
    const base = service === 'gateway' ? gateway : service === 'hub' ? hub : proxiedGateway;
    await t.test('anonymous cannot list or read bookings', async () => {
      for (const route of ['/bookings', '/bookings/booking-b']) assert.equal((await http(base, route)).status, 401);
    });
    await t.test('user A cannot read or modify booking B', async () => {
      assert.equal((await http(base, '/bookings/booking-b', 'a')).status, 404);
      const before = mutations.length;
      assert.equal((await http(base, '/bookings/booking-b/status', 'a', { method: 'POST', body: { status: 'cancelled' } })).status, 404);
      assert.equal(mutations.length, before);
    });
    await t.test('query user_id/email/role cannot change booking scope', async () => {
      const res = await http(base, '/bookings?user_id=b&user_email=b@example.test&role=admin', 'a');
      assert.equal(res.status, 200);
      assert.deepEqual(res.body.items.map(b => b.id), ['booking-a']);
      assert.equal(res.body.total, 1);
    });
    await t.test('traveler reads own booking; provider reads/manages only its bookings', async () => {
      assert.equal((await http(base, '/bookings/booking-a', 'a')).status, 200);
      assert.equal((await http(base, '/bookings/booking-a', 'owner-a')).status, 200);
      assert.equal((await http(base, '/bookings/booking-b', 'owner-a')).status, 404);
      const res = await http(base, '/bookings?provider_id=provider-b', 'owner-a');
      assert.deepEqual(res.body.items, []);
      assert.equal((await http(base, '/bookings/booking-b/status', 'owner-a', { method: 'POST', body: { status: 'cancelled' } })).status, 404);
      assert.equal((await http(base, '/bookings/booking-a/status', 'owner-a', { method: 'POST', body: { status: 'cancelled' } })).status, 201);
    });
    await t.test('booking creation ignores client-selected identity', async () => {
      const res = await http(base, '/bookings', 'a', { method: 'POST', body: {
        listing_id: 'listing-a', date: '2026-12-01', num_people: 1, user_id: 'b', user_email: 'b@example.test',
      } });
      assert.equal(res.status, 201);
      assert.equal(res.body.user_id, 'a');
    });
    await t.test('legitimate admin can read all bookings and manage another provider', async () => {
      const res = await http(base, '/bookings', 'admin');
      assert.equal(res.status, 200);
      assert.equal(res.body.items.length, 2);
      assert.equal((await http(base, '/providers', 'admin')).status, 200);
      const detail = await http(base, '/admin/providers/provider-b', 'admin');
      assert.equal(detail.status, 200);
      assert.equal(detail.body.email, 'private@example.test');
      assert.ok(!Object.hasOwn(detail.body, 'password_hash'));
      assert.equal((await http(base, '/providers/provider-b/verify', 'admin', { method: 'POST', body: { status: 'verified' } })).status, 201);
    });
    await t.test('non-admin cannot enumerate providers, access admin detail or approve', async () => {
      assert.equal((await http(base, '/providers')).status, 401);
      assert.equal((await http(base, '/providers', 'a')).status, 403);
      assert.equal((await http(base, '/admin/providers/provider-b', 'owner-a')).status, 403);
      assert.equal((await http(base, '/providers/provider-b/verify', 'owner-a', { method: 'POST', body: { status: 'verified' } })).status, 403);
    });
    await t.test('public provider and listings contain only allowlisted data', async () => {
      const provider = await http(base, '/providers/provider-a');
      assert.equal(provider.status, 200);
      assertPublic(provider.body);
      assert.ok(Object.keys(provider.body).every(k => Object.hasOwn(publicData.publicProviderDetailSelect, k)));
      assert.deepEqual(provider.body.listings.map(l => l.id), ['listing-a']);
      for (const route of ['/listings', '/listings/search', '/listings/listing-a']) {
        const res = await http(base, route);
        assert.equal(res.status, 200);
        assertPublic(res.body);
        if (res.body.items) assert.equal(res.body.items.length, 2);
        const listing = res.body.items?.[0] || res.body;
        assert.ok(!Object.hasOwn(listing, 'operator_id'));
        assert.ok(!Object.hasOwn(listing, 'provider_phone'));
      }
    });
    await t.test('drafts and provider verification details require the matching owner/admin', async () => {
      assert.equal((await http(base, '/listings/listing-draft-b')).status, 401);
      assert.equal((await http(base, '/listings/listing-draft-b', 'owner-a')).status, 404);
      assert.equal((await http(base, '/listings/listing-draft-b', 'owner-b')).status, 200);
      assert.equal((await http(base, '/listings/search?all=true&provider_id=provider-b', 'owner-a')).status, 404);
      const own = await http(base, '/listings/search?all=true&provider_id=provider-a', 'owner-a');
      assert.equal(own.status, 200);
      assert.deepEqual(own.body.items.map(l => l.id), ['listing-a', 'listing-draft-a']);
      assert.equal((await http(base, '/providers/provider-b/verification-status', 'owner-a')).status, 404);
      assert.equal((await http(base, '/providers/provider-a/verification-status', 'owner-a')).status, 200);
    });
    await t.test('disabled/expired/forged JWTs cannot access bookings; token role cannot grant admin', async () => {
      assert.equal((await http(base, '/bookings', 'disabled')).status, 401);
      assert.equal((await http(base, '/bookings', null, { bearer: token('a', {}, { expiresIn: -1 }) })).status, 401);
      assert.equal((await http(base, '/bookings', null, { bearer: jwt.sign({ sub: 'a' }, 'wrong-key') })).status, 401);
      assert.equal((await http(base, '/providers', null, { bearer: token('a', { role: 'admin' }) })).status, 403);
      assert.equal((await http(base, '/providers', 'allowlisted')).status, 200);
      assert.equal((await http(base, '/providers', null, { bearer: token('allowlisted', { email_verified: false }) })).status, 403);
    });
    await t.test('payment status cannot be written through provider/admin status endpoint', async () => {
      const before = mutations.length;
      const res = await http(base, '/bookings/booking-a/status', 'admin', { method: 'POST', body: { payment_status: 'paid' } });
      assert.equal(res.status, 400);
      assert.equal(mutations.length, before);
    });
  });
}

test('Hub internal guard protects direct access and runs before uploads; health remains public', async () => {
  assert.equal((await http(hub, '/providers/provider-a', null, { internal: false })).status, 403);
  assert.equal((await http(hub, '/bookings', 'admin', { internal: false })).status, 403);
  assert.equal((await http(hub, '/health', null, { internal: false })).status, 200);
  const body = new FormData();
  body.append('id_document', new Blob(['synthetic']), 'test.txt');
  const response = await fetch(hub + '/providers/provider-b/verify-identity', { method: 'POST', body,
    headers: { Authorization: `Bearer ${token('owner-a')}`, 'x-internal-service-token': process.env.INTERNAL_SERVICE_TOKEN } });
  assert.equal(response.status, 404);
});
test('gateway admin edits do not take ownership; another provider cannot edit or delete', async () => {
  const before = mutations.length;
  assert.equal((await http(gateway, '/listings/listing-b', 'owner-a', { method: 'PATCH', body: { title: 'Changed' } })).status, 404);
  assert.equal((await http(gateway, '/listings/listing-b', 'owner-a', { method: 'DELETE' })).status, 404);
  assert.equal(mutations.length, before);
  assert.equal((await http(gateway, '/listings/listing-b', 'admin', { method: 'PATCH', body: { title: 'Changed' } })).status, 200);
  assert.ok(!Object.hasOwn(mutations.at(-1).data, 'operator_id'));
});
test('gateway payment routes reject unrelated actors before any Stripe call', async () => {
  for (const [route, body] of [
    ['/payments/bookings/booking-b/checkout', {}],
    ['/payments/create-intent', { booking_id: 'booking-b', amount: 50 }],
    ['/payments/connect/provider-b/link', {}],
  ]) assert.equal((await http(gateway, route, 'owner-a', { method: 'POST', body })).status, 404);
});
test('webhook requires a signature even with a well-formed forged payment payload', async () => {
  const before = mutations.length;
  const body = { type: 'payment_intent.succeeded', data: { object: { metadata: { booking_id: 'booking-a' } } } };
  assert.equal((await http(gateway, '/webhooks/stripe', null, { method: 'POST', body })).status, 401);
  process.env.STRIPE_WEBHOOK_SECRET = 'synthetic-webhook-secret';
  assert.equal((await http(gateway, '/webhooks/stripe', null, { method: 'POST', body })).status, 401);
  delete process.env.STRIPE_WEBHOOK_SECRET;
  assert.equal(mutations.length, before);
});
test('central ownership never claims an already-owned provider by email', async () => {
  const before = mutations.length;
  const actor = { id: 'a', email: 'private@example.test', verified: true, admin: false };
  assert.equal(await common.findOwnedProvider(prisma, actor), null);
  assert.equal(mutations.length, before);
  assert.throws(() => common.requireInternalToken({ headers: {} }), /internal service/);
  assert.equal(common.getClaimsFromAuth({ headers: { authorization: `Bearer ${jwt.sign({ sub: 'a' }, process.env.JWT_SECRET)}` } }), null);
});
test('remote public projections drop private fields and unpublished nested listings', () => {
  const provider = publicData.toPublicProvider({ ...rows.providers[0], listings: rows.listings });
  assertPublic(provider);
  assert.ok(provider.listings.every(l => l.status === 'published'));
  const listing = publicData.toPublicListing({ ...rows.listings[0], provider: rows.providers[0] });
  assertPublic(listing);
});

test('admin cache handles user change, expiry, logout and concurrent exchanges', async t => {
  function fixture() {
    let time = Date.now(), calls = 0;
    const user = id => ({ uid: id, getIdToken: async () => id });
    const auth = { currentUser: user('a') };
    const session = createAdminSession({ getAuth: async () => auth, now: () => time,
      exchange: async id => { calls++; return jwt.sign({ sub: id, exp: Math.floor(time / 1000) + 120 }, 'synthetic'); } });
    return { session, auth, user, calls: () => calls, advance: ms => { time += ms; } };
  }
  await t.test('single exchange for concurrent requests and cache reuse', async () => {
    const f = fixture();
    const tokens = await Promise.all([f.session.token(), f.session.token(), f.session.token()]);
    assert.equal(new Set(tokens).size, 1);
    assert.equal(f.calls(), 1);
    assert.equal(await f.session.token(), tokens[0]);
    assert.equal(f.calls(), 1);
  });
  await t.test('user B never receives user A token, including immediately before HTTP send', async () => {
    const f = fixture(); const old = await f.session.token();
    f.auth.currentUser = f.user('b');
    await assert.rejects(f.session.assertCurrent(old), /session changed/);
    assert.equal(jwt.decode(await f.session.token()).sub, 'b');
    assert.equal(f.calls(), 2);
  });
  await t.test('expiry renews; logout clears; missing identity fails closed', async () => {
    const f = fixture(); await f.session.token(); f.advance(100000);
    await f.session.token(); assert.equal(f.calls(), 2);
    f.session.clear(); await f.session.token(); assert.equal(f.calls(), 3);
    f.auth.currentUser = null;
    await assert.rejects(f.session.token(), /sign-in is required/);
  });
  await t.test('logout during token exchange cannot repopulate the cache', async () => {
    let release, entered;
    const started = new Promise(resolve => { entered = resolve; });
    const auth = { currentUser: { uid: 'a', getIdToken: async () => 'a' } };
    const session = createAdminSession({ getAuth: async () => auth,
      exchange: () => { entered(); return new Promise(resolve => { release = resolve; }); } });
    const pending = session.token(); await started; session.clear();
    release(jwt.sign({ sub: 'a' }, 'synthetic', { expiresIn: '5m' }));
    await assert.rejects(pending, /session changed/);
  });
  await t.test('expired or malformed gateway token never enters cache', async () => {
    const auth = { currentUser: { uid: 'a', getIdToken: async () => 'a' } };
    for (const bad of ['malformed', jwt.sign({ sub: 'a' }, 'synthetic', { expiresIn: -1 })]) {
      const session = createAdminSession({ getAuth: async () => auth, exchange: async () => bad });
      await assert.rejects(session.token(), /Invalid admin session|has expired/);
    }
  });
});
