// Synthetic refund finalization only. No database, Stripe, email provider or network IO.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

const originalLoad = Module._load;
Module._load = function(request, ...args) {
  if (request === '@wadatrip/common/payment-lifecycle') return {
    withPaymentBooking: async (prisma, bookingId, fn) => fn(prisma, prisma.state.booking),
    financialAudit: () => {},
    assertPaymentOwnership: async () => {},
    enqueueBookingNotifications: (prisma, bookingId, kind) => prisma.booking_notifications.createMany({
      data: ['traveler', 'operator'].map(audience => ({ booking_id: bookingId, kind, audience })),
      skipDuplicates: true,
    }),
  };
  if (request === '@wadatrip/common/booking-capacity') return { refreshCapacity: async () => {} };
  if (request === '@wadatrip/common/booking-policy') return { CANCELLATION_POLICY_VERSION: 'flexible_24h_v1' };
  return originalLoad.call(this, request, ...args);
};
after(() => { Module._load = originalLoad; });

const { recordVerifiedRefund } = require('../apps/gateway/dist/apps/gateway/src/services/booking-refund.service.js');

test('verified automatic refund atomically enqueues cancellation for traveler and operator', async () => {
  const notifications = [];
  const payment = {
    id: 'synthetic-payment', booking_id: 'synthetic-booking', status: 'succeeded',
    stripe_payment_intent_id: 'pi_synthetic', amount_gross_cents: 5000, currency: 'usd',
    refund_request_payload: { amount: 5000 }, refund_id: null, refund_status: 'processing',
  };
  const prisma = {
    state: { booking: { id: 'synthetic-booking', listing_id: 'synthetic-listing', status: 'reconciliation_required' } },
    paymentRecord: {
      findUnique: async () => payment,
      update: async ({ data }) => Object.assign(payment, data),
    },
    bookings: {
      update: async ({ data }) => (prisma.state.updated = { ...prisma.state.booking, ...data }),
    },
    booking_notifications: {
      createMany: async ({ data }) => { notifications.push(...data); return { count: data.length }; },
    },
  };
  const refund = {
    id: 're_synthetic', payment_intent: 'pi_synthetic', amount: 5000, currency: 'usd', status: 'succeeded',
    metadata: { booking_id: 'synthetic-booking', payment_record_id: 'synthetic-payment', operation: 'wadatrip:refund:synthetic-payment:v1' },
  };

  const result = await recordVerifiedRefund(prisma, 'synthetic-booking', refund);

  assert.equal(result.status, 'cancelled');
  assert.equal(payment.status, 'refunded');
  assert.deepEqual(notifications.map(row => row.audience).sort(), ['operator', 'traveler']);
  assert.ok(notifications.every(row => row.kind === 'cancelled' && row.booking_id === 'synthetic-booking'));
});
