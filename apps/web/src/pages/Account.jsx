import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { useAuth } from '../context/AuthContext.jsx';
import ItineraryCard from '../components/ItineraryCard.jsx';
import { AppConfig } from '../config/appConfig';
import SummaryCards from '../components/dashboard/SummaryCards.jsx';
import BookingsList from '../components/dashboard/BookingsList.jsx';
import PaymentsList from '../components/dashboard/PaymentsList.jsx';
import { COUNTRY_OPTIONS, getCitySuggestions, normalizeCountryCode } from '../utils/geoOptions';
import { paymentAmountCents, separateTestActivity, partitionBookingHistory } from '../utils/accountDisplay.js';

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
      processorMode: item.payment?.processor_mode || null,
      departureAt: item.booking_terms?.departure_at || null,
      timezone: item.booking_terms?.timezone || null,
    };
  });
};

const normalizePayments = (payload) => {
  const items = toArray(payload, ['payments', 'items', 'data', 'results']);
  return items.map((item, index) => {
    const amountCents = paymentAmountCents(item);
    return {
      id: item.id || item.payment_id || item.intent_id || item.reference || `payment-${index}`,
      bookingId: item.booking_id || item.bookingId || item.metadata?.booking_id || item.reference || null,
      amountCents: amountCents || 0,
      currency: item.charged_currency || item.currency || item.currency_code || item.currencyCode || item.payment?.currency || 'USD',
      status: String(item.status || item.payment_status || item.intent_status || '').toLowerCase(),
      method: item.method || item.payment_method || item.source || 'card',
      createdAt: item.created_at || item.createdAt || item.date || item.timestamp || item.updated_at,
      mock: Boolean(item.mock || item.metadata?.mock || item.demo),
      processorMode: item.processor_mode || null,
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
  country_code: normalizeCountryCode(provider?.country_code),
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
  const { t } = useTranslation();
  const location = useLocation();
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
  const [showGuideSetup, setShowGuideSetup] = useState(false);
  const [personalTripsOpen, setPersonalTripsOpen] = useState(false);

  useEffect(() => {
    if (location.hash === '#my-trips') setPersonalTripsOpen(true);
  }, [location.hash]);

  useEffect(() => {
    if (!user || bookingsLoading || location.hash !== '#my-trips') return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById('my-trips')?.scrollIntoView({ block: 'start' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [user, bookingsLoading, location.hash]);

  const fetchJson = useCallback(async (path, init = {}) => {
    if (!token) throw new Error('User is not authenticated');
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
    throw new Error('No data is available right now.');
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
      setItinerariesError(error?.status === 404 ? null : (error?.message || 'Could not load itineraries'));
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
      setBookingsError(error?.message || 'Could not load bookings');
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
        '/payments/user-history?limit=10',
        '/payments/mine?limit=10',
        '/payments/history?limit=10',
        '/payments?mine=1&limit=10',
      ]);
      setPayments(normalizePayments(data));
    } catch (error) {
      setPayments([]);
      setPaymentsError(error?.message || 'Could not load payments');
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
      setGuideMessage(error?.message || 'Could not load your guide profile.');
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
      setPersonalTripsOpen(false);
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

  const activity = useMemo(() => separateTestActivity(bookings, payments), [bookings, payments]);
  const bookingHistory = partitionBookingHistory(activity.bookings);
  const stats = useMemo(() => getStats(itineraries, activity.bookings, activity.payments), [itineraries, activity]);

  const guidePublicHref = guideProfile?.id ? `/guides/${guideProfile.id}` : null;
  const guideStatusLabel = formatProviderStatus(guideProfile);
  const guideSaveLabel = guideProfile ? 'Save guide profile' : 'Create my guide profile';
  const guideCitySuggestions = useMemo(() => getCitySuggestions(guideForm.country_code), [guideForm.country_code]);
  // Ownership comes from /providers/me, not the account's role label.
  const TripsContainer = guideProfile ? 'details' : 'section';

  const handleAccountField = (field, value) => {
    setAccountForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleGuideField = (field, value) => {
    setGuideForm((prev) => ({
      ...prev,
      [field]: field === 'country_code' ? normalizeCountryCode(value) : value,
    }));
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
      setAccountMessage(error?.message || 'Could not save your account.');
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
        country_code: normalizeCountryCode(guideForm.country_code),
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
      setGuideMessage(error?.message || 'Could not save your guide profile.');
      if (error?.status === 401) logout?.();
    } finally {
      setGuideSaving(false);
    }
  };

  if (!user) {
    return (
        <section className="py-20 bg-[#0a0e27]">
        <div className="container mx-auto px-4 text-center max-w-xl">
          <h1 className="text-3xl font-bold mb-4 text-white">Sign in to view your trips</h1>
          <p className="text-[#a0a0a0]">Save custom itineraries and come back to them whenever you want.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-[#0a0e27] py-16">
      <div className="container mx-auto flex flex-col gap-10 px-4">
        <div className="order-1 space-y-4">
          <h1 className="text-3xl font-bold text-white">Hi, {user.name || user.email}</h1>
          <p className="text-[#a0a0a0]">{guideProfile ? t('account_context.host_help') : 'Manage your trips, bookings, payments, and profile.'}</p>
          <div className="flex flex-wrap gap-3">
            <Button asChild className="h-12 rounded-2xl bg-[#167c7d] px-6 font-semibold text-white hover:bg-[#136f71]">
              {guideProfile ? (
                <Link to="/operator/tours/new">{t('account_context.dashboard')}</Link>
              ) : (
                <a href="#my-trips">My trips</a>
              )}
            </Button>
            {guideProfile ? (
              <Button asChild variant="outline" className="h-11 rounded-2xl px-5">
                <a href="#my-trips" onClick={() => setPersonalTripsOpen(true)}>{t('account_context.personal')}</a>
              </Button>
            ) : null}
            <Button asChild variant="outline" className="h-11 rounded-2xl px-5">
              <Link to="/tours">Explore tours</Link>
            </Button>
          </div>
        </div>

        <div className="order-4 grid gap-6 xl:grid-cols-2">
          <div className="rounded-2xl border border-[#2d3548]/60 bg-[#1a1f3a] p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-white">Your profile</h2>
                <p className="mt-1 text-sm text-[#a0a0a0]">
                  Manage the name and email used for your Wadatrip account.
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
                  We use this address for sign-in and important account updates.
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
                <h2 className="text-lg font-semibold text-white">
                  {guideProfile || showGuideSetup ? 'Host profile' : 'Host on Wadatrip'}
                </h2>
                <p className="mt-1 text-sm text-[#a0a0a0]">
                  {guideProfile || showGuideSetup
                    ? 'Manage the public profile connected securely to your account.'
                    : 'Create and sell tours when you are ready. Your traveler account stays the same.'}
                </p>
              </div>
              {guideProfile || showGuideSetup ? (
                <div className="rounded-full border border-[#00D9FF]/30 px-3 py-1 text-xs uppercase tracking-[0.2em] text-[#7dd3fc]">
                  {guideStatusLabel}
                </div>
              ) : null}
            </div>

            {guideLoading ? (
              <div className="mt-6 text-sm text-[#a0a0a0]">Loading your guide profile...</div>
            ) : !guideProfile && !showGuideSetup ? (
              <div className="mt-6 space-y-5">
                <div className="rounded-xl border border-[#2d3548] bg-[#0a0e27]/60 p-4 text-sm text-[#cad3df]">
                  <p>Publish real departures, manage availability, and receive traveler bookings from one operator workspace.</p>
                  <p className="mt-2 text-[#a0a0a0]">Creating a host profile starts a review. It does not change your existing trips or payments.</p>
                </div>
                <Button type="button" className="h-12 neon-cta font-black" onClick={() => setShowGuideSetup(true)}>
                  Become a host
                </Button>
              </div>
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
                      list="account-guide-city-suggestions"
                    />
                    <datalist id="account-guide-city-suggestions">
                      {guideCitySuggestions.map((city) => <option key={city} value={city} />)}
                    </datalist>
                  </div>
                  <div>
                    <label htmlFor="guide-country" className="text-sm text-[#e0e0e0]">Country (ISO2)</label>
                    <div className="mt-2">
                      <Select
                        value={normalizeCountryCode(guideForm.country_code) || undefined}
                        onValueChange={(value) => handleGuideField('country_code', value)}
                      >
                        <SelectTrigger className="h-12 w-full neon-input text-white">
                          <SelectValue placeholder="Choose a country" />
                        </SelectTrigger>
                        <SelectContent>
                          {COUNTRY_OPTIONS.map((country) => (
                            <SelectItem key={country.code} value={country.code}>
                              {country.label} ({country.code})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
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
                    placeholder="Tell travelers why they should book with you."
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
                  {guideProfile ? (
                    <Button asChild variant="outline" className="h-12 border border-[#00D9FF]/40 text-[#00D9FF] hover:text-white">
                      <Link to="/operator/tours/new">{t('account_context.dashboard')}</Link>
                    </Button>
                  ) : (
                    <Button type="button" variant="outline" className="h-12 border border-[#00D9FF]/40 text-[#00D9FF] hover:text-white" onClick={() => setShowGuideSetup(false)}>
                      Not now
                    </Button>
                  )}
                </div>
              </form>
            )}
          </div>
        </div>

        <TripsContainer id="my-trips" className="order-2 scroll-mt-24 space-y-6"
          {...(guideProfile ? { open: personalTripsOpen, onToggle: (event) => setPersonalTripsOpen(event.currentTarget.open) } : {})}>
          {guideProfile ? (
            <summary className="cursor-pointer rounded-2xl border border-[#2d3548] bg-[#1a1f3a] p-5 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00D9FF]">
              <span className="font-semibold">{t('account_context.personal')}</span>
              <span className="mt-2 block text-sm text-[#a0a0a0]">{t('account_context.personal_help')}</span>
            </summary>
          ) : null}
        <div>
          <SummaryCards stats={stats} />
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            <BookingsList
              bookings={bookingHistory.current}
              loading={bookingsLoading}
              error={bookingsError}
              onRefresh={loadBookings}
              title={t('account_context.current_bookings')}
              description={t('account_context.current_help')}
              emptyMessage={t('account_context.no_upcoming')}
            />
            {bookingHistory.historical.length ? (
              <details className="rounded-2xl border border-white/10 p-5">
                <summary className="cursor-pointer font-semibold text-[#cad3df]">{t('account_context.history', { count: bookingHistory.historical.length })}</summary>
                <p className="my-4 text-sm text-[#a0a0a0]">{t('account_context.history_help')}</p>
                <BookingsList bookings={bookingHistory.historical} loading={bookingsLoading} error={bookingsError} onRefresh={loadBookings}
                  title={t('account_context.history_title')} description={t('account_context.history_help')} />
              </details>
            ) : null}

            <div className="rounded-2xl border border-[#2d3548]/60 bg-[#1a1f3a] p-6 shadow-sm">
              <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">Generated itineraries</h2>
                  <p className="text-sm text-[#a0a0a0]">All the travel plans you saved from the itinerary builder.</p>
                </div>
                <Button size="sm" variant="outline" asChild>
                  <Link to="/">Start a new trip</Link>
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
                  Saved itineraries will appear here after you generate them.
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
              payments={activity.payments}
              loading={paymentsLoading}
              error={paymentsError}
            />
          </div>
        </div>
        {activity.testBookings.length || activity.testPayments.length ? (
          <details className="rounded-2xl border border-amber-400/30 p-5">
            <summary className="cursor-pointer font-semibold text-amber-200">{t('account_context.test_history')}</summary>
            <p className="my-4 text-sm text-[#a0a0a0]">{t('account_context.test_help')}</p>
            <div className="space-y-6">
              <BookingsList bookings={activity.testBookings} loading={bookingsLoading} error={bookingsError} onRefresh={loadBookings} />
              <PaymentsList payments={activity.testPayments} loading={paymentsLoading} error={paymentsError} />
            </div>
          </details>
        ) : null}
        </TripsContainer>
      </div>
    </section>
  );
};

export default Account;
