import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function CheckoutSuccess() {
  const { t } = useTranslation();

  return (
    <section className="page-shell min-h-0 py-10 md:py-12">
      <div className="page-container py-8 md:py-10">
        <div className="page-card space-y-4 text-center">
          <p className="page-kicker text-[#00D9FF]">
            {t('checkout.success.kicker', 'Payment confirmed')}
          </p>
          <h1 className="text-3xl md:text-4xl font-semibold neon-title">
            {t('checkout.success.title', 'Your booking is confirmed')}
          </h1>
          <p className="text-sm md:text-base text-[#e0e0e0] leading-relaxed">
            {t(
              'checkout.success.body',
              'You will receive a confirmation email with the tour details.',
            )}
          </p>
          <p className="text-xs md:text-sm text-[#c8d3f5] leading-relaxed">
            {t(
              'checkout.success.mobile_hint',
              'If you came from the mobile app, open WadaTrip again to keep browsing or review your traveler wallet.',
            )}
          </p>
          <div className="flex flex-col gap-3 md:flex-row md:justify-center">
            <a className="neon-cta" href="wadatrip://">
              {t('checkout.success.cta_open_app', 'Open WadaTrip app')}
            </a>
            <Link className="neon-outline" to="/tours">
              {t('checkout.success.cta_primary', 'Back to tours')}
            </Link>
            <Link className="neon-cta" to="/tours">
              {t('checkout.success.cta_secondary', 'View web bookings')}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
