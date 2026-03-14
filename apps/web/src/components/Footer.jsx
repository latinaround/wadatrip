import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import BrandLogo from './BrandLogo';

const Footer = () => {
  const { t } = useTranslation();

  return (
    <footer className="border-t border-[#2d3548] bg-[#0a0e27] text-white">
      <div className="container mx-auto px-4 py-12">
        <div className="grid gap-8 md:grid-cols-4">
          <div className="md:col-span-1">
            <div className="mb-4">
              <BrandLogo size="sm" showTagline light />
            </div>
            <p className="text-sm leading-relaxed text-[#a0a0a0]">
              {t('footer.description')}
            </p>
          </div>

          <div>
            <h4 className="mb-4 text-lg font-semibold">{t('footer.products')}</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/products" className="text-[#a0a0a0] transition-colors hover:text-[#16d7d0]">{t('footer.mobile_app')}</Link></li>
              <li><Link to="/products" className="text-[#a0a0a0] transition-colors hover:text-[#16d7d0]">{t('footer.api')}</Link></li>
              <li><Link to="/products" className="text-[#a0a0a0] transition-colors hover:text-[#16d7d0]">{t('footer.integrations')}</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="mb-4 text-lg font-semibold">{t('footer.solutions')}</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/solutions" className="text-[#a0a0a0] transition-colors hover:text-[#16d7d0]">{t('footer.business')}</Link></li>
              <li><Link to="/solutions" className="text-[#a0a0a0] transition-colors hover:text-[#16d7d0]">{t('footer.agencies')}</Link></li>
              <li><Link to="/solutions" className="text-[#a0a0a0] transition-colors hover:text-[#16d7d0]">{t('footer.enterprise')}</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="mb-4 text-lg font-semibold">{t('footer.company')}</h4>
            <ul className="mb-6 space-y-2 text-sm">
              <li><Link to="/about-us" className="text-[#a0a0a0] transition-colors hover:text-[#16d7d0]">{t('footer.about')}</Link></li>
              <li><Link to="/about-us" className="text-[#a0a0a0] transition-colors hover:text-[#16d7d0]">{t('footer.careers')}</Link></li>
              <li><Link to="/about-us" className="text-[#a0a0a0] transition-colors hover:text-[#16d7d0]">{t('footer.blog')}</Link></li>
            </ul>

            <h4 className="mb-4 text-lg font-semibold">{t('footer.support')}</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/contact" className="text-[#a0a0a0] transition-colors hover:text-[#16d7d0]">{t('footer.help')}</Link></li>
              <li><Link to="/contact" className="text-[#a0a0a0] transition-colors hover:text-[#16d7d0]">{t('footer.contact')}</Link></li>
              <li><Link to="/privacy-policy" className="text-[#a0a0a0] transition-colors hover:text-[#16d7d0]">{t('footer.documentation')}</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t border-[#2d3548] pt-8 text-center">
          <p className="text-sm text-[#a0a0a0]">
            © 2025 WadaTrip. {t('footer.rights')} <Link to="/privacy-policy" className="text-[#a0a0a0] transition-colors hover:text-[#16d7d0]">{t('nav.privacy_policy')}</Link>
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
