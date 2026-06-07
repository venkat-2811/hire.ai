import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import logoFull from '@/assets/LOGO_full.png';
import { useAuth } from '@/hooks/useAuth';

interface NavbarProps {
  activeSection?: string;
  onScrollTo?: (id: string) => void;
}

export default function Navbar({ activeSection, onScrollTo }: NavbarProps) {
  const { user, signOut } = useAuth();
  const { pathname } = useLocation();

  const handleScrollLink = (id: string) => (e: React.MouseEvent) => {
    if (pathname === '/') {
      e.preventDefault();
      onScrollTo?.(id);
    }
  };

  const handleLogoClick = (e: React.MouseEvent) => {
    if (pathname === '/') {
      e.preventDefault();
      onScrollTo?.('hero');
    }
  };

  return (
    <nav className="fixed top-4 left-1/2 -translate-x-1/2 w-[95%] md:w-[80%] lg:w-[60%] z-50 bg-background/80 backdrop-blur-xl border rounded-full shadow-lg transition-all duration-300">
      <div className="px-6 h-14 flex items-center justify-between">
        <Link to="/" onClick={handleLogoClick} className="flex items-center cursor-pointer">
          <img
            src={logoFull}
            alt="Rekshift"
            className="h-11 w-auto object-contain"
            draggable={false}
          />
        </Link>

        {/* Links */}
        <div className="flex flex-wrap items-center justify-center gap-4 text-sm font-medium">
          {[
            { id: 'hero', label: 'Home', path: '/' },
            { id: 'features', label: 'Features', path: '/#features' },
            { id: 'how-it-works', label: 'How it Works', path: '/#how-it-works' },
          ].map((link) => {
            const isActive = pathname === '/' && activeSection === link.id;
            return (
              <Link
                key={link.id}
                to={link.path}
                onClick={handleScrollLink(link.id)}
                className={`transition-colors relative py-1 ${
                  isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {link.label}
                {isActive && (
                  <motion.div
                    layoutId="nav-pill"
                    className="absolute -bottom-1 left-0 right-0 h-0.5 bg-primary rounded-full"
                  />
                )}
              </Link>
            );
          })}
          
          <Link
            to="/pricing"
            className={`transition-colors py-1 ${
              pathname === '/pricing' ? 'text-primary font-medium' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Pricing
          </Link>
          <Link
            to="/contact"
            className={`transition-colors py-1 ${
              pathname === '/contact' ? 'text-primary font-medium' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Contact
          </Link>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          {user ? (
            <>
              <Button variant="ghost" size="sm" className="rounded-full" asChild>
                <Link to="/dashboard">Dashboard</Link>
              </Button>
              <Button variant="outline" size="sm" className="rounded-full" onClick={() => void signOut()}>
                Sign Out
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" className="hidden sm:inline-flex rounded-full" asChild>
                <Link to="/sign-in">Sign In</Link>
              </Button>
              <Button size="sm" className="rounded-full" asChild>
                <Link to="/sign-up">Get Started</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
