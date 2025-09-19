// services/itineraries/src/routes.ts
import { Body, Controller, Post, Query } from '@nestjs/common';
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
} from '@wadatrip/common/dtos';

import { searchFlights, searchHotels, searchActivities } from '@wadatrip/connectors';
import { getPrisma } from '@wadatrip/db/src/client';
import { metric } from '@wadatrip/common/metrics';

type Store = {
  itineraries: Map<string, { base: GenerateItineraryRequest; scenarios: Scenario[] }>;
};
const store: Store = { itineraries: new Map() };

// ---------- helpers ----------
function safeNumber(n: any, def = 0) {
  const x = Number(n);
  return Number.isFinite(x) ? x : def;
}

function summarize(items: ItineraryItem[]) {
  const sum = (t: string) => items.filter(i => i.type === t).reduce((s, i) => s + safeNumber(i.price), 0);
  return {
    flight: sum('flight'),
    lodging: sum('lodging'),
    activities: sum('activity'),
  };
}

function kpis(items: ItineraryItem[], days: number) {
  const total = items.reduce((s, i) => s + safeNumber(i.price), 0);
  const free_time_hours = Math.max(0, days * 10 - items.filter(i => i.type === 'activity').length * 2);
  const walk_distance_km = Math.round(items.filter(i => i.type === 'activity').length * 1.2 * 10) / 10;
  return {
    cost_per_day: Math.round((total / Math.max(1, days)) * 100) / 100,
    free_time_hours,
    walk_distance_km,
  };
}

// ---------- Pricing vía microservicio ----------
async function getPricingAdvice(origin: string, destination: string, date: string) {
  const resp = await axios.post(
    (process.env.PRICING_URL || 'http://127.0.0.1:3012') + '/pricing/predict',
    { origin, destination, start_date: date },
    { headers: { Authorization: `Bearer ${process.env.AUTH_TOKEN}` } }
  );
  return resp.data?.predictions?.[0];
}

async function scenariosFromRequest(
  req: GenerateItineraryRequest,
  provider?: { flights?: 'amadeus' | 'mock'; hotels?: 'travelpayouts' | 'mock'; activities?: 'viator' | 'mock' },
): Promise<Scenario[]> {
  const t0 = Date.now();

  const days = Math.max(
    1,
    Math.ceil((Date.parse(req.end_date) - Date.parse(req.start_date)) / (1000 * 60 * 60 * 24)),
  );

  const [flights, hotels, acts] = await Promise.all([
    searchFlights(req.origin, req.destination, req.start_date, provider?.flights),
    searchHotels(req.destination, req.start_date, req.end_date, (req as any).adults ?? (req as any).pax ?? 1, provider?.hotels),
    searchActivities(req.destination, req.start_date, req.end_date, provider?.activities),
  ]);

  const pricing = await getPricingAdvice(req.origin, req.destination, req.start_date);

  const build = (type: ScenarioType): Scenario => {
    const pickFlight = (t: ScenarioType) => {
      const arr = [...(flights ?? [])];
      if (!arr.length) return undefined;
      if (t === 'premium') return arr.sort((a, b) => (a.layovers - b.layovers) || (a.duration_hours - b.duration_hours))[0];
      if (t === 'balanced') return arr.sort((a, b) => (a.price - b.price) + (a.layovers - b.layovers) * 50)[0];
      return arr.sort((a, b) => a.price - b.price)[0];
    };

    const pickHotel = (t: ScenarioType) => {
      const arr = [...(hotels ?? [])];
      if (!arr.length) return undefined;
      if (t === 'premium') return arr.sort((a: any, b: any) => (b.stars ?? 0) - (a.stars ?? 0))[0];
      if (t === 'balanced') {
        return arr.sort((a: any, b: any) =>
          ((b.stars ?? 0) - (a.stars ?? 0)) - (safeNumber(a.price_per_night) - safeNumber(b.price_per_night)) / 100
        )[0];
      }
      return arr.sort((a: any, b: any) => safeNumber(a.price_per_night) - safeNumber(b.price_per_night))[0];
    };

    const pickActivities = (t: ScenarioType) => {
      const arr = [...(acts ?? [])];
      if (!arr.length) return [];
      if (t === 'premium') return arr.filter((_, i) => i % 2 === 0).slice(0, days * 2);
      if (t === 'balanced') return arr.slice(0, days * 2);
      return arr.filter((_, i) => i % 3 !== 0).slice(0, days);
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
        details: { raw: (f as any).raw },
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
        details: { stars: (h as any).stars, raw: (h as any).raw },
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
        action: pricing?.action ?? 'wait',
        confidence: pricing?.confidence ?? 0.5,
        next_check_at: pricing?.next_check_at ?? new Date().toISOString(),
        rationale: `Trend ${pricing?.trend ?? 'flat'}`,
      },
      items,
      kpis: kpis(items, days),
    };
  };

  const scenarios: Scenario[] = (['economy', 'balanced', 'premium'] as ScenarioType[]).map(build);
  metric('scenarios.generate_ms', { ms: Date.now() - t0, origin: req.origin, destination: req.destination });
  return scenarios;
}

function diffScenarios(prev: Scenario[], next: Scenario[]) {
  const before = prev[0]?.items ?? [];
  const after = next[0]?.items ?? [];
  const byId = (arr: ItineraryItem[]) => new Map(arr.map(i => [i.id, i]));
  const mBefore = byId(before);
  const mAfter = byId(after);
  const added: ItineraryItem[] = [];
  const removed: ItineraryItem[] = [];
  const updated: { before: ItineraryItem; after: ItineraryItem }[] = [];

  for (const [id, item] of mAfter) if (!mBefore.has(id)) added.push(item);
  for (const [id, item] of mBefore) if (!mAfter.has(id)) removed.push(item);
  for (const [id, a] of mAfter) {
    const b = mBefore.get(id);
    if (b && (a.price !== b.price || a.start !== b.start || a.end !== b.end)) updated.push({ before: b, after: a });
  }
  return { added, removed, updated };
}

// ---------- Controller ----------
@Controller('itineraries')
export class ItinerariesController {
  @Post('generate')
  async generate(
    @Body() body: GenerateItineraryRequest & { owner_id?: string },
    @Query('providerFlights') providerFlights?: 'amadeus' | 'mock',
    @Query('providerHotels') providerHotels?: 'travelpayouts' | 'mock',
    @Query('providerActivities') providerActivities?: 'viator' | 'mock',
  ): Promise<GenerateItineraryResponse> {
    const prisma = getPrisma();

    let ownerId = (body as any).owner_id as string | undefined;
    if (!ownerId) {
      const demoEmail = 'demo@wadatrip.local';
      const demo = await prisma.users.upsert({
        where: { email: demoEmail },
        update: {},
        create: { email: demoEmail, name: 'Demo User' },
      });
      ownerId = demo.id;
    }

    const scenarios = await scenariosFromRequest(body, {
      flights: providerFlights,
      hotels: providerHotels,
      activities: providerActivities,
    });

    const itinerary = await prisma.itineraries.create({
      data: {
        owner_id: ownerId,
        title: (body as any).title ?? `${body.destination} trip`,
        origin: body.origin,
        destination: body.destination,
        start_date: new Date(body.start_date),
        end_date: new Date(body.end_date),
        pax: (body as any).adults ?? (body as any).pax ?? 1,
        status: 'draft',
      },
    });

    for (const sc of scenarios) {
      const version = await prisma.itinerary_versions.create({
        data: {
          itinerary_id: itinerary.id,
          scenario: sc.type,
          total_price: sc.total_price,
          adred_action: sc.adred.action,
        },
      });

      for (const it of sc.items) {
        await prisma.itinerary_items.create({
          data: {
            version_id: version.id,
            type: it.type,
            supplier: it.supplier,
            title: it.title,
            start_ts: it.start ? new Date(it.start) : null,
            end_ts: it.end ? new Date(it.end) : null,
            geo: it.geo ? { lat: (it.geo as any).lat, lng: (it.geo as any).lng } : undefined,
            price: safeNumber(it.price, 0),
            currency: it.currency ?? 'USD',
            details: it.details ?? undefined,
          },
        });
      }
    }

    return { itinerary_id: itinerary.id, scenarios };
  }

  @Post('update')
  async update(
    @Body() body: UpdateItineraryRequest,
    @Query('providerFlights') providerFlights?: 'amadeus' | 'mock',
    @Query('providerHotels') providerHotels?: 'travelpayouts' | 'mock',
    @Query('providerActivities') providerActivities?: 'viator' | 'mock',
  ): Promise<UpdateItineraryResponse> {
    const prisma = getPrisma();
    const itinerary = await prisma.itineraries.findUnique({ where: { id: (body as any).itinerary_id } });
    if (!itinerary) throw new Error('itinerary not found');

    const baseReq: GenerateItineraryRequest = {
      origin: itinerary.origin,
      destination: itinerary.destination,
      start_date: (body as any).changes?.dates?.start_date || itinerary.start_date.toISOString().slice(0, 10),
      end_date: (body as any).changes?.dates?.end_date || itinerary.end_date.toISOString().slice(0, 10),
      adults: (body as any).changes?.pax || itinerary.pax,
      budget_total: (body as any).changes?.budget_total ?? 0,
      preferences: (body as any).changes?.preferences,
    } as any;

    const prevScenarios: Scenario[] = [];
    const scenarios = await scenariosFromRequest(baseReq, { flights: providerFlights, hotels: providerHotels, activities: providerActivities });
    const diff = diffScenarios(prevScenarios, scenarios);

    let firstVersion: string | null = null;
    for (const sc of scenarios) {
      const version = await prisma.itinerary_versions.create({
        data: {
          itinerary_id: itinerary.id,
          scenario: sc.type,
          total_price: sc.total_price,
          adred_action: sc.adred.action,
          diff_from_prev: diff as any,
        },
      });
      if (!firstVersion) firstVersion = version.id;

      for (const it of sc.items) {
        await prisma.itinerary_items.create({
          data: {
            version_id: version.id,
            type: it.type,
            supplier: it.supplier,
            title: it.title,
            start_ts: it.start ? new Date(it.start) : null,
            end_ts: it.end ? new Date(it.end) : null,
            geo: it.geo ? { lat: (it.geo as any).lat, lng: (it.geo as any).lng } : undefined,
            price: safeNumber(it.price, 0),
            currency: it.currency ?? 'USD',
            details: it.details ?? undefined,
          },
        });
      }
    }

    return { version_id: firstVersion!, scenarios, diff };
  }
}
