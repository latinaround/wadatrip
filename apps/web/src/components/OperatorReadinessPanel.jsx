import { useMemo, useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import OperatorBookingPolicyForm from './OperatorBookingPolicyForm.jsx';

const hasNumber = (value) => (typeof value === 'number' || typeof value === 'string')
  && String(value).trim() !== '' && Number.isFinite(Number(value));
const hasText = (value) => typeof value === 'string' && value.trim().length > 0;

function hasPrice(listing) {
  if (String(listing?.currency || '').trim().toUpperCase() !== 'USD') return false;
  const freeTour = Array.isArray(listing?.tags) && listing.tags.includes('free_tour');
  if (freeTour && listing.price_from == null) return true;
  return hasNumber(listing?.price_from) && Number(listing.price_from) >= 0
    && (!freeTour || Number(listing.price_from) === 0);
}

const checks = [
  ['profile', 'Provider profile', (p) => p?.name && p?.base_city && p?.country_code && p?.languages?.length],
  ['verification', 'Provider approved', (p) => ['approved', 'verified'].includes(String(p?.status || '').toLowerCase())],
  ['price', 'Price and currency', (_, l) => hasPrice(l)],
  ['timezone', 'Timezone', (_, l) => hasText(l?.timezone)],
  ['meeting', 'Meeting point', (_, l) => hasText(l?.meeting_point)],
  ['cancellation', 'Cancellation policy', (_, l) => hasText(l?.cancellation_policy)],
  ['cutoff', 'Booking cutoff', (_, l) => hasNumber(l?.booking_cutoff_hours)
    && Number.isInteger(Number(l.booking_cutoff_hours)) && Number(l.booking_cutoff_hours) >= 0],
  ['payout', 'Payout account linked', (p) => hasText(p?.stripe_account_id)],
];

export default function OperatorReadinessPanel({ provider, listing, availability = [], loading, message, onSaveAvailability, onRemoveAvailability, onSavePolicy }) {
  const [date, setDate] = useState('');
  const [spotsTotal, setSpotsTotal] = useState('');
  const ready = useMemo(() => checks.filter(([, , predicate]) => predicate(provider, listing)).length, [provider, listing]);
  const canEditAvailability = Boolean(listing?.id);
  const save = async (event) => {
    event.preventDefault();
    if (!date || !Number.isInteger(Number(spotsTotal)) || Number(spotsTotal) < 1) return;
    await onSaveAvailability({ date, spotsTotal });
    setDate(''); setSpotsTotal('');
  };
  return (
    <section className="page-card" aria-labelledby="operator-readiness-title">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm text-[#00D9FF]">Launch readiness</p>
          <h2 id="operator-readiness-title" className="text-xl font-semibold text-white">Make this tour bookable safely</h2>
          <p className="text-sm text-[#a0a0a0]">Complete the operational details and add real dates before sharing the booking link.</p>
        </div>
        <span className="text-sm font-semibold text-[#cad3df]">{ready}/{checks.length} setup checks complete</span>
      </div>
      <div className="mt-5 grid gap-2 md:grid-cols-2">
        {checks.map(([key, label, predicate]) => {
          const complete = predicate(provider, listing);
          return <div key={key} className={`rounded-xl border px-3 py-2 text-sm ${complete ? 'border-[#167c7d]/50 bg-[#e7f7f5]/10 text-[#8df3d8]' : 'border-[#f59e0b]/30 bg-[#f59e0b]/5 text-[#f8c66b]'}`}>
            {complete ? '✓' : '○'} {label}
          </div>;
        })}
      </div>
      <p className="mt-3 text-sm text-[#a0a0a0]">A linked payout account does not confirm that payouts are enabled. Real dates and available spots are also required before travelers can book.</p>
      {canEditAvailability ? (
        <>
          {onSavePolicy ? <OperatorBookingPolicyForm key={`${listing.id}:${listing.departure_time}:${listing.cancellation_policy_version}`} listing={listing} onSave={onSavePolicy} loading={loading} /> : null}
          <div className="mt-6 border-t border-white/10 pt-5">
            <h3 className="font-semibold text-white">Availability</h3>
            <p className="mt-1 text-sm text-[#a0a0a0]">Use UTC calendar days. Capacity is checked and locked by the backend.</p>
            <form className="mt-4 grid gap-3 sm:grid-cols-[1fr_140px_auto] sm:items-end" onSubmit={save}>
              <label className="text-sm text-[#e0e0e0]">Date<Input type="date" min={new Date().toISOString().slice(0, 10)} value={date} onChange={(e) => setDate(e.target.value)} className="mt-2 h-11 neon-input" /></label>
              <label className="text-sm text-[#e0e0e0]">Spots<Input type="number" min="1" step="1" value={spotsTotal} onChange={(e) => setSpotsTotal(e.target.value)} className="mt-2 h-11 neon-input" /></label>
              <Button type="submit" disabled={loading} className="h-11 neon-cta">{loading ? 'Saving…' : 'Save date'}</Button>
            </form>
          </div>
          <div className="mt-4 space-y-2">
            {availability.length ? availability.map((item) => <div key={item.id || item.date} className="flex items-center justify-between rounded-xl border border-white/10 bg-[#0a0e27]/60 px-3 py-2 text-sm text-[#cad3df]">
              <span>{item.date} · {item.spots_available} of {item.spots_total} spots available</span>
              <Button type="button" variant="outline" disabled={loading || Number(item.spots_available) < Number(item.spots_total)} onClick={() => onRemoveAvailability(item.date)} className="h-8 border-red-300/40 text-red-200">Remove</Button>
            </div>) : <p className="text-sm text-[#f8c66b]">No dates configured yet.</p>}
          </div>
        </>
      ) : <p className="mt-5 text-sm text-[#f8c66b]">Save this tour first, then add dates and capacity here.</p>}
      {message ? <p className="mt-4 text-sm text-[#8df3d8]">{message}</p> : null}
    </section>
  );
}
