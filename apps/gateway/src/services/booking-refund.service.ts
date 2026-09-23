import { ConflictException } from '@nestjs/common';
import { withPaymentBooking, financialAudit, assertPaymentOwnership } from '@wadatrip/common/payment-lifecycle';
import { CANCELLATION_POLICY_VERSION } from '@wadatrip/common/booking-policy';
import { refreshCapacity } from '@wadatrip/common/booking-capacity';
import { paymentObject } from './booking-payment.service';

const idOf = (value: any) => typeof value === 'string' ? value : value?.id;
const keyFor = (payment: any) => `wadatrip:refund:${payment.id}:v1`;

// Processor I/O always happens outside the listing-locked transaction.
export async function recordVerifiedRefund(prisma: any, bookingId: string, refund: any) {
  return withPaymentBooking(prisma, bookingId, async (tx, booking) => {
    const payment = await tx.paymentRecord.findUnique({ where: { booking_id: bookingId } });
    if (!payment?.refund_request_payload || !refund?.id || (payment.refund_id && payment.refund_id !== refund.id)
      || idOf(refund.payment_intent) !== payment.stripe_payment_intent_id
      || refund.amount !== payment.amount_gross_cents || refund.currency !== payment.currency
      || refund.metadata?.booking_id !== bookingId || refund.metadata?.payment_record_id !== payment.id
      || refund.metadata?.operation !== keyFor(payment)) throw new ConflictException('Refund association mismatch');
    await assertPaymentOwnership(tx, bookingId, { intentId: idOf(refund.payment_intent) });
    const failed = ['failed', 'canceled'].includes(refund.status);
    const succeeded = refund.status === 'succeeded';
    if (!failed && !succeeded && !['pending', 'requires_action'].includes(refund.status)) throw new ConflictException('Unknown refund status');
    // A refund can fail after initially succeeding. Keep that correction explicit.
    // Older pending/success responses must not undo a known terminal failure.
    if (payment.refund_status === 'failed' && !failed) return booking;
    if (payment.refund_status === 'succeeded' && !failed && !succeeded) return booking;
    const status = failed ? 'failed' : succeeded ? 'succeeded' : 'pending';
    await tx.paymentRecord.update({ where: { id: payment.id }, data: {
      refund_id: refund.id, refund_status: status, refund_lease_until: null,
      refund_next_attempt_at: succeeded || failed ? null : new Date(Date.now() + 60000),
      refund_error_category: failed ? 'processor_refund_failed' : refund.status === 'requires_action' ? 'processor_action_required' : null,
      status: succeeded ? 'refunded' : 'succeeded', resolution: succeeded ? null : 'refund_required',
      resolution_reason: 'cancellation_requested',
    } });
    const result = await tx.bookings.update({ where: { id: bookingId }, data: {
      status: succeeded ? 'cancelled' : 'reconciliation_required', payment_status: succeeded ? 'refunded' : 'paid', inventory_state: 'released',
    } });
    await refreshCapacity(tx, booking);
    financialAudit({ operation: 'refund_observed', booking_id: bookingId, payment_record_id: payment.id,
      processor: 'stripe', refund_id: refund.id, idempotency_key: keyFor(payment), result: status, inventory_action: 'RELEASE' });
    return result;
  });
}

export async function syncAutomaticRefund(prisma: any, stripe: any, bookingId: string) {
  const payment = await prisma.paymentRecord.findUnique({ where: { booking_id: bookingId } });
  if (!payment?.refund_id) return null;
  const refund = await stripe.refunds.retrieve(payment.refund_id);
  return recordVerifiedRefund(prisma, bookingId, refund);
}

export async function runAutomaticRefund(prisma: any, stripe: any, bookingId: string) {
  const claim = await withPaymentBooking(prisma, bookingId, async (tx, booking) => {
    const p = await tx.paymentRecord.findUnique({ where: { booking_id: bookingId } });
    if (!p || booking.booking_terms?.version !== CANCELLATION_POLICY_VERSION || booking.cancellation_refund_due !== true
      || !booking.cancellation_requested_at || p.resolution !== 'refund_required'
      || ['failed', 'review_required', 'succeeded'].includes(p.refund_status)) return null;
    if (p.refund_lease_until && +new Date(p.refund_lease_until) > Date.now()) return null;
    if (p.refund_next_attempt_at && +new Date(p.refund_next_attempt_at) > Date.now()) return null;
    if (p.processor !== 'stripe' || p.status !== 'succeeded' || !Number.isSafeInteger(p.amount_gross_cents)
      || p.amount_gross_cents <= 0 || p.amount_gross_cents !== booking.amount_cents
      || p.amount_charged_cents !== p.amount_gross_cents || p.charged_currency !== p.currency
      || p.currency !== booking.currency || !p.stripe_payment_intent_id || !p.flow
      || p.stripe_payment_intent_id !== booking.payment_intent_id) {
      await tx.paymentRecord.update({ where: { id: p.id }, data: { refund_status: 'review_required', refund_error_category: 'financial_evidence_incomplete' } });
      return null;
    }
    if (!p.refund_id && p.refund_first_attempt_at && Date.now() - +new Date(p.refund_first_attempt_at) >= 23 * 3600000) {
      await tx.paymentRecord.update({ where: { id: p.id }, data: { refund_status: 'review_required', refund_error_category: 'idempotency_window_elapsed' } });
      return null; // Never replay an uncertain POST after processor key retention.
    }
    const connect = p.request_payload?.payment_intent_data;
    const payload = p.refund_request_payload || { payment_intent: p.stripe_payment_intent_id,
      amount: p.amount_gross_cents,
      ...(connect?.transfer_data?.destination ? { reverse_transfer: true, ...(connect.application_fee_amount > 0 ? { refund_application_fee: true } : {}) } : {}),
      metadata: { booking_id: bookingId, payment_record_id: p.id, operation: keyFor(p) } };
    return tx.paymentRecord.update({ where: { id: p.id }, data: {
      refund_request_payload: payload, refund_status: 'processing', refund_attempts: (p.refund_attempts || 0) + 1,
      refund_first_attempt_at: p.refund_first_attempt_at || new Date(), refund_lease_until: new Date(Date.now() + 120000),
    } });
  });
  if (!claim) return null;
  try {
    if (claim.refund_id) return await syncAutomaticRefund(prisma, stripe, bookingId);
    // Verify persisted booking/ledger/external associations before any refund mutation.
    const object = await paymentObject(prisma, stripe, claim);
    const intent = claim.flow === 'intent' ? object : object.payment_intent;
    if (intent?.id !== claim.stripe_payment_intent_id || intent.status !== 'succeeded'
      || intent.amount_received !== claim.amount_gross_cents || intent.currency !== claim.currency
      || idOf(intent.transfer_data?.destination) !== idOf(claim.request_payload?.payment_intent_data?.transfer_data?.destination)) {
      throw new ConflictException('Refund financial association mismatch');
    }
    const prior = await stripe.refunds.list({ payment_intent: intent.id, limit: 100 });
    if (prior.has_more || prior.data.some((r: any) => r.metadata?.operation !== keyFor(claim))) {
      throw new ConflictException('Existing external refunds require review');
    }
    if (prior.data.length > 1) throw new ConflictException('Ambiguous external refund operation');
    const refund = prior.data[0] || await stripe.refunds.create(claim.refund_request_payload, { idempotencyKey: keyFor(claim) });
    // Persist the external ID/status together with business state; retries recover via the same key/list.
    return await recordVerifiedRefund(prisma, bookingId, refund);
  } catch (error: any) {
    const review = error.getStatus?.() === 409 || ['charge_already_refunded', 'refund_amount_invalid'].includes(error.code);
    await withPaymentBooking(prisma, bookingId, async (tx) => {
      const current = await tx.paymentRecord.findUnique({ where: { booking_id: bookingId } });
      if (current.refund_status !== 'processing' || current.refund_attempts !== claim.refund_attempts) return;
      await tx.paymentRecord.update({ where: { id: current.id }, data: {
        refund_status: review ? 'review_required' : 'requested', refund_lease_until: null,
        refund_next_attempt_at: new Date(Date.now() + 60000), refund_error_category: review ? 'refund_evidence_conflict' : 'refund_result_uncertain',
      } });
    });
    financialAudit({ operation: 'refund_attempt', booking_id: bookingId, payment_record_id: claim.id,
      idempotency_key: keyFor(claim), processor: 'stripe', result: review ? 'review_required' : 'retryable', error_category: 'refund_not_confirmed' });
    return null;
  }
}
