import { Controller, Get, Post, Body, Param, Query, BadRequestException, Req } from '@nestjs/common';
import axios from 'axios';
import { getPrisma } from '@wadatrip/db';
import { getClaimsFromAuth } from '../utils/auth';

const HUB = process.env.PROVIDER_HUB_URL || 'http://localhost:3014';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN;
const ENABLED = (process.env.FF_PROVIDER_HUB || 'false').toLowerCase() === 'true';
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || '';
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
  if (!SENDGRID_API_KEY || !EMAIL_FROM) {
    return { sent: false, reason: 'email_not_configured' };
  }
  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: opts.to }] }],
        from: { email: EMAIL_FROM },
        subject: opts.subject,
        content: [{ type: 'text/plain', value: opts.text }],
      }),
    });
    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error('[bookings.notify] Email failed', response.status, errText);
      return { sent: false, reason: 'email_failed' };
    }
    return { sent: true };
  } catch (err: any) {
    console.error('[bookings.notify] Email error', err?.message || err);
    return { sent: false, reason: 'email_error' };
  }
}

@Controller()
export class BookingsController {
  @Get('bookings')
  async list(@Query() q: any, @Req() req: any) {
    if (ENABLED) {
      const { data } = await axios.get(`${HUB}/bookings`, { params: q });
      const items = await Promise.all(((data?.items as any[]) || []).map((item) => enrichBookingLinks(item)));
      return { ...data, items };
    }

    const prisma = getPrisma();
    const page = Math.max(1, Number(q.page || 1));
    const limit = Math.min(100, Math.max(1, Number(q.limit || 20)));
    const skip = (page - 1) * limit;
    const where: any = {};

    if (q.status) where.status = String(q.status);
    if (q.payment_status) where.payment_status = String(q.payment_status);
    if (q.provider_id) where.provider_id = String(q.provider_id);
    if (q.user_email) {
      where.user = { email: String(q.user_email).toLowerCase() };
    } else if (q.user_id) {
      where.user_id = String(q.user_id);
    } else {
      const claims = getClaimsFromAuth(req);
      if (claims?.sub && claims?.role !== 'admin') {
        where.user_id = String(claims.sub);
      }
    }

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
        include: { listing: true, provider: true, user: true },
      }),
    ]);

    const enrichedItems = await Promise.all(items.map((item) => enrichBookingLinks(item)));
    return { items: enrichedItems, total, page, limit };
  }
  @Get('bookings/:id')
  async get(@Param('id') id: string) {
    if (ENABLED) {
      const { data } = await axios.get(`${HUB}/bookings/${id}`);
      return enrichBookingLinks(data);
    }

    const prisma = getPrisma();
    const booking = await prisma.bookings.findUnique({
      where: { id },
      include: { listing: true, provider: true, user: true },
    });
    if (!booking) throw new BadRequestException('booking not found');
    return enrichBookingLinks(booking);
  }
  @Post('bookings')
  async create(@Body() body: any) {
    if (ENABLED) {
      const { data } = await axios.post(`${HUB}/bookings`, body, {
        headers: { 'x-internal-service-token': INTERNAL_TOKEN || '' },
      });
      return data;
    }

    const prisma = getPrisma();
    const required = ['listing_id', 'date', 'num_people'];
    for (const k of required) if (!body?.[k]) throw new BadRequestException(`missing ${k}`);

    const listing = await prisma.listings.findUnique({ where: { id: String(body.listing_id) } });
    if (!listing) throw new BadRequestException('listing not found');

    const provider_id = listing.provider_id;
    const isFreeTour = Array.isArray(listing.tags) && listing.tags.includes('free_tour');
    const date = new Date(String(body.date));
    if (isNaN(+date)) throw new BadRequestException('invalid date');

    const num_people = Number(body.num_people);
    if (!Number.isFinite(num_people) || num_people <= 0) throw new BadRequestException('invalid num_people');

    const total_price = isFreeTour
      ? '0'
      : body.total_price != null
        ? String(body.total_price)
        : null;
    const amount_cents = isFreeTour
      ? 0
      : body.amount_cents != null
        ? Math.trunc(Number(body.amount_cents))
        : total_price != null && Number.isFinite(Number(total_price))
          ? Math.round(Number(total_price) * 100)
          : null;

    let user_id: string | null = null;
    if (body.user_id) {
      const u = await prisma.users.findUnique({ where: { id: String(body.user_id) } });
      user_id = u?.id || null;
    }
    if (!user_id) {
      const email = String(body.user_email || 'demo@wadatrip.test').toLowerCase();
      const name = body.user_name ? String(body.user_name) : null;
      const demo = await prisma.users.upsert({ where: { email }, update: {}, create: { email, name } });
      user_id = demo.id;
    }

    const created = await prisma.bookings.create({
      data: {
        listing_id: String(body.listing_id),
        provider_id,
        user_id: String(user_id),
        date,
        num_people,
        total_price,
        amount_cents,
        status: isFreeTour ? 'confirmed' : 'pending',
        payment_status: isFreeTour ? 'paid' : 'unpaid',
      },
    });

    if (isFreeTour) {
      const provider = await prisma.providers.findUnique({ where: { id: provider_id } });
      if (provider?.email) {
        await notifyProviderByEmail({
          to: provider.email,
          subject: 'New free tour registration',
          text: `New registration for ${listing.title}\n\nName: ${body.user_name || ''}\nEmail: ${body.user_email || ''}\nDate: ${date.toISOString()}\nPeople: ${num_people}\n\nMeeting point: ${listing.city || ''}`,
        });
      }
    }

    return created;
  }
  @Post('bookings/simple')
  async createSimple(@Body() body: any) {
    if (ENABLED) {
      const { data } = await axios.post(`${HUB}/bookings/simple`, body, {
        headers: { 'x-internal-service-token': INTERNAL_TOKEN || '' },
      });
      return data;
    }

    const today = new Date();
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    const payload = {
      listing_id: body.listing_id,
      date: body.date ?? tomorrow.toISOString(),
      num_people: body.num_people ?? 1,
      total_price: body.total_price,
      amount_cents: body.amount_cents,
      user_name: body.customer_name ?? body.name,
      user_email: body.customer_email ?? body.email,
      user_id: body.user_id,
    };
    return this.create(payload);
  }
  @Post('bookings/:id/status')
  async status(@Param('id') id: string, @Body() body: any) {
    if (ENABLED) {
      const { data } = await axios.post(`${HUB}/bookings/${id}/status`, body, {
        headers: { 'x-internal-service-token': INTERNAL_TOKEN || '' },
      });
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

    const updated = await prisma.bookings.update({
      where: { id },
      data: {
        ...(status ? { status } : {}),
        ...(payment_status ? { payment_status } : {}),
      },
    });

    return updated;
  }
}

