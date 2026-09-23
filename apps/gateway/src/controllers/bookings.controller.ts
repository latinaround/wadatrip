import { Controller, Get, Post, Body, Param, Query, BadRequestException, Req, HttpException } from '@nestjs/common';
import axios from 'axios';
import { getPrisma } from '@wadatrip/db';
import { requireActor, requireBookingAccess, bookingScope, serviceHeaders } from '@wadatrip/common/security';
import { bookingSelect } from '@wadatrip/common/public-data';
import { createCapacityBooking, updateCapacityBooking } from '@wadatrip/common/booking-capacity';
import { reconcileBookingPayment } from '../services/booking-payment.service';
import { cancelPolicyBooking } from '@wadatrip/common/booking-cancellation';
import { sendTransactionalEmail } from '../services/email.service';

const HUB = process.env.PROVIDER_HUB_URL || 'http://localhost:3014';
const ENABLED = (process.env.FF_PROVIDER_HUB || 'false').toLowerCase() === 'true';
const EMAIL_FROM = process.env.EMAIL_FROM || '';

function getStripeClient() {
  const key = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET;
  if (!key) return null;
  try {
    return new (require('stripe'))(key, { apiVersion: '2024-06-20' });
  } catch {
    return null;
  }
}

async function enrichBookingLinks(booking: any) {
  if (!booking) return booking;
  const stripe = getStripeClient();
  if (!stripe) return booking;

  const enriched = { ...booking };

  try {
    if (booking?.checkout_session_id) {
      const session = await stripe.checkout.sessions.retrieve(String(booking.checkout_session_id));
      if (session?.url) enriched.checkout_url = session.url;
      if (!enriched.payment_intent_id && session?.payment_intent) {
        enriched.payment_intent_id = String(session.payment_intent);
      }
    }
  } catch {}

  try {
    const paymentIntentId = enriched.payment_intent_id || booking?.payment_intent_id;
    if (paymentIntentId) {
      const intent = await stripe.paymentIntents.retrieve(String(paymentIntentId), {
        expand: ['latest_charge'],
      });
      const latestCharge = typeof intent?.latest_charge === 'object' ? intent.latest_charge : null;
      if (latestCharge?.receipt_url) enriched.receipt_url = latestCharge.receipt_url;
      enriched.payment_intent_id = intent?.id || enriched.payment_intent_id;
    }
  } catch {}

  return enriched;
}

async function notifyProviderByEmail(opts: { to: string; subject: string; text: string }) {
  return sendTransactionalEmail({ ...opts, from: EMAIL_FROM, logScope: 'bookings.notify' });
}

@Controller()
export class BookingsController {
  @Get('bookings')
  async list(@Query() q: any, @Req() req: any) {
    const actor = await requireActor(req, getPrisma());
    if (ENABLED) {
      const { data } = await axios.get(`${HUB}/bookings`, { params: q, headers: serviceHeaders(req) });
      const items = await Promise.all(((data?.items as any[]) || []).map((item: any) => enrichBookingLinks(item)));
      return { ...data, items };
    }

    const prisma = getPrisma();
    const page = Math.max(1, Number(q.page || 1));
    const limit = Math.min(100, Math.max(1, Number(q.limit || 20)));
    const skip = (page - 1) * limit;
    const where: any = bookingScope(actor, q);

    if (q.status) where.status = String(q.status);
    if (q.payment_status) where.payment_status = String(q.payment_status);
    if (q.provider_id) where.provider_id = String(q.provider_id);
    if (actor.admin && q.user_id) where.user_id = String(q.user_id);
    if (actor.admin && q.user_email) where.user = { email: String(q.user_email).toLowerCase() };

    if (q.q) {
      const term = String(q.q);
      where.OR = [
        { listing: { title: { contains: term, mode: 'insensitive' } } },
        { provider: { name: { contains: term, mode: 'insensitive' } } },
      ];
    }

    const [total, items] = await Promise.all([
      prisma.bookings.count({ where }),
      prisma.bookings.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
        select: bookingSelect,
      }),
    ]);

    const enrichedItems = await Promise.all(items.map((item: any) => enrichBookingLinks(item)));
    return { items: enrichedItems, total, page, limit };
  }
  @Get('bookings/:id')
  async get(@Param('id') id: string, @Req() req: any) {
    await requireBookingAccess(req, getPrisma(), id);
    if (ENABLED) {
      const { data } = await axios.get(`${HUB}/bookings/${id}`, { headers: serviceHeaders(req) });
      return enrichBookingLinks(data);
    }

    const prisma = getPrisma();
    const booking = await prisma.bookings.findUnique({
      where: { id },
      select: bookingSelect,
    });
    if (!booking) throw new BadRequestException('booking not found');
    return enrichBookingLinks(booking);
  }
  @Post('bookings')
  async create(@Req() req: any, @Body() body: any) {
    const actor = await requireActor(req, getPrisma());
    const trustedBody = { ...body, user_id: actor.id, user_email: actor.email };
    if (ENABLED) {
      try {
        const { data } = await axios.post(`${HUB}/bookings`, trustedBody, { headers: serviceHeaders(req) });
        return data;
      } catch (error: any) {
        if ([400, 401, 403, 404, 409].includes(error?.response?.status)) throw new HttpException(error.response.data, error.response.status);
        throw error;
      }
    }

    const prisma = getPrisma();
    const { created, listing } = await createCapacityBooking(prisma, actor, body);
    const { provider_id, date, num_people } = created;
    const isFreeTour = created.amount_cents === 0;

    if (isFreeTour) {
      const provider = await prisma.providers.findUnique({ where: { id: provider_id } });
      if (provider?.email) {
        await notifyProviderByEmail({
          to: provider.email,
          subject: 'New free tour registration',
          text: `New registration for ${listing.title}\n\nName: ${actor.name || 'Traveler'}\nEmail: ${actor.email}\nDate: ${date.toISOString()}\nPeople: ${num_people}\n\nMeeting point: ${listing.city || ''}`,
        });
      }
    }

    return created;
  }
  @Post('bookings/simple')
  async createSimple(@Req() req: any, @Body() body: any) {
    const today = new Date();
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    const payload = {
      listing_id: body.listing_id,
      date: body.date ?? tomorrow.toISOString(),
      num_people: body.num_people ?? 1,
      policy_version: body.policy_version,
      total_price: body.total_price,
      amount_cents: body.amount_cents,
      user_name: body.customer_name ?? body.name,
      user_email: body.customer_email ?? body.email,
      user_id: body.user_id,
    };
    return this.create(req, payload);
  }
  @Post('bookings/:id/cancel')
  async cancel(@Param('id') id: string, @Req() req: any) {
    const prisma = getPrisma();
    const { actor } = await requireBookingAccess(req, prisma, id);
    await cancelPolicyBooking(prisma, id, actor);
    // The durable cancellation request is processed independently of the browser.
    return prisma.bookings.findUnique({ where: { id }, select: bookingSelect });
  }

  @Post('bookings/:id/status')
  async status(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    const { actor, booking } = await requireBookingAccess(req, getPrisma(), id, 'manage');
    if (body?.payment_status != null) throw new BadRequestException('payment status is managed by signed payment events');
    if (String(body?.status).toLowerCase() === 'cancelled' && booking.booking_terms?.version) {
      await cancelPolicyBooking(getPrisma(), id, actor);
      return getPrisma().bookings.findUnique({ where: { id }, select: bookingSelect });
    }
    if (ENABLED) {
      const { data } = await axios.post(`${HUB}/bookings/${id}/status`, body, {
        headers: serviceHeaders(req),
      });
      if (data.status === 'cancellation_pending') return this.finishCancellation(id, data);
      return data;
    }

    const prisma = getPrisma();
    const allowedStatus = ['pending', 'confirmed', 'cancelled', 'completed'];
    const allowedPayment = ['unpaid', 'paid', 'failed', 'refunded'];

    const status = body?.status ? String(body.status).toLowerCase() : null;
    const payment_status = body?.payment_status ? String(body.payment_status).toLowerCase() : null;

    if (status && !allowedStatus.includes(status)) {
      throw new BadRequestException('invalid status');
    }
    if (payment_status && !allowedPayment.includes(payment_status)) {
      throw new BadRequestException('invalid payment_status');
    }

    const exists = await prisma.bookings.findUnique({ where: { id } });
    if (!exists) throw new BadRequestException('booking not found');

    const updated = await updateCapacityBooking(prisma, id, {
        ...(status ? { status } : {}),
        ...(payment_status ? { payment_status } : {}),
    });

    if (updated.status === 'cancellation_pending') return this.finishCancellation(id, updated);
    return updated;
  }

  private async finishCancellation(id: string, pending: any) {
    const stripe = getStripeClient();
    if (!stripe) return pending;
    try { return await reconcileBookingPayment(getPrisma(), stripe, id); }
    catch { return pending; } // Uncertain external result retains inventory and explicit pending state.
  }
}

