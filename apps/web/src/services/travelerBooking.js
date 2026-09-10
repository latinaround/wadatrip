export const SIGN_IN_REQUIRED = 'Please sign in to book this experience. Your session may have expired.';

function sessionError() {
  return Object.assign(new Error(SIGN_IN_REQUIRED), { status: 401 });
}

// AuthContext owns the session. This flow never reads storage or accepts a caller-selected actor.
export async function bookTravelerExperience({ apiBase, getSession, booking, freeTour }) {
  const session = getSession();
  if (session.loading || !session.user || !session.token) throw sessionError();

  const assertSession = () => {
    const current = getSession();
    if (current.loading || !current.user || current.user.id !== session.user.id || current.token !== session.token) {
      throw sessionError();
    }
    return current;
  };

  async function post(path, body) {
    assertSession();
    const response = await fetch(`${apiBase}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    // A late response from a previous session must not log out a different traveler.
    const current = assertSession();
    if (response.status === 401) {
      current.logout();
      throw sessionError();
    }
    const data = await response.json().catch(() => null);
    assertSession();
    if (!response.ok) throw new Error(data?.message || data?.error || response.statusText || 'Request failed');
    return data;
  }

  const created = await post('/bookings', {
    listing_id: booking.listing_id,
    num_people: booking.num_people,
    date: booking.date,
    total_price: booking.total_price,
    amount_cents: booking.amount_cents,
  });
  if (!created?.id) throw new Error('Booking failed');
  if (freeTour) return { booking: created };

  const checkout = await post(`/payments/bookings/${encodeURIComponent(created.id)}/checkout`);
  if (!checkout?.url) throw new Error('Checkout URL missing');
  return { booking: created, checkoutUrl: checkout.url };
}
