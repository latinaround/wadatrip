// Real disposable PostgreSQL; no Stripe, project dotenv or production connection.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { provision, client, verify, deploy, sql } from './postgres-test-target.mjs';

const migration = '20261014000000_payment_mode_isolation';
const source = 'libs/db/prisma/migrations';
const suffix = Date.now().toString(36);

test('real PostgreSQL: complete migration chain installs mode constraints and indexes', async () => {
  const name = `wadatrip_p05_repair_modes_${suffix}`;
  provision(name);
  const db = client(name);
  try {
    await verify(db, name);
    assert.equal(deploy(name).status, 0, 'full migration chain must succeed');
    const constraints = await db.$queryRaw`SELECT conname, convalidated FROM pg_constraint WHERE connamespace='public'::regnamespace`;
    for (const name of ['payment_processor_mode_valid', 'payment_event_processor_mode_valid', 'provider_mode_account_ids_valid']) {
      assert.equal(constraints.find(c => c.conname === name)?.convalidated, true);
    }
    const indexes = await db.$queryRaw`SELECT indexname FROM pg_indexes WHERE schemaname='public'`;
    for (const name of ['idx_payment_mode_refund', 'providers_stripe_test_account_id_key', 'providers_stripe_live_account_id_key']) {
      assert.ok(indexes.some(i => i.indexname === name));
    }
    await assert.rejects(db.paymentEvent.create({ data: { id: 'evt_invalid_mode', type: 'synthetic', payload: {}, processor_mode: 'unknown' } }));
    for (const mode of [null, 'test', 'live']) {
      await db.paymentEvent.create({ data: { id: `evt_valid_${mode}`, type: 'synthetic', payload: {}, processor_mode: mode } });
    }
    const report = sql(name, fs.readFileSync('scripts/payment-mode-readiness.sql', 'utf8'));
    assert.match(report, /payment_mode_constraints_missing_or_unvalidated\s*\|\s*0/);
    assert.match(report, /event_mode_unknown_unprocessed\s*\|\s*1/);
    const provider = id => ({ id, name: 'Synthetic', email: `${id}@example.invalid`, type: 'guide', languages: [], base_city: 'Synthetic', country_code: 'ZZ' });
    await db.providers.create({ data: { ...provider('mode-provider-one'), stripe_test_account_id: 'acct_synthetictest', stripe_live_account_id: 'acct_syntheticlive' } });
    await assert.rejects(db.providers.create({ data: { ...provider('mode-provider-two'), stripe_test_account_id: 'acct_synthetictest' } }), { code: 'P2002' });
    await assert.rejects(db.providers.update({ where: { id: 'mode-provider-one' }, data: { stripe_live_account_id: 'acct_synthetictest' } }));
    await assert.rejects(db.providers.update({ where: { id: 'mode-provider-one' }, data: { stripe_live_account_id: 'blank' } }));
  } finally { await db.$disconnect(); }
});

test('real PostgreSQL: upgrade preserves unknown historical money and references without inferred modes', async () => {
  const name = `wadatrip_p05_history_modes_${suffix}`;
  provision(name);
  const db = client(name);
  const directory = `logs/payment-mode-baseline-${suffix}`;
  const config = `${directory}.config.ts`;
  fs.mkdirSync(directory, { recursive: true });
  for (const entry of fs.readdirSync(source)) {
    if (entry === 'migration_lock.toml' || (entry < migration && fs.existsSync(`${source}/${entry}/migration.sql`))) {
      fs.cpSync(`${source}/${entry}`, `${directory}/${entry}`, { recursive: true });
    }
  }
  // Import the existing guarded disposable configuration, overriding ONLY its local migration directory.
  fs.writeFileSync(config, `import base from '../scripts/postgres-integration.prisma.config';\nexport default { ...base, schema: '../libs/db/prisma/schema.prisma', migrations: { path: './${path.basename(directory)}' } };\n`);
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/DATABASE|STRIPE|PRISMA_ENV|NODE_OPTIONS|DOTENV|P05_/.test(key)));
  env.P05_DATABASE = name;
  try {
    await verify(db, name);
    const baseline = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy', '--config', config], { env, encoding: 'utf8', timeout: 120000 });
    // Never print connection strings or subprocess output containing credentials.
    assert.equal(baseline.status, 0, 'pre-mode baseline must migrate successfully');
    sql(name, `
      INSERT INTO users(id,email) VALUES ('mode-legacy-user','synthetic-traveler@example.invalid');
      INSERT INTO providers(id,type,name,email,languages,base_city,country_code,stripe_account_id)
        VALUES ('mode-legacy-provider','guide','Synthetic','synthetic-provider@example.invalid','{}','Synthetic','ZZ','acct_syntheticlegacy');
      INSERT INTO listings(id,provider_id,title,category,city,country_code,tags,status,price_from)
        VALUES ('mode-legacy-listing','mode-legacy-provider','Synthetic','tour','Synthetic','ZZ','{}','published',50);
      INSERT INTO bookings(id,listing_id,provider_id,user_id,date,num_people,status,payment_status,amount_cents)
        VALUES ('mode-legacy-booking','mode-legacy-listing','mode-legacy-provider','mode-legacy-user',CURRENT_DATE+30,1,'confirmed','paid',NULL);
      INSERT INTO "PaymentRecord"(id,booking_id,provider_id,status,stripe_payment_intent_id,updated_at)
        VALUES ('mode-legacy-ledger','mode-legacy-booking','mode-legacy-provider','paid','pi_syntheticlegacy',NOW());
      INSERT INTO "PaymentEvent"(id,type,payload) VALUES ('evt_syntheticlegacy','synthetic','{}');
    `);
    assert.equal(deploy(name).status, 0, 'mode migration must upgrade real historical rows');
    const record = await db.paymentRecord.findUnique({ where: { id: 'mode-legacy-ledger' } });
    assert.equal(record.processor_mode, null);
    assert.equal(record.amount_gross_cents, null);
    assert.equal(record.status, 'paid');
    assert.equal(record.stripe_payment_intent_id, 'pi_syntheticlegacy');
    const event = await db.paymentEvent.findUnique({ where: { id: 'evt_syntheticlegacy' } });
    assert.equal(event.processor_mode, null); assert.equal(event.processed_at, null);
    const provider = await db.providers.findUnique({ where: { id: 'mode-legacy-provider' } });
    assert.equal(provider.stripe_account_id, 'acct_syntheticlegacy');
    assert.equal(provider.stripe_test_account_id, null); assert.equal(provider.stripe_live_account_id, null);
    assert.equal((await db.bookings.findUnique({ where: { id: 'mode-legacy-booking' } })).amount_cents, null);
    await assert.rejects(db.paymentRecord.update({ where: { id: record.id }, data: { processor_mode: 'unknown' } }));
    const report = sql(name, fs.readFileSync('scripts/payment-mode-readiness.sql', 'utf8'));
    assert.match(report, /payment_mode_unknown\s*\|\s*1/);
    assert.match(report, /unknown_mode_pending_or_external\s*\|\s*1/);
    assert.match(report, /payment_mode_constraints_missing_or_unvalidated\s*\|\s*0/);
  } finally { await db.$disconnect(); }
});
