import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import logoFull from '@/assets/LOGO_full.png';
import { useAuth } from '@/hooks/useAuth';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';

interface NavbarProps {
  activeSection?: string;
  onScrollTo?: (id: string) => void;
}

export default function Navbar({ activeSection, onScrollTo }: NavbarProps) {
  const { user, signOut } = useAuth();
  const { pathname } = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  const handleScrollLink = (id: string) => (e: React.MouseEvent) => {
    setIsOpen(false);
    if (pathname === '/') {
      e.preventDefault();
      onScrollTo?.(id);
    }
  };

  const handleLogoClick = (e: React.MouseEvent) => {
    setIsOpen(false);
    if (pathname === '/') {
      e.preventDefault();
      onScrollTo?.('hero');
    }
  };

  return (
    <nav className={`fixed top-4 left-1/2 -translate-x-1/2 w-[95%] md:w-[80%] lg:w-[60%] z-50 bg-background/80 backdrop-blur-xl border transition-all duration-300 shadow-lg ${isOpen ? 'rounded-[2rem] py-4' : 'rounded-full'}`}>
      <div className="px-6 h-14 flex items-center justify-between">
        <Link to="/" onClick={handleLogoClick} className="flex items-center cursor-pointer">
          <img
            src={logoFull}
            alt="Rekshift"
            className="h-11 w-auto object-contain"
            draggable={false}
          />
        </Link>

        {/* Desktop Links */}
        <div className="hidden md:flex flex-wrap items-center justify-center gap-4 text-sm font-medium">
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

        {/* Desktop Action Buttons & Hamburger trigger */}
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <>
                <Button size="sm" className="rounded-full bg-accent text-accent-foreground hover:bg-accent/90" asChild>
                  <Link to="/dashboard">Dashboard</Link>
                </Button>
                <Button variant="outline" size="sm" className="rounded-full" onClick={() => void signOut()}>
                  Sign Out
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" className="rounded-full" asChild>
                  <Link to="/sign-in">Sign In</Link>
                </Button>
                <Button size="sm" className="rounded-full" asChild>
                  <Link to="/sign-up">Get Started</Link>
                </Button>
              </>
            )}
          </div>

          {/* Hamburger toggle button for Mobile */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden p-2 text-muted-foreground hover:text-foreground transition-colors focus:outline-none"
            aria-label="Toggle Menu"
          >
            {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Content */}
      {isOpen && (
        <div className="md:hidden px-6 pt-4 pb-2 flex flex-col gap-4 border-t border-border/40 mt-3 animate-in fade-in slide-in-from-top-2 duration-200">
          {[
            { id: 'hero', label: 'Home', path: '/' },
            { id: 'features', label: 'Features', path: '/#features' },
            { id: 'how-it-works', label: 'How it Works', path: '/#how-it-works' },
          ].map((link) => (
            <Link
              key={link.id}
              to={link.path}
              onClick={handleScrollLink(link.id)}
              className="text-muted-foreground hover:text-foreground py-1.5 text-sm font-medium border-b border-border/20"
            >
              {link.label}
            </Link>
          ))}
          <Link
            to="/pricing"
            onClick={() => setIsOpen(false)}
            className="text-muted-foreground hover:text-foreground py-1.5 text-sm font-medium border-b border-border/20"
          >
            Pricing
          </Link>
          <Link
            to="/contact"
            onClick={() => setIsOpen(false)}
            className="text-muted-foreground hover:text-foreground py-1.5 text-sm font-medium border-b border-border/20"
          >
            Contact
          </Link>

          <div className="flex flex-col gap-2 pt-2">
            {user ? (
              <>
                <Button size="sm" className="w-full rounded-full bg-accent text-accent-foreground hover:bg-accent/90" asChild onClick={() => setIsOpen(false)}>
                  <Link to="/dashboard">Dashboard</Link>
                </Button>
                <Button variant="outline" size="sm" className="w-full rounded-full" onClick={() => { setIsOpen(false); void signOut(); }}>
                  Sign Out
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" className="w-full rounded-full" asChild onClick={() => setIsOpen(false)}>
                  <Link to="/sign-in">Sign In</Link>
                </Button>
                <Button size="sm" className="w-full rounded-full" asChild onClick={() => setIsOpen(false)}>
                  <Link to="/sign-up">Get Started</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
