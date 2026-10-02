import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function PausedFeature({ title }) {
  const { t } = useTranslation();
  return (
    <div className="page-shell"><main className="page-container">
      <div className="page-card space-y-6">
        <h1 className="text-3xl font-semibold neon-title">{title}</h1>
        <p role="status">{t('paused_feature.message')}</p>
        <Link to="/tours" className="neon-cta inline-flex">{t('nav.tours')}</Link>
      </div>
    </main></div>
  );
}
