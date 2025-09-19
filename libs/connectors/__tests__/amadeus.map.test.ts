import { mapFlightOffersToCandidates } from '../src/amadeus.client';

const fixture = {
  data: [
    {
      id: '1',
      itineraries: [
        {
          duration: 'PT10H',
          segments: [
            { carrierCode: 'AA', number: '123', departure: { iataCode: 'SCL', at: '2025-09-10T08:00:00Z' }, arrival: { iataCode: 'MIA', at: '2025-09-10T14:00:00Z' } },
            { carrierCode: 'AA', number: '456', departure: { iataCode: 'MIA', at: '2025-09-10T16:00:00Z' }, arrival: { iataCode: 'JFK', at: '2025-09-10T18:00:00Z' } }
          ],
        },
      ],
      price: { grandTotal: '520.12', currency: 'USD' },
    },
  ],
  dictionaries: { carriers: { AA: 'American Airlines' } },
};

describe('mapFlightOffersToCandidates', () => {
  it('maps Amadeus offer to FlightCandidate', () => {
    const out = mapFlightOffersToCandidates(fixture as any);
    expect(out.length).toBeGreaterThan(0);
    expect(out[0]).toEqual(
      expect.objectContaining({
        id: '1',
        airline: 'AA',
        currency: 'USD',
        layovers: 1,
        duration_hours: 10,
      })
    );
  });
});

