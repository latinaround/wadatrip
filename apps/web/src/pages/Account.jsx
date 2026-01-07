import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { useAuth } from '../context/AuthContext.jsx';
import ItineraryCard from '../components/ItineraryCard.jsx';
import { AppConfig } from '../config/appConfig';
import SummaryCards from '../components/dashboard/SummaryCards.jsx';
import BookingsList from '../components/dashboard/BookingsList.jsx';
import PaymentsList from '../components/dashboard/PaymentsList.jsx';

const apiBase = (AppConfig.api.baseUrl || '').replace(/\/$/, '');

const toArray = (payload, keys) => {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  for (const key of keys) {
    if (Array.isArray(payload[key])) return payload[key];
  }
  return [];
};

const normalizeItineraries = (payload) => {
  const items = toArray(payload, ['itineraries', 'items', 'data']);
  return items.map((item) => {
    const itineraryId = item.itinerary_id || item.id || item.itineraryId;
    const startDate = item.start_date || item.startDate || item.meta?.startDate;
    const endDate = item.end_date || item.endDate || item.meta?.endDate;
    const travelers = item.pax || item.travelers || item.meta?.travelers;
    const days = item.days || item.meta?.days || (startDate && endDate
      ? Math.max(1, Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)))
      : undefined);
    return {
      itinerary_id: itineraryId,
      origin: item.origin || item.meta?.origin,
      destination: item.destination || item.meta?.destination,
      start_date: startDate,
      days,
      pax: travelers,
      scenarios: Array.isArray(item.scenarios) ? item.scenarios : [],
      meta: item.meta || {
        origin: item.origin,
        destination: item.destination,
        startDate,
        days,
        travelers,
      },
    };
  });
};

const normalizeBookings = (payload) => {
  const items = toArray(payload, ['bookings', 'items', 'data', 'results']);
  return items.map((item, index) => {
    const statusRaw = item.status || item.booking_status || item.state || '';
    const paymentRaw = item.payment_status || item.paymentStatus || item.payment?.status || '';
    const currency = item.currency || item.currency_code || item.currencyCode || item.payment?.currency || 'USD';
    const totalPrice = typeof item.total_price === 'number'
      ? item.total_price
      : typeof item.price_total === 'number'
        ? item.price_total
        : typeof item.total === 'number'
          ? item.total
          : Number(item.total_price || item.price_total || item.total) || 0;
    const people = item.num_people || item.people || item.party_size || item.travelers || item.pax || null;
    const dateValue = item.date || item.start_date || item.startDate || item.created_at || item.createdAt || item.updated_at;
    return {
      id: item.id || item.booking_id || item.reference || item.code || `booking-${index}`,
      title: item.listing?.title || item.title || item.scenario?.title || item.itinerary_title || 'Reserva',
      provider: item.provider?.name || item.provider_name || item.vendor || null,
      date: dateValue,
      currency,
      total: totalPrice,
      people,
      status: String(statusRaw || '').toLowerCase(),
      paymentStatus: String(paymentRaw || '').toLowerCase(),
    };
  });
};

const normalizePayments = (payload) => {
  const items = toArray(payload, ['payments', 'items', 'data', 'results']);
  return items.map((item, index) => {
    const amountCents = typeof item.amount_cents === 'number'
      ? item.amount_cents
      : typeof item.amount === 'number'
        ? Math.round(item.amount * 100)
        : typeof item.total === 'number'
          ? Math.round(item.total * 100)
          : Number(item.amount_cents || item.amount || item.total || 0);
    return {
      id: item.id || item.payment_id || item.intent_id || item.reference || `payment-${index}`,
      bookingId: item.booking_id || item.bookingId || item.metadata?.booking_id || item.reference || null,
      amountCents: amountCents || 0,
      currency: item.currency || item.currency_code || item.currencyCode || item.payment?.currency || 'USD',
      status: String(item.status || item.payment_status || item.intent_status || '').toLowerCase(),
      method: item.method || item.payment_method || item.source || 'card',
      createdAt: item.created_at || item.createdAt || item.date || item.timestamp || item.updated_at,
      mock: Boolean(item.mock || item.metadata?.mock || item.demo),
    };
  });
};

const getStats = (itineraries, bookings, payments) => {
  const now = Date.now();
  const currency = payments.find((payment) => payment.currency)?.currency
    || bookings.find((booking) => booking.currency)?.currency
    || 'USD';
  const upcomingTrips = bookings.filter((booking) => {
    if (!booking.date) return false;
    const time = new Date(booking.date).getTime();
    if (Number.isNaN(time)) return false;
    return time >= now && ['pending', 'confirmed'].includes(booking.status);
  }).length;
  const pendingPayments = bookings.filter((booking) => {
    const status = booking.paymentStatus;
    if (!status) return booking.status === 'pending';
    return ['pending', 'requires_payment_method', 'requires_action', 'requires_confirmation'].includes(status);
  }).length;
  const totalSpentCents = payments
    .filter((payment) => ['succeeded', 'paid', 'completed'].includes(payment.status))
    .reduce((sum, payment) => sum + (payment.amountCents || 0), 0);
  return {
    totalTrips: itineraries.length,
    upcomingTrips,
    pendingPayments,
    totalSpentCents,
    currency,
  };
};

const Account = () => {
  const { user, token, logout } = useAuth();
  const [itineraries, setItineraries] = useState([]);
  const [itinerariesLoading, setItinerariesLoading] = useState(true);
  const [itinerariesError, setItinerariesError] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [bookingsLoading, setBookingsLoading] = useState(true);
  const [bookingsError, setBookingsError] = useState(null);
  const [payments, setPayments] = useState([]);
  const [paymentsLoading, setPaymentsLoading] = useState(true);
  const [paymentsError, setPaymentsError] = useState(null);

  const fetchJson = useCallback(async (path, init = {}) => {
    if (!token) throw new Error('Usuario no autenticado');
    const headers = new Headers(init.headers || {});
    headers.set('Accept', 'application/json');
    headers.set('Content-Type', 'application/json');
    headers.set('Authorization', `Bearer ${token}`);
    const response = await fetch(`${apiBase}${path}`, {
      method: 'GET',
      credentials: 'include',
      ...init,
      headers,
    });
    const text = await response.text();
    let data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = null;
      }
    }
    if (!response.ok) {
      const error = new Error(data?.message || `Error ${response.status}`);
      error.status = response.status;
      error.payload = data;
      throw error;
    }
    return data;
  }, [token]);

  const fetchFirstAvailable = useCallback(async (paths) => {
    let lastError = null;
    for (const path of paths) {
      try {
        const data = await fetchJson(path);
        return data;
      } catch (error) {
        lastError = error;
        if (error?.status === 401 || error?.status === 403) {
          throw error;
        }
      }
    }
    if (lastError) throw lastError;
    throw new Error('No hay datos disponibles');
  }, [fetchJson]);

  const loadItineraries = useCallback(async () => {
    if (!token) return;
    setItinerariesLoading(true);
    setItinerariesError(null);
    try {
      const data = await fetchJson('/itineraries/mine');
      setItineraries(normalizeItineraries(data));
    } catch (error) {
      setItineraries([]);
      setItinerariesError(error?.message || 'No se pudieron cargar los itinerarios');
      if (error?.status === 401) logout?.();
    } finally {
      setItinerariesLoading(false);
    }
  }, [fetchJson, logout, token]);

  const loadBookings = useCallback(async () => {
    if (!token) return;
    setBookingsLoading(true);
    setBookingsError(null);
    try {
      const data = await fetchFirstAvailable([
        '/bookings/mine?limit=10',
        '/bookings?scope=mine&limit=10',
        '/bookings?mine=1&limit=10',
      ]);
      setBookings(normalizeBookings(data));
    } catch (error) {
      setBookings([]);
      setBookingsError(error?.message || 'No se pudieron cargar las reservas');
      if (error?.status === 401) logout?.();
    } finally {
      setBookingsLoading(false);
    }
  }, [fetchFirstAvailable, logout, token]);

  const loadPayments = useCallback(async () => {
    if (!token) return;
    setPaymentsLoading(true);
    setPaymentsError(null);
    try {
      const data = await fetchFirstAvailable([
        '/payments/mine?limit=10',
        '/payments/history?limit=10',
        '/payments?mine=1&limit=10',
      ]);
      setPayments(normalizePayments(data));
    } catch (error) {
      setPayments([]);
      setPaymentsError(error?.message || 'No se pudieron cargar los pagos');
      if (error?.status === 401) logout?.();
    } finally {
      setPaymentsLoading(false);
    }
  }, [fetchFirstAvailable, logout, token]);

  useEffect(() => {
    if (!token) {
      setItineraries([]);
      setBookings([]);
      setPayments([]);
      setItinerariesLoading(false);
      setBookingsLoading(false);
      setPaymentsLoading(false);
      return;
    }
    loadItineraries();
    loadBookings();
    loadPayments();
  }, [token, loadItineraries, loadBookings, loadPayments]);

  const stats = useMemo(() => getStats(itineraries, bookings, payments), [itineraries, bookings, payments]);

  if (!user) {
    return (
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4 text-center max-w-xl">
          <h1 className="text-3xl font-bold mb-4 text-gray-900">Inicia sesion para ver tus viajes</h1>
          <p className="text-gray-600">Guarda itinerarios personalizados y retomalos cuando quieras.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-gray-50 py-16">
      <div className="container mx-auto px-4 space-y-10">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-slate-900">Hola, {user.name || user.email}</h1>
          <p className="text-slate-600">Gestiona tus itinerarios generados, reservas y pagos recientes.</p>
        </div>

        <SummaryCards stats={stats} />

        <div className="grid gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            <BookingsList
              bookings={bookings}
              loading={bookingsLoading}
              error={bookingsError}
              onRefresh={loadBookings}
            />

            <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm">
              <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Itinerarios generados</h2>
                  <p className="text-sm text-slate-500">Todos los planes que guardaste desde el generador.</p>
                </div>
                <Button size="sm" variant="outline" asChild>
                  <Link to="/">Buscar nuevo viaje</Link>
                </Button>
              </div>

              {itinerariesError && (
                <div className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {itinerariesError}
                </div>
              )}

              {itinerariesLoading ? (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="h-60 rounded-xl border border-slate-200 bg-slate-100/60 animate-pulse" />
                  ))}
                </div>
              ) : itineraries.length === 0 ? (
                <div className="py-8 text-center text-sm text-slate-500">
                  Cuando generes itinerarios con proveedores reales apareceran aqui.
                </div>
              ) : (
                <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                  {itineraries.map((itinerary) => (
                    <ItineraryCard
                      key={itinerary.itinerary_id}
                      scenario={itinerary.scenarios?.[0]}
                      itineraryId={itinerary.itinerary_id}
                      itineraryMeta={itinerary.meta || {
                        origin: itinerary.origin,
                        destination: itinerary.destination,
                        startDate: itinerary.start_date,
                        days: itinerary.days,
                        travelers: itinerary.pax,
                      }}
                      disableSelect
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <PaymentsList
              payments={payments}
              loading={paymentsLoading}
              error={paymentsError}
            />

            <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Siguiente paso</h2>
              <p className="mt-2 text-sm text-slate-500">
                Usa el generador para crear un nuevo itinerario, confirma la reserva y veras la informacion consolidada aqui.
              </p>
              <ul className="mt-4 space-y-2 text-sm text-slate-600">
                <li>• Genera un itinerario desde la pagina principal.</li>
                <li>• Selecciona un plan y procesa el pago.</li>
                <li>• Revisa el estado de la reserva y los cobros en este panel.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Account;
