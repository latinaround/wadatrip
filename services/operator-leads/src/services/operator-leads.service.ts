import { BadRequestException, Injectable } from '@nestjs/common';
import { getPrisma } from '@wadatrip/db';
import { ListOperatorLeadsDto } from '../dto/list-operator-leads.dto';
import { SearchOperatorLeadsDto } from '../dto/search-operator-leads.dto';
import { PRESET_OPERATOR_LEAD_CITIES } from '../constants/operator-leads.constants';
import { OutscraperService } from './outscraper.service';

function normalizeText(value: any) {
  return String(value || '').trim();
}

function normalizeName(value: any) {
  return normalizeText(value).toLowerCase().replace(/\s+/g, ' ');
}

function normalizeWebsite(value: any) {
  const input = normalizeText(value);
  if (!input) return null;
  try {
    const url = new URL(input.startsWith('http') ? input : `https://${input}`);
    const host = url.hostname.replace(/^www\./i, '').toLowerCase();
    const path = url.pathname.replace(/\/+$/, '');
    return `${host}${path}` || host;
  } catch {
    return input.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/+$/, '').toLowerCase();
  }
}

function normalizePhone(value: any) {
  const digits = normalizeText(value).replace(/[^\d+]/g, '');
  return digits || null;
}

function toFloat(value: any) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function toInt(value: any) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.trunc(numeric) : 0;
}

function escapeCsv(value: any) {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

@Injectable()
export class OperatorLeadsService {
  constructor(private readonly outscraperService: OutscraperService) {}

  async search(body: SearchOperatorLeadsDto) {
    const prisma = getPrisma();
    const city = normalizeText(body.city);
    const country = this.resolveCountry(city, normalizeText(body.country));

    if (!city) throw new BadRequestException('city is required');
    if (!country) throw new BadRequestException('country is required');

    const queries = this.outscraperService.buildQueries(city, country, body.queries);
    const groups = await this.outscraperService.searchPlaces(queries);

    let inserted = 0;
    let updated = 0;
    const touchedIds: string[] = [];

    for (const group of groups) {
      for (const raw of group.items) {
        const candidate = this.toLeadCandidate(raw, city, country, group.query);
        if (!candidate) continue;

        const duplicate = await prisma.operator_leads.findFirst({
          where: {
            OR: [
              ...(candidate.website_normalized
                ? [{ website_normalized: candidate.website_normalized }]
                : []),
              ...(candidate.phone_normalized
                ? [{ phone_normalized: candidate.phone_normalized }]
                : []),
              {
                name_normalized: candidate.name_normalized,
                city: { equals: candidate.city, mode: 'insensitive' },
                country: { equals: candidate.country, mode: 'insensitive' },
              },
            ],
          },
        });

        if (duplicate) {
          const merged = await prisma.operator_leads.update({
            where: { id: duplicate.id },
            data: {
              name: candidate.name,
              category: candidate.category || duplicate.category,
              address: candidate.address || duplicate.address,
              website: candidate.website || duplicate.website,
              phone: candidate.phone || duplicate.phone,
              rating: candidate.rating ?? duplicate.rating,
              reviews_count: Math.max(candidate.reviews_count, duplicate.reviews_count || 0),
              latitude: candidate.latitude ?? duplicate.latitude,
              longitude: candidate.longitude ?? duplicate.longitude,
              city: candidate.city,
              country: candidate.country,
              source_query: candidate.source_query,
              source: candidate.source,
              website_normalized: candidate.website_normalized || duplicate.website_normalized,
              phone_normalized: candidate.phone_normalized || duplicate.phone_normalized,
              name_normalized: candidate.name_normalized,
            },
          });
          updated += 1;
          touchedIds.push(merged.id);
          continue;
        }

        const created = await prisma.operator_leads.create({ data: candidate });
        inserted += 1;
        touchedIds.push(created.id);
      }
    }

    const items = touchedIds.length
      ? await prisma.operator_leads.findMany({
          where: { id: { in: touchedIds } },
          orderBy: { created_at: 'desc' },
        })
      : [];

    return {
      city,
      country,
      queries,
      inserted,
      updated,
      total: inserted + updated,
      items,
    };
  }

  async list(query: ListOperatorLeadsDto) {
    const prisma = getPrisma();
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(500, Math.max(1, Number(query.limit || 50)));
    const skip = (page - 1) * limit;
    const where = this.buildWhere(query);

    const [items, total] = await Promise.all([
      prisma.operator_leads.findMany({
        where,
        orderBy: this.resolveSort(query.sort),
        skip,
        take: limit,
      }),
      prisma.operator_leads.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async exportCsv(query: ListOperatorLeadsDto) {
    const prisma = getPrisma();
    const where = this.buildWhere(query);
    const items = await prisma.operator_leads.findMany({
      where,
      orderBy: this.resolveSort(query.sort),
    });

    const headers = [
      'name',
      'category',
      'address',
      'website',
      'phone',
      'rating',
      'reviews_count',
      'latitude',
      'longitude',
      'city',
      'country',
      'source_query',
      'source',
      'email',
      'instagram',
      'whatsapp',
      'lead_status',
      'lead_quality',
      'created_at',
    ];

    const lines = [
      headers.join(','),
      ...items.map((item: any) => headers.map((header) => escapeCsv(item[header])).join(',')),
    ];

    return lines.join('\n');
  }

  private resolveCountry(city: string, country: string) {
    if (country) return country;
    const match = PRESET_OPERATOR_LEAD_CITIES.find(
      (entry) => entry.city.toLowerCase() === city.toLowerCase(),
    );
    return match?.country || '';
  }

  private buildWhere(query: ListOperatorLeadsDto) {
    const where: any = {};
    if (query.city) where.city = { contains: String(query.city), mode: 'insensitive' };
    if (query.country) where.country = { contains: String(query.country), mode: 'insensitive' };
    if (query.category) where.category = { contains: String(query.category), mode: 'insensitive' };
    if (query.lead_status) where.lead_status = String(query.lead_status);
    if (query.rating != null && Number.isFinite(Number(query.rating))) {
      where.rating = { gte: Number(query.rating) };
    }
    return where;
  }

  private resolveSort(sort?: string): any {
    const value = String(sort || 'created_at:desc').toLowerCase();
    switch (value) {
      case 'rating:desc':
        return [{ rating: 'desc' }, { reviews_count: 'desc' }];
      case 'rating:asc':
        return [{ rating: 'asc' }, { reviews_count: 'asc' }];
      case 'reviews:desc':
        return [{ reviews_count: 'desc' }, { rating: 'desc' }];
      case 'name:asc':
        return [{ name: 'asc' }];
      case 'name:desc':
        return [{ name: 'desc' }];
      case 'created_at:asc':
        return [{ created_at: 'asc' }];
      default:
        return [{ created_at: 'desc' }];
    }
  }

  private toLeadCandidate(raw: Record<string, any>, city: string, country: string, sourceQuery: string) {
    const name = normalizeText(raw?.name || raw?.title);
    if (!name) return null;

    const website = normalizeText(raw?.website || raw?.site || raw?.domain || raw?.url) || null;
    const phone = normalizeText(raw?.phone || raw?.phone_number || raw?.phoneNumber) || null;
    const rating = toFloat(raw?.rating);
    const reviewsCount = toInt(raw?.reviews_count ?? raw?.reviews ?? raw?.reviewsCount);
    const latitude = toFloat(raw?.latitude ?? raw?.lat);
    const longitude = toFloat(raw?.longitude ?? raw?.lng ?? raw?.lon);

    return {
      name,
      category:
        normalizeText(raw?.category || raw?.main_category || raw?.type || raw?.subcategory) || null,
      address: normalizeText(raw?.full_address || raw?.address || raw?.street) || null,
      website,
      phone,
      rating,
      reviews_count: reviewsCount,
      latitude,
      longitude,
      city: normalizeText(raw?.city) || city,
      country: normalizeText(raw?.country) || country,
      source_query: sourceQuery,
      source: 'outscraper_google_maps',
      email: null,
      instagram: null,
      whatsapp: null,
      lead_status: 'new',
      lead_quality: null,
      website_normalized: normalizeWebsite(website),
      phone_normalized: normalizePhone(phone),
      name_normalized: normalizeName(name),
    };
  }
}
