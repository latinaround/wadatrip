// Explicit disposable target only. Never import root prisma.config.ts or dotenv.
import { defineConfig } from '@prisma/config';
import { readFileSync } from 'node:fs';
const target = JSON.parse(readFileSync('logs/p05-target.json', 'utf8'));
if (target.host !== '127.0.0.1' || target.port !== 55435 ||
    target.database !== 'wadatrip_p05_fresh' || target.user !== 'wadatrip_p05' ||
    !/^[a-f0-9]{32}$/.test(target.marker) || !/^[a-f0-9]{48}$/.test(target.password)) {
  throw new Error('Unsafe PostgreSQL integration target');
}
const database = process.env.P05_DATABASE;
if (!database || !/^wadatrip_p05_(repair_[a-z0-9_]+|history_[a-z0-9_]+)$/.test(database)) throw new Error('Explicit disposable database required');
const url = new URL(`postgresql://127.0.0.1:55435/${database}`);
url.username = target.user; url.password = target.password;
process.env.DATABASE_URL = url.toString();
export default defineConfig({
  schema: '../libs/db/prisma/schema.prisma',
  migrations: { path: process.env.P05_MIGRATION_STAGE === 'baseline'
    ? '../logs/p05-baseline-migrations' : '../libs/db/prisma/migrations' },
});
