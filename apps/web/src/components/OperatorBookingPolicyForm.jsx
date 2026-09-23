import { useState } from 'react';
import { Input } from './ui/input';
import { Button } from './ui/button';

export default function OperatorBookingPolicyForm({ listing, onSave, loading }) {
  const [time, setTime] = useState(listing.departure_time || '');
  const [timezone, setTimezone] = useState(listing.timezone || '');
  const [meeting, setMeeting] = useState(listing.meeting_point || '');
  const [cutoff, setCutoff] = useState(listing.booking_cutoff_hours ?? 24);
  const [consent, setConsent] = useState(false);
  return <form className="mt-5 space-y-3 border-t border-white/10 pt-5" onSubmit={event => {
    event.preventDefault();
    if (!consent || loading) return;
    onSave({ departure_time: time, timezone, meeting_point: meeting, booking_cutoff_hours: Number(cutoff), cancellation_policy_version: 'flexible_24h_v1' });
  }}>
    <h3 className="font-semibold">Departure and cancellation rules</h3>
    <div className="grid gap-3 sm:grid-cols-2">
      <label>Departure time<Input required type="time" value={time} onChange={e => setTime(e.target.value)} /></label>
      <label>Timezone<Input required placeholder="America/Lima" value={timezone} onChange={e => setTimezone(e.target.value)} /></label>
      <label>Booking closes (hours before)<Input required type="number" min="0" max="8760" step="1" value={cutoff} onChange={e => setCutoff(e.target.value)} /></label>
      <label>Public meeting point<Input required maxLength={2000} value={meeting} onChange={e => setMeeting(e.target.value)} /></label>
    </div>
    <p className="text-sm">Full refund when cancellation is received at least 24 hours before departure. Later cancellations and no-shows have no automatic refund if the service was provided. Operator cancellation or inability to operate safely: full refund, or a new date if the traveler agrees. Consumer rights remain protected. Changes apply to new bookings only.</p>
    <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />I agree to offer this policy and confirm the departure details.</label>
    <Button disabled={!consent || loading} type="submit">Save booking rules</Button>
  </form>;
}
