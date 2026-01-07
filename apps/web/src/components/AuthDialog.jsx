import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '../context/AuthContext.jsx';

const defaultForm = { name: '', email: '', password: '' };

const AuthDialog = ({ open, onClose, initialMode = 'login' }) => {
  const { login, register, loading: authLoading } = useAuth();
  const [mode, setMode] = useState(initialMode);
  const [form, setForm] = useState(defaultForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      setError(null);
      setSubmitting(false);
      setMode(initialMode);
      setForm(defaultForm);
    }
  }, [open, initialMode]);

  const title = useMemo(() => (mode === 'register' ? 'Crea tu cuenta' : 'Inicia sesión'), [mode]);

  const handleInput = (field) => (event) => {
    setForm(prev => ({ ...prev, [field]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (mode === 'register') {
        await register({ email: form.email, password: form.password, name: form.name });
      } else {
        await login({ email: form.email, password: form.password });
      }
      if (onClose) onClose();
    } catch (err) {
      setError(err?.message || 'No se pudo completar la acción');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose?.()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {mode === 'register' ? 'Regístrate para guardar y pagar tus itinerarios.' : 'Ingresa para acceder a tus viajes guardados.'}
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          {mode === 'register' && (
            <div className="space-y-2">
              <Label htmlFor="auth-name">Nombre</Label>
              <Input
                id="auth-name"
                value={form.name}
                onChange={handleInput('name')}
                placeholder="Nombre opcional"
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
              placeholder="tu@email.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="auth-password">Contraseña</Label>
            <Input
              id="auth-password"
              type="password"
              value={form.password}
              onChange={handleInput('password')}
              required
              minLength={8}
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              className="text-sm"
              onClick={() => setMode(mode === 'register' ? 'login' : 'register')}
            >
              {mode === 'register' ? '¿Ya tienes cuenta? Inicia sesión' : '¿Nuevo aquí? Crea una cuenta'}
            </Button>
            <Button type="submit" disabled={submitting || authLoading}>
              {submitting ? 'Procesando…' : mode === 'register' ? 'Registrarme' : 'Iniciar sesión'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AuthDialog;
