import { searchFlights as mockFlights } from './flights.mock';
import { searchHotels as mockHotels } from './hotels.mock';
import { searchActivities as mockActivities } from './activities.mock';
import { amadeusSearchFlights } from './amadeus.client';
import { travelpayoutsSearchHotels } from './travelpayouts.client';
import { viatorSearchActivities } from './viator.client';
import { getOrSetWithHit } from '@wadatrip/common/redis';
import { metric } from '@wadatrip/common/metrics';

function flags() {
  return {
    flights: (process.env.FF_REAL_FLIGHTS || 'false').toLowerCase() === 'true',
    hotels: (process.env.FF_REAL_HOTELS || 'false').toLowerCase() === 'true',
    activities: (process.env.FF_REAL_ACTIVITIES || 'false').toLowerCase() === 'true',
  };
}

export async function searchFlights(origin: string, destination: string, date: string, provider?: 'amadeus'|'mock') {
  const useReal = flags().flights && (provider ? provider === 'amadeus' : true);
  const key = `cand:flights:${origin}:${destination}:${date}:${useReal?'real':'mock'}`;
  const t0 = Date.now();
  const { value, hit } = await getOrSetWithHit(key, 60*60*6, async () => {
    if (useReal) {
      const res = await amadeusSearchFlights(origin, destination, date);
      if (res.length) return res;
    }
    return mockFlights(origin, destination, date);
  });
  const providerNameFlights = useReal ? 'amadeus' : 'mock';
  metric('connector.latency_ms', { provider: providerNameFlights, type: 'flights', ms: Date.now()-t0, cache_hit: hit });
  metric('connector.cache_hit', { provider: providerNameFlights, type: 'flights', hit });
  return value;
}

export async function searchHotels(city: string, checkin: string, checkout: string, adults: number, provider?: 'travelpayouts'|'mock') {
  const useReal = flags().hotels && (provider ? provider === 'travelpayouts' : true);
  const key = `cand:hotels:${city}:${checkin}:${checkout}:${adults}:${useReal?'real':'mock'}`;
  const t0 = Date.now();
  const { value, hit } = await getOrSetWithHit(key, 60*60*12, async () => {
    if (useReal) {
      const res = await travelpayoutsSearchHotels(city, checkin, checkout, adults);
      if (res.length) return res;
    }
    return mockHotels(city, checkin, checkout, adults) as any;
  });
  const providerNameHotels = useReal ? 'travelpayouts' : 'mock';
  metric('connector.latency_ms', { provider: providerNameHotels, type: 'hotels', ms: Date.now()-t0, cache_hit: hit });
  metric('connector.cache_hit', { provider: providerNameHotels, type: 'hotels', hit });
  return value;
}

export async function searchActivities(city: string, start_date: string, end_date: string, provider?: 'viator'|'mock') {
  const useReal = flags().activities && (provider ? provider === 'viator' : true);
  const key = `cand:activities:${city}:${start_date}:${end_date}:${useReal?'real':'mock'}`;
  const t0 = Date.now();
  const { value, hit } = await getOrSetWithHit(key, 60*60*12, async () => {
    if (useReal) {
      const res = await viatorSearchActivities(city, start_date, end_date);
      if (res.length) return res;
    }
    return mockActivities(city, start_date, end_date);
  });
  const providerNameActivities = useReal ? 'viator' : 'mock';
  metric('connector.latency_ms', { provider: providerNameActivities, type: 'activities', ms: Date.now()-t0, cache_hit: hit });
  metric('connector.cache_hit', { provider: providerNameActivities, type: 'activities', hit });
  return value;
}
