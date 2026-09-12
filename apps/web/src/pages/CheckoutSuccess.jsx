import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import AuthDialog from '../components/AuthDialog.jsx';
import { AppConfig } from '../config/appConfig';
import { bookingStatusMessage } from '../services/bookingStatus';

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
        {!auth.user ? <button className="neon-cta" onClick={() => setAuthOpen(true)}>Sign in</button>
          : <button className="neon-cta" onClick={() => setRefresh(value => value + 1)}>Refresh status</button>}
        <Link className="neon-outline" to="/tours">Back to tours</Link>
      </div></div>
      <AuthDialog open={authOpen} onClose={() => setAuthOpen(false)} initialIntent="traveler" />
    </section>
  );
}
