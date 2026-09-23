import { useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { AppConfig } from '../config/appConfig';

export default function BookingCancellationPanel({ booking, onChanged }) {
  const auth = useAuth(), session = useRef(auth); session.current = auth;
  const [accepted, setAccepted] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const terms = booking?.booking_terms;
  if (!terms?.version) return null;
  const request = async () => {
    if (!accepted || busy) return;
    const token = auth.token, actor = auth.user?.id;
    const current = () => session.current.token === token && session.current.user?.id === actor;
    setBusy(true); setError('');
    try {
      if (!token || !actor) throw new Error('Sign in to cancel this booking.');
      const response = await fetch(`${AppConfig.api.baseUrl.replace(/\/$/, '')}/bookings/${encodeURIComponent(booking.id)}/cancel`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      });
      if (!current()) return;
      if (response.status === 401) { session.current.logout(); return; }
      const data = await response.json().catch(() => null);
      if (!current()) return;
      if (!response.ok) throw new Error(data?.message || 'Cancellation could not be confirmed. Refresh the booking before trying again.');
      onChanged();
    } catch (err) { if (current()) setError(err.message); }
    finally { if (current()) setBusy(false); }
  };
  return <section className="space-y-3 border-t border-white/20 pt-4 text-left">
    <h2 className="font-semibold">Your cancellation policy</h2>
    <p>{terms.cancellation_policy}</p>
    <p>Free cancellation until {new Date(terms.cancellation_deadline).toLocaleString(undefined, { timeZone: terms.timezone })} ({terms.timezone}). The server checks the time when it receives your request.</p>
    {!booking.cancellation_requested_at && !['cancelled', 'completed', 'rejected'].includes(booking.status) ? <>
      <label className="flex items-start gap-2"><input type="checkbox" checked={accepted} onChange={event => setAccepted(event.target.checked)} />I want to cancel this booking and understand the refund policy above.</label>
      <button className="neon-outline" disabled={!accepted || busy} onClick={request}>{busy ? 'Requesting cancellation…' : 'Cancel booking'}</button>
    </> : null}
    {error ? <p role="alert">{error}</p> : null}
  </section>;
}
