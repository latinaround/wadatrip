import axios from 'axios';
import { withCircuit } from './circuit';
import { HotelCandidate } from './hotels.mock';

function cfg() {
  return {
    token: process.env.TRAVELPAYOUTS_TOKEN || '',
    timeout: Number(process.env.CONNECTOR_TIMEOUT_MS || 8000),
    currency: process.env.DEFAULT_CURRENCY || 'USD',
  };
}

export function mapHotels(payload: any, city: string, checkin: string, checkout: string, adults: number): HotelCandidate[] {
  // Conservative mapping supporting multiple possible payload shapes (Hotellook cache, etc.)
  const items = payload?.results || payload?.data || payload || [];
  return (Array.isArray(items) ? items : []).slice(0, 30).map((h: any, idx: number) => {
    const id = String(h.hotel_id || h.hotelId || h.id || h.code || `${city}-${idx}`);
    const name = h.hotelName || h.name || 'Hotel';
    const stars = Number(h.stars || h.star_rating || 3);
    const price = Number(
      h.price_per_night || h.priceFrom || h.price || h.min_price || 80
    );
    const currency = h.currency || cfg().currency;
    return {
      id,
      name,
      stars,
      checkin,
      checkout,
      price_per_night: Math.round(price),
      currency,
      raw: {
        id: h.hotel_id || h.hotelId || h.id || h.code,
        name: h.hotelName || h.name,
        stars: h.stars || h.star_rating,
        price: h.priceFrom || h.price || h.min_price,
        currency: h.currency,
      },
    } as HotelCandidate;
  });
}

export async function travelpayoutsSearchHotels(city: string, checkin: string, checkout: string, adults: number): Promise<HotelCandidate[]> {
  // Hotellook Cache endpoint: returns a list of hotels with prices
  // Docs (summary): https://engine.hotellook.com/api/v2/cache.json
  const base = `https://engine.hotellook.com/api/v2/cache.json`;
  const fallback = async () => [] as HotelCandidate[];
  return withCircuit('travelpayouts', async () => {
    const { data } = await axios.get(base, {
      timeout: cfg().timeout,
      params: {
        location: city,
        checkIn: checkin,
        checkOut: checkout,
        adults,
        currency: cfg().currency,
        limit: 30,
        token: cfg().token,
      },
    });
    return mapHotels(data, city, checkin, checkout, adults);
  }, fallback);
}
