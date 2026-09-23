import { BadRequestException, ConflictException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { available, lockedListing, refreshCapacity } from './booking-capacity';
import { validateBookingPrice } from './booking-price';
import { financialState } from './financial-state';
import { bookingTransition, inventoryState } from './booking-transition';
import { receivePaymentEvent, failPaymentEvent } from './payment-events';
import { assertPaymentOwnership } from './payment-association';
import { financialAudit } from './financial-audit';
import { requirePaymentBeforeCutoff } from './booking-policy';
export { financialAudit } from './financial-audit';
export { assertPaymentOwnership } from './payment-association';
export { receivePaymentEvent, failPaymentEvent } from './payment-events';

export type PaymentObservation = {
  bookingId: string; paymentId?: string; intentId?: string; sessionId?: string;
  outcome: 'pending' | 'succeeded' | 'failed' | 'refunded' | 'partial_refund';
  amount: number; currency: string;
};

export async function withPaymentBooking(prisma: any, id: string, fn: (tx: any, booking: any, listing: any) => Promise<any>, eventId?: string) {
  return prisma.$transaction(async (tx: any) => {
    // Global order: event (when present), then listing, then booking/payment/inventory.
    if (eventId) await tx.$queryRaw`SELECT id FROM "PaymentEvent" WHERE id = ${eventId} FOR UPDATE`;
    const initial = await tx.bookings.findUnique({ where: { id } });
    if (!initial) throw new BadRequestException('booking not found');
    const listing = await lockedListing(tx, initial.listing_id);
    const booking = await tx.bookings.findUnique({ where: { id }, include: { listing: true, provider: true } });
    return fn(tx, booking, listing);
  }, { isolationLevel: 'ReadCommitted' });
}

// One immutable external operation per booking. No browser-supplied financial parameters.
export async function preparePayment(prisma: any, id: string, flow: 'checkout' | 'intent',
  parameters: (booking: any, paymentId: string) => any) {
  const result = await withPaymentBooking(prisma, id, async (tx, booking, listing) => {
    requirePaymentBeforeCutoff(booking);
    const price = validateBookingPrice(booking);
    if (price.amount < 50) throw new BadRequestException('Free or below-minimum bookings do not require supported payment');
    const existing = await tx.paymentRecord.findUnique({ where: { booking_id: id } });
    if (existing) {
      if (existing.flow !== flow || existing.status !== 'pending' || existing.resolution || booking.status !== 'payment_pending') {
        throw new ConflictException('This booking already has a payment flow; reconcile its status');
      }
      return existing;
    }
    if (booking.status !== 'pending' || booking.checkout_session_id != null || booking.payment_intent_id != null
      || financialState(booking.payment_status) !== 'pending') {
      throw new ConflictException('Booking cannot start another payment; reconcile existing payment');
    }
    await available(tx, listing, booking.date, booking.num_people, id);
    const paymentId = randomUUID();
    const request = parameters(booking, paymentId);
    const fee = request.payment_intent_data?.application_fee_amount || 0;
    const payment = await tx.paymentRecord.create({ data: {
      id: paymentId, booking_id: id, provider_id: booking.provider_id,
      amount_gross_cents: price.amount, commission_cents: fee,
      amount_net_cents: price.amount - fee, currency: price.currency,
      processor: 'stripe', flow, request_payload: request, status: 'pending',
    } });
    await tx.bookings.update({ where: { id }, data: { status: 'payment_pending', payment_status: 'unpaid' } });
    return payment;
  });
  financialAudit({ operation: 'payment_prepared', booking_id: id, payment_record_id: result.id, processor: result.processor,
    idempotency_key: `wadatrip:payment:${result.id}:${result.flow}:v1`, new_booking_state: 'payment_pending',
    new_payment_state: result.status, inventory_action: 'KEEP', expected_amount_cents: result.amount_gross_cents,
    expected_currency: result.currency, result: 'committed' });
  return result;
}

export async function attachPaymentObject(prisma: any, payment: any, external: { intentId?: string; sessionId?: string }) {
  return withPaymentBooking(prisma, payment.booking_id, async (tx, booking) => {
    await assertPaymentOwnership(tx, booking.id, external);
    const current = await tx.paymentRecord.findUnique({ where: { booking_id: booking.id } });
    if (current.id !== payment.id || (external.intentId && current.stripe_payment_intent_id && current.stripe_payment_intent_id !== external.intentId)
      || (external.sessionId && current.stripe_checkout_session_id && current.stripe_checkout_session_id !== external.sessionId)) {
      throw new ConflictException('Payment identity mismatch');
    }
    await tx.paymentRecord.update({ where: { id: current.id }, data: {
      ...(external.intentId ? { stripe_payment_intent_id: external.intentId } : {}),
      ...(external.sessionId ? { stripe_checkout_session_id: external.sessionId } : {}),
    } });
    await tx.bookings.update({ where: { id: booking.id }, data: {
      ...(external.intentId ? { payment_intent_id: external.intentId } : {}),
      ...(external.sessionId ? { checkout_session_id: external.sessionId } : {}),
    } });
    return booking;
  });
}

export async function markPaymentUncertain(prisma: any, bookingId: string) {
  return withPaymentBooking(prisma, bookingId, async (tx) => {
    const record = await tx.paymentRecord.findUnique({ where: { booking_id: bookingId } });
    if (record?.status === 'pending') await tx.paymentRecord.update({ where: { id: record.id }, data: { resolution: 'reconciliation_required' } });
    // Keep payment_pending/cancellation_pending capacity. Unknown is not cancelled.
  });
}

// Called only with verified processor observations. Domain state is decided here, not by Stripe.
export async function applyPaymentObservation(prisma: any, eventId: string, type: string, observation: PaymentObservation, received = false) {
  if (!received && !await receivePaymentEvent(prisma, eventId, type, observation)) return null;
  let audit: Record<string, unknown> | undefined;
  try { const result = await withPaymentBooking(prisma, observation.bookingId, async (tx, booking, listing) => {
    if ((await tx.paymentEvent.findUnique({ where: { id: eventId } }))?.processed_at) return booking;
    let o = observation;
    if (!Number.isSafeInteger(o.amount) || o.amount < 0 || !/^[a-z]{3}$/.test(o.currency)) {
      throw new BadRequestException('Invalid observed financial amount or currency');
    }
    await assertPaymentOwnership(tx, booking.id, o);
    await tx.paymentEvent.update({ where: { id: eventId }, data: { payload: o, booking_id: booking.id } });
    let payment = await tx.paymentRecord.findUnique({ where: { booking_id: booking.id } });
    if (!payment) {
      // Legacy event: record the real financial result, but never create a new external payment.
      payment = await tx.paymentRecord.create({ data: {
        booking_id: booking.id, provider_id: booking.provider_id, processor: 'stripe',
        amount_gross_cents: Number.isSafeInteger(booking.amount_cents) && booking.amount_cents >= 0 ? booking.amount_cents : null,
        commission_cents: booking.commission_cents ?? null,
        amount_net_cents: booking.operator_share_cents ?? null,
        currency: booking.currency?.toLowerCase() || null, status: financialState(booking.payment_status),
      } });
    }
    const persistedReference = (o.intentId && [booking.payment_intent_id, payment.stripe_payment_intent_id].includes(o.intentId))
      || (o.sessionId && [booking.checkout_session_id, payment.stripe_checkout_session_id].includes(o.sessionId));
    const bookingMoney = financialState(booking.payment_status), ledgerMoney = financialState(payment.status);
    if ((bookingMoney === 'succeeded' && ['pending', 'failed'].includes(ledgerMoney))
      || (bookingMoney === 'refunded' && ledgerMoney !== 'refunded')) {
      throw new ConflictException('Contradictory historical financial evidence requires investigation');
    }
    // A charge can look refunded while an asynchronous refund is still pending or has failed.
    // Automated refunds settle only from their own verified processor status.
    if (o.outcome === 'refunded' && payment.refund_status && payment.refund_status !== 'succeeded') {
      o = { ...o, outcome: 'succeeded' };
    }
    const persistedRequest = payment.flow && o.paymentId === payment.id
      && payment.request_payload?.metadata?.booking_id === booking.id
      && payment.request_payload?.metadata?.payment_record_id === payment.id;
    const identityMismatch = ((o.intentId || o.sessionId) && !persistedReference && !persistedRequest)
      || (o.paymentId && payment.flow && o.paymentId !== payment.id)
      || (booking.payment_intent_id != null && o.intentId && booking.payment_intent_id !== o.intentId)
      || (booking.checkout_session_id != null && o.sessionId && booking.checkout_session_id !== o.sessionId)
      || (payment.stripe_payment_intent_id && o.intentId && payment.stripe_payment_intent_id !== o.intentId)
      || (payment.stripe_checkout_session_id && o.sessionId && payment.stripe_checkout_session_id !== o.sessionId);
    const mismatch = identityMismatch || o.amount !== payment.amount_gross_cents || o.currency !== payment.currency?.toLowerCase();
    const ids = {
      ...(!payment.stripe_payment_intent_id && o.intentId ? { stripe_payment_intent_id: o.intentId } : {}),
      ...(!payment.stripe_checkout_session_id && o.sessionId ? { stripe_checkout_session_id: o.sessionId } : {}),
    };
    const money = ['succeeded', 'refunded', 'partial_refund'].includes(o.outcome);
    let capacityValid = false;
    if (!mismatch && ['succeeded', 'partial_refund'].includes(o.outcome) && inventoryState(booking) === 'held') {
      if (booking.status === 'completed' || (booking.status === 'confirmed' && financialState(payment.status) === 'succeeded')) capacityValid = true;
      else try { await available(tx, listing, booking.date, booking.num_people, booking.id, true); capacityValid = true; }
      catch (error: any) { if (![400, 409].includes(error.getStatus?.())) throw error; }
    }
    const transition = bookingTransition(booking, payment,
      identityMismatch ? 'association_mismatch' : o.outcome === 'refunded' ? 'refunded' : mismatch ? 'financial_mismatch' : o.outcome, capacityValid);
    // A mismatched amount on the canonical transaction still records real money.
    if (mismatch && !identityMismatch && money) transition.financial = o.outcome === 'refunded' || financialState(payment.status) === 'refunded' ? 'refunded' : 'succeeded';
    const paymentStatus = transition.financial === 'succeeded' ? 'paid' : transition.financial === 'pending' ? 'unpaid' : transition.financial;
    audit = { operation: type, event_id: eventId, booking_id: booking.id, payment_record_id: payment.id, processor: payment.processor,
      idempotency_key: payment.flow ? `wadatrip:payment:${payment.id}:${payment.flow}:v1` : undefined,
      payment_intent_id: o.intentId, checkout_session_id: o.sessionId,
      previous_booking_state: booking.status, new_booking_state: transition.status,
      previous_payment_state: payment.status, new_payment_state: transition.financial, inventory_action: transition.inventory,
      expected_amount_cents: payment.amount_gross_cents, expected_currency: payment.currency,
      observed_amount_cents: o.amount, observed_currency: o.currency, result: 'committed' };
    await tx.paymentRecord.update({ where: { id: payment.id }, data: {
      ...(!identityMismatch ? ids : {}), status: transition.financial, resolution: transition.resolution, resolution_reason: transition.reason,
      ...(!identityMismatch && money ? { amount_charged_cents: o.amount, charged_currency: o.currency } : {}),
    } });
    const result = await tx.bookings.update({ where: { id: booking.id }, data: {
      status: transition.status, payment_status: paymentStatus,
      inventory_state: transition.inventory === 'RELEASE' ? 'released' : inventoryState(booking),
      ...(!identityMismatch && o.intentId ? { payment_intent_id: o.intentId } : {}),
      ...(!identityMismatch && o.sessionId ? { checkout_session_id: o.sessionId } : {}),
    } });
    await refreshCapacity(tx, booking);
    await tx.paymentEvent.update({ where: { id: eventId }, data: { processed_at: new Date(), status: 'processed', error_category: null,
      payment_record_id: payment.id, payload: { ...o, transition: audit } } });
    return result;
  }, eventId);
    if (audit) financialAudit(audit);
    return result;
  } catch (error) {
    await failPaymentEvent(prisma, eventId, error);
    throw error;
  }
}
