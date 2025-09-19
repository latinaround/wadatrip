import { Controller, Post, Get, Query, Body, BadRequestException, Patch, Param } from '@nestjs/common';
import { getPrisma } from '@wadatrip/db/src/client';

@Controller('listings')
export class ListingsController {
  @Post()
  async create(@Body() body: any) {
    const prisma = getPrisma();
    const required = ['provider_id', 'title', 'category', 'city', 'country_code'];
    for (const k of required) if (!body?.[k]) throw new BadRequestException(`missing ${k}`);

    const provider = await prisma.providers.findUnique({ where: { id: String(body.provider_id) } });
    if (!provider) throw new BadRequestException('provider not found');
    if (provider.status !== 'verified') throw new BadRequestException('provider must be verified');

    const listing = await prisma.listings.create({
      data: {
        provider_id: String(body.provider_id),
        title: String(body.title),
        description: body.description != null ? String(body.description) : null,
        category: String(body.category),
        city: String(body.city),
        country_code: String(body.country_code),
        duration_minutes: body.duration_minutes != null ? Number(body.duration_minutes) : null,
        price_from: body.price_from != null ? String(body.price_from) : null,
        currency: body.currency ? String(body.currency) : undefined,
        start_date: body.startDate ? new Date(String(body.startDate)) : (body.start_date ? new Date(String(body.start_date)) : null),
        end_date: body.endDate ? new Date(String(body.endDate)) : (body.end_date ? new Date(String(body.end_date)) : null),
        tags: Array.isArray(body.tags)
          ? body.tags.map((t: any) => String(t))
          : typeof body.tags === 'string'
            ? String(body.tags).split(',').map((s) => s.trim()).filter(Boolean)
            : [],
        status: body.status ? String(body.status) : undefined,
      },
    });
    return listing;
  }

  @Get('search')
  async search(@Query() query: any) {
    const prisma = getPrisma();
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(50, Math.max(1, Number(query.limit || 10)));
    const skip = (page - 1) * limit;

    const where: any = {};
    const includeAll = String(query.all || 'false').toLowerCase() === 'true';
    if (!includeAll) {
      where.status = query.status ? String(query.status) : 'published';
    } else if (query.status) {
      where.status = String(query.status);
    }
    if (query.city) where.city = String(query.city);
    if (query.country || query.country_code) where.country_code = String(query.country || query.country_code);
    if (query.category) where.category = String(query.category);
    if (query.q) where.title = { contains: String(query.q), mode: 'insensitive' };
    if (query.min_price || query.max_price) {
      where.price_from = {};
      if (query.min_price) where.price_from.gte = String(query.min_price);
      if (query.max_price) where.price_from.lte = String(query.max_price);
    }
    // Simple date range filters (optional)
    if (query.startDate || query.start_date) {
      const d = new Date(String(query.startDate || query.start_date));
      if (!isNaN(+d)) where.start_date = { gte: d };
    }
    if (query.endDate || query.end_date) {
      const d = new Date(String(query.endDate || query.end_date));
      if (!isNaN(+d)) where.end_date = where.end_date ? { ...where.end_date, lte: d } : { lte: d };
    }

    // Sorting
    let orderBy: any = { created_at: 'desc' };
    if (query.sort) {
      const raw = String(query.sort);
      const [field, dir] = raw.split(':');
      const direction = (dir || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';
      if (field === 'created_at') orderBy = { created_at: direction };
      if (field === 'price' || field === 'price_from') orderBy = { price_from: direction };
    }

    const [total, items] = await Promise.all([
      prisma.listings.count({ where }),
      prisma.listings.findMany({ where, orderBy, skip, take: limit }),
    ]);

    return { items, total, page, limit };
  }

  @Patch(':id/status')
  async updateStatus(@Param('id') id: string, @Body() body: any) {
    const prisma = getPrisma();
    const status = String(body?.status || '').toLowerCase();
    if (!['published', 'inactive', 'draft'].includes(status)) {
      throw new BadRequestException('invalid status');
    }
    const exists = await prisma.listings.findUnique({ where: { id: String(id) } });
    if (!exists) throw new BadRequestException('listing not found');
    const updated = await prisma.listings.update({ where: { id: String(id) }, data: { status } });
    return updated;
  }
}
