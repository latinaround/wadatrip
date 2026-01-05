import axios from 'axios';
import { randomUUID } from 'crypto';
import { withCircuit } from './circuit';
import { ActivityCandidate, FlightCandidate, HotelCandidate } from './types';

const ACTIVITIES_URL = 'https://api.travelpayouts.com/v1/city-directions';
const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function cfg() {
  return {
    token: process.env.TRAVELPAYOUTS_TOKEN || '',
    timeout: Number(process.env.CONNECTOR_TIMEOUT_MS || 8000),
    currency: process.env.DEFAULT_CURRENCY || 'USD',
  };
}

function safeNumber(value: any, fallback = 0): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function normalizeDateOnly(date: string | undefined): string {
  if (!date) return new Date().toISOString().slice(0, 10);
  const trimmed = date.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString().slice(0, 10) : parsed.toISOString().slice(0, 10);
}

function defaultDepartureIso(dateOnly: string): string {
  return `${dateOnly}T08:00:00Z`;
}

function flattenFlightItems(node: any): any[] {
  if (!node) return [];
  if (Array.isArray(node)) {
    return node.flatMap(item => flattenFlightItems(item));
  }
  if (typeof node === 'object') {
    if ('price' in node || 'airline' in node || 'departure_at' in node || 'departureAt' in node) {
      return [node];
    }
    return Object.values(node).flatMap(value => flattenFlightItems(value));
  }
  return [];
}

type FlightContext = {
  origin: string;
  destination: string;
  dateOnly: string;
  currency: string;
  source: 'cheap' | 'month-matrix';
};

function mapFlightCandidate(entry: any, ctx: FlightContext): FlightCandidate | null {
  if (!entry) return null;

  const price = safeNumber(entry.price ?? entry.value ?? entry.price_total, 0);
  const departureIso = (entry.departure_at || entry.departureAt || entry.departure || entry.departure_time) as string | undefined;
  const dateOnly = ctx.dateOnly;
  const resolvedDeparture = departureIso || defaultDepartureIso(dateOnly);
  const departureDate = new Date(resolvedDeparture);
  const durationMinutesRaw = safeNumber(entry.duration_to ?? entry.duration ?? entry.duration_flight, 0);
  const durationMinutes = durationMinutesRaw > 0 ? durationMinutesRaw : 6 * 60;
  const arrivalIso = Number.isNaN(departureDate.getTime())
    ? defaultDepartureIso(dateOnly)
    : new Date(departureDate.getTime() + durationMinutes * MINUTE_MS).toISOString();

  const airline = (entry.airline || entry.gate || 'XX').toString();
  const layovers = Math.max(0, safeNumber(entry.transfers ?? entry.number_of_changes ?? entry.changes, 0));
  const idSeed = entry.id || entry.flight_number || entry.flightNumber || `${airline}-${resolvedDeparture}-${price}`;
  const candidate: FlightCandidate = {
    id: `travelpayouts:${ctx.source}:${idSeed || randomUUID()}`,
    airline,
    title: `${ctx.origin}-${ctx.destination} ${airline}`,
    departure: Number.isNaN(departureDate.getTime()) ? defaultDepartureIso(dateOnly) : departureDate.toISOString(),
    arrival: arrivalIso,
    duration_hours: Math.max(1, Math.round((durationMinutes || 360) / 60)),
    layovers,
    price: price > 0 ? Math.round(price) : 0,
    currency: (entry.currency || ctx.currency || 'USD').toString().toUpperCase(),
    raw: { source: ctx.source, ...entry },
  };

  return candidate;
}

function flattenHotelItems(node: any): any[] {
  if (!node) return [];
  if (Array.isArray(node)) {
    return node.flatMap(item => flattenHotelItems(item));
  }
  if (typeof node === 'object') {
    if ('hotelName' in node || 'hotel_id' in node || 'name' in node || 'price' in node || 'price_from' in node) {
      return [node];
    }
    if ('hotels' in node) return flattenHotelItems((node as any).hotels);
    return Object.values(node).flatMap(value => flattenHotelItems(value));
  }
  return [];
}

export function mapHotels(payload: any, city: string, checkin: string, checkout: string, adults: number): HotelCandidate[] {
  const config = cfg();
  const items = flattenHotelItems(payload);
  const nightsRaw = (Date.parse(checkout) - Date.parse(checkin)) / DAY_MS;
  const nights = Number.isFinite(nightsRaw) && nightsRaw > 0 ? Math.floor(nightsRaw) : 1;

  return items.slice(0, 30).map((h: any, idx: number) => {
    const id = String(
      h.hotel_id || h.hotelId || h.id || h.code || h._id || `${city}-${idx}`,
    );
    const name = h.hotelName || h.name || h.title || 'Hotel';
    const stars = safeNumber(h.stars ?? h.star_rating ?? h.category ?? 3, 3);
    const offer = Array.isArray(h.offers) && h.offers.length ? h.offers[0] : undefined;
    const priceSource = offer?.price?.total ?? offer?.price ?? offer?.total ?? offer?.price_per_room;
    const rawPrice = safeNumber(
      h.price_per_night ?? h.price_from ?? h.priceFrom ?? h.price ?? h.min_price ?? priceSource ?? 80,
      80,
    );
    const currency = (h.currency || offer?.price?.currency || offer?.currency || config.currency).toString().toUpperCase();
    const total = offer?.price?.total ?? offer?.total ?? rawPrice * Math.max(1, nights);
    const pricePerNight = Math.round((total / Math.max(1, nights)) || rawPrice);

    return {
      id,
      name,
      stars,
      checkin,
      checkout,
      price_per_night: pricePerNight,
      currency,
      raw: {
        id: h.hotel_id || h.hotelId || h.id || h.code,
        name,
        stars: h.stars || h.star_rating,
        price: rawPrice,
        currency,
        offers: h.offers,
      },
    } as HotelCandidate;
  });
}

async function fetchCheapFlights(origin: string, destination: string, dateOnly: string, config: ReturnType<typeof cfg>) {
  const params = {
    origin,
    destination,
    depart_date: dateOnly,
    currency: config.currency,
    limit: 30,
    page: 1,
    show_to_affiliates: true,
    token: config.token,
  };

  const { data } = await axios.get('https://api.travelpayouts.com/v1/prices/cheap', {
    timeout: config.timeout,
    params,
  });
  const currency = data?.currency || config.currency;
  const items = flattenFlightItems(data?.data);
  return { items, currency };
}

async function fetchMonthMatrix(origin: string, destination: string, dateOnly: string, config: ReturnType<typeof cfg>) {
  const month = dateOnly.slice(0, 7);
  const params = {
    origin,
    destination,
    month,
    currency: config.currency,
    show_to_affiliates: true,
    token: config.token,
  };

  const { data } = await axios.get('https://api.travelpayouts.com/v1/prices/month-matrix', {
    timeout: config.timeout,
    params,
  });
  const currency = data?.currency || config.currency;
  const items = flattenFlightItems(data?.data);
  return { items, currency };
}

export async function travelpayoutsSearchFlights(origin: string, destination: string, date?: string): Promise<FlightCandidate[]> {
  const config = cfg();
  if (!config.token) {
    throw new Error('TRAVELPAYOUTS_TOKEN is required');
  }

  const fallback = async () => [] as FlightCandidate[];
  return withCircuit('travelpayouts', async () => {
    const o = origin.trim().toUpperCase();
    const d = destination.trim().toUpperCase();
    const dateOnly = normalizeDateOnly(date);
    const contextBase = { origin: o, destination: d, dateOnly } as const;

    // ✅ FIX: añadimos config
    const [cheap, matrix] = await Promise.allSettled([
      fetchCheapFlights(o, d, dateOnly, config),
      fetchMonthMatrix(o, d, dateOnly, config),
    ]);

    const candidates = new Map<string, FlightCandidate>();

    if (cheap.status === 'fulfilled') {
      const ctx: FlightContext = { ...contextBase, currency: cheap.value.currency, source: 'cheap' };
      for (const entry of cheap.value.items) {
        const cand = mapFlightCandidate(entry, ctx);
        if (!cand) continue;
        const key = `${cand.airline}|${cand.departure}|${cand.price}|${cand.layovers}`;
        if (!candidates.has(key)) {
          candidates.set(key, cand);
        }
      }
    }

    if (matrix.status === 'fulfilled') {
      const ctx: FlightContext = { ...contextBase, currency: matrix.value.currency, source: 'month-matrix' };
      for (const entry of matrix.value.items) {
        const cand = mapFlightCandidate(entry, ctx);
        if (!cand) continue;
        const key = `${cand.airline}|${cand.departure}|${cand.price}|${cand.layovers}`;
        if (!candidates.has(key)) {
          candidates.set(key, cand);
        }
      }
    }

    const list = Array.from(candidates.values());
    if (!list.length) return list;

    list.sort((a, b) => {
      const priceDiff = safeNumber(a.price, 0) - safeNumber(b.price, 0);
      if (priceDiff !== 0) return priceDiff;
      const layoverDiff = safeNumber(a.layovers, 0) - safeNumber(b.layovers, 0);
      if (layoverDiff !== 0) return layoverDiff;
      return safeNumber(a.duration_hours, 0) - safeNumber(b.duration_hours, 0);
    });

    return list.slice(0, 20);
  }, fallback);
}

export async function travelpayoutsSearchHotels(city: string, checkin: string, checkout: string, adults: number): Promise<HotelCandidate[]> {
  const config = cfg();
  if (!config.token) {
    throw new Error('TRAVELPAYOUTS_TOKEN is required');
  }

  const fallback = async () => [] as HotelCandidate[];
  return withCircuit('travelpayouts', async () => {
    const location = city.trim();
    const params = {
      token: config.token,
      location,
      checkIn: checkin,
      checkOut: checkout,
      adults,
      rooms: 1,
      currency: config.currency,
      lang: 'en',
      waitForResult: 1,
      limit: 30,
    };

    const { data } = await axios.get('https://engine.hotellook.com/api/v2/search/start', {
      timeout: config.timeout,
      params,
    });

    let hotels = mapHotels(data?.results || data, location, checkin, checkout, adults);

    if (!hotels.length && data?.search_id) {
      try {
        const { data: poll } = await axios.get('https://engine.hotellook.com/api/v2/search/getResult', {
          timeout: config.timeout,
          params: {
            token: config.token,
            searchId: data.search_id,
            limit: 30,
            currency: config.currency,
          },
        });
        hotels = mapHotels(poll?.results || poll, location, checkin, checkout, adults);
      } catch (err) {
        // Swallow and fallback to cache
      }
    }

    if (!hotels.length) {
      try {
        const { data: cache } = await axios.get('https://engine.hotellook.com/api/v2/cache.json', {
          timeout: config.timeout,
          params: {
            token: config.token,
            location,
            checkIn: checkin,
            checkOut: checkout,
            currency: config.currency,
            adults,
            limit: 30,
          },
        });
        hotels = mapHotels(cache, location, checkin, checkout, adults);
      } catch (err) {
        // ignore, will return whatever we have
      }
    }

    return hotels;
  }, fallback);
}

export async function travelpayoutsSearchActivities(city: string, startDate: string, endDate: string): Promise<ActivityCandidate[]> {
  const config = cfg();
  if (!config.token) {
    throw new Error('TRAVELPAYOUTS_TOKEN is required');
  }
  try {
    const { data } = await axios.get(ACTIVITIES_URL, {
      timeout: config.timeout,
      params: {
        token: config.token,
        city,
        startDate,
        endDate,
        currency: config.currency,
      },
    });
    const items = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
    const ensureDateTime = (value: any, fallbackDate: string, defaultTime: string) => {
      if (typeof value !== 'string' || !value.trim()) return `${fallbackDate}${defaultTime}`;
      if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return value;
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${value}${defaultTime}`;
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? `${fallbackDate}${defaultTime}` : parsed.toISOString();
    };
    return items.map((entry: any, index: number) => {
      const startRaw = entry.start_time || entry.startTime || entry.start || startDate;
      const endRaw = entry.end_time || entry.endTime || entry.end || endDate;
      const ratingValue = safeNumber(entry.rating ?? entry.rate ?? entry.score, 0);
      return {
        id: entry.id || `travelpayouts:activity:${city}:${index}`,
        title: entry.name || entry.direction || entry.title || `Activity ${index + 1}`,
        start: ensureDateTime(startRaw, startDate, 'T10:00:00Z'),
        end: ensureDateTime(endRaw, endDate, 'T12:00:00Z'),
        price: safeNumber(entry.price ?? entry.price_from ?? entry.amount, 0),
        currency: (entry.currency || config.currency).toString().toUpperCase(),
        rating: ratingValue > 0 ? ratingValue : undefined,
        raw: { source: 'travelpayouts', ...entry },
      } as ActivityCandidate;
    });
  } catch (error: any) {
    throw new Error(`Failed to fetch Travelpayouts activities: ${error?.message || error}`);
  }
}
