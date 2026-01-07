import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, X, Search, UserCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import LanguageSwitcher from './LanguageSwitcher';

const Header = ({ user, onLoginClick, onLogout }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const navItems = [
    { key: 'products', href: '/products' },
    { key: 'solutions', href: '/solutions' },
    { key: 'price_alerts', href: '/price-alerts' },
    { key: 'tour_alerts', href: '/enhanced-search', icon: Search },
    { key: 'about_us', href: '/about-us' },
    { key: 'contact', href: '/contact' },
    { key: 'privacy_policy', href: '/privacy-policy' },
  ];

  const handleLoginClick = () => {
    setIsMenuOpen(false);
    onLoginClick?.();
  };

  const handleLogout = () => {
    setIsMenuOpen(false);
    onLogout?.();
  };

  const goToAccount = () => {
    setIsMenuOpen(false);
    navigate('/account');
  };

  return (
    <header className="bg-gradient-to-r from-teal-600 to-teal-700 shadow-lg sticky top-0 z-50">
      <div className="w-full px-4">
        <div className="flex items-center h-16 gap-4 max-w-7xl mx-auto">
          <div className="flex-shrink-0">
            <Link to="/" className="text-white text-lg font-bold">
              WADATRIP
            </Link>
          </div>

          <div className="hidden lg:flex flex-1 justify-center">
            <nav className="flex items-center gap-3 text-sm">
              {navItems.map((item) => {
                const IconComponent = item.icon;
                return (
                  <Link
                    key={item.key}
                    to={item.href}
                    className="text-white hover:text-teal-200 transition-colors px-2 py-1 whitespace-nowrap flex items-center gap-1"
                  >
                    {IconComponent && <IconComponent size={16} />}
                    {t(`nav.${item.key}`)}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="lg:hidden flex-1 flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-white hover:bg-teal-500"
            >
              {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </Button>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <LanguageSwitcher />
            <Button
              variant="outline"
              size="sm"
              className="bg-transparent border-white text-white hover:bg-white hover:text-teal-600 text-xs hidden md:flex"
              asChild
            >
              <Link to="/request-demo">{t('nav.request_demo')}</Link>
            </Button>
            {user ? (
              <div className="hidden md:flex items-center gap-2">
                <Button variant="ghost" size="sm" className="text-white" onClick={goToAccount}>
                  <UserCircle className="w-4 h-4 mr-1" />
                  {user.name || user.email}
                </Button>
                <Button variant="outline" size="sm" className="bg-transparent border-white text-white hover:bg-white hover:text-teal-600" onClick={handleLogout}>
                  {t('nav.logout') ?? 'Logout'}
                </Button>
              </div>
            ) : (
              <Button
                variant="default"
                size="sm"
                className="bg-white text-teal-600 hover:bg-teal-50 hidden md:flex"
                onClick={handleLoginClick}
              >
                {t('nav.login') ?? 'Login'}
              </Button>
            )}
          </div>
        </div>

        {isMenuOpen && (
          <div className="lg:hidden py-4 border-t border-teal-500">
            <nav className="flex flex-col space-y-4">
              {navItems.map((item) => {
                const IconComponent = item.icon;
                return (
                  <Link
                    key={item.key}
                    to={item.href}
                    className="text-white hover:text-teal-200 transition-colors duration-200 font-medium flex items-center gap-2"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {IconComponent && <IconComponent size={16} />}
                    {t(`nav.${item.key}`)}
                  </Link>
                );
              })}
              <div className="flex flex-col space-y-2 pt-4 border-t border-teal-500">
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-transparent border-white text-white hover:bg-white hover:text-teal-600"
                  asChild
                >
                  <Link to="/request-demo" onClick={() => setIsMenuOpen(false)}>
                    {t('nav.request_demo')}
                  </Link>
                </Button>
                {user ? (
                  <>
                    <Button size="sm" className="bg-white text-teal-600 hover:bg-teal-50" onClick={goToAccount}>
                      {t('nav.my_trips') ?? 'My trips'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="bg-transparent border-white text-white hover:bg-white hover:text-teal-600"
                      onClick={handleLogout}
                    >
                      {t('nav.logout') ?? 'Logout'}
                    </Button>
                  </>
                ) : (
                  <Button size="sm" className="bg-white text-teal-600 hover:bg-teal-50" onClick={handleLoginClick}>
                    {t('nav.login') ?? 'Login'}
                  </Button>
                )}
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;

