// Disposable PostgreSQL 17 in Docker only. No production data, dotenv or Stripe.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { spawnSync } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const { operatorBookingInbox, reviewOperatorBooking } = require('../apps/gateway/dist/apps/gateway/src/services/operator-booking-inbox.js');
const root = path.resolve(__dirname, '..');
const actor = { id: 'synthetic-owner-a', email: 'owner-a@example.test', verified: true, admin: false, role: 'traveler' };
const other = { ...actor, id: 'synthetic-owner-b' };
const suffix = randomBytes(8).toString('hex');
const container = `wadatrip-inbox-test-${suffix}`;
const network = `wadatrip-inbox-net-${suffix}`;
const password = randomBytes(24).toString('hex');
let port, prisma, second, started = false, networkCreated = false;
let historicalBefore, historicalAfter;
const childEnv = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(PG|DATABASE|PRISMA|STRIPE|DOTENV|NODE_OPTIONS)/.test(k)));
function docker(args, input) {
  const result = spawnSync('docker', args, { input, encoding: 'utf8', env: { ...childEnv, POSTGRES_PASSWORD: password }, windowsHide: true, timeout: 30000 });
  if (result.error || result.status !== 0) throw new Error(`Disposable PostgreSQL command failed: ${result.error?.code || result.status}; ${String(result.stderr || '').replaceAll(password, '[synthetic-password]').slice(0, 900)}`);
  return result.stdout;
}
function sql(text) { return docker(['exec', '-i', container, 'psql', '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-h', '127.0.0.1', '-U', 'synthetic_inbox', '-d', 'postgres'], text); }
before(async () => {
  const image = docker(['image', 'inspect', '--format={{.Id}}', 'postgres:17.9-bookworm']).trim();
  assert.match(image, /^sha256:[a-f0-9]{64}$/);
  const probe = net.createServer(); await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  port = probe.address().port; await new Promise(resolve => probe.close(resolve));
  // Docker Desktop's internal networks do not expose published ports to this Windows host.
  // Use a dedicated bridge; the only published port is loopback and no remote credentials exist.
  docker(['network', 'create', '--label', `wadatrip.inbox_test=${suffix}`, network]); networkCreated = true;
  docker(['run', '--detach', '--rm', '--pull=never', '--name', container, '--label', `wadatrip.inbox_test=${suffix}`,
    '--network', network, '--publish', `127.0.0.1:${port}:5432`, '--tmpfs', '/var/lib/postgresql/data:rw,nosuid,size=256m',
    '--env', 'POSTGRES_USER=synthetic_inbox', '--env', 'POSTGRES_DB=postgres', '--env', 'POSTGRES_PASSWORD', image]);
  started = true;
  const [info] = JSON.parse(docker(['inspect', container]));
  assert.equal(info.Config.Labels['wadatrip.inbox_test'], suffix);
  assert.ok(info.Mounts.every(mount => mount.Type === 'tmpfs'), 'No persistent or host volume');
  assert.deepEqual(info.HostConfig.PortBindings['5432/tcp'], [{ HostIp: '127.0.0.1', HostPort: String(port) }]);
  const [netInfo] = JSON.parse(docker(['network', 'inspect', network]));
  assert.equal(netInfo.Driver, 'bridge');
  assert.equal(Object.keys(netInfo.Containers).length, 1);
  let ready = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    // TCP excludes the temporary Unix-socket-only server used by image initialization.
    try { docker(['exec', container, 'pg_isready', '-h', '127.0.0.1', '-U', 'synthetic_inbox', '-d', 'postgres']); ready = true; break; }
    catch { await new Promise(resolve => setTimeout(resolve, 200)); }
  }
  assert.ok(ready, 'Disposable PostgreSQL readiness timeout');
  // A deliberately small historical schema: this tests the additive migration, not the whole migration chain.
  sql(`CREATE TABLE users (id TEXT PRIMARY KEY);
    CREATE TABLE providers (id TEXT PRIMARY KEY, user_id TEXT UNIQUE REFERENCES users(id));
    CREATE TABLE listings (id TEXT PRIMARY KEY, title TEXT);
    CREATE TABLE bookings (id TEXT PRIMARY KEY, listing_id TEXT REFERENCES listings(id), provider_id TEXT REFERENCES providers(id),
      user_id TEXT REFERENCES users(id), status TEXT, date TIMESTAMP(3), num_people INTEGER, amount_cents INTEGER,
      currency TEXT, booking_terms JSONB, created_at TIMESTAMP(3));
    CREATE TABLE "PaymentRecord" (id TEXT PRIMARY KEY, booking_id TEXT UNIQUE REFERENCES bookings(id), processor_mode TEXT);
    INSERT INTO users VALUES ('synthetic-owner-a'), ('synthetic-owner-b'), ('synthetic-traveler');
    INSERT INTO providers VALUES ('synthetic-provider-a','synthetic-owner-a'), ('synthetic-provider-b','synthetic-owner-b');
    INSERT INTO listings VALUES ('synthetic-listing', 'Synthetic city tour');
    INSERT INTO bookings VALUES ('synthetic-historical','synthetic-listing','synthetic-provider-a','synthetic-traveler',
      'confirmed','2026-01-01',1,NULL,'USD','{}','2026-01-01');
    INSERT INTO "PaymentRecord" VALUES ('synthetic-legacy-payment','synthetic-historical',NULL);`);
  const historicalSql = `COPY (SELECT jsonb_build_object('bookings',(SELECT jsonb_agg(b ORDER BY b.id) FROM bookings b),
    'payments',(SELECT jsonb_agg(p ORDER BY p.id) FROM "PaymentRecord" p))) TO STDOUT;`;
  historicalBefore = sql(historicalSql);
  sql(fs.readFileSync(path.join(root, 'libs/db/prisma/migrations/20261021000000_operator_booking_reviews/migration.sql'), 'utf8'));
  historicalAfter = sql(historicalSql);
  const url = `postgresql://synthetic_inbox:${password}@127.0.0.1:${port}/postgres?connection_limit=2&connect_timeout=5`;
  for (const key of ['DATABASE_URL', 'DATABASE_URL_LOCAL', 'DATABASE_URL_REMOTE']) delete process.env[key];
  prisma = new PrismaClient({ datasources: { db: { url } } });
  second = new PrismaClient({ datasources: { db: { url } } });
  await Promise.all([prisma.$connect(), second.$connect()]);
  const [identity] = await prisma.$queryRaw`SELECT current_user AS role, current_database() AS db, current_setting('server_version_num')::int AS version`;
  assert.equal(identity.role, 'synthetic_inbox'); assert.equal(identity.db, 'postgres');
  assert.ok(identity.version >= 170000 && identity.version < 180000);
});
beforeEach(async () => {
  sql(`DELETE FROM operator_booking_reviews; DELETE FROM "PaymentRecord"; DELETE FROM bookings;
    INSERT INTO bookings VALUES
     ('synthetic-live','synthetic-listing','synthetic-provider-a','synthetic-traveler','confirmed','2026-11-30',1,5000,'USD','{}','2026-10-20'),
     ('synthetic-test','synthetic-listing','synthetic-provider-a','synthetic-traveler','confirmed','2026-11-30',1,5000,'USD','{}','2026-10-20'),
     ('synthetic-free','synthetic-listing','synthetic-provider-a','synthetic-traveler','confirmed','2026-11-30',1,0,'USD','{}','2026-10-20'),
     ('synthetic-null','synthetic-listing','synthetic-provider-a','synthetic-traveler','confirmed','2026-11-30',1,NULL,'USD','{}','2026-10-20'),
     ('synthetic-unknown','synthetic-listing','synthetic-provider-a','synthetic-traveler','confirmed','2026-11-30',1,5000,'USD','{}','2026-10-20'),
     ('synthetic-blank','synthetic-listing','synthetic-provider-a','synthetic-traveler','confirmed','2026-11-30',1,5000,'USD','{}','2026-10-20'),
     ('synthetic-b','synthetic-listing','synthetic-provider-b','synthetic-traveler','confirmed','2026-11-30',1,5000,'USD','{}','2026-10-20');
    INSERT INTO "PaymentRecord" VALUES ('record-live','synthetic-live','live'), ('record-test','synthetic-test','test'),
     ('record-unknown','synthetic-unknown',NULL), ('record-blank','synthetic-blank',''), ('record-b','synthetic-b','live');`);
});
after(async () => {
  await Promise.allSettled([prisma?.$disconnect(), second?.$disconnect()]);
  if (started) {
    const [info] = JSON.parse(docker(['inspect', container]));
    assert.equal(info.Config.Labels['wadatrip.inbox_test'], suffix);
    docker(['stop', '--time', '3', container]);
  }
  if (networkCreated) {
    const [info] = JSON.parse(docker(['network', 'inspect', network]));
    assert.equal(info.Labels['wadatrip.inbox_test'], suffix);
    docker(['network', 'rm', network]);
  }
});
test('REAL PostgreSQL: nullable relations and legacy modes are classified safely', async () => {
  const inbox = await operatorBookingInbox(prisma, actor);
  assert.equal(inbox.groups.reservations.total, 2);
  assert.equal(inbox.groups.sandbox.total, 1);
  assert.equal(inbox.groups.unverified.total, 3);
  assert.deepEqual(inbox.groups.unverified.items.map(x => x.id).sort(), ['synthetic-blank', 'synthetic-null', 'synthetic-unknown']);
});
test('REAL PostgreSQL: additive migration preserves historical null amounts and payment modes', () => {
  assert.ok(historicalBefore.includes('synthetic-historical'));
  assert.equal(historicalAfter, historicalBefore);
});
test('REAL PostgreSQL: two connections review the same booking concurrently without duplicates', async () => {
  const [a, b] = await Promise.all([reviewOperatorBooking(prisma, actor, 'synthetic-live'), reviewOperatorBooking(second, actor, 'synthetic-live')]);
  assert.equal(+a.reviewed_at, +b.reviewed_at);
  assert.equal(await prisma.operator_booking_reviews.count(), 1);
  assert.equal((await operatorBookingInbox(second, actor)).groups.reservations.total, 1);
});
test('REAL PostgreSQL: owner isolation and a new owner do not inherit old review receipts', async () => {
  await assert.rejects(reviewOperatorBooking(second, other, 'synthetic-live'), /not found/);
  await reviewOperatorBooking(prisma, actor, 'synthetic-live');
  await prisma.$executeRaw`UPDATE bookings SET provider_id='synthetic-provider-b' WHERE id='synthetic-live'`;
  assert.equal((await operatorBookingInbox(second, other)).groups.reservations.total, 2);
});
test('REAL PostgreSQL: foreign keys reject orphan receipts and preserve booking/user references', async () => {
  for (const row of [{ booking_id: 'missing', user_id: actor.id }, { booking_id: 'synthetic-live', user_id: 'missing' }]) {
    await assert.rejects(prisma.operator_booking_reviews.create({ data: row }), e => e.code === 'P2003');
  }
  await reviewOperatorBooking(prisma, actor, 'synthetic-live');
  await assert.rejects(prisma.$executeRaw`DELETE FROM bookings WHERE id='synthetic-live'`);
  assert.equal(await prisma.operator_booking_reviews.count(), 1);
});
test('REAL PostgreSQL: receipts roll back and repeated reviews keep the first timestamp', async () => {
  await assert.rejects(prisma.$transaction(async tx => {
    await tx.operator_booking_reviews.create({ data: { booking_id: 'synthetic-test', user_id: actor.id } });
    throw new Error('synthetic rollback');
  }), /synthetic rollback/);
  assert.equal(await prisma.operator_booking_reviews.count(), 0);
  const first = await reviewOperatorBooking(prisma, actor, 'synthetic-test');
  const repeat = await reviewOperatorBooking(second, actor, 'synthetic-test');
  assert.equal(+first.reviewed_at, +repeat.reviewed_at);
});
test('REAL PostgreSQL: migration creates the composite key and owner-time index', async () => {
  const indexes = await prisma.$queryRaw`SELECT indexname FROM pg_indexes WHERE tablename='operator_booking_reviews'`;
  assert.deepEqual(indexes.map(x => x.indexname).sort(), ['operator_booking_reviews_pkey', 'operator_booking_reviews_user_id_reviewed_at_idx']);
  await reviewOperatorBooking(prisma, actor, 'synthetic-live');
  await assert.rejects(prisma.operator_booking_reviews.create({ data: { booking_id: 'synthetic-live', user_id: actor.id } }), e => e.code === 'P2002');
});
