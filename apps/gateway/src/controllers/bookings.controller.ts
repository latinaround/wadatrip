import { Controller, Get, Post, Body, Param, Query, BadRequestException, Req } from '@nestjs/common';
import axios from 'axios';
import { getPrisma } from '@wadatrip/db';
import { getClaimsFromAuth } from '../utils/auth';

const HUB = process.env.PROVIDER_HUB_URL || 'http://localhost:3014';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN;
const ENABLED = (process.env.FF_PROVIDER_HUB || 'false').toLowerCase() === 'true';

@Controller()
export class BookingsController {
  @Get('bookings')
  async list(@Query() q: any, @Req() req: any) {
    if (ENABLED) {
      const { data } = await axios.get(`${HUB}/bookings`, { params: q });
      return data;
    }

    const prisma = getPrisma();
    const page = Math.max(1, Number(q.page || 1));
    const limit = Math.min(100, Math.max(1, Number(q.limit || 20)));
    const skip = (page - 1) * limit;
    const where: any = {};

    if (q.status) where.status = String(q.status);
    if (q.payment_status) where.payment_status = String(q.payment_status);
    if (q.provider_id) where.provider_id = String(q.provider_id);
    if (q.user_id) {
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

    return { items, total, page, limit };
  }
  @Get('bookings/:id')
  async get(@Param('id') id: string) {
    if (ENABLED) {
      const { data } = await axios.get(`${HUB}/bookings/${id}`);
      return data;
    }

    const prisma = getPrisma();
    const booking = await prisma.bookings.findUnique({
      where: { id },
      include: { listing: true, provider: true, user: true },
    });
    if (!booking) throw new BadRequestException('booking not found');
    return booking;
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
    const date = new Date(String(body.date));
    if (isNaN(+date)) throw new BadRequestException('invalid date');

    const num_people = Number(body.num_people);
    if (!Number.isFinite(num_people) || num_people <= 0) throw new BadRequestException('invalid num_people');

    const total_price = body.total_price != null ? String(body.total_price) : null;

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
        status: 'pending',
        payment_status: 'unpaid',
      },
    });

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

