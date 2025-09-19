import axios from 'axios';
import { getRedis } from '@wadatrip/common/redis';
import { FlightCandidate } from './flights.mock';
import { withCircuit } from './circuit';

function cfg() {
  return {
    env: process.env.AMADEUS_ENV || 'sandbox',
    id: process.env.AMADEUS_CLIENT_ID || '',
    secret: process.env.AMADEUS_CLIENT_SECRET || '',
    timeout: Number(process.env.CONNECTOR_TIMEOUT_MS || 8000),
    retries: Number(process.env.CONNECTOR_MAX_RETRIES || 2),
    currency: process.env.DEFAULT_CURRENCY || 'USD',
  };
}

async function getToken(): Promise<string> {
  const redis = getRedis();
  const cacheKey = 'amadeus:token';
  const cached = await redis.get(cacheKey);
  if (cached) return cached;
  const url = cfg().env === 'production'
    ? 'https://api.amadeus.com/v1/security/oauth2/token'
    : 'https://test.api.amadeus.com/v1/security/oauth2/token';
  const form = new URLSearchParams();
  form.append('grant_type', 'client_credentials');
  form.append('client_id', cfg().id);
  form.append('client_secret', cfg().secret);
  const { data } = await axios.post(url, form, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: cfg().timeout });
  const ttl = Math.max(60, Math.floor(Number(data.expires_in || 1800) * 0.9));
  await redis.set(cacheKey, data.access_token, 'EX', ttl);
  return data.access_token;
}

export function mapFlightOffersToCandidates(data: any): FlightCandidate[] {
  const offers = data?.data || [];
  const dict = data?.dictionaries || {};
  return offers.slice(0, 10).map((o: any, idx: number) => {
    const itinerary = o.itineraries?.[0];
    const segments = itinerary?.segments || [];
    const dep = segments[0]?.departure?.at;
    const arr = segments[segments.length - 1]?.arrival?.at;
    const duration = itinerary?.duration || 'PT0H';
    const hours = Number(duration.match(/PT(\d+)H/)?.[1] || 0);
    const carrierCode = segments[0]?.carrierCode || 'XX';
    const carrier = dict?.carriers?.[carrierCode] || carrierCode;
    const priceTotal = Number(o.price?.grandTotal || o.price?.total || 0);
    const currency = o.price?.currency || 'USD';
    const origin = segments[0]?.departure?.iataCode;
    const destination = segments[segments.length - 1]?.arrival?.iataCode;
    // keep a trimmed raw payload
    const raw = { id: o.id, price: o.price, itineraries: [{ duration: itinerary?.duration, segments: segments.map((s:any)=>({carrierCode:s.carrierCode, number:s.number, departure:s.departure, arrival:s.arrival})) }], carriers: dict?.carriers };
    return {
      id: o.id || String(idx),
      airline: carrierCode,
      title: `${origin}-${destination} ${carrier}`,
      departure: dep,
      arrival: arr,
      duration_hours: hours,
      layovers: Math.max(0, segments.length - 1),
      price: Math.round(priceTotal),
      currency,
      raw,
    } as FlightCandidate;
  });
}

export async function amadeusSearchFlights(origin: string, destination: string, date: string): Promise<FlightCandidate[]> {
  const fallback = async () => [] as FlightCandidate[];
  return withCircuit('amadeus', async () => {
    const token = await getToken();
    const base = cfg().env === 'production' ? 'https://api.amadeus.com' : 'https://test.api.amadeus.com';
    const url = `${base}/v2/shopping/flight-offers?originLocationCode=${origin}&destinationLocationCode=${destination}&departureDate=${date}&adults=1&nonStop=false&max=20&currencyCode=${cfg().currency}`; 
    const { data } = await axios.get(url, { timeout: cfg().timeout, headers: { Authorization: `Bearer ${token}` } });
    return mapFlightOffersToCandidates(data);
  }, fallback);
}
