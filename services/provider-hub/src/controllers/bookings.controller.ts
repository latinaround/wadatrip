import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
  BadRequestException,
  ForbiddenException,
  Req,
} from '@nestjs/common';
import { getPrisma } from '@wadatrip/db';

@Controller('bookings')
export class BookingsController {
  private requireInternalToken(req: any) {
    const expected = process.env.INTERNAL_SERVICE_TOKEN;
    if (!expected) {
      if (process.env.NODE_ENV === 'production') {
        throw new ForbiddenException('internal token not configured');
      }
      return;
    }
    const token = String(req?.headers?.['x-internal-service-token'] || '');
    if (!token || token !== expected) {
      throw new ForbiddenException('invalid internal token');
    }
  }

  @Post()
  async create(@Req() req: any, @Body() body: any) {
    this.requireInternalToken(req);
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
    const amount_cents =
      body.amount_cents != null
        ? Math.trunc(Number(body.amount_cents))
        : total_price != null && Number.isFinite(Number(total_price))
          ? Math.round(Number(total_price) * 100)
          : null;

    // Resolver usuario
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

    const trip_id = body.trip_id ? String(body.trip_id) : null;
    if (trip_id) { const trip = await prisma.trips.findUnique({ where: { id: trip_id } }); if (!trip) throw new BadRequestException('trip not found'); if (trip.user_id !== String(user_id)) throw new BadRequestException('trip does not belong to traveler'); }

    const created = await prisma.bookings.create({
      data: {
        listing_id: String(body.listing_id),
        ...(trip_id ? { trip_id } : {}),
        provider_id,
        user_id: String(user_id),
        date,
        num_people,
        total_price,
        amount_cents,
        status: 'pending',
        payment_status: 'unpaid',
      },
    });

    return created;
  }

  // Lightweight booking path for quick reservations (defaults date=tomorrow, num_people=1)
  @Post('simple')
  async createSimple(@Req() req: any, @Body() body: any) {
    this.requireInternalToken(req);
    const today = new Date();
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    const payload = {
      listing_id: body.listing_id,
      date: body.date ?? tomorrow.toISOString(),
      num_people: body.num_people ?? 1,
      total_price: body.total_price,
      amount_cents: body.amount_cents,
      user_name: body.customer_name,
      user_email: body.customer_email,
      user_id: body.user_id,
    };
    return this.create(req, payload);
  }

  @Get()
  async list(@Query() query: any) {
    const prisma = getPrisma();
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 20)));
    const skip = (page - 1) * limit;
    const where: any = {};

    if (query.status) where.status = String(query.status);
    if (query.payment_status) where.payment_status = String(query.payment_status);
    if (query.provider_id) where.provider_id = String(query.provider_id);
    if (query.user_id) where.user_id = String(query.user_id);

    if (query.q) {
      const q = String(query.q);
      where.OR = [
        { listing: { title: { contains: q, mode: 'insensitive' } } },
        { provider: { name: { contains: q, mode: 'insensitive' } } },
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

  @Get(':id')
  async getOne(@Param('id') id: string) {
    const prisma = getPrisma();
    const b = await prisma.bookings.findUnique({
      where: { id },
      include: { listing: true, provider: true, user: true },
    });
    if (!b) throw new BadRequestException('booking not found');
    return b;
  }

  @Post(':id/status')
  async updateStatus(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    this.requireInternalToken(req);
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
