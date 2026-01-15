import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  BadRequestException,
  UnauthorizedException,
  Req,
} from '@nestjs/common';
import axios from 'axios';
import { getPrisma } from '@wadatrip/db';
import { getUserIdFromAuth } from '../utils/auth';

const ENABLED = (process.env.FF_PROVIDER_HUB || 'false').toLowerCase() === 'true';

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
  @Get('user-history')
  async userHistory(@Req() req: any) {
    const userId = getUserIdFromAuth(req);
    if (!userId) throw new UnauthorizedException('not authenticated');
    const prisma = getPrisma() as any;

    const bookings = await prisma.bookings.findMany({
      where: { user_id: String(userId) },
      select: { id: true },
    });

    const bookingIds = bookings.map((b: any) => b.id);
    if (!bookingIds.length) return { items: [] };

    const items = await prisma.paymentRecord.findMany({
      where: { booking_id: { in: bookingIds } },
      orderBy: { created_at: 'desc' },
    });

    return { items };
  }
  @Post('connect/:providerId/link')
  async connectLink(@Param('providerId') providerId: string) {
    const stripe = requireStripe();
    const HUB = process.env.PROVIDER_HUB_URL || 'http://localhost:3014';
    const prisma = getPrisma() as any;

    const provider = ENABLED
      ? (await axios.get(`${HUB}/providers/${providerId}`)).data
      : await prisma.providers.findUnique({ where: { id: String(providerId) } });

    if (!provider) {
      throw new BadRequestException('provider not found');
    }

    let accountId = provider.stripe_account_id;
    if (!accountId) {
      const acct = await stripe.accounts.create({
        type: 'express',
        email: provider.email,
        country: provider.country_code || 'US',
      });
      accountId = acct.id;

      if (ENABLED) {
        await axios
          .post(`${HUB}/providers/${providerId}/verify`, {
            status: provider.status,
            documents: [],
            stripe_account_id: accountId,
          })
          .catch(() => {});
      } else {
        await prisma.providers.update({
          where: { id: String(providerId) },
          data: { stripe_account_id: accountId },
        });
      }
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
    const stripe = requireStripe();
    const HUB = process.env.PROVIDER_HUB_URL || 'http://localhost:3014';
    const prisma = getPrisma() as any;

    // Obtener booking real
    const booking = ENABLED
      ? (await axios.get(`${HUB}/bookings/${bookingId}`)).data
      : await prisma.bookings.findUnique({
          where: { id: bookingId },
          include: { listing: true, provider: true },
        });

    if (!booking) {
      throw new BadRequestException('Booking not found');
    }

    // Obtener provider desde booking
    const providerId = booking?.listing?.provider_id;
    if (!providerId) {
      throw new BadRequestException('Booking has no provider assigned');
    }

    const provider = ENABLED
      ? (await axios.get(`${HUB}/providers/${providerId}`)).data
      : await prisma.providers.findUnique({ where: { id: String(providerId) } });

    // Flags
    const allowNoConnect =
      (process.env.ALLOW_NO_CONNECT_CHECKOUT || '').toLowerCase() === 'true';

    const hasConnectAccount = Boolean(provider?.stripe_account_id);
    if (!hasConnectAccount) {
      if (!allowNoConnect) {
        console.warn(
          '[payments.checkout] Missing provider Stripe account, falling back to standard Stripe checkout.',
        );
      }
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
    let session;
    try {
      session = await stripe.checkout.sessions.create({
        mode: 'payment',
        success_url:
          process.env.CHECKOUT_SUCCESS_URL ||
          `${process.env.GATEWAY_URL || 'http://localhost:3015'}/checkout/success`,
        cancel_url:
          process.env.CHECKOUT_CANCEL_URL ||
          `${process.env.GATEWAY_URL || 'http://localhost:3015'}/checkout/cancel`,
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
    } catch (err: any) {
      console.error('[payments.checkout] Stripe session error:', err?.message || err);
      throw new BadRequestException('Stripe checkout failed');
    }

    if (!session?.url) {
      throw new BadRequestException(
        'Stripe did not return a checkout session URL',
      );
    }

    return { url: session.url };
  }

  @Post('itineraries/:id/checkout')
  async checkoutItinerary(@Param('id') itineraryId: string) {
    const stripe = requireStripe();
    const prisma = getPrisma() as any;
    const itinerary = await prisma.itineraries.findUnique({ where: { id: itineraryId } });
    if (!itinerary) {
      throw new BadRequestException('Itinerary not found');
    }

    if (String(itinerary.status).toLowerCase() !== 'published') {
      throw new BadRequestException('Itinerary is not published');
    }

    const operatorStripe = itinerary.operator_stripe_account_id;
    if (!operatorStripe) {
      throw new BadRequestException('Operator has no connected Stripe account');
    }

    const price = Number(itinerary.price);
    if (!Number.isFinite(price) || price <= 0) {
      throw new BadRequestException('Invalid itinerary price');
    }

    const currency = String(itinerary.currency || 'USD').toLowerCase();
    if (currency !== 'usd') {
      throw new BadRequestException('Only USD is supported');
    }

    const amountCents = Math.max(50, Math.round(price * 100));
    const feePct = Number(process.env.WADATRIP_FEE_PCT || 15);
    const feeCents = Math.floor((amountCents * feePct) / 100);

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      success_url:
        process.env.CHECKOUT_SUCCESS_URL ||
        `${process.env.GATEWAY_URL || 'http://localhost:3015'}/checkout/success`,
      cancel_url:
        process.env.CHECKOUT_CANCEL_URL ||
        `${process.env.GATEWAY_URL || 'http://localhost:3015'}/checkout/cancel`,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: amountCents,
            product_data: {
              name: itinerary.title || 'Wadatrip itinerary',
            },
          },
        },
      ],
      payment_intent_data: {
        application_fee_amount: feeCents,
        transfer_data: { destination: operatorStripe },
        metadata: { itinerary_id: itineraryId },
      },
    });

    if (!session?.url) {
      throw new BadRequestException('Stripe did not return a checkout session URL');
    }

    return { url: session.url };
  }
}
