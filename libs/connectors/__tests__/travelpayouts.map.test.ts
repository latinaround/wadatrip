import { mapHotels } from '../src/travelpayouts.client';

const fixture = {
  results: [
    { hotel_id: 100, name: 'Hotel One', stars: 4, price: 120, currency: 'USD' },
    { hotel_id: 101, name: 'Hotel Two', stars: 3, min_price: 80, currency: 'USD' },
  ],
};

describe('mapHotels', () => {
  it('maps Travelpayouts payload to HotelCandidate', () => {
    const out = mapHotels(fixture as any, 'NYC', '2025-09-10', '2025-09-12', 2);
    expect(out.length).toBe(2);
    expect(out[0]).toEqual(
      expect.objectContaining({
        id: '100',
        name: 'Hotel One',
        stars: 4,
        currency: 'USD',
      })
    );
  });
});

