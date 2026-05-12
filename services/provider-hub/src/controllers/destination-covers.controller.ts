import { Controller, Get, Post, Query, Body, Req, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { getPrisma } from '@wadatrip/db';
import type { Request } from 'express';

const ACCESS_CODE = process.env.OPERATOR_ACCESS_CODE || '';

function normalizeSlug(value: string) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildSlug(city: string, countryCode?: string | null) {
  const base = [city, countryCode].filter(Boolean).join(' ');
  return normalizeSlug(base);
}

function requireAccessCode(req: Request, body: any) {
  if (!ACCESS_CODE) return;
  const headerCode = req.headers['x-operator-access-code'];
  const raw = headerCode ?? body?.access_code ?? body?.accessCode ?? '';
  const provided = String(raw || '').trim();
  if (!provided || provided !== ACCESS_CODE) {
    throw new UnauthorizedException('invalid access code');
  }
}

@Controller('destination-covers')
export class DestinationCoversController {
  @Get()
  async list(@Query() query: any) {
    const prisma = getPrisma();
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 50)));
    const skip = (page - 1) * limit;
    const where: any = {};

    if (query.active != null) where.active = String(query.active).toLowerCase() !== 'false';
    if (query.slug) where.slug = normalizeSlug(String(query.slug));
    if (query.city) where.city = { equals: String(query.city), mode: 'insensitive' };
    if (query.country_code) where.country_code = String(query.country_code).toUpperCase();
    if (query.q) {
      const term = String(query.q);
      where.OR = [
        { city: { contains: term, mode: 'insensitive' } },
        { title: { contains: term, mode: 'insensitive' } },
        { country_code: { contains: term, mode: 'insensitive' } },
      ];
    }

    const [total, items] = await Promise.all([
      prisma.destination_covers.count({ where }),
      prisma.destination_covers.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return { items, total, page, limit };
  }

  @Get('resolve')
  async resolve(@Query() query: any) {
    const prisma = getPrisma();
    const city = query.city ? String(query.city).trim() : '';
    const countryCode = query.country_code ? String(query.country_code).trim().toUpperCase() : '';
    const requestedSlug = query.slug ? normalizeSlug(String(query.slug)) : '';
    const derivedSlug = !requestedSlug && city ? buildSlug(city, countryCode || null) : '';
    const slug = requestedSlug || derivedSlug || null;

    let item = null;
    if (slug) {
      item = await prisma.destination_covers.findFirst({
        where: { slug, active: true },
      });
    }
    if (!item && city && countryCode) {
      item = await prisma.destination_covers.findFirst({
        where: {
          city: { equals: city, mode: 'insensitive' },
          country_code: countryCode,
          active: true,
        },
        orderBy: { created_at: 'desc' },
      });
    }
    if (!item && city) {
      item = await prisma.destination_covers.findFirst({
        where: {
          city: { equals: city, mode: 'insensitive' },
          active: true,
        },
        orderBy: { created_at: 'desc' },
      });
    }

    return { item, resolved: !!item, slug };
  }

  @Post()
  async upsert(@Req() req: Request, @Body() body: any) {
    requireAccessCode(req, body);

    const prisma = getPrisma();
    const city = String(body?.city || '').trim();
    const imageUrl = String(body?.image_url || body?.imageUrl || '').trim();
    if (!city) throw new BadRequestException('missing city');
    if (!imageUrl) throw new BadRequestException('missing image_url');

    const countryCode = body?.country_code ? String(body.country_code).trim().toUpperCase() : null;
    const slug = normalizeSlug(String(body?.slug || buildSlug(city, countryCode)));
    if (!slug) throw new BadRequestException('missing slug');

    return prisma.destination_covers.upsert({
      where: { slug },
      update: {
        city,
        country_code: countryCode,
        title: body?.title ? String(body.title).trim() : null,
        image_url: imageUrl,
        eyebrow: body?.eyebrow ? String(body.eyebrow).trim() : null,
        active: body?.active == null ? true : String(body.active).toLowerCase() !== 'false',
      },
      create: {
        slug,
        city,
        country_code: countryCode,
        title: body?.title ? String(body.title).trim() : null,
        image_url: imageUrl,
        eyebrow: body?.eyebrow ? String(body.eyebrow).trim() : null,
        active: body?.active == null ? true : String(body.active).toLowerCase() !== 'false',
      },
    });
  }
}