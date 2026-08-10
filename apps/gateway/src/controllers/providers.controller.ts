import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
  Patch,
  Delete,
  BadRequestException,
  UnauthorizedException,
  Req,
} from '@nestjs/common';
import axios from 'axios';
import { getPrisma } from '@wadatrip/db';
import type { Request } from 'express';
import { getUserIdFromAuth } from '../utils/auth';

const HUB = process.env.PROVIDER_HUB_URL || 'http://localhost:3014';
const ENABLED = (process.env.FF_PROVIDER_HUB || 'false').toLowerCase() === 'true';
const ACCESS_CODE = process.env.OPERATOR_ACCESS_CODE || '';
const hasOwn = Object.prototype.hasOwnProperty;

function normalizeTags(tags: any): string[] {
  if (Array.isArray(tags)) return tags.map((t) => String(t));
  if (typeof tags === 'string') {
    return String(tags)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeLanguages(value: any): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeNullableString(value: any): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text ? text : null;
}

function normalizeInstagram(value: any): string | null {
  const text = normalizeNullableString(value);
  return text ? text.replace(/^@+/, '') : null;
}

function normalizeType(value: any): 'guide' | 'operator' {
  return String(value || '').toLowerCase() === 'operator' ? 'operator' : 'guide';
}

const COUNTRY_NAME_TO_CODE: Record<string, string> = {
  peru: 'PE',
  'perú': 'PE',
  us: 'US',
  usa: 'US',
  'united states': 'US',
  'united states of america': 'US',
  mexico: 'MX',
  colombia: 'CO',
  argentina: 'AR',
  chile: 'CL',
  ecuador: 'EC',
  bolivia: 'BO',
  brazil: 'BR',
  brasil: 'BR',
  spain: 'ES',
  españa: 'ES',
  italy: 'IT',
  italia: 'IT',
  france: 'FR',
  francia: 'FR',
  portugal: 'PT',
  'united kingdom': 'GB',
  uk: 'GB',
  england: 'GB',
};

function normalizeCountryCode(value: any): string | null {
  const text = normalizeNullableString(value);
  if (!text) return null;
  const upper = text.toUpperCase();
  if (/^[A-Z]{2}$/.test(upper)) return upper;
  return COUNTRY_NAME_TO_CODE[text.toLowerCase()] || null;
}

function requireListingText(value: any, field: string): string {
  const text = normalizeNullableString(value);
  if (!text) throw new BadRequestException(`${field} is required`);
  return text;
}

function normalizeListingNumber(value: any, field: string, { allowZero = false, integer = false } = {}): number | null {
  if (value == null || value === '') return null;
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    throw new BadRequestException(`${field} must be a valid number`);
  }
  if (integer && !Number.isInteger(numberValue)) {
    throw new BadRequestException(`${field} must be a whole number`);
  }
  if (allowZero ? numberValue < 0 : numberValue <= 0) {
    throw new BadRequestException(`${field} must be greater than ${allowZero ? 'or equal to ' : ''}0`);
  }
  return numberValue;
}

function normalizeListingDate(value: any, field: string): Date | null {
  if (value == null || value === '') return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(`${field} must be a valid date`);
  }
  return date;
}

function normalizeListingStatus(value: any, fallback = 'draft') {
  const status = String(value || fallback).toLowerCase();
  if (!['draft', 'published', 'inactive'].includes(status)) {
    throw new BadRequestException('invalid status');
  }
  return status;
}

function hasValidAccessCode(req: Request, body: any) {
  if (!ACCESS_CODE) return false;
  const headerCode = req.headers['x-operator-access-code'];
  const raw = headerCode ?? body?.access_code ?? body?.accessCode ?? '';
  const provided = String(raw || '').trim();
  return Boolean(provided) && provided === ACCESS_CODE;
}

function requireAccessCode(req: Request, body: any) {
  if (!ACCESS_CODE) return;
  if (!hasValidAccessCode(req, body)) {
    throw new UnauthorizedException('invalid access code');
  }
}

async function getAuthenticatedUser(req: Request) {
  const userId = getUserIdFromAuth(req);
  if (!userId) return null;
  const prisma = getPrisma();
  return prisma.users.findUnique({ where: { id: String(userId) } });
}

async function loadProviderWithRelations(prisma: any, id: string) {
  return prisma.providers.findUnique({
    where: { id },
    include: {
      documents: true,
      listings: {
        orderBy: { created_at: 'desc' },
      },
    },
  });
}

async function findOwnedProvider(prisma: any, user: any) {
  const email = String(user?.email || '').toLowerCase();
  if (!user?.id || !email) return null;

  const provider = await prisma.providers.findFirst({
    where: {
      OR: [{ user_id: String(user.id) }, { email }],
    },
    orderBy: { created_at: 'asc' },
  });

  if (!provider) return null;

  if (provider.user_id !== user.id || provider.email !== email) {
    await prisma.providers.update({
      where: { id: provider.id },
      data: {
        user_id: String(user.id),
        email,
      },
    });
  }

  return loadProviderWithRelations(prisma, provider.id);
}

function mapListingWithProvider(item: any) {
  const providerStatus = String(item.provider?.status ?? '').toLowerCase();
  const verifiedLevel = String(item.provider?.verified_level ?? '').toLowerCase();
  const isVerified = providerStatus === 'verified' || providerStatus === 'approved';
  const isLicensed = isVerified && verifiedLevel === 'licensed';
  const rating = Math.min(5, Math.max(0, Number(item.provider?.ratings_avg ?? 0) || 0));
  const ratingCount = Math.max(0, Number(item.provider?.ratings_count ?? 0) || 0);
  const providerTrustScore =
    (isLicensed ? 50 : isVerified ? 35 : 0) +
    rating * 4 +
    Math.min(10, Math.log10(ratingCount + 1) * 5);

  return {
    ...item,
    provider_name: item.provider?.name ?? null,
    provider_country: item.provider?.country_code ?? null,
    provider_status: item.provider?.status ?? null,
    provider_verified_level: item.provider?.verified_level ?? null,
    provider_photo_url: item.provider?.photo_url ?? null,
    provider_bio_short: item.provider?.bio_short ?? null,
    provider_phone: item.provider?.phone ?? null,
    provider_instagram_handle: item.provider?.instagram_handle ?? null,
    provider_ratings_avg: item.provider?.ratings_avg ?? 0,
    provider_ratings_count: item.provider?.ratings_count ?? 0,
    provider_trust_score: Number(providerTrustScore.toFixed(2)),
    provider_badge: isLicensed ? 'Licensed guide' : isVerified ? 'Verified host' : null,
  };
}

function compareFeaturedListings(left: any, right: any) {
  const scoreDifference = Number(right.provider_trust_score ?? 0) - Number(left.provider_trust_score ?? 0);
  if (scoreDifference !== 0) return scoreDifference;
  const ratingDifference = Number(right.provider_ratings_avg ?? 0) - Number(left.provider_ratings_avg ?? 0);
  if (ratingDifference !== 0) return ratingDifference;
  const reviewDifference = Number(right.provider_ratings_count ?? 0) - Number(left.provider_ratings_count ?? 0);
  if (reviewDifference !== 0) return reviewDifference;
  return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
}

function buildOwnedProviderData(body: any, user: any, existing: any) {
  const fallbackName = String(user?.name || user?.email || 'Guide').trim();
  const nextName = normalizeNullableString(body?.name) ?? existing?.name ?? fallbackName;
  const nextBaseCity = normalizeNullableString(body?.base_city) ?? existing?.base_city ?? null;
  const countryCandidate = normalizeNullableString(body?.country_code) ?? existing?.country_code ?? null;
  const nextCountryCode = countryCandidate ? String(countryCandidate).toUpperCase() : null;

  if (!nextName) {
    throw new BadRequestException('name is required');
  }
  if (!nextBaseCity) {
    throw new BadRequestException('base_city is required');
  }
  if (!nextCountryCode) {
    throw new BadRequestException('country_code is required');
  }

  return {
    user_id: String(user.id),
    email: String(user.email || '').toLowerCase(),
    type: normalizeType(body?.type ?? existing?.type ?? 'guide'),
    name: nextName,
    phone: hasOwn.call(body, 'phone')
      ? normalizeNullableString(body.phone)
      : existing?.phone ?? null,
    instagram_handle:
      hasOwn.call(body, 'instagram_handle') || hasOwn.call(body, 'instagramHandle')
        ? normalizeInstagram(body?.instagram_handle ?? body?.instagramHandle)
        : existing?.instagram_handle ?? null,
    languages: hasOwn.call(body, 'languages')
      ? normalizeLanguages(body.languages)
      : Array.isArray(existing?.languages)
        ? existing.languages
        : [],
    base_city: nextBaseCity,
    country_code: nextCountryCode,
    photo_url: hasOwn.call(body, 'photo_url')
      ? normalizeNullableString(body.photo_url)
      : existing?.photo_url ?? null,
    bio_short: hasOwn.call(body, 'bio_short')
      ? normalizeNullableString(body.bio_short)
      : existing?.bio_short ?? null,
    license_url: hasOwn.call(body, 'license_url')
      ? normalizeNullableString(body.license_url)
      : existing?.license_url ?? null,
    verified_level: existing?.verified_level ?? 'community',
    status: existing?.status ?? 'pending',
  };
}

async function upsertOwnedProvider(prisma: any, user: any, body: any) {
  const existing = await findOwnedProvider(prisma, user);
  const data = buildOwnedProviderData(body, user, existing);

  if (existing) {
    const updated = await prisma.providers.update({
      where: { id: existing.id },
      data,
      include: {
        documents: true,
        listings: {
          orderBy: { created_at: 'desc' },
        },
      },
    });
    return updated;
  }

  const created = await prisma.providers.create({
    data,
    include: {
      documents: true,
      listings: {
        orderBy: { created_at: 'desc' },
      },
    },
  });
  return created;
}

async function authorizeListingMutation(prisma: any, req: Request, body: any, listingId: string) {
  const listing = await prisma.listings.findUnique({
    where: { id: String(listingId) },
    include: { provider: true },
  });
  if (!listing) throw new BadRequestException('listing not found');

  const user = await getAuthenticatedUser(req);
  if (user) {
    const ownedProvider = await findOwnedProvider(prisma, user);
    if (ownedProvider?.id === listing.provider_id) {
      return { listing, owned: true, user, provider: ownedProvider };
    }
  }

  requireAccessCode(req, body);
  return { listing, owned: false, user: null, provider: listing.provider };
}

@Controller()
export class ProvidersController {
  @Get('providers')
  async listProviders(@Query() q: Record<string, any>) {
    if (ENABLED) {
      const { data } = await axios.get(`${HUB}/providers`, { params: q });
      return data;
    }

    const prisma = getPrisma();
    const page = Math.max(1, Number(q.page || 1));
    const limit = Math.min(100, Math.max(1, Number(q.limit || 50)));
    const skip = (page - 1) * limit;
    const where: any = {};

    if (q.status) where.status = String(q.status);
    if (q.q) {
      const term = String(q.q);
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { email: { contains: term, mode: 'insensitive' } },
        { base_city: { contains: term, mode: 'insensitive' } },
        { country_code: { contains: term, mode: 'insensitive' } },
      ];
    }

    const [total, items] = await Promise.all([
      prisma.providers.count({ where }),
      prisma.providers.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return { items, total, page, limit };
  }

  @Get('providers/me')
  async getMyProvider(@Req() req: Request) {
    const user = await getAuthenticatedUser(req);
    if (!user) throw new UnauthorizedException('not authenticated');

    const prisma = getPrisma();
    const provider = await findOwnedProvider(prisma, user);
    return provider ?? null;
  }

  @Patch('providers/me')
  async upsertMyProvider(@Req() req: Request, @Body() body: any) {
    const user = await getAuthenticatedUser(req);
    if (!user) throw new UnauthorizedException('not authenticated');

    const prisma = getPrisma();
    return upsertOwnedProvider(prisma, user, body);
  }

  @Get('providers/me/listings')
  async listMyProviderListings(@Req() req: Request, @Query() query: any) {
    const user = await getAuthenticatedUser(req);
    if (!user) throw new UnauthorizedException('not authenticated');

    const prisma = getPrisma();
    const provider = await findOwnedProvider(prisma, user);
    if (!provider) return { items: [], total: 0, page: 1, limit: 50 };

    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 50)));
    const skip = (page - 1) * limit;

    const [total, items] = await Promise.all([
      prisma.listings.count({ where: { provider_id: provider.id } }),
      prisma.listings.findMany({
        where: { provider_id: provider.id },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
        include: {
          provider: {
            select: {
              name: true,
              country_code: true,
              status: true,
              verified_level: true,
              photo_url: true,
              bio_short: true,
              phone: true,
              instagram_handle: true,
              ratings_avg: true,
              ratings_count: true,
            },
          },
        },
      }),
    ]);

    return { items: items.map(mapListingWithProvider), total, page, limit };
  }

  @Post('providers')
  async createProvider(@Req() req: Request, @Body() body: any) {
    const prisma = getPrisma();
    const authenticatedUser = await getAuthenticatedUser(req);

    if (authenticatedUser) {
      return upsertOwnedProvider(prisma, authenticatedUser, body);
    }

    requireAccessCode(req, body);
    if (ENABLED) {
      const { data } = await axios.post(`${HUB}/providers`, body);
      return data;
    }

    const required = ['type', 'name', 'email', 'base_city', 'country_code'];
    for (const k of required) {
      if (!body?.[k]) throw new BadRequestException(`missing ${k}`);
    }

    const languages = normalizeLanguages(body.languages);

    try {
      const created = await prisma.providers.create({
        data: {
          type: normalizeType(body.type),
          name: String(body.name),
          email: String(body.email).toLowerCase(),
          phone: normalizeNullableString(body.phone),
          instagram_handle: normalizeInstagram(body.instagram_handle ?? body.instagramHandle),
          languages,
          base_city: String(body.base_city),
          country_code: String(body.country_code).toUpperCase(),
          photo_url: normalizeNullableString(body.photo_url),
          bio_short: normalizeNullableString(body.bio_short),
          status: 'pending',
          verified_level:
            String(body.verified_level || 'community').toLowerCase() === 'licensed'
              ? 'licensed'
              : 'community',
          license_url: normalizeNullableString(body.license_url),
        },
        include: { documents: true, listings: true },
      });

      return created;
    } catch (error: any) {
      const code = error?.code ?? error?.meta?.code;
      if (code === 'P2002') {
        throw new BadRequestException('email already registered');
      }
      throw error;
    }
  }

  @Get('providers/:id')
  async getProvider(@Param('id') id: string) {
    if (ENABLED) {
      const { data } = await axios.get(`${HUB}/providers/${id}`);
      return data;
    }

    const prisma = getPrisma();
    const provider = await prisma.providers.findUnique({
      where: { id: String(id) },
      include: { documents: true, listings: true },
    });
    if (!provider) throw new BadRequestException('provider not found');
    return provider;
  }

  @Post('providers/:id/verify')
  async verifyProvider(@Param('id') id: string, @Body() body: any) {
    if (ENABLED) {
      const { data } = await axios.post(`${HUB}/providers/${id}/verify`, body);
      return data;
    }

    const prisma = getPrisma();
    const rawStatus = String(body?.status || '').toLowerCase();
    const status = rawStatus === 'verified' ? 'approved' : rawStatus;
    if (!['approved', 'rejected'].includes(status)) {
      throw new BadRequestException('status must be approved|rejected');
    }

    await prisma.providers.update({
      where: { id: String(id) },
      data: {
        verification_status: status,
        status: status === 'approved' ? 'verified' : 'rejected',
        stripe_account_id: body.stripe_account_id ?? undefined,
      },
    });

    return { message: 'updated' };
  }

  @Post('providers/register')
  async registerProvider(@Req() req: Request, @Body() body: any) {
    return this.createProvider(req, body);
  }

  @Get('providers/:id/verification-status')
  async verificationStatus(@Param('id') id: string) {
    if (ENABLED) {
      const { data } = await axios.get(`${HUB}/providers/${id}/verification-status`);
      return data;
    }

    const prisma = getPrisma();
    const provider = await prisma.providers.findUnique({
      where: { id: String(id) },
      include: { documents: true },
    });
    if (!provider) throw new BadRequestException('provider not found');
    return {
      id: provider.id,
      verification_status: provider.verification_status,
      verification_score: provider.verification_score,
      risk_level: provider.risk_level,
      detected_name: provider.detected_name,
      document_valid: provider.document_valid,
      documents: provider.documents,
    };
  }

  @Post('providers/:id/resubmit')
  async resubmit(@Param('id') id: string) {
    if (ENABLED) {
      const { data } = await axios.post(`${HUB}/providers/${id}/resubmit`);
      return data;
    }

    const prisma = getPrisma();
    const provider = await prisma.providers.findUnique({ where: { id: String(id) } });
    if (!provider) throw new BadRequestException('provider not found');

    await prisma.providers.update({
      where: { id: String(id) },
      data: {
        verification_status: 'pending',
        verification_score: null,
        risk_level: null,
        detected_name: null,
        document_valid: false,
        status: 'review_required',
      },
    });

    return { message: 'resubmitted' };
  }

  @Post('listings')
  async createListing(@Req() req: Request, @Body() body: any) {
    const prisma = getPrisma();
    const providerId = requireListingText(body?.provider_id, 'provider_id');
    const title = requireListingText(body?.title, 'title');
    const category = requireListingText(body?.category, 'category');
    const city = requireListingText(body?.city, 'city');
    const countryCode = normalizeCountryCode(body?.country_code);
    if (!countryCode) {
      throw new BadRequestException('country_code must be a valid ISO2 code');
    }
    const tags = normalizeTags(body?.tags);
    const isFreeTour = tags.includes('free_tour');
    const durationMinutes = normalizeListingNumber(body?.duration_minutes, 'duration_minutes', { integer: true });
    const priceFrom = isFreeTour
      ? null
      : normalizeListingNumber(body?.price_from, 'price_from', { allowZero: false });
    const startDate = normalizeListingDate(body?.startDate ?? body?.start_date, 'start_date');
    const endDate = normalizeListingDate(body?.endDate ?? body?.end_date, 'end_date');
    if (startDate && endDate && endDate < startDate) {
      throw new BadRequestException('end_date must be after start_date');
    }

    const provider = await prisma.providers.findUnique({ where: { id: providerId } });
    if (!provider) throw new BadRequestException('provider not found');

    const authenticatedUser = await getAuthenticatedUser(req);
    const ownedProvider = authenticatedUser ? await findOwnedProvider(prisma, authenticatedUser) : null;
    const isOwner = ownedProvider?.id === provider.id;
    const accessGranted = isOwner || hasValidAccessCode(req, body);

    if (!accessGranted) {
      throw new UnauthorizedException('not authorized');
    }

    const requestedStatus = normalizeListingStatus(body?.status, 'draft');
    const providerApproved = ['approved', 'verified'].includes(String(provider.status || '').toLowerCase());
    const finalStatus = !providerApproved && !hasValidAccessCode(req, body) && requestedStatus === 'published'
      ? 'draft'
      : requestedStatus;

    const listing = await prisma.listings.create({
      data: {
        provider_id: providerId,
        operator_id: isOwner ? String(authenticatedUser?.id) : body.operator_id ? String(body.operator_id) : undefined,
        title,
        description: normalizeNullableString(body.description),
        category,
        city,
        country_code: countryCode,
        duration_minutes: durationMinutes,
        price_from: priceFrom != null ? String(priceFrom) : null,
        currency: isFreeTour ? undefined : normalizeNullableString(body.currency) ?? undefined,
        start_date: startDate,
        end_date: endDate,
        tags,
        status: finalStatus,
        cover_image_url: normalizeNullableString(body.cover_image_url ?? body.coverImageUrl),
      },
    });

    return listing;
  }

  @Get('listings')
  async listListings(@Query() query: any) {
    if (ENABLED) {
      const { data } = await axios.get(`${HUB}/listings`, { params: query });
      return data;
    }
    return this.searchListings(query);
  }

  @Get('listings/search')
  async searchListings(@Query() query: any) {
    if (ENABLED) {
      const { data } = await axios.get(`${HUB}/listings/search`, { params: query });
      return data;
    }

    const prisma = getPrisma();
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(50, Math.max(1, Number(query.limit || 10)));
    const skip = (page - 1) * limit;

    const where: any = {};
    const includeAll = String(query.all || 'false').toLowerCase() === 'true';
    if (!includeAll) {
      const statusParam = query.status ? String(query.status).toLowerCase() : null;
      if (statusParam) {
        where.status = statusParam;
      } else {
        where.status = { in: ['published', 'approved'] };
      }
    } else if (query.status) {
      where.status = String(query.status);
    }

    if (query.city) where.city = String(query.city);
    if (query.provider_id) where.provider_id = String(query.provider_id);
    if (query.country || query.country_code) {
      where.country_code = String(query.country || query.country_code);
    }
    if (query.category) where.category = String(query.category);
    if (query.q) where.title = { contains: String(query.q), mode: 'insensitive' };
    const freeFlag = String(query.free_tour || query.free || 'false').toLowerCase();
    if (freeFlag === 'true' || freeFlag === '1') {
      where.tags = { has: 'free_tour' };
    }
    const minPrice = query.min_price ?? query.price_min;
    const maxPrice = query.max_price ?? query.price_max;
    if (minPrice || maxPrice) {
      where.price_from = {};
      if (minPrice) where.price_from.gte = String(minPrice);
      if (maxPrice) where.price_from.lte = String(maxPrice);
    }

    if (query.startDate || query.start_date) {
      const d = new Date(String(query.startDate || query.start_date));
      if (!isNaN(+d)) where.start_date = { gte: d };
    }
    if (query.endDate || query.end_date) {
      const d = new Date(String(query.endDate || query.end_date));
      if (!isNaN(+d)) where.end_date = where.end_date ? { ...where.end_date, lte: d } : { lte: d };
    }

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
        include: {
          provider: {
            select: {
              name: true,
              country_code: true,
              status: true,
              verified_level: true,
              photo_url: true,
              bio_short: true,
              phone: true,
              instagram_handle: true,
              ratings_avg: true,
              ratings_count: true,
            },
          },
        },
      }),
    ]);

    const mappedItems = items.map(mapListingWithProvider);
    if (String(query.sort || '').toLowerCase() === 'featured') {
      mappedItems.sort(compareFeaturedListings);
    }

    return { items: mappedItems, total, page, limit };
  }

  @Get('listings/:id')
  async getListing(@Param('id') id: string) {
    if (ENABLED) {
      const { data } = await axios.get(`${HUB}/listings/${id}`);
      return data;
    }

    const prisma = getPrisma();
    const listing = await prisma.listings.findUnique({
      where: { id: String(id) },
      include: {
        provider: {
          select: {
            name: true,
            country_code: true,
            status: true,
            verified_level: true,
            photo_url: true,
            bio_short: true,
            phone: true,
            instagram_handle: true,
            ratings_avg: true,
            ratings_count: true,
          },
        },
      },
    });
    if (!listing) throw new BadRequestException('listing not found');
    return mapListingWithProvider(listing);
  }

  @Post('listings/:id/status')
  async setListingStatus(@Req() req: Request, @Param('id') id: string, @Body() body: any) {
    const prisma = getPrisma();
    const { listing, owned, provider } = await authorizeListingMutation(prisma, req, body, id);
    const status = String(body?.status || '').toLowerCase();
    if (!['published', 'inactive', 'draft'].includes(status)) {
      throw new BadRequestException('invalid status');
    }

    if (owned && status === 'published') {
      const providerStatus = String(provider?.status || '').toLowerCase();
      if (!['approved', 'verified'].includes(providerStatus)) {
        throw new BadRequestException('provider must be approved before publishing');
      }
    }

    const updated = await prisma.listings.update({
      where: { id: listing.id },
      data: { status },
    });
    return updated;
  }

  @Patch('listings/:id')
  async updateListing(@Req() req: Request, @Param('id') id: string, @Body() body: any) {
    const prisma = getPrisma();
    const { listing, user } = await authorizeListingMutation(prisma, req, body, id);

    const updateData: any = {};
    if (body?.title != null) updateData.title = requireListingText(body.title, 'title');
    if (body?.description != null) updateData.description = normalizeNullableString(body.description);
    if (body?.category != null) updateData.category = requireListingText(body.category, 'category');
    if (body?.city != null) updateData.city = requireListingText(body.city, 'city');
    if (body?.country_code != null) {
      const countryCode = normalizeCountryCode(body.country_code);
      if (!countryCode) throw new BadRequestException('country_code must be a valid ISO2 code');
      updateData.country_code = countryCode;
    }
    if (body?.duration_minutes != null) {
      updateData.duration_minutes = normalizeListingNumber(body.duration_minutes, 'duration_minutes', { integer: true });
    }
    const nextTags = body?.tags != null ? normalizeTags(body.tags) : Array.isArray(listing.tags) ? listing.tags : [];
    const nextFreeTour = nextTags.includes('free_tour');
    if (body?.price_from != null) {
      const price = nextFreeTour ? null : normalizeListingNumber(body.price_from, 'price_from', { allowZero: false });
      updateData.price_from = price != null ? String(price) : null;
    } else if (body?.tags != null && nextFreeTour) {
      updateData.price_from = null;
    }
    if (body?.currency != null) updateData.currency = nextFreeTour ? null : normalizeNullableString(body.currency);
    if (body?.start_date != null) updateData.start_date = normalizeListingDate(body.start_date, 'start_date');
    if (body?.end_date != null) updateData.end_date = normalizeListingDate(body.end_date, 'end_date');
    if (body?.tags != null) updateData.tags = nextTags;
    if (body?.cover_image_url != null || body?.coverImageUrl != null) {
      updateData.cover_image_url = normalizeNullableString(body.cover_image_url ?? body.coverImageUrl);
    }
    if (user) updateData.operator_id = String(user.id);

    if (!Object.keys(updateData).length) {
      throw new BadRequestException('no editable fields provided');
    }
    if (updateData.start_date && updateData.end_date && updateData.end_date < updateData.start_date) {
      throw new BadRequestException('end_date must be after start_date');
    }

    const updated = await prisma.listings.update({ where: { id: listing.id }, data: updateData });
    return updated;
  }

  @Delete('listings/:id')
  async deleteListing(@Req() req: Request, @Param('id') id: string) {
    const prisma = getPrisma();
    const { listing } = await authorizeListingMutation(prisma, req, {}, id);

    await prisma.listings.delete({ where: { id: listing.id } });
    return { ok: true };
  }

  @Post('alerts/tours/create')
  async createTourAlert(@Body() body: any) {
    if (ENABLED) {
      const { data } = await axios.post(`${HUB}/alerts/tours/create`, body);
      return data;
    }

    const prisma = getPrisma();
    const city = body.city ? String(body.city) : null;
    const country_code = body.country_code ? String(body.country_code) : null;
    const listing_id = body.listing_id ? String(body.listing_id) : null;
    const budget = body.budget != null ? Number(body.budget) : body.price_limit != null ? Number(body.price_limit) : null;
    const email = body.email ? String(body.email) : null;
    const user_id = body.user_id ? String(body.user_id) : null;
    const channel = body.channel ? String(body.channel) : 'email';

    if (!city && !country_code && !listing_id) {
      throw new BadRequestException('city or country_code or listing_id is required');
    }
    if (!user_id && !email) {
      throw new BadRequestException('user_id or email is required');
    }

    let resolvedUserId: string | null = null;
    if (user_id) {
      const user = await prisma.users.findUnique({ where: { id: user_id } });
      resolvedUserId = user?.id || null;
    }

    if (!resolvedUserId && email) {
      const user = await prisma.users.upsert({
        where: { email: email.toLowerCase() },
        update: {},
        create: { email: email.toLowerCase(), name: body.name ?? null },
      });
      resolvedUserId = user.id;
    }

    if (!resolvedUserId) {
      throw new BadRequestException('unable to resolve user');
    }

    const subscription = await prisma.alert_subscriptions.create({
      data: {
        user_id: resolvedUserId,
        itinerary_id: null,
        rule: {
          type: 'tour',
          city,
          country_code,
          listing_id,
          budget,
          currency: body.currency ?? 'USD',
        },
        channel,
        active: true,
      },
    });

    return { ok: true, subscription_id: subscription.id, rule: subscription.rule };
  }

  @Get('alerts/tours/list')
  async listTourAlerts() {
    if (ENABLED) {
      const { data } = await axios.get(`${HUB}/alerts/tours/list`);
      return data;
    }

    const prisma = getPrisma();
    const items = await prisma.alert_subscriptions.findMany({
      where: { rule: { path: ['type'], equals: 'tour' } as any },
      orderBy: { created_at: 'desc' },
    });
    return {
      items: items.map((i: any) => ({
        id: i.id,
        user_id: i.user_id,
        rule: i.rule,
        channel: i.channel,
        created_at: i.created_at,
      })),
    };
  }

  @Delete('alerts/:id')
  async deleteAlert(@Param('id') id: string) {
    if (ENABLED) {
      const { data } = await axios.delete(`${HUB}/alerts/${id}`);
      return data;
    }

    const prisma = getPrisma();
    const exists = await prisma.alert_subscriptions.findUnique({ where: { id } });
    if (!exists) throw new BadRequestException('alert not found');
    await prisma.alert_subscriptions.delete({ where: { id } });
    return { ok: true };
  }
}
