export const SIGN_IN_REQUIRED = 'Please sign in to book this experience. Your session may have expired.';
export const TRAVELER_NAME_REQUIRED = 'Add your name to your Wadatrip account before booking.';

function sessionError() {
  return Object.assign(new Error(SIGN_IN_REQUIRED), { status: 401 });
}

// AuthContext owns the session. Never read storage or accept a caller-selected actor.
function travelerRequest({ apiBase, getSession }) {
  const session = getSession();
  if (session.loading || !session.user?.id || !session.token) throw sessionError();

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
  return { session, post };
}

// Presentation guard only. The authenticated checkout endpoint owns all authorization,
// financial-state and processor-session checks, including races with cancellation.
export function canResumeTravelerCheckout(booking) {
  return Boolean(booking?.id && ['pending', 'payment_pending'].includes(booking.status)
    && booking.payment_status === 'unpaid' && !booking.cancellation_requested_at
    && booking.inventory_state !== 'released'
    && Number.isSafeInteger(booking.amount_cents) && booking.amount_cents > 0);
}

export async function resumeTravelerCheckout({ apiBase, getSession, booking }) {
  const { post } = travelerRequest({ apiBase, getSession });
  if (!canResumeTravelerCheckout(booking)) throw new Error('This booking is not awaiting payment. Refresh its status.');
  const checkout = await post(`/payments/bookings/${encodeURIComponent(booking.id)}/checkout`);
  let url;
  try { url = new URL(checkout?.url); } catch { throw new Error('Checkout URL missing or invalid'); }
  if (url.protocol !== 'https:' || url.hostname !== 'checkout.stripe.com' || url.port || url.username || url.password) {
    throw new Error('Checkout URL is not a secure Stripe checkout');
  }
  return url.href;
}

export async function bookTravelerExperience({ apiBase, getSession, booking }) {
  const { session, post } = travelerRequest({ apiBase, getSession });
  if (!String(session.user.name || '').trim()) {
    throw Object.assign(new Error(TRAVELER_NAME_REQUIRED), { status: 400, code: 'traveler_name_required' });
  }

  const created = await post('/bookings', {
    listing_id: booking.listing_id,
    num_people: booking.num_people,
    date: booking.date,
    ...(booking.policy_version ? { policy_version: booking.policy_version } : {}),
  });
  if (!created?.id) throw new Error('Booking failed');
  if (created.amount_cents === 0) return { booking: created };

  const checkout = await post(`/payments/bookings/${encodeURIComponent(created.id)}/checkout`);
  if (!checkout?.url) throw new Error('Checkout URL missing');
  return { booking: created, checkoutUrl: checkout.url };
}
