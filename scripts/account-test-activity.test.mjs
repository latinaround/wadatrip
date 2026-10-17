import { test } from 'node:test';
import assert from 'node:assert/strict';
import { separateTestActivity } from '../apps/web/src/utils/accountDisplay.js';

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
