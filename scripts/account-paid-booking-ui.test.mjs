import assert from 'node:assert/strict';
import test from 'node:test';

import { formatBookingDeparture, paymentAmountCents } from '../apps/web/src/utils/accountDisplay.js';

test('booking departure uses the contractual tour timezone', () => {
  const label = formatBookingDeparture({
    date: '2026-11-30T00:00:00.000Z',
    departureAt: '2026-11-30T14:30:00.000Z',
    timezone: 'America/Lima',
  }, 'en-US');

  assert.match(label, /Nov 30/);
  assert.match(label, /09:30 AM/);
  assert.doesNotMatch(label, /Nov 29/);
  assert.match(label, /America\/Lima/);
});

test('legacy date-only bookings never shift to the previous browser day', () => {
  const label = formatBookingDeparture({ date: '2026-11-30T00:00:00.000Z' }, 'en-US');
  assert.match(label, /Nov 30/);
  assert.doesNotMatch(label, /Nov 29/);
});

test('payment history prefers the amount actually charged', () => {
  assert.equal(paymentAmountCents({
    amount_charged_cents: 5000,
    amount_gross_cents: 5000,
    amount_cents: null,
  }), 5000);
});

test('payment history supports expected gross amount when charged amount is legacy null', () => {
  assert.equal(paymentAmountCents({
    amount_charged_cents: null,
    amount_gross_cents: '5000',
  }), 5000);
});
