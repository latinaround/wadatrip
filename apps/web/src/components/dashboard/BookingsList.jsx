import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import StatusBadge from './StatusBadge.jsx';

const formatDate = (value) => {
  if (!value) return 'Sin fecha';
  try {
    return new Date(value).toLocaleString('es-ES', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
};

const formatCurrency = (value, currency = 'USD') => {
  if (typeof value !== 'number' || Number.isNaN(value)) return '-';
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
};

const skeleton = (className) => (
  <span className={`inline-block h-4 animate-pulse rounded bg-slate-200 ${className}`} />
);

const BookingsList = ({ bookings = [], loading, error, onRefresh }) => (
  <Card className="border border-[#2d3548]/60 shadow-sm">
    <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
      <div>
        <CardTitle className="text-lg font-semibold text-white">Tus reservas</CardTitle>
        <p className="text-sm text-[#a0a0a0]">Resumen de las reservas creadas desde la web.</p>
      </div>
      <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
        {loading ? 'Actualizando...' : 'Actualizar'}
      </Button>
    </CardHeader>
    <CardContent>
      {error && (
        <div className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}
      {!loading && bookings.length === 0 ? (
        <div className="py-8 text-center text-sm text-[#a0a0a0]">
          Aun no tienes reservas confirmadas.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tour / itinerario</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Personas</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Pago</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(loading ? Array.from({ length: 3 }).map((_, index) => ({ id: `loading-${index}`, loading: true })) : bookings).map((booking) => (
              <TableRow key={booking.id || booking.internalId}>
                <TableCell className="max-w-[220px] truncate font-medium text-slate-800">
                  {booking.loading ? skeleton('w-32') : (booking.title || 'Reserva sin titulo')}
                  {booking.provider && !booking.loading && (
                    <span className="block text-xs text-[#a0a0a0]">{booking.provider}</span>
                  )}
                </TableCell>
                <TableCell>{booking.loading ? skeleton('w-24') : formatDate(booking.date)}</TableCell>
                <TableCell>{booking.loading ? skeleton('w-10') : (booking.people ?? '-')}</TableCell>
                <TableCell>{booking.loading ? skeleton('w-16') : formatCurrency(booking.total, booking.currency)}</TableCell>
                <TableCell>{booking.loading ? skeleton('w-20') : <StatusBadge status={booking.status} />}</TableCell>
                <TableCell>{booking.loading ? skeleton('w-24') : <StatusBadge status={booking.paymentStatus} fallback="sin pago" />}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </CardContent>
  </Card>
);

export default BookingsList;

