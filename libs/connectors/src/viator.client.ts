import axios from 'axios';
import { withCircuit } from './circuit';
import { ActivityCandidate } from './activities.mock';

function cfg() {
  return {
    apiKey: process.env.VIATOR_API_KEY || '',
    timeout: Number(process.env.CONNECTOR_TIMEOUT_MS || 8000),
    currency: process.env.DEFAULT_CURRENCY || 'USD',
  };
}

export function mapActivities(payload: any): ActivityCandidate[] {
  const items = payload?.data || payload?.products || [];
  const res: ActivityCandidate[] = [];
  for (const p of items.slice(0, 30)) {
    const title = p.title || p.name || 'Activity';
    const price = Math.round(Number(p.price?.amount || p.pricing?.from || 30));
    const currency = p.price?.currency || p.pricing?.currency || cfg().currency;
    const rating = Number(p.reviews?.averageRating || p.rating || 4);
    // Availability to start/end (approx 2h block at 10:00)
    const day = new Date().toISOString().slice(0,10);
    const start = new Date(`${day}T10:00:00Z`).toISOString();
    const end = new Date(`${day}T12:00:00Z`).toISOString();
    res.push({ id: String(p.productCode || p.id || title), title, start, end, price, rating, currency, raw: { id: p.productCode || p.id, title: p.title || p.name, price: p.price || p.pricing, rating: p.reviews?.averageRating || p.rating } });
  }
  return res;
}

export async function viatorSearchActivities(city: string, start_date: string, end_date: string): Promise<ActivityCandidate[]> {
  const fallback = async () => [] as ActivityCandidate[];
  return withCircuit('viator', async () => {
    // Placeholder: Viator endpoints vary; this is a skeleton
    const url = `https://viatorapi.viator.com/partner/products/search`; // example
    const { data } = await axios.get(url, {
      timeout: cfg().timeout,
      headers: { 'api-key': cfg().apiKey },
      params: { text: city, start_date, end_date, currency: cfg().currency },
    });
    return mapActivities(data);
  }, fallback);
}
