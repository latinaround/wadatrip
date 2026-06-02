import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '../context/AuthContext.jsx';

const defaultForm = { name: '', email: '', password: '' };

const AuthDialog = ({ open, onClose, initialMode = 'login', initialIntent = 'traveler' }) => {
  const { login, register, requestCode, verifyCode, loading: authLoading } = useAuth();
  const [mode, setMode] = useState(initialMode);
  const [intent, setIntent] = useState(initialIntent);
  const [form, setForm] = useState(defaultForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [emailStepOpen, setEmailStepOpen] = useState(initialMode === 'register');
  const [showPassword, setShowPassword] = useState(false);
  const [authMethod, setAuthMethod] = useState('code');
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState('');
  const [codeNotice, setCodeNotice] = useState('');

  useEffect(() => {
    if (open) {
      setError(null);
      setSubmitting(false);
      setMode(initialMode);
      setIntent(initialIntent);
      setForm(defaultForm);
      setEmailStepOpen(initialMode === 'register');
      setShowPassword(false);
      setAuthMethod('code');
      setCodeSent(false);
      setCode('');
      setCodeNotice('');
    }
  }, [open, initialMode, initialIntent]);

  const isGuideIntent = intent === 'guide';
  const title = useMemo(() => {
    if (mode === 'register') {
      return isGuideIntent ? 'Create your guide account' : 'Create your account';
    }
    return isGuideIntent ? 'Sign in as a guide' : 'Sign in';
  }, [isGuideIntent, mode]);

  const handleInput = (field) => (event) => {
    setForm(prev => ({ ...prev, [field]: event.target.value }));
  };

  const runSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      if (!form.email?.trim()) {
        throw new Error('Enter your email first');
      }
      if (authMethod === 'code') {
        if (!codeSent) {
          const payload = await requestCode({ email: form.email, name: form.name, role: isGuideIntent ? 'guide' : 'traveler' });
          setCodeSent(true);
          setCodeNotice(payload?.preview_code ? `Use code ${payload.preview_code}` : 'We sent a 6-digit code to your email.');
          return;
        }
        await verifyCode({ email: form.email, code, name: form.name, role: isGuideIntent ? 'guide' : 'traveler' });
      } else if (mode === 'register') {
        await register({ email: form.email, password: form.password, name: form.name, role: isGuideIntent ? 'guide' : 'traveler' });
      } else {
        await login({ email: form.email, password: form.password });
      }
      if (onClose) onClose();
    } catch (err) {
      setError(err?.message || 'Action could not be completed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    await runSubmit();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose?.()}>
      <DialogContent className="sm:max-w-md bg-[#1a1f3a] border border-[#2d3548] text-white">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {mode === 'register'
              ? (
                  isGuideIntent
                    ? 'Create a guide account first, then publish your public profile and tours from the same identity.'
                    : 'Create an account to save and pay for your itineraries.'
                )
              : (
                  isGuideIntent
                    ? 'Sign in to manage your guide profile, public page, and tours.'
                    : 'Sign in to access your saved trips.'
                )}
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          {isGuideIntent ? (
            <div className="rounded-xl border border-[#00D9FF]/20 bg-[#0f172a]/50 px-4 py-3 text-sm text-[#c8f7f4]">
              Travelers book faster when your guide identity is complete: photo, city, languages, bio, and your first tour.
            </div>
          ) : null}

          {!emailStepOpen ? (
            <Button
              type="button"
              variant="outline"
              className="w-full justify-between border-[#2d3548] bg-[#0f172a]/40 text-white hover:bg-[#13203c]"
              onClick={() => {
                setEmailStepOpen(true);
                setError(null);
              }}
            >
              <span>{mode === 'register' ? 'Continue with email' : 'Use email and password'}</span>
              <span>→</span>
            </Button>
          ) : (
            <>
              {mode === 'register' && (
                <div className="space-y-2">
                  <Label htmlFor="auth-name">Name</Label>
                  <Input
                    id="auth-name"
                    value={form.name}
                    onChange={handleInput('name')}
                    placeholder="Optional name"
                    className="neon-input"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="auth-email">Email</Label>
                <Input
                  id="auth-email"
                  type="email"
                  value={form.email}
                  onChange={handleInput('email')}
                  required
                  placeholder="you@email.com"
                  className="neon-input"
                />
              </div>

              {authMethod === 'password' || codeSent ? (
                <div className="space-y-2">
                  <Label htmlFor="auth-password">{authMethod === 'code' ? 'Code' : 'Password'}</Label>
                  {authMethod === 'code' ? (
                    <Input
                      id="auth-code"
                      value={code}
                      onChange={(event) => setCode(event.target.value)}
                      placeholder="6-digit code"
                      className="neon-input"
                    />
                  ) : (
                    <div className="flex gap-2">
                      <Input
                        id="auth-password"
                        type={showPassword ? 'text' : 'password'}
                        value={form.password}
                        onChange={handleInput('password')}
                        required
                        minLength={8}
                        className="neon-input"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="border-[#2d3548] bg-transparent text-white hover:bg-[#13203c]"
                        onClick={() => setShowPassword((value) => !value)}
                      >
                        {showPassword ? 'Hide' : 'Show'}
                      </Button>
                    </div>
                  )}
                </div>
              ) : null}

              {codeNotice ? <div className="text-sm font-semibold text-[#8df3d8]">{codeNotice}</div> : null}

              {authMethod === 'code' && !codeSent ? null : (
                <Button
                  type="button"
                  variant="ghost"
                  className="w-fit px-0 text-sm text-[#00D9FF]"
                  onClick={authMethod === 'code'
                    ? () => {
                        setAuthMethod('password');
                        setCodeSent(false);
                        setCode('');
                        setCodeNotice('');
                      }
                    : () => {
                        setAuthMethod('code');
                        setCodeSent(false);
                        setCode('');
                        setCodeNotice('');
                      }}
                  disabled={submitting || authLoading}
                >
                  {authMethod === 'code' ? 'Use password instead' : 'Use a 6-digit code instead'}
                </Button>
              )}

              {authMethod === 'code' && !codeSent ? (
                <div className="text-sm text-slate-300">
                  Enter your email and we will send you a one-time code. No password needed.
                </div>
              ) : null}
            </>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              className="text-sm text-[#00D9FF]"
                onClick={() => {
                  const nextMode = mode === 'register' ? 'login' : 'register';
                  setMode(nextMode);
                  setEmailStepOpen(nextMode === 'register');
                  setAuthMethod('code');
                  setCodeSent(false);
                  setCode('');
                  setCodeNotice('');
                  setError(null);
                }}
              >
              {mode === 'register'
                ? 'Already have an account? Sign in'
                : isGuideIntent
                  ? 'New guide here? Create your account'
                  : 'New here? Create an account'}
            </Button>
            {emailStepOpen ? (
              <Button
                type="button"
                className="neon-cta font-black hover:scale-105 transition-all"
                disabled={submitting || authLoading}
                onClick={runSubmit}
              >
                {submitting
                  ? 'Processing...'
                  : authMethod === 'code'
                    ? codeSent
                      ? 'Continue with code'
                      : 'Email me a code'
                    : mode === 'register'
                      ? 'Create account'
                      : 'Continue'}
              </Button>
            ) : null}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AuthDialog;


