import { useEffect, useMemo, useState } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
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
  const isAdminRoute = location.pathname.startsWith('/admin');

  const [searchData, setSearchData] = useState(null);
  const [currentItinerary, setCurrentItinerary] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [paymentNotice, setPaymentNotice] = useState(null);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [checkoutState, setCheckoutState] = useState(initialCheckoutState);

  useEffect(() => {
    notificationService.init();
  }, []);

  const handleSearch = async (formData) => {
    setSearchData(formData);
    setPaymentNotice(null);

    if (!token) {
      setAuthDialogOpen(true);
      setSearchError(t('auth.login_required', 'Inicia sesión para generar itinerarios con datos reales.'));
      return;
    }

    const { payload, meta } = buildGeneratePayload(formData);
    setIsLoading(true);
    setSearchError(null);

    try {
      const response = await fetch(`${apiBase}/itineraries/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
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
        throw new Error('Stripe no devolvió un clientSecret válido');
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
    setPaymentNotice('Pago confirmado. El itinerario quedó reservado en tu cuenta.');
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

  return (
    <div className="min-h-screen bg-white">
      {!isAdminRoute && (
        <Header
          user={user}
          onLoginClick={() => setAuthDialogOpen(true)}
          onLogout={logout}
        />
      )}

      <Routes>
        <Route path="/admin/*" element={<AdminApp />} />
        <Route
          path="/"
          element={
            <>
              <Hero onSearch={handleSearch} />
              <ResultsSection
                searchData={searchData}
                itinerary={currentItinerary}
                isLoading={isLoading}
                error={searchError}
                notice={paymentNotice}
                onStartNewSearch={handleStartNewSearch}
                onSelectScenario={handleSelectScenario}
              />
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
        <Route path="/operator/tours/new" element={<OperatorToursNew />} />
      </Routes>

      {!isAdminRoute && (
        <>
          <Footer />
          <WhatsAppButton />

          <div className="fixed bottom-4 right-4 z-50">
            <WadaAgent />
          </div>

          <AuthDialog open={authDialogOpen} onClose={() => setAuthDialogOpen(false)} />

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
