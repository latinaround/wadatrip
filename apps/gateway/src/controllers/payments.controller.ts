import { Controller, Post, Param, Body, NotFoundException, BadRequestException } from '@nestjs/common';
import axios from 'axios';

const ENABLED = (process.env.FF_PROVIDER_HUB || 'false').toLowerCase() === 'true';
function ensureEnabled() { if (!ENABLED) throw new NotFoundException(); }

// Minimal Stripe wrapper (optional at runtime)
function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET;
  if (!key) return null;
  try { return new (require('stripe'))(key, { apiVersion: '2024-06-20' }); } catch { return null; }
}

@Controller('payments')
export class PaymentsController {
  @Post('connect/:providerId/link')
  async connectLink(@Param('providerId') providerId: string) {
    ensureEnabled();
    const stripe = getStripe();
    // Fetch provider to get/set stripe_account_id
    const HUB = process.env.PROVIDER_HUB_URL || 'http://127.0.0.1:3014';
    const { data: provider } = await axios.get(`${HUB}/providers/${providerId}`);

    if (!stripe) {
      // Fallback mock link in dev
      return { url: `https://connect.stripe.com/express_onboarding/${providerId}` };
    }

    let accountId = provider.stripe_account_id;
    if (!accountId) {
      const acct = await stripe.accounts.create({ type: 'express', email: provider.email, country: provider.country_code || 'US' });
      accountId = acct.id;
      // store on provider via a verify-like path (or add a dedicated endpoint in hub)
      await axios.post(`${HUB}/providers/${providerId}/verify`, { status: provider.status, documents: [], stripe_account_id: accountId }).catch(() => {});
    }
    const link = await stripe.accountLinks.create({ account: accountId, refresh_url: process.env.CONNECT_REFRESH_URL || 'https://example.com/reauth', return_url: process.env.CONNECT_RETURN_URL || 'https://example.com/return', type: 'account_onboarding' });
    return { url: link.url };
  }

  @Post('create-intent')
  async createIntent(@Body() body: any) {
    const amount = Math.trunc(Number(body?.amount || 0));
    if (!amount || amount < 1) {
      throw new BadRequestException('amount must be greater than 0');
    }
    const currency = (body?.currency || 'usd').toLowerCase();
    const description = body?.description;
    const stripe = getStripe();
    const amountCents = Math.max(50, amount);
    if (!stripe) {
      return { clientSecret: `pi_mock_${Date.now()}`, mock: true, amount: amountCents, currency };
    }
    const intent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency,
      description,
      automatic_payment_methods: { enabled: true },
    });
    return { clientSecret: intent.client_secret };
  }

  @Post('bookings/:id/checkout')
  async checkout(@Param('id') bookingId: string, @Body() body: any) {
    ensureEnabled();
    const stripe = getStripe();
    const HUB = process.env.PROVIDER_HUB_URL || 'http://127.0.0.1:3014';
    const { data: booking } = await axios.get(`${HUB}/bookings/${bookingId}`);
    const { data: provider } = await axios.get(`${HUB}/providers/${booking.provider_id}`);
    const amountCents = Math.max(50, Math.round(Number(booking.total_price || 0) * 100));
    const feePct = Number(process.env.WADATRIP_FEE_PCT || 15);
    const feeCents = Math.floor((amountCents * feePct) / 100);

    if (!stripe || !provider?.stripe_account_id) {
      // Fallback dev response
      return { url: `https://checkout.stripe.com/pay/cs_test_${bookingId}` };
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      success_url: process.env.CHECKOUT_SUCCESS_URL || 'https://example.com/success',
      cancel_url: process.env.CHECKOUT_CANCEL_URL || 'https://example.com/cancel',
      line_items: [{ quantity: 1, price_data: { currency: 'usd', unit_amount: amountCents, product_data: { name: booking?.listing?.title || 'Tour booking' } } }],
      payment_intent_data: {
        application_fee_amount: feeCents,
        transfer_data: { destination: provider.stripe_account_id },
      },
    });
    return { url: session.url };
  }
}

