import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { sessionExpiryTime } from '../lib/tour-draft.js';

export default function OperatorSessionNotice({ activityError = null }) {
  const { user, sessionKey, session, sessionObservedAt, refreshProfile } = useAuth();
  const [phase, setPhase] = useState(null);
  const checked = useRef(new Set());
  const refresh = useRef(refreshProfile);
  refresh.current = refreshProfile;
  const deadline = sessionExpiryTime(session, sessionObservedAt);
  useEffect(() => {
    setPhase(null);
    if (!user?.id || !sessionKey || deadline === null) return;
    let active = true;
    const mark = `${user.id}:${sessionKey}:${session.idle_expires_at}:${session.expires_at}`;
    const verify = () => {
      if (!active) return;
      // A server write may have moved the deadline. Bootstrap is read-only and
      // cannot keep an idle session alive or extend its absolute lifetime.
      if (!checked.current.has(mark)) {
        checked.current.add(mark);
        refresh.current().catch(() => { if (active) setPhase('unverified'); });
      } else setPhase(Date.now() >= deadline ? 'expired' : 'soon');
    };
    const timer = setTimeout(verify, Math.max(0, deadline - Date.now() - 120000));
    const expiry = setTimeout(() => {
      if (active) { setPhase('expired'); refresh.current().catch(() => { if (active) setPhase('unverified'); }); }
    }, Math.max(0, deadline - Date.now()));
    return () => { active = false; clearTimeout(timer); clearTimeout(expiry); };
  }, [user?.id, sessionKey, deadline, session?.idle_expires_at, session?.expires_at]);
  if (!user || (!phase && !activityError)) return null;
  return <aside role="status" aria-label="Session expiry warning" className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-2xl rounded-2xl border border-amber-300/40 bg-[#11182d] p-4 text-sm shadow-xl">
    <p className="font-semibold">{phase === 'unverified' || activityError ? 'We could not verify your session.' : phase === 'expired' ? 'Sign in again before saving your tour.' : 'Your session is about to expire.'}</p>
    <p>{activityError || 'Save your draft before stepping away. Editing keeps your session active, but inactivity and maximum-session limits still apply.'}</p>
    <Link className="underline" to="/guide/register?mode=login&next=%2Foperator%2Ftours%2Fnew">Sign in again</Link>
  </aside>;
}
