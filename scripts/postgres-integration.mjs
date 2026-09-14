// Real PostgreSQL migration gate. No production configuration, Stripe or DB mocks.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = JSON.parse(fs.readFileSync(path.join(root, 'logs/p05-target.json'), 'utf8'));
if (target.host !== '127.0.0.1' || target.port !== 55435 ||
    target.database !== 'wadatrip_p05_fresh' || target.user !== 'wadatrip_p05' ||
    !/^[a-f0-9]{32}$/.test(target.marker) || !/^[a-f0-9]{48}$/.test(target.password)) {
  throw new Error('Refusing an unrecognized PostgreSQL test target');
}
const database = process.env.P05_DATABASE;
if (!database || !/^wadatrip_p05_(repair_[a-z0-9_]+|history_[a-z0-9_]+)$/.test(database)) throw new Error('Explicit disposable database required');
const url = new URL(`postgresql://127.0.0.1:55435/${database}`);
url.username = target.user; url.password = target.password;
const prisma = new PrismaClient({ datasources: { db: { url: url.toString() } } });
const report = { test: 'prisma_migration_chain', status: 'NOT_RUN', target: {
  host: target.host, port: target.port, database,
}, started_at: new Date().toISOString() };
const redact = text => String(text || '').replaceAll(target.password, '[redacted]')
  .replace(/postgres(?:ql)?:\/\/[^\s]+/g, '[database-url-redacted]');
try {
  const [identity] = await prisma.$queryRaw`SELECT current_database() AS database,
    current_user AS role, current_setting('wadatrip.test_marker', true) AS marker,
    version() AS version`;
  if (identity.database !== database || identity.role !== target.user || identity.marker !== target.marker) {
    throw new Error('PostgreSQL identity/marker mismatch; migration refused');
  }
  report.postgres_version = identity.version;
  const [before] = await prisma.$queryRaw`SELECT count(*)::int AS count FROM pg_tables WHERE schemaname = 'public'`;
  if (before.count !== 0) throw new Error('Fresh migration gate requires a new, empty public schema');
  await prisma.$disconnect();
  const environment = { ...process.env };
  for (const key of Object.keys(environment)) {
    if (/DATABASE|STRIPE|PRISMA_ENV|NODE_OPTIONS|DOTENV|P05_/.test(key)) delete environment[key];
  }
  environment.P05_DATABASE = database;
  const run = spawnSync(process.execPath, [
    'node_modules/prisma/build/index.js', 'migrate', 'deploy',
    '--config', 'scripts/postgres-integration.prisma.config.ts',
  ], { cwd: root, env: environment, encoding: 'utf8', timeout: 120000 });
  report.exit_code = run.status;
  report.output = redact((run.stdout || '') + (run.stderr || ''));
  report.status = run.status === 0 ? 'PASS' : 'FAIL';
  const rows = await prisma.$queryRaw`SELECT migration_name, finished_at IS NOT NULL AS finished,
    rolled_back_at IS NOT NULL AS rolled_back, applied_steps_count, logs
    FROM "_prisma_migrations" ORDER BY started_at`;
  report.migrations = rows.map(row => ({ ...row, logs: redact(row.logs) }));
  report.tables = await prisma.$queryRaw`SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' ORDER BY tablename`;
} catch (error) {
  report.status = 'FAIL';
  report.error = redact(error.message);
} finally {
  await prisma.$disconnect();
  report.finished_at = new Date().toISOString();
  fs.writeFileSync(path.join(root, `logs/p05-migration-${database}-${Date.now()}.json`), JSON.stringify(report, null, 2));
}
console.log(JSON.stringify(report, null, 2));
if (report.status !== 'PASS') {
  console.error('DEPENDENT TESTS BLOCKED: migration gate failed; no db push or automatic data repair performed.');
  process.exitCode = 1;
}
