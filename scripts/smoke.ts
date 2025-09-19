import 'dotenv/config';
import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { io } from 'socket.io-client';

async function main() {
  const prisma = new PrismaClient();
  const base = process.env.GATEWAY_URL || 'http://localhost:3000';
  console.log('Smoke starting at', base);

  // 1) Generate itinerary
  const genBody = {
    origin: 'SCL', destination: 'JFK', start_date: '2025-09-10', end_date: '2025-09-15', adults: 1, budget_total: 1200,
  };
  const gen = await axios.post(`${base}/itineraries/generate`, genBody, { params: {
    providerFlights: 'amadeus', providerHotels: 'travelpayouts', providerActivities: 'viator'
  }});
  const itineraryId = gen.data.itinerary_id as string;
  console.log('Generated itinerary', itineraryId);

  // 2) Check DB details JSONB present
  const versions = await prisma.itinerary_versions.findMany({ where: { itinerary_id: itineraryId } });
  const vIds = versions.map(v => v.id);
  const items = await prisma.itinerary_items.findMany({ where: { version_id: { in: vIds } } });
  const withDetails = items.filter(i => !!i.details).length;
  console.log(`Items: ${items.length}, with details: ${withDetails}`);

  // 3) WebSocket listen
  const s = io(`${base}/ws`, { transports: ['websocket'] });
  let alertReceived: any = null;
  s.on('alert.triggered', (m) => { console.log('WS alert.triggered', m); alertReceived = m; });
  s.on('itinerary.updated', (m) => { console.log('WS itinerary.updated', m); });

  // 4) Subscribe to alerts
  const subBody = { itinerary_id: itineraryId, rules: [
    { type: 'adred_recommendation', route: 'SCL-JFK' },
    { type: 'price_drop', route: 'SCL-JFK', threshold: 30 },
  ] };
  await axios.post(`${base}/alerts/subscribe`, subBody);
  console.log('Subscribed to alerts');

  // 5) Update itinerary to trigger WS itinerary.updated
  await axios.post(`${base}/itineraries/update`, { itinerary_id: itineraryId, changes: { budget_total: 1400 } });

  // 6) Wait up to 90s for an alert
  const started = Date.now();
  while (!alertReceived && Date.now() - started < 90000) {
    await new Promise(r => setTimeout(r, 1000));
  }
  console.log('Alert received?', !!alertReceived);

  await prisma.$disconnect();
  s.close();
  console.log('Smoke complete.');
}

main().catch(err => { console.error('Smoke failed', err); process.exit(1); });

