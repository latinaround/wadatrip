import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AppConfig } from '../config/appConfig';

const tokenStorageKey = 'wadatrip_token';

async function guideAuthRequest(path, body) {
  const baseUrl = AppConfig.api.baseUrl?.replace(/\/$/, '') || '';
  const timeoutMs = Number(AppConfig.api.timeout) || 10000;
  const timeoutPromise = new Promise((_, reject) => {
    window.setTimeout(() => reject(new Error('Request timed out. Please try again.')), timeoutMs);
  });

  let response;
  try {
    response = await Promise.race([
      fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
      timeoutPromise,
    ]);
  } catch (err) {
    throw err;
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || `Request failed with status ${response.status}`);
  }
  return payload;
}

export default function GuideSignupPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = useMemo(() => {
    const next = searchParams.get('next');
    if (!next || !next.startsWith('/')) return '/operator/tours/new';
    return next;
  }, [searchParams]);
  const initialMode = searchParams.get('mode') === 'login' ? 'login' : 'register';
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [authMethod, setAuthMethod] = useState('code');
  const [codeSent, setCodeSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [mode, setMode] = useState(initialMode);

  const busy = submitting;

  const submit = async () => {
    setError('');
    setNotice('');
    setSubmitting(true);
    try {
      if (!email.trim()) {
        throw new Error('Enter your email first');
      }

      if (authMethod === 'code') {
        if (!codeSent) {
          const payload = await guideAuthRequest('/auth/request-code', {
            email: email.trim(),
            name: name.trim() || undefined,
            role: 'guide',
          });
          setCodeSent(true);
          setNotice(payload?.preview_code ? `Use code ${payload.preview_code}` : 'We sent a 6-digit code to your email.');
          return;
        }

        if (!code.trim()) {
          throw new Error('Enter the 6-digit code');
        }

        const payload = await guideAuthRequest('/auth/verify-code', {
          email: email.trim(),
          code: code.trim(),
          name: name.trim() || undefined,
          role: 'guide',
        });
        if (payload?.token) {
          window.localStorage.setItem(tokenStorageKey, payload.token);
          window.location.assign(returnTo);
          return;
        }
      } else if (mode === 'register') {
        if (!password.trim()) {
          throw new Error('Create a password');
        }
        const payload = await guideAuthRequest('/auth/register', {
          email: email.trim(),
          password,
          name: name.trim() || undefined,
          role: 'guide',
        });
        if (payload?.token) {
          window.localStorage.setItem(tokenStorageKey, payload.token);
          window.location.assign(returnTo);
          return;
        }
      } else {
        if (!password.trim()) {
          throw new Error('Enter your password');
        }
        const payload = await guideAuthRequest('/auth/login', {
          email: email.trim(),
          password,
        });
        if (payload?.token) {
          window.localStorage.setItem(tokenStorageKey, payload.token);
          window.location.assign(returnTo);
          return;
        }
      }

      navigate(returnTo);
    } catch (err) {
      setError(err?.message || 'Could not continue');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-shell">
      <div className="page-container py-10">
        <div className="mx-auto max-w-xl rounded-[28px] border border-[#2d3548] bg-[#1a1f3a] p-6 text-white shadow-[0_24px_80px_rgba(15,23,42,0.28)] md:p-8">
          <p className="page-kicker text-[#16d7d0]">
            {mode === 'login' ? 'Step 1 of 2' : 'Become a guide'}
          </p>
          <h1 className="mt-3 text-3xl font-semibold">
            {mode === 'login' ? 'Sign in to publish your tour' : 'Create your guide account'}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-[#cad3df]">
            {mode === 'login'
              ? 'Enter your email, receive a 6-digit code, and then we will take you straight to Publish tours.'
              : 'Start with your email, enter a one-time code, and then publish your first tour.'}
          </p>

          <div className="mt-6 rounded-2xl border border-[#00D9FF]/20 bg-[#0f172a]/50 px-4 py-3 text-sm text-[#c8f7f4]">
            Travelers book faster when your guide identity is complete: photo, city, languages, bio, and one strong tour.
          </div>

          <div className="mt-6 space-y-4">
            {mode === 'register' ? (
              <div className="space-y-2">
                <label className="text-sm font-semibold text-white" htmlFor="guide-name">Name</label>
                <input
                  id="guide-name"
                  className="w-full rounded-xl border border-[#41506b] bg-[#0f172a] px-4 py-3 text-white outline-none"
                  placeholder="Optional name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </div>
            ) : null}

            <div className="space-y-2">
              <label className="text-sm font-semibold text-white" htmlFor="guide-email">Email</label>
              <input
                id="guide-email"
                type="email"
                className="w-full rounded-xl border border-[#41506b] bg-[#0f172a] px-4 py-3 text-white outline-none"
                placeholder="you@email.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>

            {authMethod === 'password' || codeSent ? (
              <div className="space-y-2">
                <label className="text-sm font-semibold text-white" htmlFor="guide-secret">
                  {authMethod === 'code' ? 'Code' : 'Password'}
                </label>
                <input
                  id="guide-secret"
                  type={authMethod === 'code' ? 'text' : 'password'}
                  className="w-full rounded-xl border border-[#41506b] bg-[#0f172a] px-4 py-3 text-white outline-none"
                  placeholder={authMethod === 'code' ? '6-digit code' : mode === 'register' ? 'Create a password' : 'Enter your password'}
                  value={authMethod === 'code' ? code : password}
                  onChange={(event) => authMethod === 'code' ? setCode(event.target.value) : setPassword(event.target.value)}
                />
              </div>
            ) : null}

            {notice ? <p className="text-sm font-semibold text-[#8df3d8]">{notice}</p> : null}
            {error ? <p className="text-sm font-semibold text-[#ff8ca8]">{error}</p> : null}

            <div className="flex flex-col gap-3 pt-2">
              <button
                type="button"
                className="inline-flex h-12 items-center justify-center rounded-2xl bg-gradient-to-r from-[#ff3f97] via-[#ffb347] to-[#16d7d0] px-6 text-sm font-black uppercase tracking-[0.14em] text-white transition-transform hover:scale-[1.01] disabled:opacity-60"
                onClick={submit}
                disabled={busy}
              >
                {busy
                  ? 'Processing...'
                  : authMethod === 'code'
                    ? codeSent
                      ? mode === 'login'
                        ? 'Continue to publish tours'
                        : 'Continue with code'
                      : mode === 'login'
                        ? 'Send code to continue'
                        : 'Email me a code'
                    : mode === 'register'
                      ? 'Create account'
                      : 'Sign in'}
              </button>

              <button
                type="button"
                className="self-start text-sm font-semibold text-[#16d7d0]"
                onClick={() => {
                  setAuthMethod((value) => value === 'code' ? 'password' : 'code');
                  setCodeSent(false);
                  setCode('');
                  setNotice('');
                  setError('');
                }}
                disabled={busy}
              >
                {authMethod === 'code' ? 'Use password instead' : 'Use a 6-digit code instead'}
              </button>

              <button
                type="button"
                className="self-start text-sm text-[#cad3df]"
                onClick={() => {
                  const nextMode = mode === 'register' ? 'login' : 'register';
                  setMode(nextMode);
                  setCodeSent(false);
                  setCode('');
                  setNotice('');
                  setError('');
                }}
                disabled={busy}
              >
                {mode === 'register' ? 'Already have an account? Sign in' : 'New guide here? Create your account'}
              </button>
            </div>
          </div>

          <div className="mt-6 text-sm text-[#9aa8bb]">
            Prefer to explore first? <Link to="/tours" className="text-[#16d7d0]">See marketplace examples</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
