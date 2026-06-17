import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import StatusBadge from './StatusBadge.jsx';

const formatDate = (value) => {
  if (!value) return 'No date';
  try {
    return new Date(value).toLocaleString(undefined, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
};

const formatCurrency = (amountCents = 0, currency = 'USD') => {
  const value = typeof amountCents === 'number' ? amountCents / 100 : Number(amountCents) / 100;
  if (Number.isNaN(value)) return '-';
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency }).format(value);
};

const skeleton = (className) => (
  <span className={`inline-block h-4 animate-pulse rounded bg-slate-200 ${className}`} />
);

const PaymentsList = ({ payments = [], loading, error }) => (
  <Card className="border border-[#2d3548]/60 shadow-sm">
    <CardHeader>
      <CardTitle className="text-lg font-semibold text-white">Recent payments</CardTitle>
      <p className="text-sm text-[#a0a0a0]">Payment history connected to your bookings.</p>
    </CardHeader>
    <CardContent>
      {error && (
        <div className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}
      {!loading && payments.length === 0 ? (
        <div className="py-8 text-center text-sm text-[#a0a0a0]">
          No payments found for this account.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Booking</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(loading ? Array.from({ length: 3 }).map((_, index) => ({ id: `loading-${index}`, loading: true })) : payments).map((payment) => (
              <TableRow key={payment.id || payment.intentId || payment.internalId}>
                <TableCell>{payment.loading ? skeleton('w-32') : formatDate(payment.createdAt)}</TableCell>
                <TableCell>{payment.loading ? skeleton('w-24') : formatCurrency(payment.amountCents, payment.currency)}</TableCell>
                <TableCell>{payment.loading ? skeleton('w-20') : <StatusBadge status={payment.status} />}</TableCell>
                <TableCell>{payment.loading ? skeleton('w-20') : (payment.method || 'card')}</TableCell>
                <TableCell>{payment.loading ? skeleton('w-28') : (payment.bookingId || payment.reference || '-')}
                  {payment.mock && !payment.loading && (
                    <span className="block text-xs text-amber-600">Demo mode</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </CardContent>
  </Card>
);

export default PaymentsList;

