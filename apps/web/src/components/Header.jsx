import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, X, Search, UserCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import LanguageSwitcher from './LanguageSwitcher';
import BrandLogo from './BrandLogo';

const Header = ({ user, onLoginClick, onGuideClick, onLogout }) => {
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

  const handleGuideClick = () => {
    setIsMenuOpen(false);
    onGuideClick?.();
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
    <header className="sticky top-0 z-50 border-b border-[#243048] bg-[#0a0e27]/82 backdrop-blur-md">
      <div className="w-full px-4">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4">
          <div className="flex-shrink-0">
            <Link to="/" className="flex items-center">
              <BrandLogo size="sm" />
            </Link>
          </div>

          <div className="hidden flex-1 justify-center lg:flex">
            <nav className="flex items-center gap-3 text-sm">
              {navItems.map((item) => {
                const IconComponent = item.icon;
                return (
                  <Link
                    key={item.key}
                    to={item.href}
                    className="flex items-center gap-1 whitespace-nowrap px-2 py-1 text-[#e0e0e0] transition-colors hover:text-[#16d7d0]"
                  >
                    {IconComponent && <IconComponent size={16} />}
                    {t(`nav.${item.key}`)}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex flex-1 justify-end lg:hidden">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-white hover:bg-white/10"
            >
              {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </Button>
          </div>

          <div className="flex flex-shrink-0 items-center gap-2">
            <LanguageSwitcher />
            <Button
              variant="secondary"
              size="sm"
              className="hidden bg-gradient-to-r from-[#ff3f97] via-[#ffb347] to-[#16d7d0] font-black text-white transition-all hover:scale-105 md:flex"
              onClick={handleGuideClick}
            >
              {t('nav.list_tour') ?? 'Become a guide'}
            </Button>
            {user ? (
              <div className="hidden items-center gap-2 md:flex">
                <Button variant="ghost" size="sm" className="text-white" onClick={goToAccount}>
                  <UserCircle className="mr-1 h-4 w-4" />
                  {user.name || user.email}
                </Button>
                <Button variant="outline" size="sm" className="border-[#16d7d0]/30 bg-transparent text-[#16d7d0] hover:bg-white/5" onClick={handleLogout}>
                  {t('nav.logout') ?? 'Logout'}
                </Button>
              </div>
            ) : (
              <Button
                variant="default"
                size="sm"
                className="hidden bg-gradient-to-r from-[#ff3f97] via-[#ffb347] to-[#16d7d0] font-black text-white transition-all hover:scale-105 md:flex"
                onClick={handleLoginClick}
              >
                {t('nav.login') ?? 'Login'}
              </Button>
            )}
          </div>
        </div>

        {isMenuOpen && (
          <div className="border-t border-[#2d3548] py-4 lg:hidden">
            <nav className="flex flex-col space-y-4">
              {navItems.map((item) => {
                const IconComponent = item.icon;
                return (
                  <Link
                    key={item.key}
                    to={item.href}
                    className="flex items-center gap-2 font-medium text-[#e0e0e0] transition-colors duration-200 hover:text-[#16d7d0]"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {IconComponent && <IconComponent size={16} />}
                    {t(`nav.${item.key}`)}
                  </Link>
                );
              })}
              <div className="flex flex-col space-y-2 border-t border-[#2d3548] pt-4">
                <Button
                  size="sm"
                  className="bg-gradient-to-r from-[#ff3f97] via-[#ffb347] to-[#16d7d0] font-black text-white transition-all hover:scale-105"
                  onClick={handleGuideClick}
                >
                  {t('nav.list_tour') ?? 'Become a guide'}
                </Button>
                {user ? (
                  <>
                    <Button size="sm" className="bg-gradient-to-r from-[#ff3f97] via-[#ffb347] to-[#16d7d0] font-black text-white transition-all hover:scale-105" onClick={goToAccount}>
                      {t('nav.my_trips') ?? 'My trips'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-[#16d7d0]/30 bg-transparent text-[#16d7d0] hover:bg-white/5"
                      onClick={handleLogout}
                    >
                      {t('nav.logout') ?? 'Logout'}
                    </Button>
                  </>
                ) : (
                  <Button size="sm" className="bg-gradient-to-r from-[#ff3f97] via-[#ffb347] to-[#16d7d0] font-black text-white transition-all hover:scale-105" onClick={handleLoginClick}>
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
