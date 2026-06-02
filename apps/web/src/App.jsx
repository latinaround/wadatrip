import { useEffect, useMemo, useState } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import Header from './components/Header';
import Hero from './components/Hero';
import ResultsSection from './components/ResultsSection';
import AboutSection from './components/AboutSection';
import FlightPricePredictor from './components/FlightPricePredictor';
import FlightPriceAlert from './components/FlightPriceAlert';
import Footer from './components/Footer';
import WhatsAppButton from './components/WhatsAppButton';
import TourAlerts from './pages/TourAlerts.jsx';
import { FlightPriceNotifications } from './components/FlightPriceNotifications';
import Products from './pages/Products';
import Solutions from './pages/Solutions';
import Contact from './pages/Contact';
import AboutUs from './pages/AboutUs';
import PrivacyPolicy from './pages/PrivacyPolicy';
import RequestDemo from './pages/RequestDemo';
import FlightAlerts from './pages/FlightAlerts';
import Account from './pages/Account';
import OperatorToursNew from './pages/OperatorToursNew.jsx';
import Tours from './pages/Tours.jsx';
import TourDetail from './pages/TourDetail.jsx';
import GuideProfile from './pages/GuideProfile.jsx';
import GuideSignupPage from './pages/GuideSignupPage.jsx';
import Home from './pages/Home.jsx';
import CheckoutSuccess from './pages/CheckoutSuccess.jsx';
import CheckoutCancel from './pages/CheckoutCancel.jsx';
import AuthDialog from './components/AuthDialog.jsx';
import CheckoutDialog from './components/payments/CheckoutDialog.jsx';
import { useAuth } from './context/AuthContext.jsx';
import { AppConfig } from './config/appConfig';
import { notificationService } from './utils/notifications';
import AdminApp from './admin/AdminApp.jsx';
import WadaAgent from './components/WadaAgent';

const initialCheckoutState = {
  open: false,
  scenario: null,
  itineraryId: null,
  itineraryMeta: null,
  clientSecret: null,
  loading: false,
  error: null,
  amountCents: 0,
  currency: 'USD',
  mock: false,
  mockReason: null,
};

function buildGeneratePayload(formData) {
  const days = Math.max(1, Number.parseInt(formData.tripLength, 10) || 5);
  const travelers = Math.max(1, Number.parseInt(formData.travelers, 10) || 1);
  const origin = formData.origin?.trim().toUpperCase();
  const destination = formData.destination?.trim().toUpperCase();

  const payload = {
    origin,
    destination,
    startDate: formData.startDate,
    days,
    travelers,
    budget: formData.budget || 'medium',
    title: `${destination || 'Trip'} ${formData.startDate || ''}`.trim(),
  };

  if (formData.interests) {
    const interests = formData.interests
      .split(',')
      .map(item => item.trim())
      .filter(Boolean);
    if (interests.length) {
      payload.preferences = { interests };
    }
  }

  const meta = {
    origin,
    destination,
    startDate: formData.startDate,
    days,
    travelers,
    budget: payload.budget,
  };

  return { payload, meta };
}

function App() {
  const { user, token, logout } = useAuth();
  const { t } = useTranslation();
  const apiBase = useMemo(() => (AppConfig.api.baseUrl || '').replace(/\/$/, ''), []);
  const location = useLocation();
  const navigate = useNavigate();
  const isAdminRoute = location.pathname.startsWith('/admin');

  const [searchData, setSearchData] = useState(null);
  const [currentItinerary, setCurrentItinerary] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [paymentNotice, setPaymentNotice] = useState(null);
  const [authDialogState, setAuthDialogState] = useState({
    open: false,
    mode: 'login',
    intent: 'traveler',
  });
  const [checkoutState, setCheckoutState] = useState(initialCheckoutState);

  useEffect(() => {
    notificationService.init();
  }, []);

  useEffect(() => {
    if (isAdminRoute) return;
    const params = new URLSearchParams(location.search);
    const authIntent = params.get('auth');
    if (authIntent === 'guide-register') {
      navigate('/guide/register', { replace: true });
    } else if (authIntent === 'login') {
      setAuthDialogState({
        open: true,
        mode: 'login',
        intent: 'traveler',
      });
    }
  }, [isAdminRoute, location.search]);

  const handleSearch = async (formData) => {
    setSearchData(formData);
    setPaymentNotice(null);

    const { payload, meta } = buildGeneratePayload(formData);
    setIsLoading(true);
    setSearchError(null);

    try {
      const response = await fetch(`${apiBase}/itineraries/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const providerMessage = data && typeof data === 'object'
          ? (data.message || data.detail || data.error || data.reason)
          : null;
        const fallback = t('errors.generate_failed', 'No se pudo generar el itinerario con proveedores reales.');
        throw new Error(typeof providerMessage === 'string' && providerMessage.trim() ? providerMessage : fallback);
      }

      setCurrentItinerary({ itineraryId: data.itinerary_id, id: data.itinerary_id, scenarios: data.scenarios, meta });
    } catch (err) {
      setSearchError(err?.message || 'Error generando el itinerario');
      setCurrentItinerary(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartNewSearch = () => {
    setSearchData(null);
    setCurrentItinerary(null);
    setSearchError(null);
    setPaymentNotice(null);
  };

  const createPaymentIntent = async (itineraryId, scenario, amountCents, currency) => {
    try {
      const response = await fetch(`${apiBase}/payments/create-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          amount: amountCents,
          currency,
          description: `Itinerario ${itineraryId} - ${scenario.type}`,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const message = data && typeof data === 'object'
          ? (data.message || data.error || data.detail)
          : null;
        throw new Error(message && message.trim() ? message : 'No se pudo crear el intent de pago');
      }

      if (!data?.clientSecret) {
        throw new Error('Stripe no devolvi un clientSecret vlido');
      }

      setCheckoutState(prev => ({
        ...prev,
        clientSecret: data.clientSecret,
        mock: Boolean(data.mock),
        mockReason: data.mockReason ? String(data.mockReason) : null,
        error: null,
        loading: false,
      }));
    } catch (err) {
      setCheckoutState(prev => ({
        ...prev,
        loading: false,
        clientSecret: null,
        error: err?.message || 'Error al inicializar el pago',
        mock: false,
        mockReason: null,
      }));
    }
  };

  const handleSelectScenario = ({ scenario, itineraryId, itineraryMeta }) => {
    if (!token) {
      setAuthDialogOpen(true);
      return;
    }

    const currency = scenario.items?.find((item) => item.currency)?.currency || 'USD';
    const amountCents = Math.max(50, Math.round(Number(scenario.total_price || 0) * 100));

    setPaymentNotice(null);

    setCheckoutState({
      open: true,
      scenario,
      itineraryId,
      itineraryMeta,
      clientSecret: null,
      loading: true,
      error: null,
      amountCents,
      currency,
      mock: false,
      mockReason: null,
    });

    createPaymentIntent(itineraryId, scenario, amountCents, currency);
  };

  const handlePaymentClose = () => {
    setCheckoutState(() => ({ ...initialCheckoutState }));
  };

  const handlePaymentSuccess = () => {
    setPaymentNotice('Pago confirmado. El itinerario qued reservado en tu cuenta.');
    setCheckoutState(() => ({ ...initialCheckoutState }));
  };

  const handleRetryPayment = () => {
    if (!checkoutState.scenario || !checkoutState.itineraryId) return;
    setCheckoutState(prev => ({ ...prev, loading: true, error: null, clientSecret: null, mock: false, mockReason: null }));
    createPaymentIntent(
      checkoutState.itineraryId,
      checkoutState.scenario,
      checkoutState.amountCents,
      checkoutState.currency,
    );
  };

  const handleOpenWadaAgent = () => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new Event('wadagent:open'));
  };

  const openTravelerAuth = (mode = 'login') => {
    setAuthDialogState({
      open: true,
      mode,
      intent: 'traveler',
    });
  };

  const openGuideAuth = (mode = 'register') => {
    navigate('/guide/register');
  };

  const closeAuthDialog = () => {
    setAuthDialogState((prev) => ({ ...prev, open: false }));
    const params = new URLSearchParams(location.search);
    if (params.has('auth')) {
      params.delete('auth');
      const nextSearch = params.toString();
      navigate({
        pathname: location.pathname,
        search: nextSearch ? `?${nextSearch}` : '',
      }, { replace: true });
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {!isAdminRoute && (
        <Header
          user={user}
          onLoginClick={() => openTravelerAuth('login')}
          onGuideClick={() => {
            if (user) {
              window.location.assign('/operator/tours/new');
              return;
            }
            openGuideAuth('register');
          }}
          onLogout={logout}
        />
      )}

      <Routes>
        <Route path="/admin/*" element={<AdminApp />} />
        <Route path="/" element={<Home />} />
        <Route
          path="/plan"
          element={
            <>
              <Hero onSubmit={handleSearch} />
              <ResultsSection
                searchData={searchData}
                itinerary={currentItinerary}
                isLoading={isLoading}
                error={searchError}
                notice={paymentNotice}
                onStartNewSearch={handleStartNewSearch}
                onSelectScenario={handleSelectScenario}
              />
              <section className="page-shell min-h-0 py-10 md:py-12">
                <div className="page-container py-8 md:py-10">
                  <div className="page-card grid gap-6 md:grid-cols-[1.2fr_0.8fr] md:items-center">
                    <div className="space-y-3">
                      <p className="page-kicker text-[#00D9FF]">WadaAgent</p>
                      <h2 className="text-2xl md:text-3xl font-semibold neon-title">
                        Your AI travel assistant
                      </h2>
                      <p className="text-sm md:text-base text-[#e0e0e0] leading-relaxed">
                        Ask WadaAgent to check operators, tours, and prices so you can book with confidence.
                      </p>
                    </div>
                    <div className="flex md:justify-end">
                      <button
                        type="button"
                        onClick={handleOpenWadaAgent}
                        className="neon-cta w-full md:w-auto"
                      >
                        Open WadaAgent
                      </button>
                    </div>
                  </div>
                </div>
              </section>
              <FlightPricePredictor />
              <AboutSection />
            </>
          }
        />
        <Route path="/products" element={<Products />} />
        <Route path="/solutions" element={<Solutions />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/about-us" element={<AboutUs />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/request-demo" element={<RequestDemo />} />
        <Route path="/price-alerts" element={<FlightAlerts />} />
        <Route path="/enhanced-search" element={<TourAlerts />} />
        <Route path="/flight-notifications" element={<FlightPriceNotifications />} />
        <Route path="/account" element={<Account />} />
        <Route path="/tours" element={<Tours />} />
        <Route path="/tours/:id" element={<TourDetail />} />
        <Route path="/guides/:id" element={<GuideProfile />} />
        <Route path="/guide/register" element={<GuideSignupPage />} />
        <Route path="/operator/tours/new" element={<OperatorToursNew />} />
        <Route path="/checkout/success" element={<CheckoutSuccess />} />
        <Route path="/checkout/cancel" element={<CheckoutCancel />} />
      </Routes>

      {!isAdminRoute && (
        <>
          <Footer />
          <WhatsAppButton />

          {location.pathname.startsWith('/plan') && (
            <div className="fixed bottom-4 right-4 z-50">
              <WadaAgent />
            </div>
          )}

          <AuthDialog
            open={authDialogState.open}
            onClose={closeAuthDialog}
            initialMode={authDialogState.mode}
            initialIntent={authDialogState.intent}
          />

          <CheckoutDialog
            open={checkoutState.open}
            onClose={handlePaymentClose}
            scenario={checkoutState.scenario}
            itineraryMeta={checkoutState.itineraryMeta}
            loading={checkoutState.loading}
            error={checkoutState.error}
            clientSecret={checkoutState.clientSecret}
            amountCents={checkoutState.amountCents}
            currency={checkoutState.currency}
            mock={checkoutState.mock}
            mockReason={checkoutState.mockReason}
            onPaymentSuccess={handlePaymentSuccess}
            onRetry={handleRetryPayment}
          />
        </>
      )}
    </div>
  );
}

export default App;

