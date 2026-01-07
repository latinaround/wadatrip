import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

const Footer = () => {
  const { t } = useTranslation()

  return (
    <footer className="bg-slate-900 text-white">
      <div className="container mx-auto px-4 py-12">
        <div className="grid md:grid-cols-4 gap-8">
          {/* Company Info */}
          <div className="md:col-span-1">
            <div className="flex items-center space-x-3 mb-4">
              <img 
                src="/logo.png" 
                alt="WadaTrip Logo" 
                className="h-10 w-auto"
              />
            </div>
            <p className="text-gray-300 text-sm leading-relaxed">
              {t('footer.description')}
            </p>
          </div>

          {/* Products */}
          <div>
            <h4 className="text-lg font-semibold mb-4">{t('footer.products')}</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/products" className="text-gray-300 hover:text-white transition-colors">{t('footer.mobile_app')}</Link></li>
              <li><Link to="/products" className="text-gray-300 hover:text-white transition-colors">{t('footer.api')}</Link></li>
              <li><Link to="/products" className="text-gray-300 hover:text-white transition-colors">{t('footer.integrations')}</Link></li>
            </ul>
          </div>

          {/* Solutions */}
          <div>
            <h4 className="text-lg font-semibold mb-4">{t('footer.solutions')}</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/solutions" className="text-gray-300 hover:text-white transition-colors">{t('footer.business')}</Link></li>
              <li><Link to="/solutions" className="text-gray-300 hover:text-white transition-colors">{t('footer.agencies')}</Link></li>
              <li><Link to="/solutions" className="text-gray-300 hover:text-white transition-colors">{t('footer.enterprise')}</Link></li>
            </ul>
          </div>

          {/* Company & Support */}
          <div>
            <h4 className="text-lg font-semibold mb-4">{t('footer.company')}</h4>
            <ul className="space-y-2 text-sm mb-6">
              <li><Link to="/about-us" className="text-gray-300 hover:text-white transition-colors">{t('footer.about')}</Link></li>
              <li><Link to="/about-us" className="text-gray-300 hover:text-white transition-colors">{t('footer.careers')}</Link></li>
              <li><Link to="/about-us" className="text-gray-300 hover:text-white transition-colors">{t('footer.blog')}</Link></li>
            </ul>
            
            <h4 className="text-lg font-semibold mb-4">{t('footer.support')}</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/contact" className="text-gray-300 hover:text-white transition-colors">{t('footer.help')}</Link></li>
              <li><Link to="/contact" className="text-gray-300 hover:text-white transition-colors">{t('footer.contact')}</Link></li>
              <li><Link to="/privacy-policy" className="text-gray-300 hover:text-white transition-colors">{t('footer.documentation')}</Link></li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-gray-700 mt-8 pt-8 text-center">
          <p className="text-gray-400 text-sm">
            © 2025 WadaTrip. {t('footer.rights')} <Link to="/privacy-policy" className="text-gray-400 hover:text-white transition-colors">{t('nav.privacy_policy')}</Link>
          </p>
        </div>
      </div>
    </footer>
  )
}

export default Footer

