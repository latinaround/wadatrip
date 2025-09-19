import { randomUUID } from 'crypto';

export interface ActivityCandidate {
  id: string;
  title: string;
  start: string;
  end: string;
  price: number;
  rating: number;
  currency: string;
  raw?: any;
}

export async function searchActivities(city: string, start_date: string, end_date: string): Promise<ActivityCandidate[]> {
  const days = Math.max(1, Math.ceil((Date.parse(end_date) - Date.parse(start_date)) / (1000*60*60*24)));
  const results: ActivityCandidate[] = [];
  for (let d = 0; d < days; d++) {
    const day = new Date(Date.parse(start_date) + d*24*60*60*1000);
    const date = day.toISOString().slice(0,10);
    [9, 14, 19].forEach((h, i) => {
      const start = new Date(`${date}T${String(h).padStart(2,'0')}:00:00Z`).toISOString();
      const end = new Date(`${date}T${String(h+2).padStart(2,'0')}:00:00Z`).toISOString();
      results.push({
        id: randomUUID(),
        title: `${city} Activity ${d+1}-${i+1}`,
        start,
        end,
        price: 10 + i*15 + d*5,
        rating: 3 + (i%3),
        currency: 'USD',
        raw: { city, mock: true }
      });
    });
  }
  return results;
}
