import {sessionFetch} from '../lib/web-request';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext.jsx';
import { AppConfig } from '../config/appConfig';
import { Button } from './ui/button';
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from './ui/alert-dialog';

export default function BookingCancellationPanel({ booking, onChanged }) {
  const auth = useAuth(), session = useRef(auth); session.current = auth;
  const { t, i18n } = useTranslation();
  const [reviewing, setReviewing] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const inFlight = useRef(false);
  const terms = booking?.booking_terms;
  if (!terms?.version) return null;
  const deadline = new Date(terms.cancellation_deadline);
  const deadlineKnown = Boolean(terms.cancellation_deadline) && Number.isFinite(+deadline);
  const freeCancellation = deadlineKnown && Date.now() <= +deadline;
  const canCancel = !booking.cancellation_requested_at && !['cancelled', 'completed', 'rejected'].includes(booking.status);
  const paid = ['paid', 'succeeded'].includes(String(booking.payment_status || '').toLowerCase());
  const currency = String(booking.currency || '').trim().toUpperCase();
  let amount = null, deadlineLabel = null;
  if (Number.isSafeInteger(booking.amount_cents) && booking.amount_cents > 0 && /^[A-Z]{3}$/.test(currency)) {
    try { amount = new Intl.NumberFormat(i18n.resolvedLanguage, { style: 'currency', currency, currencyDisplay: 'code' }).format(booking.amount_cents / 100); }
    catch { /* Unknown legacy currency must not produce an invented refund. */ }
  }
  if (deadlineKnown) {
    try {
      if (!terms.timezone) throw new Error('Missing timezone');
      deadlineLabel = `${deadline.toLocaleString(i18n.resolvedLanguage, { timeZone: terms.timezone })} (${terms.timezone})`;
    } catch { deadlineLabel = `${deadline.toISOString()} (UTC)`; }
  }
  const request = async () => {
    if (!reviewing || !canCancel || inFlight.current) return;
    const sessionKey = auth.sessionKey, actor = auth.user?.id;
    const current = () => session.current.sessionKey === sessionKey && session.current.user?.id === actor;
    inFlight.current = true; setBusy(true); setError('');
    try {
      if (!sessionKey || !actor) throw new Error(t('cancellation.sign_in'));
      const response = await sessionFetch(`${AppConfig.api.baseUrl.replace(/\/$/, '')}/bookings/${encodeURIComponent(booking.id)}/cancel`, {
        method: 'POST', headers: { },
      });
      if (!current()) return;
      if (response.status === 401) { session.current.logout(); return; }
      const data = await response.json().catch(() => null);
      if (!current()) return;
      if (!response.ok) throw new Error(data?.message || t('cancellation.error'));
      setReviewing(false);
      onChanged();
    } catch (err) { if (current()) setError(err.message); }
    finally { inFlight.current = false; if (current()) setBusy(false); }
  };
  return <section className="space-y-3 border-t border-white/20 pt-4 text-left">
    <h2 className="font-semibold">{t('cancellation.policy_title')}</h2>
    <p>{terms.cancellation_policy}</p>
    <p>{deadlineLabel ? t('cancellation.deadline', { deadline: deadlineLabel }) : t('cancellation.deadline_unknown')}</p>
    {canCancel ? <div className="space-y-2 pt-2">
      <AlertDialog open={reviewing} onOpenChange={open => { if (!inFlight.current) { setReviewing(open); if (open) setError(''); } }}>
        <AlertDialogTrigger asChild>
          <Button type="button" variant="outline" className="h-auto min-h-11 whitespace-normal rounded-xl px-4 py-3">{t('cancellation.review')}</Button>
        </AlertDialogTrigger>
        <AlertDialogContent className="max-h-[85dvh] overflow-y-auto rounded-2xl border-[#d7e6e3] bg-[#fff8f1] text-[#172033]">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('cancellation.dialog_title')}</AlertDialogTitle>
            <AlertDialogDescription className="text-[#526173]">{t('cancellation.dialog_help')}</AlertDialogDescription>
          </AlertDialogHeader>
          {booking.listing?.title ? <p className="font-semibold">{booking.listing.title}</p> : null}
          <div className="space-y-2 rounded-xl border border-[#d7e6e3] bg-white p-4 text-sm">
            <p>{booking.amount_cents === 0 ? t('cancellation.no_payment')
              : paid && freeCancellation && amount ? t('cancellation.refund_preview', { amount })
              : paid && deadlineKnown && !freeCancellation ? t('cancellation.late')
              : t('cancellation.payment_review')}</p>
            <p>{t('cancellation.refund_check')}</p>
          </div>
          {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
          <AlertDialogFooter>
            <AlertDialogCancel type="button" disabled={busy} className="h-auto min-h-11 whitespace-normal rounded-xl border-[#167c7d] bg-white px-4 py-3 text-[#136f71]">{t('cancellation.keep')}</AlertDialogCancel>
            <Button type="button" variant="destructive" disabled={busy} onClick={request} className="h-auto min-h-11 whitespace-normal rounded-xl px-4 py-3">{busy ? t('cancellation.busy') : t('cancellation.confirm')}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <p className="text-sm text-[#cad3df]">{t('cancellation.review_help')}</p>
    </div> : null}
  </section>;
}
