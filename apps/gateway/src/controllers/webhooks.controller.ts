import { Controller, Post, Req, UnauthorizedException } from '@nestjs/common';
import { getPrisma } from '@wadatrip/db';

@Controller('webhooks')
export class WebhooksController {
  @Post('stripe')
  async stripeWebhook(@Req() req: any) {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret || !req.headers['stripe-signature']) throw new UnauthorizedException('signed webhook required');
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

      }
    } catch (e: any) {
      console.error('❌ Webhook signature verification failed:', e.message);
      throw new UnauthorizedException('invalid signature');
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

    const prisma = getPrisma() as any;

    try {
      if (type === 'checkout.session.completed') {
        await prisma.bookings.update({
          where: { id: String(bookingId) },
          data: {
            checkout_session_id: data?.id ? String(data.id) : undefined,
            payment_intent_id: data?.payment_intent ? String(data.payment_intent) : undefined,
          },
        }).catch(() => {});
      }

      if (type === 'payment_intent.succeeded') {
        await prisma.bookings.update({
          where: { id: String(bookingId) },
          data: {
            payment_intent_id: data?.id ? String(data.id) : undefined,
          },
        }).catch(() => {});
      }

      if (type === 'checkout.session.completed' || type === 'payment_intent.succeeded') {
        await prisma.bookings.update({ where: { id: String(bookingId) }, data: { status: 'confirmed', payment_status: 'paid' } });
      } else if (
        type === 'payment_intent.payment_failed' ||
        type === 'charge.refunded' ||
        type === 'refund.updated'
      ) {
        await prisma.bookings.update({
          where: { id: String(bookingId) },
          data: {
            status: 'cancelled',
            payment_status: type === 'payment_intent.payment_failed' ? 'failed' : 'refunded',
          },
        });
      }
    } catch (err: any) {
      console.error('❌ Error al actualizar booking en HUB:', err.message);
    }

    return { ok: true };
  }
}
