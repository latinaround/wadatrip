const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('operator readiness keeps public and managed listing contracts separate', () => {
  const publicData = read('libs/common/src/public-data.ts');
  const gateway = read('apps/gateway/src/controllers/providers.controller.ts');
  const hub = read('services/provider-hub/src/controllers/listings.controller.ts');
  const migration = read('libs/db/prisma/migrations/20260916000000_operator_readiness/migration.sql');

  for (const privateField of ['timezone', 'meeting_point', 'cancellation_policy', 'booking_cutoff_hours', 'operational_contact']) {
    const publicSelect = publicData.match(/export const publicListingSelect = \{([\s\S]*?)\} as const;/)?.[1] || '';
    assert.equal(publicSelect.includes(`${privateField}: true`), false, `${privateField} must stay out of public projection`);
  }
  for (const source of [gateway, hub]) {
    assert.match(source, /availability/);
    assert.match(source, /lockedListing/);
    assert.match(source, /requireProviderAccess/);
    assert.match(source, /spots_total/);
  }
  assert.match(gateway, /listings\/:id\/manage/);
  assert.match(gateway, /HUB[^\n]*availability[\s\S]*serviceHeaders/);
  assert.match(hub, /:id\/manage/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS/);
  assert.doesNotMatch(migration, /\b(DELETE|UPDATE|INSERT|DROP|TRUNCATE)\b/);
});
