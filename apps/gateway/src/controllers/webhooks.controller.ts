import { Controller, Post, Req } from '@nestjs/common';
import axios from 'axios';

@Controller('webhooks')
export class WebhooksController {
  @Post('stripe')
  async stripeWebhook(@Req() req: any) {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    let event: any;

    try {
      if (secret && req.headers['stripe-signature']) {
        const stripe = new (require('stripe'))(
          process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET,
          { apiVersion: '2024-06-20' }
        );

        // ⚡ Usamos rawBody (Buffer) que llega gracias a express.raw()
        const rawBody = req.body;
        event = stripe.webhooks.constructEvent(
          rawBody,
          String(req.headers['stripe-signature']),
          secret
        );
      } else {
        // fallback en dev si no se pasa firma
        event = req.body;
      }
    } catch (e: any) {
      console.error('❌ Webhook signature verification failed:', e.message);
      return { ok: false, error: 'invalid_signature' };
    }

    const type = event?.type;
    const data = event?.data?.object || {};

    // 🔎 Intento inicial de sacar bookingId
    let bookingId =
      data?.metadata?.booking_id ||
      data?.client_reference_id ||
      null;

    // ⚡ Fallback: si es refund/charge, buscar PaymentIntent original
    if (!bookingId && data?.payment_intent) {
      try {
        const stripe = new (require('stripe'))(
          process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET,
          { apiVersion: '2024-06-20' }
        );
        const pi = await stripe.paymentIntents.retrieve(data.payment_intent);
        bookingId = pi?.metadata?.booking_id || null;
      } catch (err: any) {
        console.error('❌ No se pudo recuperar PaymentIntent:', err.message);
      }
    }

    console.log('🎯 Stripe webhook recibido:', type, 'para booking', bookingId);

    if (!bookingId) return { ok: true, ignored: true };

    const HUB = process.env.PROVIDER_HUB_URL || 'http://localhost:3014';
    const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';

    try {
      if (type === 'checkout.session.completed' || type === 'payment_intent.succeeded') {
        await axios.post(
          `${HUB}/bookings/${bookingId}/status`,
          { status: 'confirmed', payment_status: 'paid' },
          { headers: { 'x-internal-service-token': INTERNAL_TOKEN } },
        );
      } else if (
        type === 'payment_intent.payment_failed' ||
        type === 'charge.refunded' ||
        type === 'refund.updated'
      ) {
        await axios.post(
          `${HUB}/bookings/${bookingId}/status`,
          {
            status: 'cancelled',
            payment_status: type === 'payment_intent.payment_failed' ? 'failed' : 'refunded',
          },
          { headers: { 'x-internal-service-token': INTERNAL_TOKEN } },
        );
      }
    } catch (err: any) {
      console.error('❌ Error al actualizar booking en HUB:', err.message);
    }

    return { ok: true };
  }
}
