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
        {itineraryMeta?.origin} to {itineraryMeta?.destination} - {itineraryMeta?.days || '?'} days - {itineraryMeta?.travelers || 1} travelers
      </p>
      <div className="text-sm space-y-1">
        <p><strong>Flight:</strong> {flight ? `${flight.title || 'Flight'} - ${flight.supplier || ''}` : 'Included in itinerary'}</p>
        <p><strong>Lodging:</strong> {lodging ? lodging.title : 'Included in itinerary'}</p>
        <p><strong>Activities:</strong> {activities.length} planned</p>
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
        onError?.(result.error.message || 'Payment could not be confirmed');
      } else if (result.paymentIntent?.status === 'succeeded') {
        onSuccess?.(result.paymentIntent);
      }
    } catch (err) {
      onError?.(err?.message || 'Payment could not be completed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <LabelComponent text="Card" />
        <div className="border border-[#00D9FF]/30 rounded-md p-3 bg-[#1a1f3a]">
          <CardElement options={{ style: { base: { fontSize: '16px', color: '#ffffff' } } }} />
        </div>
      </div>
      <Button type="submit" disabled={submitting} className="w-full">
        {submitting ? 'Processing...' : `Pay ${amountLabel(amountCents, currency)}`}
      </Button>
    </form>
  );
}

const LabelComponent = ({ text }) => (
  <label className="text-sm font-medium text-[#e0e0e0]">{text}</label>
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
      return `Preview booking only. Payments are not fully enabled yet, so no real charge will be made for ${amountLabel(amountCents, currency)}.`;
    }
    if (mockReason === 'provider_missing_connect') {
      return `Preview booking only. This host is not ready for live payouts yet, so no real charge will be made for ${amountLabel(amountCents, currency)}.`;
    }
    return `Preview booking only. No real charge will be made for ${amountLabel(amountCents, currency)}.`;
  }, [mock, mockReason, amountCents, currency]);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose?.()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Confirm booking</DialogTitle>
          <DialogDescription>
            Review the details and complete payment to lock this itinerary.
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
          <div className="py-6 text-center text-sm text-muted-foreground">Creating payment...</div>
        )}

        {!loading && !clientSecret && !mock && (
          <div className="py-6 text-center text-sm text-muted-foreground">
            Payment could not be initialized. <Button variant="link" onClick={onRetry}>Try again</Button>
          </div>
        )}

        {!loading && (mock || clientSecret) && (
          <div className="space-y-4">
            {mock ? (
              <Button className="w-full" onClick={() => { onPaymentSuccess?.({ status: 'succeeded', mock: true, mockReason }); }}>
                Continue in preview mode
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
                  Configure VITE_STRIPE_PUBLISHABLE_KEY to enable payments.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onClose?.()}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
export default CheckoutDialog;


