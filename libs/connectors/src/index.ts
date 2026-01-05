import { metric } from '@wadatrip/common/metrics';
import { amadeusSearchFlights } from './amadeus.client';
import { travelpayoutsSearchFlights, travelpayoutsSearchHotels, travelpayoutsSearchActivities } from './travelpayouts.client';
import { viatorSearchActivities } from './viator.client';
import { ActivityCandidate, FlightCandidate, HotelCandidate } from './types';

type FlightResolver = (origin: string, destination: string, date: string) => Promise<FlightCandidate[]>;
type HotelResolver = (city: string, checkin: string, checkout: string, adults: number) => Promise<HotelCandidate[]>;
type ActivityResolver = (city: string, startDate: string, endDate: string) => Promise<ActivityCandidate[]>;

export type FlightProvider = 'travelpayouts' | 'amadeus';
export type HotelProvider = 'travelpayouts';
export type ActivityProvider = 'travelpayouts' | 'viator';

const flightResolvers: Record<FlightProvider, FlightResolver> = {
  travelpayouts: travelpayoutsSearchFlights,
  amadeus: amadeusSearchFlights,
};

const hotelResolvers: Record<HotelProvider, HotelResolver> = {
  travelpayouts: travelpayoutsSearchHotels,
};

const activityResolvers: Record<ActivityProvider, ActivityResolver> = {
  travelpayouts: travelpayoutsSearchActivities,
  viator: viatorSearchActivities,
};

function ensureNonEmpty<T>(value: T[] | undefined | null, provider: string, kind: string) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${provider} returned no ${kind}`);
  }
  return value;
}

export async function searchFlights(origin: string, destination: string, date: string, provider: FlightProvider = 'travelpayouts') {
  const resolver = flightResolvers[provider];
  if (!resolver) {
    throw new Error(`Unsupported flight provider: ${provider}`);
  }
  const started = Date.now();
  try {
    const flights = ensureNonEmpty(await resolver(origin, destination, date), provider, 'flights');
    metric('connector.latency_ms', { provider, type: 'flights', ms: Date.now() - started });
    return flights;
  } catch (error) {
    metric('connector.error', { provider, type: 'flights' });
    throw error instanceof Error ? error : new Error(`${provider} flights unavailable`);
  }
}

export async function searchHotels(city: string, checkin: string, checkout: string, adults: number, provider: HotelProvider = 'travelpayouts') {
  const resolver = hotelResolvers[provider];
  if (!resolver) {
    throw new Error(`Unsupported hotel provider: ${provider}`);
  }
  const started = Date.now();
  try {
    const hotels = ensureNonEmpty(await resolver(city, checkin, checkout, adults), provider, 'hotels');
    metric('connector.latency_ms', { provider, type: 'hotels', ms: Date.now() - started });
    return hotels;
  } catch (error) {
    metric('connector.error', { provider, type: 'hotels' });
    throw error instanceof Error ? error : new Error(`${provider} hotels unavailable`);
  }
}

export async function searchActivities(city: string, startDate: string, endDate: string, provider: ActivityProvider = 'travelpayouts') {
  const resolver = activityResolvers[provider];
  if (!resolver) {
    throw new Error(`Unsupported activities provider: ${provider}`);
  }
  const started = Date.now();
  try {
    const activities = await resolver(city, startDate, endDate);
    metric('connector.latency_ms', { provider, type: 'activities', ms: Date.now() - started });
    return activities;
  } catch (error) {
    metric('connector.error', { provider, type: 'activities' });
    throw error instanceof Error ? error : new Error(`${provider} activities unavailable`);
  }
}
