import { test } from 'node:test';
import assert from 'node:assert/strict';
import { separateTestActivity, partitionBookingHistory } from '../apps/web/src/utils/accountDisplay.js';

test('persisted Test activity is separate from normal trips and payments without deleting records', () => {
  const bookings = [{ id: 'synthetic-test', processorMode: 'test' }, { id: 'synthetic-live', processorMode: 'live' }];
  const payments = [{ id: 'synthetic-test-payment', bookingId: bookings[0].id, processorMode: 'test' }, { id: 'synthetic-live-payment', bookingId: bookings[1].id, processorMode: 'live' }];
  const activity = separateTestActivity(bookings, payments);
  assert.deepEqual(activity.bookings, [bookings[1]]);
  assert.deepEqual(activity.payments, [payments[1]]);
  assert.deepEqual(activity.testBookings, [bookings[0]]);
  assert.deepEqual(activity.testPayments, [payments[0]]);
  assert.equal(bookings.length, 2); assert.equal(payments.length, 2);
});

test('older booking responses can use the persisted payment history mode', () => {
  const activity = separateTestActivity([{ id: 'synthetic-booking' }], [{ bookingId: 'synthetic-booking', processorMode: 'test' }]);
  assert.equal(activity.bookings.length, 0); assert.equal(activity.testBookings.length, 1);
});

test('unknown legacy records, free bookings and test-looking names or IDs are never silently classified as Test', () => {
  const bookings = [{ id: 'cs_test_synthetic', name: 'Synthetic Test', amountCents: 0 }, { id: 'synthetic-unknown', processorMode: null }];
  const payments = [{ id: 'cs_test_synthetic', processorMode: null, mock: true }];
  const activity = separateTestActivity(bookings, payments);
  assert.deepEqual(activity.bookings, bookings); assert.deepEqual(activity.payments, payments);
  assert.equal(activity.testBookings.length, 0); assert.equal(activity.testPayments.length, 0);
});

test('live evidence prevents hiding a booking with conflicting historical modes', () => {
  for (const [bookingMode, paymentMode] of [['test', 'live'], ['live', 'test']]) {
    const activity = separateTestActivity([{ id: 'synthetic-conflict', processorMode: bookingMode }], [{ bookingId: 'synthetic-conflict', processorMode: paymentMode }]);
    assert.equal(activity.bookings.length, 1); assert.equal(activity.testBookings.length, 0);
  }
});

test('an unrelated traveler payment cannot classify another booking as Test', () => {
  const activity = separateTestActivity([{ id: 'synthetic-own-booking' }], [{ bookingId: 'synthetic-other-booking', processorMode: 'test' }]);
  assert.equal(activity.bookings.length, 1); assert.equal(activity.testBookings.length, 0);
});

const now = Date.parse('2026-10-19T03:00:00Z');
test('old unpaid records leave the active list without being deleted or reclassified as Test', () => {
  const old = { id: 'synthetic-old', date: '2026-03-29', status: 'pending', paymentStatus: 'unpaid' };
  const result = partitionBookingHistory([old], now);
  assert.deepEqual(result.current, []); assert.deepEqual(result.historical, [old]);
  assert.equal(old.status, 'pending'); assert.equal(old.processorMode, undefined);
});

test('future paid and free bookings stay visible', () => {
  const rows = [50, 0].map(total => ({ date: '2026-11-30', status: 'confirmed', paymentStatus: 'paid', total }));
  assert.deepEqual(partitionBookingHistory(rows, now).current, rows);
});

test('payment and cancellation issues remain active even after departure', () => {
  const rows = ['payment_pending', 'cancellation_pending', 'reconciliation_required'].map(status => ({ date: '2026-01-01', status }));
  rows.push({ date: '2026-01-01', status: 'cancelled', paymentStatus: 'paid' });
  rows.push({ date: '2026-01-01', status: 'confirmed', paymentStatus: 'refund_required' });
  rows.push({ date: '2026-01-01', status: 'pending', paymentStatus: 'pending' });
  assert.deepEqual(partitionBookingHistory(rows, now).current, rows);
});

test('unpaid cancellation, refunded cancellation and completed paid trips remain accessible in history', () => {
  const rows = [{ status: 'cancelled', paymentStatus: 'unpaid' }, { status: 'cancelled', paymentStatus: 'refunded' }, { status: 'completed', paymentStatus: 'paid' }];
  assert.deepEqual(partitionBookingHistory(rows, now).historical, rows);
});

test('calendar-only departure day uses the saved tour timezone and keeps today active', () => {
  const booking = { date: '2026-10-18', status: 'confirmed', paymentStatus: 'paid', timezone: 'America/Lima' };
  assert.equal(partitionBookingHistory([booking], now).current.length, 1);
  assert.equal(partitionBookingHistory([booking], Date.parse('2026-10-19T05:00:00Z')).historical.length, 1);
});

test('contractual departure instant takes precedence over the legacy booking date', () => {
  const booking = { date: '2026-01-01', status: 'confirmed', paymentStatus: 'paid', departureAt: '2026-10-19T04:00:00Z' };
  assert.equal(partitionBookingHistory([booking], now).current.length, 1);
  assert.equal(partitionBookingHistory([booking], Date.parse('2026-10-19T04:00:01Z')).historical.length, 1);
});

test('invalid dates, invalid timezone and unknown lifecycle remain visible for review', () => {
  const rows = [{ date: '2026-02-30', status: 'pending' }, { date: 'not-a-date', status: 'confirmed' },
    { date: '2026-01-01', timezone: 'invalid/zone', status: 'pending' }, { date: '2026-01-01', status: 'unknown-legacy' }];
  assert.deepEqual(partitionBookingHistory(rows, now).current, rows);
});
