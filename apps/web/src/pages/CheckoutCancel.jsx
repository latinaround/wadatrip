import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function CheckoutCancel() {
  const { t } = useTranslation();

  return (
    <section className="page-shell min-h-0 py-10 md:py-12">
      <div className="page-container py-8 md:py-10">
        <div className="page-card space-y-4 text-center">
          <p className="page-kicker text-[#FFB703]">
            {t('checkout.cancel.kicker', 'Payment canceled')}
          </p>
          <h1 className="text-3xl md:text-4xl font-semibold neon-title">
            {t('checkout.cancel.title', 'Your payment was canceled')}
          </h1>
          <p className="text-sm md:text-base text-[#e0e0e0] leading-relaxed">
            {t(
              'checkout.cancel.body',
              'No charge was made. You can return to the tour and try again anytime.',
            )}
          </p>
          <div className="flex flex-col gap-3 md:flex-row md:justify-center">
            <Link className="neon-cta" to="/tours">
              {t('checkout.cancel.cta_primary', 'Back to tours')}
            </Link>
            <Link className="neon-outline" to="/operator/tours/new">
              {t('checkout.cancel.cta_secondary', 'List your tour')}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
