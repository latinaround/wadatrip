import { randomUUID } from 'crypto';

export interface HotelCandidate {
  id: string;
  name: string;
  stars: number;
  checkin: string;
  checkout: string;
  price_per_night: number;
  currency: string;
  raw?: any;
}

export async function searchHotels(city: string, checkin: string, checkout: string, adults: number): Promise<HotelCandidate[]> {
  const base = Math.floor(40 + Math.random() * 160);
  const nights = Math.max(1, Math.ceil((Date.parse(checkout) - Date.parse(checkin)) / (1000*60*60*24)));
  return [2,3,4,5].map(stars => ({
    id: randomUUID(),
    name: `${city} Hotel ${stars}*`,
    stars,
    checkin,
    checkout,
    price_per_night: base * stars,
    currency: 'USD',
    raw: { city, mock: true, stars }
  })).map(h => ({...h, price_per_night: Math.round(h.price_per_night * (1 + (adults-1)*0.15)), nights} as any));
}
