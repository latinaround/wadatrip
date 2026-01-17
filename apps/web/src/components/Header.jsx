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
    { key: 'tours', href: '/tours' },
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
    <header className="border-b border-[#2d3548] bg-[#0a0e27]/80 backdrop-blur-md sticky top-0 z-50">
      <div className="w-full px-4">
        <div className="flex items-center h-16 gap-4 max-w-7xl mx-auto">
          <div className="flex-shrink-0">
            <Link to="/" className="flex items-center gap-3 text-lg font-black">
              <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00D9FF] to-[#FF006E] flex items-center justify-center shadow-lg shadow-[#00D9FF]/50">
                <span className="text-white text-lg font-black">W</span>
              </span>
              <span className="bg-gradient-to-r from-[#00D9FF] to-[#FF006E] bg-clip-text text-transparent">Wadatrip</span>
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
                    className="text-[#e0e0e0] hover:text-[#00D9FF] transition-colors px-2 py-1 whitespace-nowrap flex items-center gap-1"
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
              className="text-white hover:bg-white/10"
            >
              {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </Button>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <LanguageSwitcher />
            <Button
              variant="outline"
              size="sm"
              className="bg-transparent border-[#00D9FF]/30 text-[#00D9FF] hover:bg-white/5 text-xs hidden md:flex"
              asChild
            >
              <Link to="/request-demo">{t('nav.request_demo')}</Link>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="hidden md:flex bg-gradient-to-r from-[#FF006E] via-[#FFB703] to-[#00D9FF] text-white font-black hover:scale-105 transition-all"
              asChild
            >
              <Link to="/operator/tours/new">List your tour</Link>
            </Button>
            {user ? (
              <div className="hidden md:flex items-center gap-2">
                <Button variant="ghost" size="sm" className="text-white" onClick={goToAccount}>
                  <UserCircle className="w-4 h-4 mr-1" />
                  {user.name || user.email}
                </Button>
                <Button variant="outline" size="sm" className="bg-transparent border-[#00D9FF]/30 text-[#00D9FF] hover:bg-white/5" onClick={handleLogout}>
                  {t('nav.logout') ?? 'Logout'}
                </Button>
              </div>
            ) : (
              <Button
                variant="default"
                size="sm"
                className="bg-gradient-to-r from-[#FF006E] via-[#FFB703] to-[#00D9FF] text-white font-black hidden md:flex hover:scale-105 transition-all"
                onClick={handleLoginClick}
              >
                {t('nav.login') ?? 'Login'}
              </Button>
            )}
          </div>
        </div>

        {isMenuOpen && (
          <div className="lg:hidden py-4 border-t border-[#2d3548]">
            <nav className="flex flex-col space-y-4">
              {navItems.map((item) => {
                const IconComponent = item.icon;
                return (
                  <Link
                    key={item.key}
                    to={item.href}
                    className="text-[#e0e0e0] hover:text-[#00D9FF] transition-colors duration-200 font-medium flex items-center gap-2"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {IconComponent && <IconComponent size={16} />}
                    {t(`nav.${item.key}`)}
                  </Link>
                );
              })}
              <div className="flex flex-col space-y-2 pt-4 border-t border-[#2d3548]">
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-transparent border-[#00D9FF]/30 text-[#00D9FF] hover:bg-white/5"
                  asChild
                >
                  <Link to="/request-demo" onClick={() => setIsMenuOpen(false)}>
                    {t('nav.request_demo')}
                  </Link>
                </Button>
                <Button
                  size="sm"
                  className="bg-gradient-to-r from-[#FF006E] via-[#FFB703] to-[#00D9FF] text-white font-black hover:scale-105 transition-all"
                  asChild
                >
                  <Link to="/operator/tours/new" onClick={() => setIsMenuOpen(false)}>
                    List your tour
                  </Link>
                </Button>
                {user ? (
                  <>
                    <Button size="sm" className="bg-gradient-to-r from-[#FF006E] via-[#FFB703] to-[#00D9FF] text-white font-black hover:scale-105 transition-all" onClick={goToAccount}>
                      {t('nav.my_trips') ?? 'My trips'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="bg-transparent border-[#00D9FF]/30 text-[#00D9FF] hover:bg-white/5"
                      onClick={handleLogout}
                    >
                      {t('nav.logout') ?? 'Logout'}
                    </Button>
                  </>
                ) : (
                  <Button size="sm" className="bg-gradient-to-r from-[#FF006E] via-[#FFB703] to-[#00D9FF] text-white font-black hover:scale-105 transition-all" onClick={handleLoginClick}>
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

