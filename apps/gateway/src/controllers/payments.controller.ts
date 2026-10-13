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
  ServiceUnavailableException,
} from '@nestjs/common';
import axios from 'axios';
import { getPrisma } from '@wadatrip/db';
import { requireActor, requireProviderAccess, requireBookingAccess } from '@wadatrip/common/security';
import { validateBookingPrice } from '@wadatrip/common/booking-price';
import { preparePayment, assertPaymentMode } from '@wadatrip/common/payment-lifecycle';
import { paymentObject, reconcileBookingPayment } from '../services/booking-payment.service';
import { stripeConnectAccountUpdate, stripeConnectCapabilities, stripeConnectServiceAgreement, stripeConnectStatus, stripeConnectUrls } from '../services/stripe-connect.service';
import { requireNewPaymentAccess, stripePaymentMode, payoutAccountForMode, marketplaceFee } from '../services/payment-config.service';

const ENABLED = (process.env.FF_PROVIDER_HUB || 'false').toLowerCase() === 'true';

function bookingPaymentAmount(booking: any) {
  const price = validateBookingPrice(booking);
  if (price.amount === 0) throw new BadRequestException('Free bookings do not require payment');
  // The existing processor minimum belongs here, never in the domain price calculation.
  if (price.amount < 50) throw new BadRequestException('Booking amount is below the supported payment minimum');
  return price;
}

function marketplaceFeeAmount(amountCents: number) {
  return marketplaceFee(amountCents);
}

async function requireReadyPayoutAccount(stripe: any, booking: any) {
  const mode = stripePaymentMode();
  const accountId = String(payoutAccountForMode(booking?.provider, mode) || '').trim();
  if (!accountId) throw new ConflictException('Operator payout setup is incomplete');
  const account = await stripe.accounts.retrieve(accountId);
  const associatedProvider = String(account?.metadata?.wadatrip_provider_id || '');
  if ((mode === 'live' && associatedProvider !== booking.provider_id) || (associatedProvider && associatedProvider !== booking.provider_id)) {
    throw new ConflictException('Payout account association mismatch');
  }
  if (!stripeConnectStatus(account).ready) {
    throw new ConflictException('Operator payout account is not ready');
  }
  return accountId;
}

function normalizeCountryCode(raw: any): string {
  const value = String(raw || '').trim();
  if (!value) throw new BadRequestException('Provider country is required for payout setup');
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

  const country = known[normalized];
  if (!country) throw new BadRequestException('Provider country is not supported by payout setup');
  return country;
}

// Minimal Stripe wrapper (throws when Stripe is misconfigured)
function requireStripe() {
  stripePaymentMode();
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
  @Get('connect/:providerId/status')
  async connectStatus(@Param('providerId') providerId: string, @Req() req: any) {
    const { provider } = await requireProviderAccess(req, getPrisma(), providerId);
    const mode = stripePaymentMode();
    const accountId = payoutAccountForMode(provider, mode);
    if (!accountId) return stripeConnectStatus(null);
    const account = await requireStripe().accounts.retrieve(accountId);
    const associatedProvider = String(account?.metadata?.wadatrip_provider_id || '');
    if ((mode === 'live' && associatedProvider !== providerId) || (associatedProvider && associatedProvider !== providerId)) {
      throw new ConflictException('Payout account association mismatch');
    }
    return stripeConnectStatus(account);
  }

  @Post('connect/:providerId/link')
  async connectLink(@Param('providerId') providerId: string, @Req() req: any) {
    const { provider } = await requireProviderAccess(req, getPrisma(), providerId);
    const mode = requireNewPaymentAccess(providerId);
    const providerStatus = String(provider.status || provider.verification_status || '').toLowerCase();
    if (!['approved', 'verified'].includes(providerStatus)) {
      throw new BadRequestException('Provider must be approved before payout setup');
    }
    const { returnUrl, refreshUrl } = stripeConnectUrls();
    const stripe = requireStripe();
    const prisma = getPrisma() as any;

    let accountId = payoutAccountForMode(provider, mode);
    if (!accountId) {
      const stripeCountry = normalizeCountryCode(provider.country_code);
      const acct = await stripe.accounts.create({
        type: 'express',
        email: provider.email,
        country: stripeCountry,
        capabilities: stripeConnectCapabilities(),
        tos_acceptance: stripeConnectServiceAgreement(),
        metadata: { wadatrip_provider_id: providerId },
      }, { idempotencyKey: `wadatrip-connect-account:${providerId}:${mode}` });
      accountId = acct.id;

      await prisma.providers.update({
        where: { id: providerId },
        data: mode === 'live' ? { stripe_live_account_id: accountId } : { stripe_test_account_id: accountId },
      });
    } else {
      const existing = await stripe.accounts.retrieve(accountId);
      const associatedProvider = String(existing?.metadata?.wadatrip_provider_id || '');
      if (existing?.deleted || (mode === 'live' && associatedProvider !== providerId) || (associatedProvider && associatedProvider !== providerId)) {
        throw new ConflictException('Payout account association mismatch');
      }
      const accountUpdate = stripeConnectAccountUpdate(existing);
      if (accountUpdate) await stripe.accounts.update(accountId, accountUpdate);
    }

    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
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
    await requireBookingAccess(req, prisma, String(body.booking_id), 'pay');
    throw new ServiceUnavailableException('Use the hosted booking checkout');
  }

  @Post('bookings/:id/checkout')
  async checkout(@Param('id') bookingId: string, @Req() req: any) {
    const prisma = getPrisma() as any;
    const { booking } = await requireBookingAccess(req, prisma, bookingId, 'pay');
    const mode = requireNewPaymentAccess(booking.provider_id);
    bookingPaymentAmount(booking);
    const existingPayment = await prisma.paymentRecord.findUnique({ where: { booking_id: bookingId } });
    if (existingPayment) assertPaymentMode(existingPayment, mode);
    const stripe = requireStripe();
    const payoutAccountId = await requireReadyPayoutAccount(stripe, booking);
    const payment = await preparePayment(prisma, bookingId, 'checkout', (current, paymentId) => {
      const metadata = { booking_id: current.id, payment_record_id: paymentId };
      const success = new URL(process.env.CHECKOUT_SUCCESS_URL || `${process.env.GATEWAY_URL || 'http://localhost:3015'}/checkout/success`);
      success.searchParams.set('booking_id', current.id);
      const cancel = new URL(process.env.CHECKOUT_CANCEL_URL || `${process.env.GATEWAY_URL || 'http://localhost:3015'}/checkout/cancel`);
      cancel.searchParams.set('booking_id', current.id);
      return {
        mode: 'payment', payment_method_types: ['card'],
        // One hour is a processor-session deadline, never permission to release inventory locally.
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        client_reference_id: current.id, metadata,
        success_url: success.toString(),
        cancel_url: cancel.toString(),
        line_items: [{ quantity: 1, price_data: { currency: current.currency, unit_amount: current.amount_cents,
          product_data: { name: current.listing?.title || 'Tour booking' } } }],
        payment_intent_data: {
          application_fee_amount: marketplaceFeeAmount(current.amount_cents),
          transfer_data: { destination: payoutAccountId }, metadata,
        },
      };
    }, mode);
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
    throw new ServiceUnavailableException('Itinerary payments are not available; book a published tour');
  }
}
