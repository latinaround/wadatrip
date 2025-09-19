import { randomUUID } from 'crypto';

export interface FlightCandidate {
  id: string;
  airline: string;
  title: string;
  departure: string;
  arrival: string;
  duration_hours: number;
  layovers: number;
  price: number;
  currency: string;
  raw?: any;
}

export async function searchFlights(origin: string, destination: string, date: string): Promise<FlightCandidate[]> {
  // Mock: generate a few candidates
  const base = Math.floor(200 + Math.random() * 600);
  return [0,1,2,3].map(i => ({
    id: randomUUID(),
    airline: ['WA','GX','AD','NX'][i%4],
    title: `${origin}-${destination} #${i+1}`,
    departure: new Date(date + 'T08:00:00Z').toISOString(),
    arrival: new Date(date + 'T16:00:00Z').toISOString(),
    duration_hours: 8 + i,
    layovers: i % 2,
    price: base + i * 50,
    currency: 'USD',
    raw: { origin, destination, date, mock: true }
  }));
}
