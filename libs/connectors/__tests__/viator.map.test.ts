import { mapActivities } from '../src/viator.client';

const fixture = {
  data: [
    { id: 'V1', title: 'Best Tour', price: { amount: 45, currency: 'USD' }, reviews: { averageRating: 4.6 } },
    { id: 'V2', title: 'City Walk', price: { amount: 25, currency: 'USD' }, reviews: { averageRating: 4.2 } },
  ],
};

describe('mapActivities', () => {
  it('maps Viator payload to ActivityCandidate', () => {
    const out = mapActivities(fixture as any);
    expect(out.length).toBe(2);
    expect(out[0]).toEqual(
      expect.objectContaining({
        id: 'V1',
        title: 'Best Tour',
        currency: 'USD',
      })
    );
  });
});

