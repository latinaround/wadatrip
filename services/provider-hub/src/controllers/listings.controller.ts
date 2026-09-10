import { Controller, Post, Get, Query, Body, BadRequestException, Patch, Param, Req } from '@nestjs/common';
import { getPrisma } from '@wadatrip/db';
import type { Request } from 'express';

import { requireAdmin, requireProviderAccess } from '@wadatrip/common/security';
import { publicListingSelect, publicProviderSelect } from '@wadatrip/common/public-data';

@Controller('listings')
export class ListingsController {
  @Get()
  async list(@Query() query: any, @Req() req: Request) {
    // Wrapper to reuse the search logic (defaults to visible listings)
    return this.search(query, req);
  }

  @Post()
  async create(@Req() req: Request, @Body() body: any) {
    const prisma = getPrisma();
    const required = ['provider_id', 'title', 'category', 'city', 'country_code'];
    for (const k of required) if (!body?.[k]) throw new BadRequestException(`missing ${k}`);

    const provider = await prisma.providers.findUnique({ where: { id: String(body.provider_id) } });
    if (!provider) throw new BadRequestException('provider not found');
    const { actor } = await requireProviderAccess(req, prisma, provider.id);
    const allowUnverified = actor.admin;
    if (!allowUnverified && !['approved', 'verified'].includes(String(provider.status || '').toLowerCase()))
      throw new BadRequestException('provider must be approved');

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
        cover_image_url: body.cover_image_url ?? body.coverImageUrl ?? null,
      },
    });
    return listing;
  }

  @Get('search')
  async search(@Query() query: any, @Req() req: Request) {
    const prisma = getPrisma();
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(50, Math.max(1, Number(query.limit || 10)));
    const skip = (page - 1) * limit;

    const where: any = {};
    const includeAll = String(query.all || 'false').toLowerCase() === 'true';
    if (!includeAll) {
      // Show visible listings by default: published or approved
      const statusParam = query.status ? String(query.status).toLowerCase() : null;
      if (statusParam) {
        where.status = statusParam;
      } else {
        where.status = { in: ['published', 'approved'] };
      }
    } else if (query.status) {
      where.status = String(query.status);
    }
    if (includeAll || (query.status && !['published', 'approved'].includes(String(query.status).toLowerCase()))) {
      if (query.provider_id) await requireProviderAccess(req, prisma, String(query.provider_id));
      else await requireAdmin(req, prisma);
    }
    if (query.city) where.city = String(query.city);
    if (query.country || query.country_code) where.country_code = String(query.country || query.country_code);
    if (query.category) where.category = String(query.category);
    if (query.q) where.title = { contains: String(query.q), mode: 'insensitive' };
    if (query.provider_id) where.provider_id = String(query.provider_id);
    const minPrice = query.min_price ?? query.price_min;
    const maxPrice = query.max_price ?? query.price_max;
    if (minPrice || maxPrice) {
      where.price_from = {};
      if (minPrice) where.price_from.gte = String(minPrice);
      if (maxPrice) where.price_from.lte = String(maxPrice);
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
      prisma.listings.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        select: { ...publicListingSelect, provider: { select: publicProviderSelect } },
      }),
    ]);

    const mapped = items.map((item) => ({
      ...item,
      provider_name: item.provider?.name ?? null,
      provider_country: item.provider?.country_code ?? null,
      provider_status: item.provider?.status ?? null,
      provider_verified_level: item.provider?.verified_level ?? null,
      provider_photo_url: item.provider?.photo_url ?? null,
      provider_bio_short: item.provider?.bio_short ?? null,
      provider_instagram_handle: item.provider?.instagram_handle ?? null,
      provider_ratings_avg: item.provider?.ratings_avg ?? 0,
      provider_ratings_count: item.provider?.ratings_count ?? 0,
    }));

    return { items: mapped, total, page, limit };
  }

  @Patch(':id/status')
  async updateStatus(@Param('id') id: string, @Body() body: any, @Req() req: Request) {
    const prisma = getPrisma();
    const status = String(body?.status || '').toLowerCase();
    if (!['published', 'inactive', 'draft'].includes(status)) {
      throw new BadRequestException('invalid status');
    }
    const exists = await prisma.listings.findUnique({ where: { id: String(id) } });
    if (!exists) throw new BadRequestException('listing not found');
    const { actor, provider } = await requireProviderAccess(req, prisma, exists.provider_id);
    if (!actor.admin && status === 'published' && !['approved', 'verified'].includes(provider.status)) throw new BadRequestException('provider must be approved');
    const updated = await prisma.listings.update({ where: { id: String(id) }, data: { status } });
    return updated;
  }

  @Get(':id')
  async getOne(@Param('id') id: string, @Req() req: Request) {
    const prisma = getPrisma();
    const listing = await prisma.listings.findUnique({
      where: { id: String(id) },
      select: { ...publicListingSelect, provider: { select: publicProviderSelect } },
    });
    if (!listing) throw new BadRequestException('listing not found');
    if (!['published', 'approved'].includes(listing.status)) await requireProviderAccess(req, prisma, listing.provider_id);
    return {
      ...listing,
      provider_name: listing.provider?.name ?? null,
      provider_country: listing.provider?.country_code ?? null,
      provider_status: listing.provider?.status ?? null,
      provider_verified_level: listing.provider?.verified_level ?? null,
      provider_photo_url: listing.provider?.photo_url ?? null,
      provider_bio_short: listing.provider?.bio_short ?? null,
      provider_instagram_handle: listing.provider?.instagram_handle ?? null,
      provider_ratings_avg: listing.provider?.ratings_avg ?? 0,
      provider_ratings_count: listing.provider?.ratings_count ?? 0,
    };
  }
}

