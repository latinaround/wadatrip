// Static migration contract checks; PostgreSQL execution is a separate release gate.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const sql = fs.readFileSync('libs/db/prisma/migrations/20260910000000_payment_lifecycle/migration.sql', 'utf8');
test('local startup requires explicit opt-in before applying migrations', () => {
  const startup = fs.readFileSync('scripts/dev-all.ps1', 'utf8');
  assert.match(startup, /\[switch\]\$Migrate\s*=\s*\$false/);
});
test('BLOCKER database: ledger has a restrictive booking FK without rejecting historical orphans during DDL', () => {
  assert.match(sql, /FOREIGN KEY\s*\("booking_id"\) REFERENCES "bookings"\("id"\) ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID/);
});
test('BLOCKER database: capacity query indexed and availability unique per calendar day', () => {
  assert.match(sql, /CREATE INDEX "idx_bookings_listing_date"/);
  assert.match(sql, /CREATE UNIQUE INDEX "listing_availability_listing_day_key"[\s\S]*?\(date::date\)/);
});
test('BLOCKER database: unknown historic money stays nullable while managed money must exist', () => {
  assert.match(sql, /ALTER COLUMN "amount_gross_cents" DROP NOT NULL/);
  assert.match(sql, /"amount_gross_cents" IS NOT NULL/);
  assert.match(sql, /BEGIN;/); assert.match(sql, /COMMIT;/);
  assert.doesNotMatch(sql, /DELETE FROM|TRUNCATE|DROP TABLE|UPDATE "bookings"|UPDATE "PaymentRecord"/i);
});
test('BLOCKER database: event processing state, attempts and association are persisted', () => {
  for (const column of ['last_attempt_at', 'error_category', 'payment_record_id', 'processed_at']) assert.ok(sql.includes(column), column);
  assert.match(sql, /"status" = 'processed'\) = \("processed_at" IS NOT NULL\)/);
});
