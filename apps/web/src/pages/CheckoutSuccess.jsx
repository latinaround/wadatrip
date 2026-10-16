import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import AuthDialog from '../components/AuthDialog.jsx';
import BookingCancellationPanel from '../components/BookingCancellationPanel.jsx';
import BookingDetails from '../components/BookingDetails.jsx';
import { AppConfig } from '../config/appConfig';
import { bookingStatusMessage } from '../services/bookingStatus';
import { Button } from '../components/ui/button';

export default function CheckoutSuccess() {
  const auth = useAuth();
  const session = useRef(auth);
  session.current = auth;
  const [params] = useSearchParams();
  const bookingId = params.get('booking_id'); // Identifier only; server checks ownership.
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [authOpen, setAuthOpen] = useState(false);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let disposed = false;
    setResult(null); setError('');
    if (auth.loading || !auth.user || !auth.token || !bookingId) return;
    const token = auth.token, actor = auth.user.id;
    const current = () => !disposed && session.current.token === token && session.current.user?.id === actor;
    const base = AppConfig.api.baseUrl.replace(/\/$/, '');
    (async () => {
      // Outages must not turn a redirect into a false confirmation.
      const reconcile = await fetch(`${base}/payments/bookings/${encodeURIComponent(bookingId)}/reconcile`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      }).catch(() => null);
      if (!current()) return;
      if (reconcile?.status === 401) { session.current.logout(); setAuthOpen(true); return; }
      const response = await fetch(`${base}/bookings/${encodeURIComponent(bookingId)}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!current()) return;
      if (response.status === 401) { session.current.logout(); setAuthOpen(true); return; }
      if (!response.ok) throw new Error('Unable to verify this booking. No confirmation is available.');
      const booking = await response.json();
      if (current()) setResult({ actor, token, bookingId, booking });
    })().catch(err => { if (current()) setError(err.message); });
    return () => { disposed = true; };
  }, [auth.user?.id, auth.token, auth.loading, bookingId, refresh]);
  const booking = result?.actor === auth.user?.id && result?.token === auth.token && result?.bookingId === bookingId ? result.booking : null;
  const message = bookingStatusMessage(booking);
  return (
    <section className="page-shell min-h-0 py-10 md:py-12">
      <div className="page-container py-8 md:py-10"><div className="page-card space-y-4 text-center" aria-live="polite">
        <h1 className="text-3xl font-semibold neon-title">{message.title}</h1>
        <p>{!auth.user ? 'Sign in to check your booking.' : !bookingId ? 'Open your booking from your account to check its status.' : error || message.body}</p>
        {booking ? <BookingDetails booking={booking} /> : null}
        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row sm:flex-wrap">
          {!auth.user ? (
            <Button className="h-12 w-full min-w-48 rounded-2xl bg-[#167c7d] px-6 font-semibold text-white hover:bg-[#136f71] sm:w-auto" onClick={() => setAuthOpen(true)}>Sign in</Button>
          ) : (
            <>
              <Button asChild className="h-12 w-full min-w-48 rounded-2xl bg-[#167c7d] px-6 font-semibold text-white hover:bg-[#136f71] sm:w-auto">
                <Link to="/account#my-trips">View my trips</Link>
              </Button>
              <Button variant="outline" className="h-11 w-full rounded-2xl px-5 sm:w-auto" onClick={() => setRefresh(value => value + 1)}>Refresh booking status</Button>
            </>
          )}
          <Button asChild variant="outline" className="h-11 w-full rounded-2xl px-5 sm:w-auto">
            <Link to="/tours">Explore more tours</Link>
          </Button>
        </div>
        {booking ? <BookingCancellationPanel key={`${auth.user?.id}:${booking.id}`} booking={booking} onChanged={() => setRefresh(value => value + 1)} /> : null}
      </div></div>
      <AuthDialog open={authOpen} onClose={() => setAuthOpen(false)} initialIntent="traveler" />
    </section>
  );
}
