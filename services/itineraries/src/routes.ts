import { BadRequestException, Body, Controller, Get, Optional, Post, Query } from '@nestjs/common';
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
import { PricingService } from '../../pricing/src/pricing.service';
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
const PROVIDER_HUB_URL = process.env.PROVIDER_HUB_URL || 'http://localhost:3014';
const MARKETPLACE_MODE = true;

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

function getScenarioByType(
  scenarios: Scenario[],
  type: ScenarioType,
): Scenario | undefined {
  return scenarios.find((scenario) => scenario.type === type);
}

function mapScenarioType(type: string): 'standard' | 'premium' | 'custom' {
  if (type === 'premium') return 'premium';
  if (type === 'custom') return 'custom';
  return 'standard';
}

async function requireApprovedAgent(agentId: string) {
  const prisma = getPrisma();
  const agent = await prisma.providers.findUnique({ where: { id: agentId } });
  if (!agent) {
    throw new BadRequestException('agent not found');
  }
  if (agent.verification_status !== 'approved') {
    throw new BadRequestException('agent not approved');
  }
  return agent;
}

async function ensureOwnerUserFromAgent(agent: any) {
  const prisma = getPrisma();
  const email = String(agent.email || '').toLowerCase();
  if (!email) {
    throw new BadRequestException('agent email is required');
  }
  const user = await prisma.users.upsert({
    where: { email },
    update: { name: agent.name ?? undefined },
    create: {
      email,
      name: agent.name ?? null,
      role: 'agent',
      status: 'active',
    },
  });
  return user;
}

function scenarioItemsToJson(items: ItineraryItem[]) {
  return items.map((item) => ({
    id: item.id,
    type: item.type,
    supplier: item.supplier,
    title: item.title,
    start: item.start,
    end: item.end,
    geo: item.geo,
    price: item.price,
    currency: item.currency,
    details: item.details,
  }));
}

async function persistItinerary(
  itineraryId: string,
  base: GenerateItineraryRequest,
  scenarios: Scenario[],
  agentId: string,
) {
  const prisma = getPrisma();
  const agent = await requireApprovedAgent(agentId);
  const ownerUser = await ensureOwnerUserFromAgent(agent);

  await prisma.$transaction(async (tx) => {
    const existing = await tx.itineraries.findUnique({ where: { id: itineraryId } });
    if (!existing) {
      await tx.itineraries.create({
        data: {
          id: itineraryId,
          owner_id: ownerUser.id,
          owner_type: 'agent',
          agent_id: agentId,
          title: base.title,
          origin: base.origin,
          destination: base.destination,
          start_date: new Date(base.start_date),
          end_date: new Date(base.end_date),
          pax: base.adults,
          status: 'draft',
        },
      });
    } else {
      if (existing.agent_id && existing.agent_id !== agentId) {
        throw new BadRequestException('agent mismatch');
      }
      await tx.itineraries.update({
        where: { id: itineraryId },
        data: {
          agent_id: agentId,
          title: base.title,
          origin: base.origin,
          destination: base.destination,
          start_date: new Date(base.start_date),
          end_date: new Date(base.end_date),
          pax: base.adults,
        },
      });
    }

    for (const scenario of scenarios) {
      const kpiPayload = scenario.kpis;
      const itemsJson = scenarioItemsToJson(scenario.items);
      const version = await tx.itinerary_versions.create({
        data: {
          itinerary_id: itineraryId,
          scenario: scenario.type,
          scenario_type: mapScenarioType(String(scenario.type)),
          total_price: scenario.total_price,
          adred_action: scenario.adred?.action ?? null,
          items_json: itemsJson as any,
          kpis: kpiPayload as any,
        },
      });

      if (scenario.items.length) {
        await tx.itinerary_items.createMany({
          data: scenario.items.map((item) => ({
            version_id: version.id,
            type: item.type,
            supplier: item.supplier,
            provider: item.supplier,
            title: item.title,
            start_ts: item.start ? new Date(item.start) : null,
            end_ts: item.end ? new Date(item.end) : null,
            geo: item.geo as any,
            price: item.price,
            currency: item.currency,
            details: item.details as any,
          })),
        });
      }
    }
  });
}

async function loadItineraryBase(itineraryId: string): Promise<GenerateItineraryRequest | null> {
  const prisma = getPrisma();
  const itin = await prisma.itineraries.findUnique({ where: { id: itineraryId } });
  if (!itin) return null;
  return {
    title: itin.title,
    origin: itin.origin,
    destination: itin.destination,
    start_date: dateOnlyIso(itin.start_date),
    end_date: dateOnlyIso(itin.end_date),
    adults: itin.pax,
    budget_total: DEFAULT_BUDGET_TOTAL,
  };
}

async function getPricingAdvice(
  origin: string,
  destination: string,
  date: string,
  pricingService?: PricingService,
): Promise<PricingAdvice> {
  if (!pricingService) return { ...DEFAULT_PRICING_ADVICE };
  const payload = { origin, destination, start_date: date };
  try {
    const resp = await pricingService.predict(payload);
    const advice = resp?.predictions?.[0];
    if (advice && typeof advice === 'object') {
      const data = advice as Record<string, unknown>;
      const action =
        typeof data.action === 'string' && data.action === 'buy' ? 'buy' : 'wait';
      const confidence = typeof data.confidence === 'number' ? data.confidence : 0.5;
      return { ...data, action, confidence } as PricingAdvice;
    }
  } catch {
    metric('itineraries.pricing.error', {});
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

async function scenariosFromRequest(
  req: GenerateItineraryRequest,
  pricingService?: PricingService,
): Promise<Scenario[]> {
  const [flights, hotels, acts] = await Promise.all([fetchFlights(req), fetchHotels(req), fetchActivities(req)]);

  const pricing = await getPricingAdvice(req.origin, req.destination, req.start_date, pricingService);
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
  constructor(@Optional() private readonly pricingService?: PricingService) {}

  @Get('health')
  health() {
    return { status: 'ok' };
  }

  @Get('mine')
  mine(): ListItinerariesResponse {
    return { itineraries: [] };
  }

  @Get()
  list(@Query('ownerId') ownerId?: string, @Query('limit') limitParam?: string): ListItinerariesResponse {
    if (MARKETPLACE_MODE) return { itineraries: [] };
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
  generate(@Body() body: GenerateItineraryRequest): GenerateItineraryResponse {
    if (MARKETPLACE_MODE) {
      return { itinerary_id: randomUUID(), scenarios: [] };
    }
    const agentId = (body as any)?.agent_id ?? (body as any)?.agentId;
    if (!agentId) {
      throw new BadRequestException('agent_id is required');
    }
    const req = normalizeGenerateRequestPayload(body);
    const id = randomUUID();
    const scenarios = await scenariosFromRequest(req, this.pricingService);
    store.itineraries.set(id, { base: req, scenarios });
    await persistItinerary(id, req, scenarios, String(agentId));
    return { itinerary_id: id, scenarios };
  }

  @Post('update')
  update(@Body() body: UpdateItineraryRequest): UpdateItineraryResponse {
    if (MARKETPLACE_MODE) {
      return { version_id: randomUUID(), scenarios: [], diff: { added: [], removed: [], updated: [] } };
    }
    const agentId = (body as any)?.agent_id ?? (body as any)?.agentId;
    if (!agentId) {
      throw new BadRequestException('agent_id is required');
    }
    let existing = store.itineraries.get(body.itinerary_id);
    if (!existing) {
      const base = await loadItineraryBase(body.itinerary_id);
      if (!base) throw new BadRequestException('itinerary not found');
      existing = { base, scenarios: [] };
    }

    const updatedReq: GenerateItineraryRequest = { ...existing.base, ...body.changes };
    const scenarios = await scenariosFromRequest(updatedReq, this.pricingService);
    store.itineraries.set(body.itinerary_id, { base: updatedReq, scenarios });
    await persistItinerary(body.itinerary_id, updatedReq, scenarios, String(agentId));

    return { version_id: randomUUID(), scenarios, diff: { added: [], removed: [], updated: [] } };
  }

  @Post('book')
  async book(@Body() body: any) {
    if (MARKETPLACE_MODE) {
      throw new BadRequestException('itinerary booking is disabled in marketplace mode');
    }
    const itineraryId = body?.itinerary_id;
    const scenarioType = body?.scenario_type as ScenarioType | undefined;
    const listingId = body?.listing_id;

    if (!itineraryId) throw new BadRequestException('itinerary_id is required');
    if (!scenarioType) throw new BadRequestException('scenario_type is required');
    if (!listingId) throw new BadRequestException('listing_id is required');

    const existing = store.itineraries.get(String(itineraryId));
    if (!existing) throw new BadRequestException('itinerary not found');

    const scenario = getScenarioByType(existing.scenarios, scenarioType);
    if (!scenario) throw new BadRequestException('scenario not found');

    const date = body?.date ?? existing.base.start_date;
    const num_people = body?.num_people ?? existing.base.adults ?? 1;

    const payload = {
      listing_id: listingId,
      date,
      num_people,
      total_price: scenario.total_price,
      user_id: body?.user_id,
      user_email: body?.user_email,
      user_name: body?.user_name,
    };

    const { data } = await axios.post(`${PROVIDER_HUB_URL}/bookings`, payload, {
      headers: { 'x-internal-service-token': process.env.INTERNAL_SERVICE_TOKEN || '' },
    });

    return {
      booking: data,
      itinerary_id: itineraryId,
      scenario_type: scenarioType,
      total_price: scenario.total_price,
      currency: scenario.items[0]?.currency ?? 'USD',
      adred: scenario.adred,
    };
  }
}





