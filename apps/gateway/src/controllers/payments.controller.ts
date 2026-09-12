import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  BadRequestException,
  UnauthorizedException,
  ConflictException,
  Req,
} from '@nestjs/common';
import axios from 'axios';
import { getPrisma } from '@wadatrip/db';
import { requireActor, requireProviderAccess, requireBookingAccess } from '@wadatrip/common/security';
import { validateBookingPrice } from '@wadatrip/common/booking-price';
import { preparePayment } from '@wadatrip/common/payment-lifecycle';
import { paymentObject, reconcileBookingPayment } from '../services/booking-payment.service';

const ENABLED = (process.env.FF_PROVIDER_HUB || 'false').toLowerCase() === 'true';

function bookingPaymentAmount(booking: any) {
  const price = validateBookingPrice(booking);
  if (price.amount === 0) throw new BadRequestException('Free bookings do not require payment');
  // The existing processor minimum belongs here, never in the domain price calculation.
  if (price.amount < 50) throw new BadRequestException('Booking amount is below the supported payment minimum');
  return price;
}

function normalizeCountryCode(raw: any): string {
  const value = String(raw || '').trim();
  if (!value) return 'US';
  const upper = value.toUpperCase();
  if (/^[A-Z]{2}$/.test(upper)) return upper;

  const normalized = upper
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z]/g, '');

  const known: Record<string, string> = {
    UNITEDSTATES: 'US',
    USA: 'US',
    USAAMERICA: 'US',
    PERU: 'PE',
    PERUU: 'PE',
    MEXICO: 'MX',
    SPAIN: 'ES',
    ESPANA: 'ES',
    FRANCE: 'FR',
    PORTUGAL: 'PT',
    JAPAN: 'JP',
    CHILE: 'CL',
    COLOMBIA: 'CO',
    ECUADOR: 'EC',
    COSTARICA: 'CR',
    DOMINICANREPUBLIC: 'DO',
    ARGENTINA: 'AR',
    BRAZIL: 'BR',
    BRASIL: 'BR',
    URUGUAY: 'UY',
    UNITEDKINGDOM: 'GB',
    GREATBRITAIN: 'GB',
    ITALY: 'IT',
  };

  return known[normalized] || 'US';
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
  @Get('user-history')
  async userHistory(@Req() req: any) {
    const userId = (await requireActor(req, getPrisma())).id;
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
      select: { id: true, booking_id: true, amount_gross_cents: true, currency: true,
        status: true, resolution: true, amount_charged_cents: true, charged_currency: true, created_at: true },
    });

    return { items };
  }
  @Post('connect/:providerId/link')
  async connectLink(@Param('providerId') providerId: string, @Req() req: any) {
    const { provider } = await requireProviderAccess(req, getPrisma(), providerId);
    const stripe = requireStripe();
    const HUB = process.env.PROVIDER_HUB_URL || 'http://localhost:3014';
    const prisma = getPrisma() as any;

    let accountId = provider.stripe_account_id;
    if (!accountId) {
      const stripeCountry = normalizeCountryCode(provider.country_code);
      const acct = await stripe.accounts.create({
        type: 'express',
        email: provider.email,
        country: stripeCountry,
      });
      accountId = acct.id;

      await prisma.providers.update({
        where: { id: providerId },
        data: { stripe_account_id: accountId },
      });
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
  async createIntent(@Body() body: any, @Req() req: any) {
    if (!body?.booking_id) throw new BadRequestException('booking_id is required');
    const prisma = getPrisma() as any;
    const { booking } = await requireBookingAccess(req, prisma, String(body.booking_id), 'pay');
    bookingPaymentAmount(booking);
    const stripe = requireStripe();
    const payment = await preparePayment(prisma, booking.id, 'intent', (current, paymentId) => ({
      amount: current.amount_cents, currency: current.currency,
      automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
      metadata: { booking_id: current.id, payment_record_id: paymentId },
    }));
    const intent = await paymentObject(prisma, stripe, payment);
    const current = await prisma.bookings.findUnique({ where: { id: booking.id } });
    if (current.status !== 'payment_pending') throw new ConflictException('Payment is no longer awaiting checkout');
    if (!intent?.client_secret) throw new BadRequestException('Stripe did not return a clientSecret');
    return { clientSecret: intent.client_secret, payment_intent_id: intent.id };
  }

  @Post('bookings/:id/checkout')
  async checkout(@Param('id') bookingId: string, @Req() req: any) {
    const prisma = getPrisma() as any;
    const { booking } = await requireBookingAccess(req, prisma, bookingId, 'pay');
    bookingPaymentAmount(booking);
    const stripe = requireStripe();
    const payment = await preparePayment(prisma, bookingId, 'checkout', (current, paymentId) => {
      const metadata = { booking_id: current.id, payment_record_id: paymentId };
      const success = new URL(process.env.CHECKOUT_SUCCESS_URL || `${process.env.GATEWAY_URL || 'http://localhost:3015'}/checkout/success`);
      success.searchParams.set('booking_id', current.id);
      const cancel = new URL(process.env.CHECKOUT_CANCEL_URL || `${process.env.GATEWAY_URL || 'http://localhost:3015'}/checkout/cancel`);
      cancel.searchParams.set('booking_id', current.id);
      const feePct = Number(process.env.WADATRIP_FEE_PCT || 15);
      if (!Number.isFinite(feePct) || feePct < 0 || feePct > 100) throw new BadRequestException('Invalid payment fee configuration');
      return {
        mode: 'payment', payment_method_types: ['card'],
        // One hour is a processor-session deadline, never permission to release inventory locally.
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        client_reference_id: current.id, metadata,
        success_url: success.toString(),
        cancel_url: cancel.toString(),
        line_items: [{ quantity: 1, price_data: { currency: current.currency, unit_amount: current.amount_cents,
          product_data: { name: current.listing?.title || 'Tour booking' } } }],
        payment_intent_data: current.provider?.stripe_account_id ? {
          application_fee_amount: Math.floor(current.amount_cents * feePct / 100),
          transfer_data: { destination: current.provider.stripe_account_id }, metadata,
        } : { metadata: { ...metadata, connect_fallback: 'true' } },
      };
    });
    const session = await paymentObject(prisma, stripe, payment);
    const current = await prisma.bookings.findUnique({ where: { id: bookingId } });
    if (current.status !== 'payment_pending') throw new ConflictException('Payment is no longer awaiting checkout');
    if (!session?.url) throw new ConflictException('Checkout is not open; refresh booking payment status');
    return { url: session.url };
  }

  @Post('bookings/:id/reconcile')
  async reconcile(@Param('id') bookingId: string, @Req() req: any) {
    const prisma = getPrisma() as any;
    await requireBookingAccess(req, prisma, bookingId);
    const booking = await reconcileBookingPayment(prisma, requireStripe(), bookingId);
    return { id: booking.id, status: booking.status, payment_status: booking.payment_status };
  }

  @Post('itineraries/:id/checkout')
  async checkoutItinerary(@Param('id') itineraryId: string, @Req() req: any) {
    await requireActor(req, getPrisma());
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
      payment_method_types: ['card'],
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
