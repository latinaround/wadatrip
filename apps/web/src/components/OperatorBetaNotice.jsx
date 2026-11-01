import {sessionFetch} from '../lib/web-request';
import React, { useEffect, useState } from 'react';

export default function OperatorBetaNotice({ apiBase, sessionKey, onAccess }) {
  const [access, setAccess] = useState(null);
  useEffect(() => {
    setAccess(null);
    onAccess?.(null);
    if (!sessionKey) return;
    const controller = new AbortController();
    sessionFetch(`${apiBase}/operator/beta-access`, { headers: { }, signal: controller.signal })
      .then(async response => { if (!response.ok) throw new Error('unavailable'); return response.json(); })
      .then(result => { if (!controller.signal.aborted) { setAccess(result); onAccess?.(result); } })
      .catch(() => { if (!controller.signal.aborted) { setAccess({ unavailable: true }); onAccess?.(null); } });
    return () => controller.abort();
  }, [apiBase, sessionKey, onAccess]);
  return <aside className="mb-6 rounded-2xl border border-amber-300/40 bg-amber-100/10 p-4" aria-label="Operator beta access" role="status">
    <p className="font-semibold">Invitation-only operator beta</p>
    <p>{!sessionKey ? 'Sign in to check your invitation. Your traveler account stays the same.' : !access ? 'Checking your operator access…' : access.unavailable ? 'We could not verify your beta access. Try again later or contact support.'
      : !access.can_prepare ? 'Operator access requires an invitation. Your traveler account and existing trips remain available.'
      : access.can_publish ? 'You can prepare tours and manage reviewed public listings.' : 'Prepare your profile, draft tours and departure dates. Public listing approval requires a separate review.'}</p>
    <p>Beta setup and test payments do not approve real sales or operator payouts. Device uploads are paused; use reviewed photo URLs or destination covers.</p>
    <a href="/contact" className="underline">Contact Wadatrip for beta support</a>
  </aside>;
}
