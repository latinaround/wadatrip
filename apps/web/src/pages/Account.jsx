import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { useAuth } from '../context/AuthContext.jsx';
import ItineraryCard from '../components/ItineraryCard.jsx';
import { AppConfig } from '../config/appConfig';
import SummaryCards from '../components/dashboard/SummaryCards.jsx';
import BookingsList from '../components/dashboard/BookingsList.jsx';
import PaymentsList from '../components/dashboard/PaymentsList.jsx';

const apiBase = (AppConfig.api.baseUrl || '').replace(/\/$/, '');

const emptyGuideForm = {
  type: 'guide',
  name: '',
  phone: '',
  instagram_handle: '',
  base_city: '',
  country_code: '',
  languages: '',
  photo_url: '',
  bio_short: '',
  license_url: '',
};

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

const buildGuideForm = (provider, user) => ({
  type: provider?.type || 'guide',
  name: provider?.name || user?.name || '',
  phone: provider?.phone || '',
  instagram_handle: provider?.instagram_handle || '',
  base_city: provider?.base_city || '',
  country_code: provider?.country_code || '',
  languages: Array.isArray(provider?.languages) ? provider.languages.join(', ') : '',
  photo_url: provider?.photo_url || '',
  bio_short: provider?.bio_short || '',
  license_url: provider?.license_url || '',
});

const formatProviderStatus = (provider) => {
  if (!provider) return 'No guide profile yet';
  const status = provider.status || provider.verification_status || 'pending';
  return String(status).replace(/_/g, ' ');
};

const Account = () => {
  const { user, token, logout, refreshProfile } = useAuth();
  const [itineraries, setItineraries] = useState([]);
  const [itinerariesLoading, setItinerariesLoading] = useState(true);
  const [itinerariesError, setItinerariesError] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [bookingsLoading, setBookingsLoading] = useState(true);
  const [bookingsError, setBookingsError] = useState(null);
  const [payments, setPayments] = useState([]);
  const [paymentsLoading, setPaymentsLoading] = useState(true);
  const [paymentsError, setPaymentsError] = useState(null);
  const [accountForm, setAccountForm] = useState({ name: '', email: '' });
  const [accountSaving, setAccountSaving] = useState(false);
  const [accountMessage, setAccountMessage] = useState(null);
  const [guideProfile, setGuideProfile] = useState(null);
  const [guideForm, setGuideForm] = useState(emptyGuideForm);
  const [guideLoading, setGuideLoading] = useState(false);
  const [guideSaving, setGuideSaving] = useState(false);
  const [guideMessage, setGuideMessage] = useState(null);

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

  const loadGuideProfile = useCallback(async () => {
    if (!token || !user) return;
    setGuideLoading(true);
    setGuideMessage(null);
    try {
      const data = await fetchJson('/providers/me');
      setGuideProfile(data || null);
      setGuideForm(buildGuideForm(data, user));
    } catch (error) {
      if (error?.status === 401) {
        logout?.();
        return;
      }
      setGuideProfile(null);
      setGuideForm(buildGuideForm(null, user));
      setGuideMessage(error?.message || 'No se pudo cargar tu perfil de guia.');
    } finally {
      setGuideLoading(false);
    }
  }, [fetchJson, logout, token, user]);

  useEffect(() => {
    if (!user) {
      setAccountForm({ name: '', email: '' });
      return;
    }
    setAccountForm({
      name: user.name || '',
      email: user.email || '',
    });
  }, [user]);

  useEffect(() => {
    if (!token) {
      setItineraries([]);
      setBookings([]);
      setPayments([]);
      setGuideProfile(null);
      setGuideForm(emptyGuideForm);
      setItinerariesLoading(false);
      setBookingsLoading(false);
      setPaymentsLoading(false);
      setGuideLoading(false);
      return;
    }
    loadItineraries();
    loadBookings();
    loadPayments();
    loadGuideProfile();
  }, [token, loadItineraries, loadBookings, loadPayments, loadGuideProfile]);

  const stats = useMemo(() => getStats(itineraries, bookings, payments), [itineraries, bookings, payments]);

  const guidePublicHref = guideProfile?.id ? `/guides/${guideProfile.id}` : null;
  const guideStatusLabel = formatProviderStatus(guideProfile);
  const guideSaveLabel = guideProfile ? 'Save guide profile' : 'Create my guide profile';

  const handleAccountField = (field, value) => {
    setAccountForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleGuideField = (field, value) => {
    setGuideForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveAccount = async (event) => {
    event.preventDefault();
    setAccountSaving(true);
    setAccountMessage(null);
    try {
      await fetchJson('/auth/update', {
        method: 'PATCH',
        body: JSON.stringify({
          name: accountForm.name.trim(),
          email: accountForm.email.trim().toLowerCase(),
        }),
      });
      await refreshProfile?.();
      setAccountMessage('Your account identity was updated.');
    } catch (error) {
      setAccountMessage(error?.message || 'No se pudo guardar tu cuenta.');
      if (error?.status === 401) logout?.();
    } finally {
      setAccountSaving(false);
    }
  };

  const handleSaveGuide = async (event) => {
    event.preventDefault();
    setGuideSaving(true);
    setGuideMessage(null);
    try {
      const payload = {
        type: guideForm.type,
        name: guideForm.name.trim(),
        phone: guideForm.phone.trim(),
        instagram_handle: guideForm.instagram_handle.trim().replace(/^@+/, ''),
        base_city: guideForm.base_city.trim(),
        country_code: guideForm.country_code.trim().toUpperCase(),
        languages: guideForm.languages
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
        photo_url: guideForm.photo_url.trim(),
        bio_short: guideForm.bio_short.trim(),
        license_url: guideForm.license_url.trim(),
      };

      const data = await fetchJson('/providers/me', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      setGuideProfile(data);
      setGuideForm(buildGuideForm(data, user));
      setGuideMessage('Your guide profile now belongs to your account and was saved securely.');
    } catch (error) {
      setGuideMessage(error?.message || 'No se pudo guardar tu perfil de guia.');
      if (error?.status === 401) logout?.();
    } finally {
      setGuideSaving(false);
    }
  };

  if (!user) {
    return (
      <section className="py-20 bg-[#0a0e27]">
        <div className="container mx-auto px-4 text-center max-w-xl">
          <h1 className="text-3xl font-bold mb-4 text-white">Inicia sesion para ver tus viajes</h1>
          <p className="text-[#a0a0a0]">Guarda itinerarios personalizados y retomalos cuando quieras.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-[#0a0e27] py-16">
      <div className="container mx-auto px-4 space-y-10">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-white">Hola, {user.name || user.email}</h1>
          <p className="text-[#a0a0a0]">Gestiona tus itinerarios, tu identidad y tu perfil publico desde una sola cuenta.</p>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <div className="rounded-2xl border border-[#2d3548]/60 bg-[#1a1f3a] p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-white">Account identity</h2>
                <p className="mt-1 text-sm text-[#a0a0a0]">
                  Esta cuenta firma tus acciones con JWT. Desde aqui controlas tu nombre y el email principal.
                </p>
              </div>
            </div>
            <form className="mt-6 space-y-4" onSubmit={handleSaveAccount}>
              <div>
                <label htmlFor="account-name" className="text-sm text-[#e0e0e0]">Display name</label>
                <Input
                  id="account-name"
                  value={accountForm.name}
                  onChange={(event) => handleAccountField('name', event.target.value)}
                  className="mt-2 h-12 neon-input"
                />
              </div>
              <div>
                <label htmlFor="account-email" className="text-sm text-[#e0e0e0]">Email</label>
                <Input
                  id="account-email"
                  value={accountForm.email}
                  onChange={(event) => handleAccountField('email', event.target.value)}
                  className="mt-2 h-12 neon-input"
                  type="email"
                />
                <p className="mt-2 text-xs text-[#a0a0a0]">
                  Si cambias el email, tu perfil de guia queda sincronizado con esta identidad.
                </p>
              </div>
              {accountMessage ? (
                <div className="rounded-md border border-[#00D9FF]/20 bg-[#0a0e27]/70 px-3 py-2 text-sm text-[#7dd3fc]">
                  {accountMessage}
                </div>
              ) : null}
              <Button type="submit" className="h-12 neon-cta font-black" disabled={accountSaving}>
                {accountSaving ? 'Saving...' : 'Save account'}
              </Button>
            </form>
          </div>

          <div className="rounded-2xl border border-[#2d3548]/60 bg-[#1a1f3a] p-6 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Guide ownership</h2>
                <p className="mt-1 text-sm text-[#a0a0a0]">
                  Solo tu sesion autenticada puede editar este perfil. Ya no depende solo de un codigo compartido.
                </p>
              </div>
              <div className="rounded-full border border-[#00D9FF]/30 px-3 py-1 text-xs uppercase tracking-[0.2em] text-[#7dd3fc]">
                {guideStatusLabel}
              </div>
            </div>

            {guideLoading ? (
              <div className="mt-6 text-sm text-[#a0a0a0]">Loading your guide profile...</div>
            ) : (
              <form className="mt-6 space-y-4" onSubmit={handleSaveGuide}>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label htmlFor="guide-type" className="text-sm text-[#e0e0e0]">Profile type</label>
                    <select
                      id="guide-type"
                      value={guideForm.type}
                      onChange={(event) => handleGuideField('type', event.target.value)}
                      className="mt-2 h-12 w-full rounded-md border border-[#00D9FF]/30 bg-[#1a1f3a] px-3 text-sm text-white"
                    >
                      <option value="guide">Guide</option>
                      <option value="operator">Operator</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="guide-email" className="text-sm text-[#e0e0e0]">Owner email</label>
                    <Input
                      id="guide-email"
                      value={user.email || ''}
                      readOnly
                      className="mt-2 h-12 neon-input opacity-80"
                    />
                  </div>
                  <div>
                    <label htmlFor="guide-name" className="text-sm text-[#e0e0e0]">Public name</label>
                    <Input
                      id="guide-name"
                      value={guideForm.name}
                      onChange={(event) => handleGuideField('name', event.target.value)}
                      className="mt-2 h-12 neon-input"
                    />
                  </div>
                  <div>
                    <label htmlFor="guide-phone" className="text-sm text-[#e0e0e0]">WhatsApp / phone</label>
                    <Input
                      id="guide-phone"
                      value={guideForm.phone}
                      onChange={(event) => handleGuideField('phone', event.target.value)}
                      className="mt-2 h-12 neon-input"
                      placeholder="+51..."
                    />
                  </div>
                  <div>
                    <label htmlFor="guide-instagram" className="text-sm text-[#e0e0e0]">Instagram</label>
                    <Input
                      id="guide-instagram"
                      value={guideForm.instagram_handle}
                      onChange={(event) => handleGuideField('instagram_handle', event.target.value)}
                      className="mt-2 h-12 neon-input"
                      placeholder="josleentrips"
                    />
                  </div>
                  <div>
                    <label htmlFor="guide-city" className="text-sm text-[#e0e0e0]">Base city</label>
                    <Input
                      id="guide-city"
                      value={guideForm.base_city}
                      onChange={(event) => handleGuideField('base_city', event.target.value)}
                      className="mt-2 h-12 neon-input"
                      placeholder="Cusco"
                    />
                  </div>
                  <div>
                    <label htmlFor="guide-country" className="text-sm text-[#e0e0e0]">Country (ISO2)</label>
                    <Input
                      id="guide-country"
                      value={guideForm.country_code}
                      onChange={(event) => handleGuideField('country_code', event.target.value)}
                      className="mt-2 h-12 neon-input"
                      placeholder="PE"
                    />
                  </div>
                  <div>
                    <label htmlFor="guide-languages" className="text-sm text-[#e0e0e0]">Languages</label>
                    <Input
                      id="guide-languages"
                      value={guideForm.languages}
                      onChange={(event) => handleGuideField('languages', event.target.value)}
                      className="mt-2 h-12 neon-input"
                      placeholder="Spanish, English"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label htmlFor="guide-photo" className="text-sm text-[#e0e0e0]">Photo URL</label>
                    <Input
                      id="guide-photo"
                      value={guideForm.photo_url}
                      onChange={(event) => handleGuideField('photo_url', event.target.value)}
                      className="mt-2 h-12 neon-input"
                      placeholder="https://..."
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label htmlFor="guide-license" className="text-sm text-[#e0e0e0]">License URL</label>
                    <Input
                      id="guide-license"
                      value={guideForm.license_url}
                      onChange={(event) => handleGuideField('license_url', event.target.value)}
                      className="mt-2 h-12 neon-input"
                      placeholder="https://..."
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="guide-bio" className="text-sm text-[#e0e0e0]">Bio</label>
                  <Textarea
                    id="guide-bio"
                    value={guideForm.bio_short}
                    onChange={(event) => handleGuideField('bio_short', event.target.value)}
                    className="mt-2 min-h-[120px] neon-input"
                    placeholder="Cuentales por que deberian reservar contigo."
                  />
                </div>

                {guideProfile?.verified_level ? (
                  <div className="rounded-xl border border-[#2d3548] bg-[#0a0e27]/60 px-4 py-3 text-sm text-[#cad3df]">
                    <div>Verification level: <span className="font-medium capitalize">{guideProfile.verified_level}</span></div>
                    <div className="mt-1">Tours linked: <span className="font-medium">{Array.isArray(guideProfile.listings) ? guideProfile.listings.length : 0}</span></div>
                  </div>
                ) : null}

                {guideMessage ? (
                  <div className="rounded-md border border-[#00D9FF]/20 bg-[#0a0e27]/70 px-3 py-2 text-sm text-[#7dd3fc]">
                    {guideMessage}
                  </div>
                ) : null}

                <div className="flex flex-col gap-3 md:flex-row md:flex-wrap">
                  <Button type="submit" className="h-12 neon-cta font-black" disabled={guideSaving}>
                    {guideSaving ? 'Saving...' : guideSaveLabel}
                  </Button>
                  {guidePublicHref ? (
                    <Button asChild variant="outline" className="h-12 border border-[#00D9FF]/40 text-[#00D9FF] hover:text-white">
                      <Link to={guidePublicHref}>View public profile</Link>
                    </Button>
                  ) : null}
                  <Button asChild variant="outline" className="h-12 border border-[#00D9FF]/40 text-[#00D9FF] hover:text-white">
                    <Link to="/operator/tours/new">Manage tours</Link>
                  </Button>
                </div>
              </form>
            )}
          </div>
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

            <div className="rounded-2xl border border-[#2d3548]/60 bg-[#1a1f3a] p-6 shadow-sm">
              <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">Itinerarios generados</h2>
                  <p className="text-sm text-[#a0a0a0]">Todos los planes que guardaste desde el generador.</p>
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
                    <div key={index} className="h-60 rounded-xl border border-[#2d3548] bg-[#1a1f3a]/60 animate-pulse" />
                  ))}
                </div>
              ) : itineraries.length === 0 ? (
                <div className="py-8 text-center text-sm text-[#a0a0a0]">
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

            <div className="rounded-2xl border border-[#2d3548]/60 bg-[#1a1f3a] p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-white">Security posture</h2>
              <p className="mt-2 text-sm text-[#a0a0a0]">
                WadaTrip ya protege la cuenta con JWT y scope propio, pero todavia no es seguridad de banco.
              </p>
              <ul className="mt-4 space-y-2 text-sm text-[#a0a0a0]">
                <li> Tu cuenta y tu perfil de guia ahora quedan ligados por `user_id`.</li>
                <li> El perfil publico se edita desde tu propia sesion autenticada.</li>
                <li> El email del guia hereda la identidad principal de tu cuenta.</li>
                <li> Aun conviene reforzar XSS, rotacion de tokens y futuros cambios de contrasena/MFA.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Account;
