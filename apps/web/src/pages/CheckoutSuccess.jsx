import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import AuthDialog from '../components/AuthDialog.jsx';
import BookingCancellationPanel from '../components/BookingCancellationPanel.jsx';
import BookingDetails from '../components/BookingDetails.jsx';
import { AppConfig } from '../config/appConfig';
import { bookingStatusMessage } from '../services/bookingStatus';
import { canResumeTravelerCheckout, resumeTravelerCheckout } from '../services/travelerBooking';
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
  const [resumeBusy, setResumeBusy] = useState(false);
  const [resumeError, setResumeError] = useState('');
  const resumeRequest = useRef({ epoch: 0, inFlight: false });
  useEffect(() => {
    const request = resumeRequest.current;
    setResumeBusy(false); setResumeError('');
    return () => { request.epoch++; request.inFlight = false; };
  }, [auth.user?.id, auth.token, bookingId]);
  useEffect(() => {
    let disposed = false;
    setResult(null); setError('');
    if (auth.loading || !auth.user?.id || !auth.token || !bookingId) return;
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
  const canContinue = Boolean(auth.user && auth.token && canResumeTravelerCheckout(booking));
  const continuePayment = async () => {
    const request = resumeRequest.current;
    if (!canContinue || request.inFlight) return;
    const epoch = request.epoch, actor = auth.user.id, token = auth.token, pageUrl = window.location.href;
    // Router navigation can change the URL before a lazy destination commits/unmounts this page.
    const current = () => request.epoch === epoch && window.location.href === pageUrl
      && session.current.user?.id === actor && session.current.token === token;
    request.inFlight = true; setResumeBusy(true); setResumeError('');
    try {
      const url = await resumeTravelerCheckout({ apiBase: AppConfig.api.baseUrl.replace(/\/$/, ''),
        getSession: () => session.current, booking });
      if (current()) window.location.assign(url);
    } catch (err) {
      if (!current()) return;
      if (err.status === 401) setAuthOpen(true);
      else { setResumeError(err.message); setRefresh(value => value + 1); }
    } finally {
      if (request.epoch === epoch) { request.inFlight = false; if (current()) setResumeBusy(false); }
    }
  };
  return (
    <section className="page-shell min-h-0 py-10 md:py-12">
      <div className="page-container py-8 md:py-10"><div className="page-card space-y-4 text-center" aria-live="polite">
        <h1 className="text-3xl font-semibold neon-title">{message.title}</h1>
        <p>{!auth.user ? 'Sign in to check your booking.' : !bookingId ? 'Open your booking from your account to check its status.' : error || (canContinue
          ? 'Your booking is awaiting payment. Continue the checkout for this reservation, or cancel it below. Do not create another booking.' : message.body)}</p>
        {booking ? <BookingDetails booking={booking} /> : null}
        {canContinue ? <div className="space-y-2">
          <Button type="button" disabled={resumeBusy} onClick={continuePayment} className="h-12 w-full rounded-2xl bg-[#167c7d] px-6 font-semibold text-white hover:bg-[#136f71] sm:w-auto">
            {resumeBusy ? 'Opening checkout…' : 'Continue payment'}
          </Button>
          <p className="text-sm">Continues this reservation without creating a new booking. Payment availability is checked again securely.</p>
        </div> : null}
        {resumeError ? <p role="alert" className="text-red-700">{resumeError}</p> : null}
        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row sm:flex-wrap">
          {!auth.user ? (
            <Button className="h-12 w-full min-w-48 rounded-2xl bg-[#167c7d] px-6 font-semibold text-white hover:bg-[#136f71] sm:w-auto" onClick={() => setAuthOpen(true)}>Sign in</Button>
          ) : (
            <>
              <Button asChild className="h-12 w-full min-w-48 rounded-2xl bg-[#167c7d] px-6 font-semibold text-white hover:bg-[#136f71] sm:w-auto">
                <Link to="/account/trips">View my trips</Link>
              </Button>
              <Button variant="outline" disabled={resumeBusy} className="h-11 w-full rounded-2xl px-5 sm:w-auto" onClick={() => setRefresh(value => value + 1)}>Refresh booking status</Button>
            </>
          )}
          <Button asChild variant="outline" className="h-11 w-full rounded-2xl px-5 sm:w-auto">
            <Link to="/tours">Explore more tours</Link>
          </Button>
        </div>
        {booking ? <fieldset disabled={resumeBusy} className="min-w-0">
          <BookingCancellationPanel key={`${auth.user?.id}:${booking.id}`} booking={booking} onChanged={() => setRefresh(value => value + 1)} />
        </fieldset> : null}
      </div></div>
      <AuthDialog open={authOpen} onClose={() => setAuthOpen(false)} initialIntent="traveler" />
    </section>
  );
}
