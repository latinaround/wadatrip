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
import { requireActor, requireBookingAccess, bookingScope, requireInternalToken } from '@wadatrip/common/security';
import { bookingSelect } from '@wadatrip/common/public-data';
import { calculateBookingPrice } from '@wadatrip/common/booking-price';

@Controller('bookings')
export class BookingsController {
  @Post()
  async create(@Req() req: any, @Body() body: any) {
    requireInternalToken(req);
    const prisma = getPrisma();
    const actor = await requireActor(req, prisma);
    const required = ['listing_id', 'date', 'num_people'];
    for (const k of required) if (!body?.[k]) throw new BadRequestException(`missing ${k}`);

    const listing = await prisma.listings.findUnique({ where: { id: String(body.listing_id) } });
    if (!listing) throw new BadRequestException('listing not found');

    const provider_id = listing.provider_id;
    const date = new Date(String(body.date));
    if (isNaN(+date)) throw new BadRequestException('invalid date');

    const price = calculateBookingPrice(listing, body.num_people);
    const isFreeTour = price.amount_cents === 0;

    const user_id = actor.id;

    const trip_id = body.trip_id ? String(body.trip_id) : null;
    if (trip_id) { const trip = await prisma.trips.findUnique({ where: { id: trip_id } }); if (!trip) throw new BadRequestException('trip not found'); if (trip.user_id !== String(user_id)) throw new BadRequestException('trip does not belong to traveler'); }

    const created = await prisma.bookings.create({
      data: {
        listing_id: String(body.listing_id),
        ...(trip_id ? { trip_id } : {}),
        provider_id,
        user_id: String(user_id),
        date,
        ...price,
        status: isFreeTour ? 'confirmed' : 'pending',
        payment_status: isFreeTour ? 'paid' : 'unpaid',
      },
    });

    return created;
  }

  // Lightweight booking path for quick reservations (defaults date=tomorrow, num_people=1)
  @Post('simple')
  async createSimple(@Req() req: any, @Body() body: any) {
    requireInternalToken(req);
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
  async list(@Query() query: any, @Req() req: any) {
    requireInternalToken(req);
    const actor = await requireActor(req, getPrisma());
    const prisma = getPrisma();
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 20)));
    const skip = (page - 1) * limit;
    const where: any = bookingScope(actor, query);

    if (query.status) where.status = String(query.status);
    if (query.payment_status) where.payment_status = String(query.payment_status);
    if (query.provider_id) where.provider_id = String(query.provider_id);
    if (actor.admin && query.user_id) where.user_id = String(query.user_id);

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
        select: bookingSelect,
      }),
    ]);

    return { items, total, page, limit };
  }

  @Get(':id')
  async getOne(@Param('id') id: string, @Req() req: any) {
    requireInternalToken(req);
    await requireBookingAccess(req, getPrisma(), id);
    const prisma = getPrisma();
    const b = await prisma.bookings.findUnique({
      where: { id },
      select: bookingSelect,
    });
    if (!b) throw new BadRequestException('booking not found');
    return b;
  }

  @Post(':id/status')
  async updateStatus(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    requireInternalToken(req);
    const prisma = getPrisma();

    await requireBookingAccess(req, prisma, id, 'manage');
    if (body?.payment_status != null) throw new BadRequestException('payment status is managed by signed payment events');
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
