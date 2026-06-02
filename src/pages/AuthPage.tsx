import { useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { SignIn, SignUp } from '@clerk/clerk-react';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import logoFull from '@/assets/LOGO_full.png';
import logoIcon from '@/assets/logo.png';
import { ArrowLeft } from 'lucide-react';

export default function AuthPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isSignedIn, loading } = useAuth();

  const isSignUp = location.pathname.startsWith('/sign-up');

  useEffect(() => {
    if (!loading && isSignedIn) {
      navigate('/dashboard');
    }
  }, [isSignedIn, loading, navigate]);

  useEffect(() => {
    if (location.pathname === '/auth') {
      navigate('/sign-in', { replace: true });
    }
  }, [location.pathname, navigate]);

  return (
    <div className="min-h-screen flex relative">
      {/* Mobile Top-Left Back Button */}
      <Link
        to="/"
        className="group absolute top-6 left-6 z-50 lg:hidden inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-background/80 text-foreground hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground transition-all shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 backdrop-blur-sm text-sm font-semibold"
        aria-label="Back to landing page"
      >
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
        <span>Back to Home</span>
      </Link>

      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary via-primary/90 to-info/80 p-12 flex-col justify-between">
        <div className="space-y-8">
          {/* Desktop Back Button */}
          <Link
            to="/"
            className="group inline-flex items-center gap-2.5 px-4 py-2 rounded-full border border-white/20 bg-white/10 text-white hover:bg-white/20 focus:bg-white/20 transition-all shadow-sm hover:shadow focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-primary backdrop-blur-sm text-sm font-semibold w-fit"
            aria-label="Back to landing page"
          >
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
            <span>Back to Home</span>
          </Link>

          <Link
            to="/"
            className="flex items-center gap-3.5 group cursor-pointer focus:outline-none w-fit rounded-xl focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
            aria-label="Rekshift Home"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/95 backdrop-blur p-2.5 shadow-md transition-all duration-300 group-hover:bg-white group-hover:scale-105 group-hover:shadow-[0_4px_20px_rgba(255,255,255,0.25)]">
              <img
                src={logoIcon}
                alt="Rekshift"
                className="h-full w-full object-contain"
                draggable={false}
              />
            </div>
            <span className="text-2xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-white/90 transition-all duration-300 group-hover:from-white group-hover:to-white group-hover:translate-x-0.5">
              Rekshift
            </span>
          </Link>
        </div>

        <div className="space-y-6">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-4xl lg:text-5xl font-bold text-white leading-tight"
          >
            AI-Powered Hiring
            <br />
            <span className="text-white/80">Made Simple</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-lg text-white/70 max-w-md"
          >
            Screen resume,generate adaptive questions, and evaluate candidates
            with explainable AI — all in the one platform.
          </motion.p>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Roles Supported', value: '3+' },
            { label: 'AI Accuracy', value: '95%' },
            { label: 'Time Saved', value: '70%' },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + i * 0.1 }}
              className="bg-white/10 backdrop-blur rounded-xl p-4"
            >
              <div className="text-2xl font-bold text-white">{stat.value}</div>
              <div className="text-sm text-white/60">{stat.label}</div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Right Panel - Clerk Auth */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-md"
        >
          <div className="flex flex-col items-center mb-6">
            <Link to="/" className="flex items-center justify-center transition-transform hover:scale-105" aria-label="Rekshift Home">
              <img
                src={logoFull}
                alt="Rekshift"
                className="h-24 w-auto object-contain filter drop-shadow-md"
                draggable={false}
              />
            </Link>
          </div>

          <div className="flex justify-center w-full">
            {isSignUp ? (
              <SignUp
                routing="path"
                path="/sign-up"
                signInUrl="/sign-in"
                fallbackRedirectUrl="/dashboard"
              />
            ) : (
              <SignIn
                routing="path"
                path="/sign-in"
                signUpUrl="/sign-up"
                fallbackRedirectUrl="/dashboard"
              />
            )}
          </div>

          <p className="text-center text-sm text-muted-foreground mt-8">
            By continuing, you agree to our Terms of Service and Privacy Policy
          </p>
        </motion.div>
      </div>
    </div>
  );
}
