import {
  Controller,
  Post,
  Param,
  Body,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import axios from 'axios';

const ENABLED = (process.env.FF_PROVIDER_HUB || 'false').toLowerCase() === 'true';
function ensureEnabled() {
  if (!ENABLED) throw new NotFoundException();
}

// Minimal Stripe wrapper (throws when Stripe is misconfigured)
function requireStripe() {
  const key = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET;
  if (!key) {
    throw new BadRequestException('Stripe secret key is not configured');
  }
  try {
    return new (require('stripe'))(key, { apiVersion: '2024-06-20' });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error ?? 'unknown');
    throw new BadRequestException(`Stripe SDK is not available: ${detail}`);
  }
}

@Controller('payments')
export class PaymentsController {
  @Post('connect/:providerId/link')
  async connectLink(@Param('providerId') providerId: string) {
    ensureEnabled();
    const stripe = requireStripe();
    const HUB = process.env.PROVIDER_HUB_URL || 'http://localhost:3014';
    const { data: provider } = await axios.get(`${HUB}/providers/${providerId}`);

    let accountId = provider.stripe_account_id;
    if (!accountId) {
      const acct = await stripe.accounts.create({
        type: 'express',
        email: provider.email,
        country: provider.country_code || 'US',
      });
      accountId = acct.id;

      await axios
        .post(`${HUB}/providers/${providerId}/verify`, {
          status: provider.status,
          documents: [],
          stripe_account_id: accountId,
        })
        .catch(() => {});
    }

    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: process.env.CONNECT_REFRESH_URL || 'https://example.com/reauth',
      return_url: process.env.CONNECT_RETURN_URL || 'https://example.com/return',
      type: 'account_onboarding',
    });

    if (!link?.url) {
      throw new BadRequestException('Stripe did not return an onboarding link');
    }

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
    const bookingId = body?.booking_id;
    const stripe = requireStripe();
    const amountCents = Math.max(50, amount);

    const intent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency,
      description,
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never',
      },
      metadata: { booking_id: bookingId || '' },
    });

    if (!intent?.client_secret) {
      throw new BadRequestException('Stripe did not return a clientSecret');
    }

    return { clientSecret: intent.client_secret, payment_intent_id: intent.id };
  }

  @Post('bookings/:id/checkout')
  async checkout(@Param('id') bookingId: string) {
    ensureEnabled();
    const stripe = requireStripe();
    const HUB = process.env.PROVIDER_HUB_URL || 'http://localhost:3014';

    // Obtener booking real
    const { data: booking } = await axios.get(`${HUB}/bookings/${bookingId}`);
    if (!booking) {
      throw new BadRequestException('Booking not found');
    }

    // Obtener provider desde booking
    const providerId = booking?.listing?.provider_id;
    if (!providerId) {
      throw new BadRequestException('Booking has no provider assigned');
    }

    const { data: provider } = await axios.get(`${HUB}/providers/${providerId}`);

    // Flags
    const allowNoConnect =
      (process.env.ALLOW_NO_CONNECT_CHECKOUT || '').toLowerCase() === 'true';

    const hasConnectAccount = Boolean(provider?.stripe_account_id);

    if (!hasConnectAccount && !allowNoConnect) {
      throw new BadRequestException(
        'Provider is missing a connected Stripe account',
      );
    }

    // Precio total
    const amountCents = Math.max(
      50,
      Math.round(Number(booking.total_price || 0) * 100),
    );

    // Fee
    const feePct = Number(process.env.WADATRIP_FEE_PCT || 15);
    const feeCents = Math.floor((amountCents * feePct) / 100);

    // Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      success_url: process.env.CHECKOUT_SUCCESS_URL || `${process.env.GATEWAY_URL || 'http://localhost:3015'}/checkout/success`,
      cancel_url: process.env.CHECKOUT_CANCEL_URL || `${process.env.GATEWAY_URL || 'http://localhost:3015'}/checkout/cancel`,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: amountCents,
            product_data: {
              name: booking?.listing?.title || 'Tour booking',
            },
          },
        },
      ],
      payment_intent_data: hasConnectAccount
        ? {
            application_fee_amount: feeCents,
            transfer_data: { destination: provider.stripe_account_id },
            metadata: { booking_id: bookingId },
          }
        : {
            metadata: { booking_id: bookingId, connect_fallback: 'true' },
          },
    });

    if (!session?.url) {
      throw new BadRequestException(
        'Stripe did not return a checkout session URL',
      );
    }

    return { url: session.url };
  }
}
