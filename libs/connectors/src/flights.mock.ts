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

const HOUR_MS = 60 * 60 * 1000;

function parseDateInput(input?: string): Date | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? `${trimmed}T00:00:00Z` : trimmed;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function resolveTravelDate(input?: string): Date {
  if (!input) {
    return new Date();
  }
  const parsed = parseDateInput(input);
  if (!parsed) {
    throw new RangeError(`Invalid date value "${input}" provided to flights mock`);
  }
  return parsed;
}

function utcAtHour(date: Date, hour: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), hour));
}

export async function searchFlights(origin: string, destination: string, date?: string): Promise<FlightCandidate[]> {
  const travelDate = resolveTravelDate(date);
  const basePrice = Math.floor(200 + Math.random() * 600);

  return [0, 1, 2, 3].map(i => {
    const departure = utcAtHour(travelDate, 8 + i);
    const durationHours = 8 + i;
    const arrival = new Date(departure.getTime() + durationHours * HOUR_MS);

    return {
      id: randomUUID(),
      airline: ['WA', 'GX', 'AD', 'NX'][i % 4],
      title: `${origin}-${destination} #${i + 1}`,
      departure: departure.toISOString(),
      arrival: arrival.toISOString(),
      duration_hours: durationHours,
      layovers: i % 2,
      price: basePrice + i * 50,
      currency: 'USD',
      raw: { origin, destination, date: travelDate.toISOString().slice(0, 10), mock: true },
    };
  });
}
