import { BadRequestException, Body, Controller, Get, Post, Query } from '@nestjs/common';
import { randomUUID } from 'crypto';
import axios from 'axios';
import {
  GenerateItineraryRequest,
  GenerateItineraryResponse,
  UpdateItineraryRequest,
  UpdateItineraryResponse,
  ItineraryItem,
  Scenario,
  ScenarioType,
  SavedItinerary,
  ListItinerariesResponse,
} from '@wadatrip/common/dtos';
import {
  searchFlights,
  searchHotels,
  searchActivities,
  FlightProvider,
  HotelProvider,
  ActivityProvider,
} from '@wadatrip/connectors';
import { getPrisma } from '@wadatrip/db';
import { metric } from '@wadatrip/common/metrics';

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_TRIP_DAYS = 5;
const DEFAULT_BUDGET_TOTAL = 2500;
const BUDGET_PRESETS: Record<string, number> = {
  low: 1500,
  economy: 1500,
  medium: 2600,
  balanced: 2600,
  high: 3900,
  premium: 3900,
  luxury: 5800,
};

type Store = {
  itineraries: Map<string, { base: GenerateItineraryRequest; scenarios: Scenario[] }>;
};
const store: Store = { itineraries: new Map() };

type PricingAdvice = {
  action: 'wait' | 'buy';
  confidence: number;
  [key: string]: unknown;
};

const DEFAULT_PRICING_ADVICE: PricingAdvice = { action: 'wait', confidence: 0.5 };

function safeNumber(n: any, def = 0): number {
  const x = Number(n);
  return Number.isFinite(x) ? x : def;
}

function dateOnlyIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function coercePositiveInteger(value: any, fallback: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  const coerced = Math.floor(numeric);
  return coerced > 0 ? coerced : fallback;
}

function summarize(items: ItineraryItem[]) {
  const sum = (t: string): number =>
    items
      .filter((i: ItineraryItem) => i.type === t)
      .reduce((s: number, i: ItineraryItem) => s + safeNumber(i.price), 0);
  return {
    flight: sum('flight'),
    lodging: sum('lodging'),
    activities: sum('activity'),
  };
}

function kpis(items: ItineraryItem[], days: number) {
  const total = items.reduce((s: number, i: ItineraryItem) => s + safeNumber(i.price), 0);
  const free_time_hours = Math.max(0, days * 10 - items.filter((i: ItineraryItem) => i.type === 'activity').length * 2);
  const walk_distance_km =
    Math.round(items.filter((i: ItineraryItem) => i.type === 'activity').length * 1.2 * 10) / 10;
  return {
    cost_per_day: Math.round((total / Math.max(1, days)) * 100) / 100,
    free_time_hours,
    walk_distance_km,
  };
}

function normalizeGenerateRequestPayload(raw: any): GenerateItineraryRequest {
  const origin = raw?.origin ?? raw?.from;
  if (!origin) throw new BadRequestException('origin is required');

  const destination = raw?.destination ?? raw?.to;
  if (!destination) throw new BadRequestException('destination is required');

  const startDate = new Date(raw?.start_date ?? raw?.startDate);
  if (Number.isNaN(startDate.getTime())) throw new BadRequestException('invalid start_date');

  const endDate = new Date(raw?.end_date ?? raw?.endDate ?? startDate.getTime() + DEFAULT_TRIP_DAYS * DAY_MS);
  const adults = coercePositiveInteger(raw?.adults ?? 1, 1);
  const budget_total = raw?.budget_total ?? DEFAULT_BUDGET_TOTAL;

  return {
    title: raw?.title ?? `${destination} trip`,
    origin,
    destination,
    start_date: dateOnlyIso(startDate),
    end_date: dateOnlyIso(endDate),
    adults,
    budget_total,
    preferences: raw?.preferences,
  };
}

async function getPricingAdvice(origin: string, destination: string, date: string): Promise<PricingAdvice> {
  const payload = { origin, destination, start_date: date };
  const url = `${process.env.PRICING_URL || 'http://localhost:3012'}/pricing/predict`;
  try {
    const resp = await axios.post(url, payload, {
      headers: { Authorization: `Bearer ${process.env.AUTH_TOKEN}` },
    });
    const advice = resp.data?.predictions?.[0];
    if (advice && typeof advice === 'object') {
      const data = advice as Record<string, unknown>;
      const action =
        typeof data.action === 'string' && data.action === 'buy' ? 'buy' : 'wait';
      const confidence = typeof data.confidence === 'number' ? data.confidence : 0.5;
      return { ...data, action, confidence } as PricingAdvice;
    }
  } catch {
    metric('itineraries.pricing.error', {}); // ✅ corregido
  }
  return { ...DEFAULT_PRICING_ADVICE };
}

type ProviderConfig = {
  flights?: FlightProvider;
  hotels?: HotelProvider;
  activities?: ActivityProvider;
};

async function fetchFlights(req: GenerateItineraryRequest) {
  const flights = await searchFlights(req.origin, req.destination, req.start_date, 'travelpayouts');
  return flights.length > 0
    ? flights
    : [
        {
          id: randomUUID(),
          type: 'flight',
          supplier: 'ADRED',
          title: `${req.origin} → ${req.destination}`,
          start: `${req.start_date}T08:00:00Z`,
          end: `${req.end_date}T12:00:00Z`,
          price: 420,
          currency: 'USD',
          details: { adred: true },
        },
      ];
}

async function fetchHotels(req: GenerateItineraryRequest) {
  return await searchHotels(req.destination, req.start_date, req.end_date, req.adults, 'travelpayouts');
}

async function fetchActivities(req: GenerateItineraryRequest) {
  return await searchActivities(req.destination, req.start_date, req.end_date, 'travelpayouts');
}

async function scenariosFromRequest(req: GenerateItineraryRequest): Promise<Scenario[]> {
  const [flights, hotels, acts] = await Promise.all([fetchFlights(req), fetchHotels(req), fetchActivities(req)]);

  const pricing = await getPricingAdvice(req.origin, req.destination, req.start_date);
  const days = Math.max(1, Math.ceil((Date.parse(req.end_date) - Date.parse(req.start_date)) / DAY_MS));

  const build = (type: ScenarioType): Scenario => {
    const pickFlight = (t: ScenarioType): any => {
      const arr = [...flights];
      if (!arr.length) return undefined;
      return arr.sort((a: any, b: any) => a.price - b.price)[0];
    };

    const pickHotel = (t: ScenarioType): any => {
      const arr = [...hotels];
      if (!arr.length) return undefined;
      return arr.sort((a: any, b: any) => safeNumber(a.price_per_night) - safeNumber(b.price_per_night))[0];
    };

    const pickActivities = (t: ScenarioType): any[] => {
      const arr = [...acts];
      if (!arr.length) return [];
      return arr.slice(0, days);
    };

    const f = pickFlight(type);
    const h = pickHotel(type);
    const a = pickActivities(type);

    const items: ItineraryItem[] = [];

    if (f) {
      items.push({
        id: String(f.id ?? randomUUID()),
        type: 'flight',
        supplier: String(f.airline ?? 'Unknown'),
        title: String(f.title ?? `${req.origin}-${req.destination}`),
        start: String(f.departure ?? `${req.start_date}T08:00:00Z`),
        end: String(f.arrival ?? `${req.start_date}T12:00:00Z`),
        price: safeNumber(f.price, 0),
        currency: String(f.currency ?? 'USD'),
        details: { adred: f.details?.adred, raw: (f as any).raw },
      });
    }

    const nights = Math.max(1, days);
    if (h) {
      items.push({
        id: String(h.id ?? randomUUID()),
        type: 'lodging',
        supplier: 'Hotel',
        title: String(h.name ?? `${req.destination} Hotel`),
        start: `${req.start_date}T15:00:00Z`,
        end: `${req.end_date}T11:00:00Z`,
        price: safeNumber((h as any).price_per_night, 0) * nights,
        currency: String((h as any).currency ?? 'USD'),
        details: { stars: (h as any).stars },
      });
    }

    for (const x of a) {
      items.push({
        id: String(x.id ?? randomUUID()),
        type: 'activity',
        supplier: 'Local',
        title: String(x.title ?? 'Activity'),
        start: String(x.start ?? `${req.start_date}T10:00:00Z`),
        end: String(x.end ?? `${req.start_date}T12:00:00Z`),
        price: safeNumber(x.price, 0),
        currency: String(x.currency ?? 'USD'),
        details: { raw: (x as any).raw },
      });
    }

    const price_breakdown = summarize(items);
    const total_price = price_breakdown.flight + price_breakdown.lodging + price_breakdown.activities;

    return {
      type,
      total_price,
      price_breakdown,
      adred: {
        action: pricing.action,
        confidence: pricing.confidence,
      },
      items,
      kpis: kpis(items, days),
    };
  };

  return (['economy', 'balanced', 'premium'] as ScenarioType[]).map(build);
}

// ---------- Controller ----------
@Controller('itineraries')
export class ItinerariesController {
  @Get()
  async list(@Query('ownerId') ownerId?: string, @Query('limit') limitParam?: string): Promise<ListItinerariesResponse> {
    const prisma = getPrisma();
    if (!ownerId) return { itineraries: [] };

    const limit = coercePositiveInteger(limitParam, 20);
    const saved = await prisma.itineraries.findMany({
      where: { owner_id: ownerId },
      take: limit,
      orderBy: { created_at: 'desc' },
      include: { versions: { include: { items: true }, take: 1, orderBy: { created_at: 'desc' } } },
    });

    const itineraries: SavedItinerary[] = saved.map((it: any) => ({
      itinerary_id: it.id,
      title: it.title,
      origin: it.origin,
      destination: it.destination,
      start_date: dateOnlyIso(it.start_date),
      end_date: dateOnlyIso(it.end_date),
      pax: it.pax,
      status: it.status,
      created_at: it.created_at.toISOString(),
      scenarios: it.versions.map((v: any) => ({
        type: v.scenario as ScenarioType,
        total_price: safeNumber(v.total_price, 0),
        price_breakdown: summarize(v.items || []),
        adred: {
          action: (v.adred_action === 'buy' ? 'buy' : 'wait'),
          confidence: 0.5,
        },
        items: (v.items || []).map((i: any) => ({
          id: i.id,
          type: i.type,
          supplier: i.supplier,
          title: i.title,
          price: i.price,
          currency: i.currency,
          start: i.start_ts,
          end: i.end_ts,
          details: i.details,
        })),
        kpis: kpis(v.items || [], 1),
      })),
    }));

    return { itineraries };
  }

  @Post('generate')
  async generate(@Body() body: GenerateItineraryRequest): Promise<GenerateItineraryResponse> {
    const req = normalizeGenerateRequestPayload(body);
    const id = randomUUID();
    const scenarios = await scenariosFromRequest(req);
    store.itineraries.set(id, { base: req, scenarios });
    return { itinerary_id: id, scenarios };
  }

  @Post('update')
  async update(@Body() body: UpdateItineraryRequest): Promise<UpdateItineraryResponse> {
    const existing = store.itineraries.get(body.itinerary_id);
    if (!existing) throw new BadRequestException('itinerary not found');

    const updatedReq: GenerateItineraryRequest = { ...existing.base, ...body.changes };
    const scenarios = await scenariosFromRequest(updatedReq);
    store.itineraries.set(body.itinerary_id, { base: updatedReq, scenarios });

    return { version_id: randomUUID(), scenarios, diff: { added: [], removed: [], updated: [] } };
  }
}
