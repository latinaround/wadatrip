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
  const binding = info.NetworkSettings.Ports['5432/tcp'];
  if (info.Config.Labels['wadatrip.scope'] !== 'p05-disposable'
    || binding.length !== 1 || binding[0].HostIp !== '127.0.0.1' || binding[0].HostPort !== '55435'
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
export function deploy(name, baseline = false) {
  databaseName(name);
  const environment = Object.fromEntries(Object.entries(process.env)
    .filter(([key]) => !/DATABASE|STRIPE|PRISMA_ENV|NODE_OPTIONS|DOTENV|P05_/.test(key)));
  environment.P05_DATABASE = name;
  if (baseline) {
    const source = 'libs/db/prisma/migrations', destination = 'logs/p05-baseline-migrations';
    const names = fs.readdirSync(source).filter(n => /^\d+$/.test(n.split('_')[0]) && n < '20260909000000');
    fs.mkdirSync(destination, { recursive: true });
    if (fs.readdirSync(destination).some(n => n !== 'migration_lock.toml' && !names.includes(n))) throw new Error('Unexpected baseline migration');
    for (const name of [...names, 'migration_lock.toml']) fs.cpSync(`${source}/${name}`, `${destination}/${name}`, { recursive: true });
    environment.P05_MIGRATION_STAGE = 'baseline';
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
