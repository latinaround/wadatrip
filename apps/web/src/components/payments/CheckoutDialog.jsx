import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { Elements, CardElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';

const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

const amountLabel = (amountCents, currency) => {
  const formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' });
  return formatter.format((amountCents || 0) / 100);
};

function ScenarioSummary({ scenario, itineraryMeta }) {
  const flight = scenario?.items?.find(item => item.type === 'flight');
  const lodging = scenario?.items?.find(item => item.type === 'lodging');
  const activities = scenario?.items?.filter(item => item.type === 'activity') || [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Badge variant="secondary" className="uppercase tracking-wide">{scenario?.type}</Badge>
        <span className="text-xl font-semibold text-teal-600">
          {new Intl.NumberFormat('en-US', { style: 'currency', currency: flight?.currency || 'USD' }).format(scenario?.total_price || 0)}
        </span>
      </div>
      <p className="text-sm text-muted-foreground">
        {itineraryMeta?.origin} -> {itineraryMeta?.destination} - {itineraryMeta?.days || '?'} dias - {itineraryMeta?.travelers || 1} viajeros
      </p>
      <div className="text-sm space-y-1">
        <p><strong>Vuelo:</strong> {flight ? `${flight.title || 'Vuelo'} - ${flight.supplier || ''}` : 'Incluido en itinerario'}</p>
        <p><strong>Alojamiento:</strong> {lodging ? lodging.title : 'Incluido en itinerario'}</p>
        <p><strong>Actividades:</strong> {activities.length} planificadas</p>
      </div>
    </div>
  );
}

function CheckoutForm({ clientSecret, amountCents, currency, onSuccess, onError }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!stripe || !elements) {
      return;
    }
    setSubmitting(true);
    setTimeout(() => {}, 0);
    try {
      const card = elements.getElement(CardElement);
      const result = await stripe.confirmCardPayment(clientSecret, {
        payment_method: { card },
      });
      if (result.error) {
        onError?.(result.error.message || 'No se pudo confirmar el pago');
      } else if (result.paymentIntent?.status === 'succeeded') {
        onSuccess?.(result.paymentIntent);
      }
    } catch (err) {
      onError?.(err?.message || 'No se pudo completar el pago');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <LabelComponent text="Tarjeta" />
        <div className="border rounded-md p-3 bg-white">
          <CardElement options={{ style: { base: { fontSize: '16px', color: '#1f2937' } } }} />
        </div>
      </div>
      <Button type="submit" disabled={submitting} className="w-full">
        {submitting ? 'Procesando...' : `Pagar ${amountLabel(amountCents, currency)}`}
      </Button>
    </form>
  );
}

const LabelComponent = ({ text }) => (
  <label className="text-sm font-medium text-slate-700">{text}</label>
);

const CheckoutDialog = ({
  open,
  onClose,
  scenario,
  itineraryMeta,
  loading,
  error,
  clientSecret,
  amountCents,
  currency = 'USD',
  mock,
  mockReason,
  onPaymentSuccess,
  onRetry,
}) => {
  const [localError, setLocalError] = useState(null);

  useMemo(() => {
    if (!open) {
      setLocalError(null);
    }
  }, [open]);

  const effectiveError = localError || error;

  const mockMessage = useMemo(() => {
    if (!mock) return null;
    if (mockReason === 'stripe_disabled') {
      return `Stripe no esta configurado (falta STRIPE_SECRET_KEY). Intent demo ${amountLabel(amountCents, currency)} sin cargo real.`;
    }
    if (mockReason === 'provider_missing_connect') {
      return `El proveedor no tiene cuenta conectada en Stripe. Intent demo ${amountLabel(amountCents, currency)} sin cargo real.`;
    }
    return `Pagos en modo demo. Intent ${amountLabel(amountCents, currency)} sin cargo real.`;
  }, [mock, mockReason, amountCents, currency]);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose?.()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Confirmar reserva</DialogTitle>
          <DialogDescription>
            Revisa los detalles y completa el pago para bloquear este itinerario.
          </DialogDescription>
        </DialogHeader>

        {scenario && (
          <Card className="mb-4">
            <CardContent className="pt-4">
              <ScenarioSummary scenario={scenario} itineraryMeta={itineraryMeta} />
            </CardContent>
          </Card>
        )}

        {mock && mockMessage && (
          <Alert>
            <AlertDescription>{mockMessage}</AlertDescription>
          </Alert>
        )}

        {effectiveError && (
          <Alert variant="destructive" className="mb-3">
            <AlertDescription>{effectiveError}</AlertDescription>
          </Alert>
        )}

        {loading && (
          <div className="py-6 text-center text-sm text-muted-foreground">Creando pago...</div>
        )}

        {!loading && !clientSecret && !mock && (
          <div className="py-6 text-center text-sm text-muted-foreground">
            No se pudo inicializar el pago. <Button variant="link" onClick={onRetry}>Reintentar</Button>
          </div>
        )}

        {!loading && (mock || clientSecret) && (
          <div className="space-y-4">
            {mock ? (
              <Button className="w-full" onClick={() => { onPaymentSuccess?.({ status: 'succeeded', mock: true, mockReason }); }}>
                Confirmar reserva (modo demo)
              </Button>
            ) : stripePromise ? (
              <Elements stripe={stripePromise} options={{ clientSecret }}>
                <CheckoutForm
                  clientSecret={clientSecret}
                  amountCents={amountCents}
                  currency={currency}
                  onSuccess={(intent) => {
                    setLocalError(null);
                    onPaymentSuccess?.(intent);
                  }}
                  onError={(message) => setLocalError(message)}
                />
              </Elements>
            ) : (
              <Alert variant="destructive">
                <AlertDescription>
                  Configura VITE_STRIPE_PUBLISHABLE_KEY para habilitar pagos.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onClose?.()}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
export default CheckoutDialog;

