import { Controller, Post, Get, Query, Body, BadRequestException, ConflictException, Patch, Delete, Param, Req } from '@nestjs/common';
import { getPrisma } from '@wadatrip/db';
import type { Request } from 'express';

import { requireAdmin, requireProviderAccess } from '@wadatrip/common/security';
import { publicListingSelect, publicProviderSelect } from '@wadatrip/common/public-data';
import { lockedListing, occupied } from '@wadatrip/common/booking-capacity';

function utcDay(value: any): Date {
  const text = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new BadRequestException('date must be YYYY-MM-DD');
  const day = new Date(`${text}T00:00:00.000Z`);
  if (!Number.isFinite(day.getTime()) || day.toISOString().slice(0, 10) !== text) throw new BadRequestException('date must be valid');
  return day;
}

function normalizeCutoff(value: any): number | null {
  if (value == null || value === '') return null;
  const hours = Number(value);
  if (!Number.isInteger(hours) || hours < 0 || hours > 8760) {
    throw new BadRequestException('booking_cutoff_hours must be an integer from 0 to 8760');
  }
  return hours;
}

const managedListingSelect = {
  id: true, provider_id: true, operator_id: true, title: true, description: true,
  category: true, city: true, country_code: true, duration_minutes: true,
  price_from: true, currency: true, start_date: true, end_date: true,
  timezone: true, meeting_point: true, cancellation_policy: true,
  booking_cutoff_hours: true, operational_contact: true, tags: true,
  status: true, cover_image_url: true, created_at: true,
} as const;

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
        timezone: body.timezone ? String(body.timezone).trim() : null,
        meeting_point: body.meeting_point ? String(body.meeting_point).trim() : null,
        cancellation_policy: body.cancellation_policy ? String(body.cancellation_policy).trim() : null,
        booking_cutoff_hours: normalizeCutoff(body.booking_cutoff_hours),
        operational_contact: body.operational_contact ? String(body.operational_contact).trim() : null,
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

  @Get(':id/availability')
  async publicAvailability(@Param('id') id: string) {
    const prisma = getPrisma();
    const listing = await prisma.listings.findUnique({ where: { id: String(id) }, select: { id: true, status: true } });
    if (!listing || !['published', 'approved'].includes(String(listing.status).toLowerCase())) throw new BadRequestException('listing not found');
    const today = new Date(); today.setUTCHours(0, 0, 0, 0);
    const items = await prisma.listing_availability.findMany({ where: { listing_id: listing.id, date: { gte: today }, spots_available: { gt: 0 } }, orderBy: { date: 'asc' }, select: { date: true, spots_available: true } });
    return { items: items.map((item) => ({ date: item.date.toISOString().slice(0, 10), spots_available: item.spots_available })) };
  }

  @Get(':id/availability/manage')
  async manageAvailability(@Param('id') id: string, @Req() req: Request) {
    const prisma = getPrisma();
    const listing = await prisma.listings.findUnique({ where: { id: String(id) } });
    if (!listing) throw new BadRequestException('listing not found');
    await requireProviderAccess(req, prisma, listing.provider_id);
    const items = await prisma.listing_availability.findMany({
      where: { listing_id: listing.id },
      orderBy: { date: 'asc' },
      select: { id: true, date: true, spots_total: true, spots_available: true },
    });
    return { items: items.map((item) => ({ ...item, date: item.date.toISOString().slice(0, 10) })) };
  }

  @Get(':id/manage')
  async getManaged(@Param('id') id: string, @Req() req: Request) {
    const prisma = getPrisma();
    const listing = await prisma.listings.findUnique({ where: { id: String(id) } });
    if (!listing) throw new BadRequestException('listing not found');
    await requireProviderAccess(req, prisma, listing.provider_id);
    return prisma.listings.findUnique({ where: { id: listing.id }, select: managedListingSelect });
  }

  @Post(':id/availability')
  async upsertAvailability(@Param('id') id: string, @Body() body: any, @Req() req: Request) {
    const prisma = getPrisma();
    const listing = await prisma.listings.findUnique({ where: { id: String(id) } });
    if (!listing) throw new BadRequestException('listing not found');
    await requireProviderAccess(req, prisma, listing.provider_id);
    const day = utcDay(body?.date); const total = Number(body?.spots_total);
    if (!Number.isInteger(total) || total < 1) throw new BadRequestException('spots_total must be at least 1');
    const today = new Date(); today.setUTCHours(0, 0, 0, 0); if (day < today) throw new BadRequestException('availability date must not be in the past');
    const end = new Date(+day + 86400000);
    const result = await prisma.$transaction(async (tx: any) => {
      await lockedListing(tx, listing.id);
      const existingSlots = await tx.listing_availability.findMany({ where: { listing_id: listing.id, date: { gte: day, lt: end } }, orderBy: { id: 'asc' } });
      if (existingSlots.length > 1) throw new ConflictException('availability is ambiguous for this date; investigate duplicate entries');
      const existing = existingSlots[0] || null;
      const used = await occupied(tx, listing.id, day);
      if (used > total) throw new ConflictException('spots_total cannot be below current occupancy');
      const data = { spots_total: total, spots_available: total - used };
      return existing ? tx.listing_availability.update({ where: { id: existing.id }, data }) : tx.listing_availability.create({ data: { listing_id: listing.id, date: day, ...data } });
    });
    return { ...result, date: result.date.toISOString().slice(0, 10) };
  }

  @Delete(':id/availability/:date')
  async deleteAvailability(@Param('id') id: string, @Param('date') rawDate: string, @Req() req: Request) {
    const prisma = getPrisma(); const listing = await prisma.listings.findUnique({ where: { id: String(id) } });
    if (!listing) throw new BadRequestException('listing not found');
    await requireProviderAccess(req, prisma, listing.provider_id);
    const day = utcDay(rawDate); const end = new Date(+day + 86400000);
    await prisma.$transaction(async (tx: any) => {
      await lockedListing(tx, listing.id);
      const slots = await tx.listing_availability.findMany({ where: { listing_id: listing.id, date: { gte: day, lt: end } }, orderBy: { id: 'asc' } });
      if (slots.length > 1) throw new ConflictException('availability is ambiguous for this date; investigate duplicate entries');
      const slot = slots[0] || null;
      if (!slot) return;
      if (await occupied(tx, listing.id, day) > 0) throw new ConflictException('availability cannot be removed while bookings consume capacity');
      await tx.listing_availability.delete({ where: { id: slot.id } });
    });
    return { ok: true };
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
