import { Controller, Get, Post, Param, Body, Query, BadRequestException } from '@nestjs/common';
import { getPrisma } from '@wadatrip/db/src/client';

@Controller('bookings')
export class BookingsController {
  @Post()
  async create(@Body() body: any) {
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
    // Resolve user
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

  @Get()
  async list(@Query() query: any) {
    const prisma = getPrisma();
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 20)));
    const skip = (page - 1) * limit;
    const where: any = {};
    if (query.status) where.status = String(query.status);
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
      prisma.bookings.findMany({ where, orderBy: { created_at: 'desc' }, skip, take: limit, include: { listing: true, provider: true, user: true } }),
    ]);
    return { items, total, page, limit };
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    const prisma = getPrisma();
    const b = await prisma.bookings.findUnique({ where: { id }, include: { listing: true, provider: true, user: true } });
    if (!b) throw new BadRequestException('booking not found');
    return b;
  }

  @Post(':id/status')
  async updateStatus(@Param('id') id: string, @Body() body: any) {
    const prisma = getPrisma();
    const allowed = ['pending', 'confirmed', 'cancelled', 'completed'];
    const status = String(body?.status || '').toLowerCase();
    if (!allowed.includes(status)) throw new BadRequestException('invalid status');
    const exists = await prisma.bookings.findUnique({ where: { id } });
    if (!exists) throw new BadRequestException('booking not found');
    const updated = await prisma.bookings.update({ where: { id }, data: { status } });
    return updated;
  }
}
