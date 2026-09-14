// Real migrations and synthetic historical rows, never a production copy.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { provision, client, verify, deploy, sql } from './postgres-test-target.mjs';

const stamp = Date.now().toString(36);
let sequence = 0;
async function historical(run, { legacy = true } = {}) {
  const name = `wadatrip_p05_history_${stamp}_${++sequence}`;
  provision(name);
  const db = client(name);
  try {
    await verify(db, name);
    assert.equal(deploy(name, true).status, 0, 'original twelve migrations must pass');
    // Independent pre-lifecycle schema from the historical standalone definitions.
    if (legacy) sql(name, `
      ALTER TABLE bookings ADD amount_cents INTEGER, ADD commission_cents INTEGER,
        ADD operator_share_cents INTEGER, ADD currency TEXT DEFAULT 'usd',
        ADD payment_intent_id TEXT, ADD checkout_session_id TEXT;
      CREATE TABLE "PaymentRecord" (id TEXT PRIMARY KEY, booking_id TEXT NOT NULL,
        provider_id TEXT NOT NULL, amount_gross_cents INTEGER, commission_cents INTEGER,
        amount_net_cents INTEGER, currency TEXT, stripe_payment_intent_id TEXT,
        stripe_checkout_session_id TEXT, status TEXT NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP(3) NOT NULL);
      CREATE UNIQUE INDEX "PaymentRecord_booking_id_key" ON "PaymentRecord"(booking_id);
      CREATE TABLE "PaymentEvent" (id TEXT PRIMARY KEY, type TEXT NOT NULL, payload JSONB NOT NULL,
        processed_at TIMESTAMP(3), created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
    `);
    sql(name, `
      INSERT INTO users(id,email) VALUES ('hist-user','history@example.invalid');
      INSERT INTO providers(id,type,name,email,languages,base_city,country_code)
        VALUES ('hist-provider','guide','Synthetic provider','provider@example.invalid',ARRAY['en'],'Test','ZZ');
      INSERT INTO listings(id,provider_id,title,category,city,country_code,tags,status,price_from)
        VALUES ('hist-listing','hist-provider','Synthetic listing','tour','Test','ZZ',ARRAY[]::text[],'published',120);
      INSERT INTO listing_availability(id,listing_id,date,spots_total,spots_available)
        VALUES ('hist-slot','hist-listing','2099-01-01',1,0);
      INSERT INTO bookings(id,listing_id,provider_id,user_id,status,date,num_people,payment_status)
        VALUES ('hist-booking','hist-listing','hist-provider','hist-user','pending','2099-01-01',1,'unpaid');
    `);
    await run(db, name);
  } finally { await db.$disconnect(); }
}
const report = (name, script) => {
  const text = sql(name, fs.readFileSync(`scripts/payment-${script}.sql`, 'utf8'));
  fs.writeFileSync(`logs/p05-${name}-${script}.txt`, text);
  return Object.fromEntries([...text.matchAll(/^\s*([a-z_]+)\s*\|\s*(\d+)\s*$/gm)].map(m => [m[1], Number(m[2])]));
};

test('committed SQL alias defect is reproduced on PostgreSQL; repaired reports stay read-only', () => historical(async (db,name) => {
  for (const script of ['preflight','postflight']) {
    if (script === 'postflight') assert.equal(deploy(name).status,0);
    const original=execFileSync('git',['show',`02ca58d723925c9cde036af63f751878ac82a608:scripts/payment-${script}.sql`],{encoding:'utf8'});
    assert.throws(()=>sql(name,original), error=>/syntax error at or near "day"/.test(String(error.stderr)));
    const repaired=fs.readFileSync(`scripts/payment-${script}.sql`,'utf8').replace(/--[^\r\n]*/g,'');
    assert.doesNotMatch(repaired,/\b(?:DELETE|UPDATE|INSERT|ALTER|DROP|TRUNCATE|CREATE|GRANT|REVOKE)\b/i);
    assert.match(repaired,/READ ONLY/i);
    const before=await db.$queryRawUnsafe('SELECT count(*)::int n FROM bookings');
    report(name,script);
    assert.deepEqual(await db.$queryRawUnsafe('SELECT count(*)::int n FROM bookings'),before);
  }
}));

test('history: recover missing money columns without inventing amount/currency', () => historical(async (db, name) => {
  assert.equal(deploy(name).status, 0);
  const booking = await db.bookings.findUnique({ where: { id: 'hist-booking' } });
  assert.equal(booking.amount_cents, null); assert.equal(booking.currency, null);
  assert.equal(booking.inventory_state, null); assert.equal(booking.status, 'pending');
}, { legacy: false }));

test('history: known legacy money, unknown amounts, orphan ledger and invalid occupancy survive; new writes are constrained', () => historical(async (db, name) => {
  sql(name, `
    UPDATE bookings SET num_people=3, payment_status='paid' WHERE id='hist-booking';
    INSERT INTO bookings(id,listing_id,provider_id,user_id,status,date,num_people,payment_status)
      VALUES ('hist-invalid','hist-listing','hist-provider','hist-user','pending','2099-01-02',0,'unpaid'),
      ('hist-no-ledger','hist-listing','hist-provider','hist-user','confirmed','2099-01-03',1,'paid'),
      ('hist-cancelled','hist-listing','hist-provider','hist-user','cancelled','2099-01-04',1,'unpaid');
    UPDATE bookings SET payment_intent_id='pi_synthetic_cancelled' WHERE id='hist-cancelled';
    INSERT INTO "PaymentRecord"(id,booking_id,provider_id,status,updated_at,stripe_payment_intent_id)
      VALUES ('hist-paid','hist-booking','hist-provider','paid',CURRENT_TIMESTAMP,'pi_synthetic_paid'),
      ('hist-orphan','missing-booking','hist-provider','succeeded',CURRENT_TIMESTAMP,''),
      ('hist-cancel-ledger','hist-cancelled','hist-provider','pending',CURRENT_TIMESTAMP,'pi_synthetic_conflict');
    INSERT INTO "PaymentEvent"(id,type,payload,processed_at) VALUES
      ('hist-event','synthetic','{}',NULL), ('hist-done','synthetic','{}',CURRENT_TIMESTAMP);
  `);
  const before = await db.$queryRawUnsafe('SELECT to_jsonb(p)::text value FROM "PaymentRecord" p ORDER BY id');
  const pre = report(name, 'preflight');
  for (const key of ['payment_without_booking','booking_paid_without_ledger','payment_expected_amount_unknown',
    'payment_legacy_paid','payment_succeeded','event_unprocessed','participants_invalid',
    'occupancy_above_capacity','external_reference_empty','booking_ledger_reference_mismatch','cancelled_with_unsettled_financial_reference']) {
    assert.ok(pre[key] > 0, `preflight detects ${key}`);
  }
  assert.equal(deploy(name).status, 0, 'NOT VALID must preserve suspect historical rows');
  for (const row of before) {
    const original = JSON.parse(row.value), after = await db.paymentRecord.findUnique({ where: { id: original.id } });
    for (const field of ['booking_id','status','amount_gross_cents','currency','stripe_payment_intent_id']) assert.equal(after[field], original[field]);
  }
  assert.equal((await db.paymentEvent.findUnique({ where: { id: 'hist-event' } })).status, 'received');
  assert.equal((await db.paymentEvent.findUnique({ where: { id: 'hist-done' } })).status, 'processed');
  const post = report(name, 'postflight');
  assert.equal(post.required_constraints_missing, 0); assert.equal(post.required_indexes_missing, 0);
  assert.ok(post.unvalidated_core_constraints > 0); assert.ok(post.occupancy_above_capacity > 0);
  await assert.rejects(db.paymentRecord.create({ data: { booking_id: 'new-orphan', provider_id: 'hist-provider' } }), { code: 'P2003' });
  await assert.rejects(db.bookings.update({ where: { id: 'hist-booking' }, data: { num_people: 0 } }));
  await assert.rejects(db.$executeRawUnsafe('ALTER TABLE "PaymentRecord" VALIDATE CONSTRAINT "PaymentRecord_booking_id_fkey"'));
}));

for (const kind of ['duplicate_day','duplicate_external']) test(`history: ${kind} blocks migration atomically without deleting rows`, () => historical(async (db, name) => {
  if (kind === 'duplicate_day') sql(name, `INSERT INTO listing_availability VALUES ('duplicate-slot','hist-listing','2099-01-01 13:00',1,1)`);
  else sql(name, `
    UPDATE bookings SET payment_intent_id='pi_synthetic_duplicate' WHERE id='hist-booking';
    INSERT INTO "PaymentRecord"(id,booking_id,provider_id,stripe_payment_intent_id,updated_at)
      VALUES ('duplicate-payment','different-booking','hist-provider','pi_synthetic_duplicate',CURRENT_TIMESTAMP);
  `);
  const pre = report(name, 'preflight');
  assert.ok(pre[kind === 'duplicate_day' ? 'availability_duplicate_days' : 'external_reference_multiple_bookings'] > 0);
  const countBefore = await db.$queryRawUnsafe('SELECT count(*)::int n FROM bookings');
  assert.notEqual(deploy(name).status, 0);
  assert.equal((await db.$queryRawUnsafe('SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NULL'))[0].migration_name,'20260910000000_payment_lifecycle');
  assert.deepEqual(await db.$queryRawUnsafe('SELECT count(*)::int n FROM bookings'), countBefore);
  const columns = await db.$queryRaw`SELECT column_name FROM information_schema.columns WHERE table_name='bookings' AND column_name='inventory_state'`;
  assert.equal(columns.length, 0, 'failed lifecycle transaction rolled back');
}));

for (const kind of ['column','index']) test(`history: incompatible existing ${kind} is rejected, never hidden by IF NOT EXISTS`, () => historical(async (db, name) => {
  sql(name, kind === 'column'
    ? 'ALTER TABLE "PaymentRecord" ALTER amount_gross_cents TYPE bigint'
    : 'DROP INDEX "PaymentRecord_booking_id_key"; CREATE INDEX "PaymentRecord_booking_id_key" ON "PaymentRecord"(provider_id)');
  assert.notEqual(deploy(name).status, 0);
  assert.equal((await db.$queryRawUnsafe('SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NULL'))[0].migration_name,'20260909000000_restore_schema_history');
  const columns = await db.$queryRaw`SELECT column_name FROM information_schema.columns WHERE table_name='users' AND column_name='password_hash'`;
  assert.equal(columns.length, 0, 'recovery migration rolled back');
  assert.equal((await db.$queryRawUnsafe('SELECT count(*)::int n FROM bookings'))[0].n, 1);
}));
