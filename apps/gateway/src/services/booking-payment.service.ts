import { ConflictException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { syncAutomaticRefund } from './booking-refund.service';
import { applyPaymentObservation, attachPaymentObject, markPaymentUncertain, PaymentObservation, receivePaymentEvent, failPaymentEvent, assertPaymentOwnership, financialAudit } from '@wadatrip/common/payment-lifecycle';

const externalId = (value: any): string | undefined => typeof value === 'string' ? value : value?.id;

function verifyExternalAssociation(booking: any, payment: any, flow: string, object: any) {
  if (!booking || (payment && (payment.booking_id !== booking.id || payment.processor !== 'stripe'))
    || (payment?.flow && payment.flow !== flow)) throw new ConflictException('Payment flow association mismatch');
  const key = flow === 'checkout' ? 'checkout_session_id' : 'payment_intent_id';
  const recordId = payment?.[`stripe_${key}`], bookingId = booking[key];
  if (!object?.id || (!recordId && !bookingId) || (recordId != null && recordId !== object.id)
    || (bookingId != null && bookingId !== object.id)) throw new ConflictException('External payment reference mismatch');
  const metadata = object.metadata || {};
  if ((metadata.booking_id && metadata.booking_id !== booking.id)
    || (metadata.payment_record_id && payment && metadata.payment_record_id !== payment.id)) {
    throw new ConflictException('Payment association mismatch');
  }
  if (flow === 'checkout' && object.payment_intent) {
    const intentId = externalId(object.payment_intent);
    if ((payment?.stripe_payment_intent_id && payment.stripe_payment_intent_id !== intentId)
      || (booking.payment_intent_id && booking.payment_intent_id !== intentId)) throw new ConflictException('Checkout intent association mismatch');
    const intentMetadata = typeof object.payment_intent === 'object' ? object.payment_intent.metadata : null;
    if ((intentMetadata?.booking_id && intentMetadata.booking_id !== booking.id)
      || (intentMetadata?.payment_record_id && payment && intentMetadata.payment_record_id !== payment.id)) throw new ConflictException('Checkout intent ownership mismatch');
  }
}

// Replaying creation uses identical persisted parameters and the same key. Never replay
// beyond Stripe's minimum idempotency retention: uncertainty then requires manual review.
export async function paymentObject(prisma: any, stripe: any, payment: any) {
  const verify = async (object: any) => {
    if (payment.flow === 'checkout' && typeof object.payment_intent === 'string') {
      object.payment_intent = await stripe.paymentIntents.retrieve(object.payment_intent, { expand: ['latest_charge'] });
    }
    const booking = await prisma.bookings.findUnique({ where: { id: payment.booking_id } });
    const current = await prisma.paymentRecord.findUnique({ where: { booking_id: payment.booking_id } });
    verifyExternalAssociation(booking, current, payment.flow, object);
    await assertPaymentOwnership(prisma, payment.booking_id, payment.flow === 'checkout'
      ? { sessionId: object.id, intentId: externalId(object.payment_intent) } : { intentId: object.id });
    return object;
  };
  if (payment.flow === 'checkout' && payment.stripe_checkout_session_id) {
    return verify(await stripe.checkout.sessions.retrieve(payment.stripe_checkout_session_id, { expand: ['payment_intent.latest_charge'] }));
  }
  if (payment.flow === 'intent' && payment.stripe_payment_intent_id) {
    return verify(await stripe.paymentIntents.retrieve(payment.stripe_payment_intent_id, { expand: ['latest_charge'] }));
  }
  if (payment.status !== 'pending' || !payment.request_payload || !['checkout', 'intent'].includes(payment.flow)
    || Date.now() - +new Date(payment.created_at) >= 23 * 60 * 60 * 1000) {
    await markPaymentUncertain(prisma, payment.booking_id);
    throw new ConflictException('Payment creation outcome requires manual reconciliation; seats remain reserved');
  }
  const options = { idempotencyKey: `wadatrip:payment:${payment.id}:${payment.flow}:v1` };
  const audit = { booking_id: payment.booking_id, payment_record_id: payment.id, processor: 'stripe',
    idempotency_key: options.idempotencyKey, operation: 'processor_create', expected_amount_cents: payment.amount_gross_cents, expected_currency: payment.currency };
  financialAudit({ ...audit, result: 'requested' });
  let object: any;
  try {
    object = payment.flow === 'checkout'
      ? await stripe.checkout.sessions.create(payment.request_payload, options)
      : await stripe.paymentIntents.create(payment.request_payload, options);
  } catch (error) {
    financialAudit({ ...audit, result: 'uncertain', error_category: 'processor_request_failure' });
    throw error;
  }
  if (object.metadata?.booking_id !== payment.booking_id || object.metadata?.payment_record_id !== payment.id) {
    throw new ConflictException('Created payment does not match its persisted request');
  }
  await attachPaymentObject(prisma, payment, payment.flow === 'checkout'
    ? { sessionId: object.id, intentId: externalId(object.payment_intent) } : { intentId: object.id });
  financialAudit({ ...audit, result: 'attached', ...(payment.flow === 'checkout' ? { checkout_session_id: object.id } : { payment_intent_id: object.id }) });
  return verify(object);
}

export async function observeStripeObject(stripe: any, flow: 'checkout' | 'intent', object: any): Promise<PaymentObservation> {
  let intent = flow === 'intent' ? object : object.payment_intent;
  if (typeof intent === 'string') intent = await stripe.paymentIntents.retrieve(intent, { expand: ['latest_charge'] });
  let charge = intent?.latest_charge;
  if (typeof charge === 'string') charge = await stripe.charges.retrieve(charge);
  const metadata = intent?.metadata || object.metadata || {};
  const bookingId = metadata.booking_id || object.metadata?.booking_id || object.client_reference_id;
  if (!bookingId) throw new ConflictException('Payment is missing booking association');
  let outcome: PaymentObservation['outcome'] = 'pending';
  if (intent?.status === 'succeeded' || (flow === 'checkout' && object.payment_status === 'paid')) outcome = 'succeeded';
  if (charge?.refunded === true) outcome = 'refunded';
  else if (charge?.amount_refunded > 0) outcome = 'partial_refund';
  // payment_failed / requires_payment_method are retryable, not proof of cancellation.
  if (outcome === 'pending' && (intent?.status === 'canceled'
    || (flow === 'checkout' && object.status === 'expired' && (!intent || intent.status === 'canceled')))) outcome = 'failed';
  return {
    bookingId: String(bookingId), paymentId: metadata.payment_record_id || object.metadata?.payment_record_id,
    ...(intent?.id ? { intentId: intent.id } : {}), ...(flow === 'checkout' ? { sessionId: object.id } : {}),
    outcome, amount: outcome === 'succeeded' || outcome === 'refunded' || outcome === 'partial_refund'
      ? (intent?.amount_received ?? object.amount_total) : (intent?.amount ?? object.amount_total),
    currency: String(intent?.currency || object.currency || '').toLowerCase(),
  };
}

// On-demand recovery: no scheduler, queue, or clock-based inventory release.
export async function reconcileBookingPayment(prisma: any, stripe: any, bookingId: string) {
  let booking = await prisma.bookings.findUnique({ where: { id: bookingId } });
  const payment = await prisma.paymentRecord.findUnique({ where: { booking_id: bookingId } });
  if (!booking) throw new ConflictException('Booking not found');
  for (const id of [booking.checkout_session_id, booking.payment_intent_id, payment?.stripe_checkout_session_id, payment?.stripe_payment_intent_id]) {
    if (id != null && (typeof id !== 'string' || !id.trim())) throw new ConflictException('Empty historical external reference requires investigation');
  }
  const sessionId = payment?.stripe_checkout_session_id || booking.checkout_session_id;
  const intentId = payment?.stripe_payment_intent_id || booking.payment_intent_id;
  if (!payment && !sessionId && !intentId) return booking;
  if (!payment?.flow && !sessionId && !intentId) throw new ConflictException('Historical payment has no recoverable external reference');
  const flow = payment?.flow || (sessionId ? 'checkout' : 'intent');
  let object = payment?.flow ? await paymentObject(prisma, stripe, payment)
    : flow === 'checkout'
      ? await stripe.checkout.sessions.retrieve(sessionId, { expand: ['payment_intent.latest_charge'] })
      : await stripe.paymentIntents.retrieve(intentId, { expand: ['latest_charge'] });
  if (flow === 'checkout' && typeof object.payment_intent === 'string') {
    object.payment_intent = await stripe.paymentIntents.retrieve(object.payment_intent, { expand: ['latest_charge'] });
  }
  booking = await prisma.bookings.findUnique({ where: { id: bookingId } });
  verifyExternalAssociation(booking, await prisma.paymentRecord.findUnique({ where: { booking_id: bookingId } }), flow, object);
  await assertPaymentOwnership(prisma, bookingId, flow === 'checkout'
    ? { sessionId: object.id, intentId: externalId(object.payment_intent) } : { intentId: object.id });
  if (booking.status === 'cancellation_pending') {
    try {
      if (flow === 'checkout' && object.status === 'open') {
        await stripe.checkout.sessions.expire(object.id, {}, { idempotencyKey: `wadatrip:expire:${object.id}` });
      } else if (flow === 'intent' && !['succeeded', 'canceled'].includes(object.status)) {
        await stripe.paymentIntents.cancel(object.id, {}, { idempotencyKey: `wadatrip:cancel:${object.id}` });
      }
    } catch {
      // Expiration can lose the race to payment. Retrieve; never infer failure from an exception.
    }
    object = flow === 'checkout'
      ? await stripe.checkout.sessions.retrieve(object.id, { expand: ['payment_intent.latest_charge'] })
      : await stripe.paymentIntents.retrieve(object.id, { expand: ['latest_charge'] });
  }
  verifyExternalAssociation(booking, await prisma.paymentRecord.findUnique({ where: { booking_id: bookingId } }), flow, object);
  const observation = await observeStripeObject(stripe, flow, object);
  if (observation.bookingId !== bookingId) throw new ConflictException('Payment association mismatch');
  return applyPaymentObservation(prisma, `reconcile:${randomUUID()}`, 'processor.reconciled', observation);
}

export async function handleStripeEvent(prisma: any, stripe: any, event: any) {
  if (!event?.id) throw new ConflictException('Missing payment event ID');
  if (!await receivePaymentEvent(prisma, event.id, event.type, { external_id: String(event.data?.object?.id || '') })) return { ok: true };
  try {
  const data = event.data?.object;
  let flow: 'checkout' | 'intent', object: any;
  if (event.type.startsWith('checkout.session.')) {
    flow = 'checkout'; object = await stripe.checkout.sessions.retrieve(data.id, { expand: ['payment_intent.latest_charge'] });
  } else if (event.type.startsWith('payment_intent.')) {
    flow = 'intent'; object = await stripe.paymentIntents.retrieve(data.id, { expand: ['latest_charge'] });
  } else if (['charge.refunded', 'refund.updated', 'refund.created', 'refund.failed'].includes(event.type)) {
    flow = 'intent';
    const intentId = externalId(data.payment_intent);
    if (!intentId) throw new ConflictException('Refund event missing payment association');
    object = await stripe.paymentIntents.retrieve(intentId, { expand: ['latest_charge'] });
  } else {
    await prisma.paymentEvent.update({ where: { id: event.id }, data: { status: 'processed', processed_at: new Date() } });
    return { ok: true, ignored: true };
  }
  // The existing itinerary payment integration is outside this booking lifecycle.
  if (object.metadata?.itinerary_id && !object.metadata?.booking_id) {
    await prisma.paymentEvent.update({ where: { id: event.id }, data: { status: 'processed', processed_at: new Date() } });
    return { ok: true, ignored: true };
  }
  const observation = await observeStripeObject(stripe, flow, object);
  await syncAutomaticRefund(prisma, stripe, observation.bookingId);
  await applyPaymentObservation(prisma, event.id, event.type, observation, true);
  return { ok: true };
  } catch (error) { await failPaymentEvent(prisma, event.id, error); throw error; }
}
