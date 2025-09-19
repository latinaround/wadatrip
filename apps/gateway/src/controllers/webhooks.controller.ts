import { Controller, Post, Req } from '@nestjs/common';
import axios from 'axios';

@Controller('webhooks')
export class WebhooksController {
  @Post('stripe')
  async stripeWebhook(@Req() req: any) {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    const payload = req.body;

    // En dev, si no hay secret, aceptamos payload sin verificar
    let event: any = payload;
    if (secret && req.headers['stripe-signature']) {
      try {
        const stripe = new (require('stripe'))(process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET, { apiVersion: '2024-06-20' });
        const rawBody = (req as any).rawBody || JSON.stringify(payload);
        event = stripe.webhooks.constructEvent(rawBody, String(req.headers['stripe-signature']), secret);
      } catch (e) {
        return { ok: false, error: 'invalid_signature' };
      }
    }

    const type = event?.type;
    const data = event?.data?.object || {};
    const bookingId = data?.metadata?.booking_id || data?.client_reference_id || null;

    if (!bookingId) return { ok: true, ignored: true };

    const HUB = process.env.PROVIDER_HUB_URL || 'http://127.0.0.1:3014';

    try {
      if (type === 'checkout.session.completed' || type === 'payment_intent.succeeded') {
        await axios.post(`${HUB}/bookings/${bookingId}/status`, { status: 'confirmed' });
        // TODO: actualizar payment_status a 'paid' cuando exista endpoint dedicado
      } else if (type === 'payment_intent.payment_failed' || type === 'charge.refunded') {
        await axios.post(`${HUB}/bookings/${bookingId}/status`, { status: 'cancelled' });
        // TODO: actualizar payment_status a 'failed'/'refunded'
      }
    } catch {}

    // TODO: enviar emails a user/provider (notificador dev)
    return { ok: true };
  }
}

