import { Controller, Post, Req, UnauthorizedException } from '@nestjs/common';
import { getPrisma } from '@wadatrip/db';
import { handleStripeEvent } from '../services/booking-payment.service';
import { financialAudit } from '@wadatrip/common/payment-lifecycle';

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
      financialAudit({ operation: 'webhook_signature', processor: 'stripe', result: 'rejected', error_category: 'invalid_signature' });
      throw new UnauthorizedException('invalid signature');
    }

    const stripe = new (require('stripe'))(
      process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET,
      { apiVersion: '2024-06-20' },
    );
    return handleStripeEvent(getPrisma(), stripe, event);
  }
}
