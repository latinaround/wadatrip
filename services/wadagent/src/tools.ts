import type {
  BookingOption,
  ItineraryOption,
  PricingAdvice,
  TourOption,
  WadaAgentContext,
} from './types';

const PRICING_SERVICE_URL = String(process.env.PRICING_SERVICE_URL || 'http://localhost:3012').replace(/\/$/, '');
const MARKETPLACE_API_URL = String(process.env.MARKETPLACE_API_URL || process.env.PROVIDER_HUB_URL || 'http://localhost:3014').replace(/\/$/, '');
const BOOKINGS_API_URL = String(process.env.BOOKINGS_API_URL || process.env.GATEWAY_URL || 'http://localhost:3000').replace(/\/$/, '');
const ITINERARIES_API_URL = String(process.env.ITINERARIES_API_URL || 'http://localhost:3011').replace(/\/$/, '');

export async function fetchPricingAdvice(context?: WadaAgentContext): Promise<PricingAdvice> {
  const origin = context?.origin;
  const destination = context?.destination;
  const date = extractDate(context?.dates || context?.start_date);
  if (!origin || !destination || !date) return { action: 'unknown' };

  try {
    const resp = await fetch(`${PRICING_SERVICE_URL}/pricing/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ origin, destination, date }),
    });
    if (!resp.ok) return { action: 'unknown' };
    const data = await resp.json();
    return {
      action: data?.action,
      confidence: data?.confidence,
      reason: data?.reason || data?.recommendation,
    };
  } catch {
    return { action: 'unknown' };
  }
}

export async function fetchTourOptions(context?: WadaAgentContext, message?: string): Promise<TourOption[]> {
  const destination = normalizeSearchValue(context?.destination);
  const query = buildSearchQuery(destination, message);
  const category = normalizeSearchValue(Array.isArray(context?.interests) ? context?.interests[0] : '');
  const budget = parseBudget(context?.budget);

  const direct = await requestTours({ city: destination, q: destination ? '' : query, category, budget });
  if (direct.length > 0) return direct;

  if (destination) {
    const fallback = await requestTours({ city: '', q: destination, category, budget });
    if (fallback.length > 0) return fallback;
  }

  if (query) {
    return requestTours({ city: '', q: query, category, budget });
  }

  return [];
}

export async function fetchBookingOptions(context?: WadaAgentContext): Promise<BookingOption[]> {
  const userEmail = normalizeSearchValue(context?.user_email);
  const userId = normalizeSearchValue(context?.user_id);
  if (!userEmail && !userId) return [];

  try {
    const params = new URLSearchParams();
    params.set('limit', '5');
    if (userEmail) params.set('user_email', userEmail);
    if (userId) params.set('user_id', userId);

    const resp = await fetch(`${BOOKINGS_API_URL}/bookings?${params.toString()}`);
    if (!resp.ok) return [];
    const data = await resp.json();
    const items = Array.isArray(data?.items) ? data.items : [];

    return items.map((item: any) => ({
      id: String(item?.id || ''),
      title: String(item?.listing?.title || item?.title || 'Booking'),
      city: String(item?.listing?.city || item?.city || ''),
      date: String(item?.date || ''),
      total_price: parseMoney(item?.total_price ?? (Number.isFinite(Number(item?.amount_cents)) ? Number(item?.amount_cents || 0) / 100 : 0)),
      currency: String(item?.listing?.currency || item?.currency || 'USD'),
      booking_status: String(item?.status || 'unknown'),
      payment_status: String(item?.payment_status || 'unknown'),
      provider_name: String(item?.provider?.name || item?.provider_name || 'Local tour guide'),
      reference: String(item?.reference || item?.id || ''),
    }));
  } catch {
    return [];
  }
}

export async function fetchItineraryOptions(context: WadaAgentContext | undefined, tourOptions: TourOption[] = []): Promise<ItineraryOption[]> {
  const destination = normalizeSearchValue(context?.destination);
  if (!destination) return [];

  const origin = normalizeSearchValue(context?.origin);
  const startDate = extractDate(context?.dates || context?.start_date) || futureDate(14);
  const endDate = futureDateFrom(startDate, 4);
  const budgetTotal = parseBudget(context?.budget) || deriveBudgetFromTours(tourOptions) || 1200;
  const interests: string[] = Array.isArray(context?.interests) ? (context?.interests || []).map((item) => String(item)) : [];

  if (origin) {
    try {
      const resp = await fetch(`${ITINERARIES_API_URL}/itineraries/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `${destination} trip`,
          origin,
          destination,
          start_date: startDate,
          end_date: endDate,
          adults: 1,
          budget_total: budgetTotal,
          preferences: interests.length > 0 ? { interests } : undefined,
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        const itineraryId = String(data?.itinerary_id || '');
        const scenarios = Array.isArray(data?.scenarios) ? data.scenarios : [];
        const mapped = scenarios.map((scenario: any) => mapScenarioToItineraryOption(destination, startDate, endDate, itineraryId, scenario));
        if (mapped.length > 0) return mapped;
      }
    } catch {}
  }

  return [buildStubItinerary(destination, startDate, endDate, budgetTotal, tourOptions, interests)];
}

function mapScenarioToItineraryOption(destination: string, startDate: string, endDate: string, itineraryId: string, scenario: any): ItineraryOption {
  const highlights = Array.isArray(scenario?.items)
    ? scenario.items
        .filter((item: any) => String(item?.type || '').toLowerCase() === 'activity')
        .slice(0, 3)
        .map((item: any) => String(item?.title || 'Activity'))
    : [];

  return {
    source: 'itineraries_service',
    itinerary_id: itineraryId,
    title: `${destination} ${String(scenario?.type || 'trip')}`,
    destination,
    start_date: startDate,
    end_date: endDate,
    scenario_type: String(scenario?.type || 'balanced'),
    estimated_total: Number(scenario?.total_price || 0),
    action: String(scenario?.adred?.action || 'unknown').toLowerCase() === 'buy' ? 'buy' : 'wait',
    highlights,
    summary: highlights.length > 0 ? `Includes ${highlights.join(', ')}.` : `Starter itinerary for ${destination}.`,
  };
}

function buildStubItinerary(destination: string, startDate: string, endDate: string, budgetTotal: number, tourOptions: TourOption[], interests: string[]): ItineraryOption {
  const highlights = [
    ...tourOptions.slice(0, 2).map((tour) => tour.title),
    ...interests.slice(0, 2),
  ].filter(Boolean).slice(0, 3);

  return {
    source: 'stub_fallback',
    itinerary_id: 'stub-fallback',
    title: `${destination} starter itinerary`,
    destination,
    start_date: startDate,
    end_date: endDate,
    scenario_type: 'balanced',
    estimated_total: budgetTotal,
    action: 'unknown',
    highlights,
    summary: 'Fallback itinerary generated because the current itinerary service returned no scenarios yet.',
  };
}

async function requestTours(opts: { city?: string; q?: string; category?: string; budget?: number | null }): Promise<TourOption[]> {
  try {
    const params = new URLSearchParams();
    params.set('limit', '5');
    params.set('status', 'published');
    if (opts.city) params.set('city', opts.city);
    if (opts.q) params.set('q', opts.q);
    if (opts.category) params.set('category', opts.category);
    if (opts.budget != null && Number.isFinite(opts.budget)) params.set('max_price', String(opts.budget));

    const resp = await fetch(`${MARKETPLACE_API_URL}/listings/search?${params.toString()}`);
    if (!resp.ok) return [];
    const data = await resp.json();
    const items = Array.isArray(data?.items) ? data.items : [];

    return items
      .filter((item: any) => {
        const providerStatus = String(item?.provider_status || '').toLowerCase();
        return !providerStatus || providerStatus === 'approved' || providerStatus === 'verified';
      })
      .map((item: any) => ({
        id: String(item?.id || ''),
        title: String(item?.title || 'Tour'),
        city: String(item?.city || ''),
        country_code: String(item?.country_code || ''),
        category: String(item?.category || 'tour'),
        price_from: parseMoney(item?.price_from),
        currency: String(item?.currency || 'USD'),
        provider_name: String(item?.provider_name || 'Local tour guide'),
        provider_verified_level: String(item?.provider_verified_level || ''),
        provider_status: String(item?.provider_status || ''),
      }))
      .sort((a: TourOption, b: TourOption) => a.price_from - b.price_from)
      .slice(0, 5);
  } catch {
    return [];
  }
}

function buildSearchQuery(destination?: string, message?: string) {
  if (destination) return destination;
  const raw = String(message || '').replace(/[^\p{L}\p{N}\s-]/gu, ' ').replace(/\s+/g, ' ').trim();
  return raw.slice(0, 80);
}

function extractDate(value?: string) {
  const match = String(value || '').match(/\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : '';
}

function futureDate(daysAhead: number) {
  const now = new Date();
  now.setDate(now.getDate() + daysAhead);
  return now.toISOString().slice(0, 10);
}

function futureDateFrom(startDate: string, extraDays: number) {
  const date = new Date(startDate);
  if (Number.isNaN(date.getTime())) return futureDate(extraDays + 14);
  date.setDate(date.getDate() + extraDays);
  return date.toISOString().slice(0, 10);
}

function deriveBudgetFromTours(tours: TourOption[]) {
  const first = tours.find((tour) => tour.price_from > 0);
  return first ? Math.max(first.price_from * 2, 800) : 0;
}

export function normalizeSearchValue(value?: string) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

export function parseBudget(value?: string) {
  const match = String(value || '').match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

export function parseMoney(value: any) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const match = String(value || '').match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : 0;
}



