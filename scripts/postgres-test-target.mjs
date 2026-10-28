// Dedicated disposable cluster only. No project dotenv, production URLs or default datasource.
import fs from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

export const target = JSON.parse(fs.readFileSync('logs/p05-target.json', 'utf8'));
if (target.host !== '127.0.0.1' || target.port !== 55435 || target.user !== 'wadatrip_p05'
  || target.database !== 'wadatrip_p05_fresh' || !/^[a-f0-9]{32}$/.test(target.marker)
  || !/^[a-f0-9]{48}$/.test(target.password)) throw new Error('Unsafe disposable target');
export function databaseName(name) {
  if (!/^wadatrip_p05_(repair|history)_[a-z0-9_]+$/.test(name) || name.length > 63) throw new Error('Unsafe test database');
  return name;
}
export function client(name) {
  databaseName(name);
  const url = new URL(`postgresql://127.0.0.1:55435/${name}?connection_limit=2`);
  url.username = target.user; url.password = target.password;
  return new PrismaClient({ datasources: { db: { url: url.href } } });
}
export async function verify(db, name) {
  const [row] = await db.$queryRaw`SELECT current_database() AS name, current_user AS role,
    current_setting('wadatrip.test_marker', true) AS marker`;
  if (row.name !== databaseName(name) || row.role !== target.user || row.marker !== target.marker) {
    throw new Error('Disposable database identity mismatch');
  }
}
export function provision(name) {
  databaseName(name);
  const container = 'wadatrip-p05-20260912';
  const [info] = JSON.parse(execFileSync('docker', ['inspect', container], { encoding: 'utf8' }));
  if (info?.State?.Status !== 'running') throw new Error('Disposable PostgreSQL test container must be running; no database was provisioned');
  const binding = info.NetworkSettings?.Ports?.['5432/tcp'];
  if (info.Config.Labels['wadatrip.scope'] !== 'p05-disposable'
    || !Array.isArray(binding) || binding.length !== 1 || binding[0].HostIp !== '127.0.0.1' || binding[0].HostPort !== '55435'
    || info.Mounts.some(m => m.Type === 'volume' || m.Type === 'bind')) throw new Error('Unsafe Docker target');
  // Identifiers and marker are strict allowlists. Existing databases are never dropped or reused.
  execFileSync('docker', ['exec', '-i', container, 'psql', '-X', '-v', 'ON_ERROR_STOP=1',
    '-U', target.user, '-d', target.database], {
    input: `CREATE DATABASE ${name};\nALTER DATABASE ${name} SET wadatrip.test_marker = '${target.marker}';\n`,
    stdio: ['pipe', 'pipe', 'pipe'], encoding: 'utf8',
  });
}
export function sql(name, source) {
  databaseName(name);
  return execFileSync('docker', ['exec', '-i', 'wadatrip-p05-20260912', 'psql', '-X',
    '-v', 'ON_ERROR_STOP=1', '-U', target.user, '-d', name], {
    input: source, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'],
  });
}
// The partial-schema fixtures model the twelve-file checkout that existed before
// original history was recovered. Keep that scenario explicit; production/full
// tests always use the complete current chain. Never mark missing history resolved.
const partialSchemaMigrations = [
  '20250827233319_init', '20250829000553_provider_hub_init',
  '20250829044951_make_subscription_optional', '20250912090000_add_listing_description_dates',
  '20250913091500_add_bookings_and_provider_stripe', '20260106133000_add_agent_itineraries',
  '20260507093000_add_provider_instagram_handle', '20260513124500_add_provider_owner',
  '20260520083000_add_operator_leads', '20260602093000_add_auth_login_codes',
  '20260806090000_add_trips', '20260806093000_add_firebase_identity_and_push_devices',
];
const partialSchemaTargets = new Set();
export function deploy(name, baseline = false) {
  databaseName(name);
  const environment = Object.fromEntries(Object.entries(process.env)
    .filter(([key]) => !/DATABASE|STRIPE|PRISMA_ENV|NODE_OPTIONS|DOTENV|P05_/.test(key)));
  environment.P05_DATABASE = name;
  if (baseline !== false && baseline !== true && baseline !== 'recovered') throw new Error('Unknown historical schema scenario');
  if (baseline === true) partialSchemaTargets.add(name);
  if (baseline === 'recovered' && partialSchemaTargets.has(name)) throw new Error('Cannot mix historical schema scenarios');
  if (baseline || partialSchemaTargets.has(name)) {
    const source = 'libs/db/prisma/migrations';
    const current = fs.readdirSync(source).filter(n => /^\d+$/.test(n.split('_')[0]) && fs.existsSync(`${source}/${n}/migration.sql`));
    const stage = partialSchemaTargets.has(name)
      ? (baseline ? 'partial_baseline' : 'partial_upgrade') : 'recovered_baseline';
    const names = stage === 'recovered_baseline' ? current.filter(n => n < '20260909000000')
      : [...partialSchemaMigrations, ...(stage === 'partial_upgrade' ? current.filter(n => n >= '20260909000000') : [])];
    const destination = `logs/p05-${stage}-migrations`;
    fs.mkdirSync(destination, { recursive: true });
    if (fs.readdirSync(destination).some(n => n !== 'migration_lock.toml' && !names.includes(n))) throw new Error('Unexpected baseline migration');
    for (const name of [...names, 'migration_lock.toml']) fs.cpSync(`${source}/${name}`, `${destination}/${name}`, { recursive: true });
    environment.P05_MIGRATION_STAGE = stage;
  }
  const run = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy',
    '--config', 'scripts/postgres-integration.prisma.config.ts'], { env: environment, encoding: 'utf8', timeout: 120000 });
  const output = String((run.stdout || '') + (run.stderr || '')).replaceAll(target.password, '[redacted]')
    .replace(/postgres(?:ql)?:\/\/[^\s]+/g, '[database-url-redacted]');
  fs.writeFileSync(`logs/p05-deploy-${name}-${Date.now()}.json`, JSON.stringify({ database: name, baseline, exit_code: run.status, output }, null, 2));
  return { status: run.status, output };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  provision(process.argv[2]);
  console.log('Provisioned isolated database:', process.argv[2]);
}
