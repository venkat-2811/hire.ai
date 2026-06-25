import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import logoFull from '@/assets/LOGO_full.png';
import logoIcon from '@/assets/logo.png';
import {
  Sparkles,
  ArrowRight,
  Users,
  FileText,
  Brain,
  Shield,
  BarChart3,
  CheckCircle,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';
import Footer from '@/components/layout/Footer';
import Navbar from '@/components/layout/Navbar';
import { useScroll, useMotionValueEvent, useTransform } from 'framer-motion';

const features = [
  {
    icon: FileText,
    title: 'Semantic Resume Parsing',
    description: 'AI-powered analysis that understands context, not just keywords.',
    image: '/3d-resume-parsing.png',
  },
  {
    icon: Brain,
    title: 'Adaptive Questions',
    description: 'Unique, role-specific questions tailored to each candidate.',
    image: '/3d-adaptive-questions.png',
  },
  {
    icon: Shield,
    title: 'Proctoring & Integrity',
    description: 'Tab switching, copy-paste detection, and session monitoring.',
    image: '/3d-proctoring.png',
  },
  {
    icon: BarChart3,
    title: 'Explainable AI Scoring',
    description: 'Transparent reason codes for every hiring decision.',
    image: '/3d-ai-scoring.png',
  },
];

const clientLogos = [
  {
    name: 'Mudra Systems',
    url: 'https://www.mudrasys.com',
    initials: 'MS',
    caption: 'Enterprise IT services',
  },
  {
    name: 'Compile Infy',
    url: 'https://www.compileinfy.com',
    initials: 'CI',
    caption: 'Digital engineering partners',
    logo: '/Compileinfy Logo.png',
  },
  {
    name: 'DBAce Technologies',
    url: 'https://www.dbacetech.com',
    initials: 'DB',
    caption: 'Business automation experts',
    logo: '/DBAce.png',
  },
  {
    name: 'Mellowsoft',
    url: 'https://mellowsoftinc.com',
    initials: 'MS',
    caption: 'Software consultancy',
    logo: '/Mellowsoft Logo.png',
  },
  {
    name: 'BVIT Solutions',
    url: 'https://bvitsolutions.com',
    initials: 'BV',
    caption: 'IT Implementation',
    logo: '/BVIT Logo.png',
  },
];

export default function LandingPage() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [activeFeature, setActiveFeature] = useState(0);
  const [activeSection, setActiveSection] = useState('hero');
  const [isFirstVisit, setIsFirstVisit] = useState(true);

  useEffect(() => {
    const visited = sessionStorage.getItem('rekshift_visited_home');
    if (visited) {
      setIsFirstVisit(false);
    } else {
      sessionStorage.setItem('rekshift_visited_home', 'true');
    }
  }, []);

  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start center", "end center"]
  });

  // Transform scroll progress to line height
  const lineHeight = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (latest) => {
    const sections = ['hero', 'features', 'how-it-works'];
    for (const section of [...sections].reverse()) {
      const element = document.getElementById(section);
      if (element) {
        const rect = element.getBoundingClientRect();
        // If the top of the section is anywhere above the middle of the screen
        if (rect.top <= window.innerHeight / 2) {
          setActiveSection(section);
          break;
        }
      }
    }
  });

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveFeature((prev) => (prev + 1) % features.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Removed auto-redirect to dashboard for authenticated users to allow landing page navigation

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation (Detached NavSpy) */}
      <Navbar activeSection={activeSection} onScrollTo={scrollTo} />

      {/* Hero Section */}
      <section id="hero" className="pt-32 pb-20 px-4 min-h-[90vh] flex items-center">
        <div className="container mx-auto grid md:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={isFirstVisit ? { opacity: 0, x: -20 } : false}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-sm font-semibold border border-emerald-500/20 mb-6 shadow-sm shadow-emerald-500/5">
              <Sparkles className="h-4 w-4 text-emerald-500 animate-pulse" />
              AI-Powered Interview Platform
            </div>

            <h1 className="text-4xl md:text-6xl font-bold text-foreground leading-tight mb-6">
              Hire the Right Talent with
              <span className="block text-gradient">Explainable AI</span>
            </h1>

            <p className="text-lg text-muted-foreground mx-auto mb-8">
              Semantic resume screening, adaptive interviews, and transparent hiring decisions.
              Built for international hiring committee standards.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              {user ? (
                <Button size="lg" asChild>
                  <Link to="/dashboard">
                    Go to Dashboard
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
              ) : (
                <div className="relative group">
                  <Link
                    to="/sign-up"
                    className="relative inline-block p-px font-semibold leading-6 text-white bg-gray-800 shadow-2xl cursor-pointer rounded-xl shadow-zinc-900 transition-transform duration-300 ease-in-out hover:scale-105 active:scale-95"
                  >
                    <span
                      className="absolute inset-0 rounded-xl bg-gradient-to-r from-teal-400 via-blue-500 to-purple-500 p-[2px] opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                    ></span>

                    <span className="relative z-10 block px-6 py-3 rounded-xl bg-gray-950">
                      <div className="relative z-10 flex items-center space-x-2">
                        <span className="transition-all duration-500 group-hover:translate-x-1">
                          Start Hiring
                        </span>
                        <svg
                          className="w-6 h-6 transition-transform duration-500 group-hover:translate-x-1"
                          data-slot="icon"
                          aria-hidden="true"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            clipRule="evenodd"
                            d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z"
                            fillRule="evenodd"
                          ></path>
                        </svg>
                      </div>
                    </span>
                  </Link>
                </div>
              )}
            </div>

            {/* Stats */}
            <motion.div
              initial={isFirstVisit ? { opacity: 0, y: 20 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: isFirstVisit ? 0.3 : 0 }}
              className="mt-12 grid grid-cols-3 gap-6"
            >
              {[
                { value: '3+', label: 'Roles Supported' },
                { value: '95%', label: 'AI Accuracy' },
                { value: '70%', label: 'Time Saved' },
              ].map((stat) => (
                <div key={stat.label}>
                  <div className="text-2xl md:text-3xl font-bold text-foreground">{stat.value}</div>
                  <div className="text-xs text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </motion.div>
          </motion.div>

          <motion.div
            initial={isFirstVisit ? { opacity: 0, scale: 0.9 } : false}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: isFirstVisit ? 0.2 : 0 }}
            className="relative"
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 rounded-[3rem] to-transparent blur-3xl -z-10" />
            <img
              src="/hero-students.png"
              alt="Diverse students and young professionals"
              className="w-full max-w-lg mx-auto relative z-10 drop-shadow-2xl animate-in fade-in zoom-in duration-1000"
            />
          </motion.div>
        </div>
      </section>

      {/* Client Logos Section */}
      <section id="clients" className="pt-12 pb-10 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Trusted by Hiring Teams</h2>
            <p className="text-muted-foreground">
              Leading employers rely on Rekshift for smarter, fairer hiring decisions.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {clientLogos.map((client) => (
              <a
                key={client.name}
                href={client.url}
                target="_blank"
                rel="noreferrer"
                className="group rounded-3xl border bg-card p-6 transition-shadow hover:shadow-xl"
              >
                <div className="flex items-center gap-4">
                  {client.logo ? (
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white dark:bg-white/[0.04] border border-border/50 p-1.5 overflow-hidden shadow-inner">
                      <img
                        src={client.logo}
                        alt={client.name}
                        className="h-full w-full object-contain"
                        draggable={false}
                      />
                    </div>
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary text-lg font-semibold">
                      {client.initials}
                    </div>
                  )}
                  <div>
                    <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                      {client.name}
                    </h3>
                    <p className="text-sm text-muted-foreground">{client.url.replace(/^https?:\/\//, '')}</p>
                  </div>
                </div>
                <p className="mt-4 text-sm text-muted-foreground">{client.caption}</p>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="pt-10 pb-10 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Enterprise-Grade Features</h2>
            <p className="text-muted-foreground">
              Everything you need for unbiased, efficient hiring
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-12 items-center">
            {/* Left side: Feature List */}
            <div className="space-y-4">
              {features.map((feature, index) => {
                const isActive = activeFeature === index;
                return (
                  <button
                    key={feature.title}
                    onClick={() => setActiveFeature(index)}
                    className={`w-full text-left flex items-start gap-4 p-6 rounded-2xl transition-all ${isActive
                      ? 'bg-card border-primary/50 border shadow-md'
                      : 'bg-transparent border border-transparent hover:bg-card/50'
                      }`}
                  >
                    <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${isActive ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary'
                      }`}>
                      <feature.icon className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className={`text-xl font-semibold mb-2 transition-colors ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {feature.title}
                      </h3>
                      <p className={`text-muted-foreground transition-all duration-300 overflow-hidden ${isActive ? 'h-auto opacity-100' : 'h-0 opacity-0'}`}>
                        {feature.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Right side: Dynamic Content */}
            <div className="relative h-[450px] rounded-3xl overflow-hidden bg-gradient-to-br from-primary/5 to-primary/10 border flex items-center justify-center p-8">
              <motion.div
                key={activeFeature}
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="text-center w-full"
              >
                <div className="w-full max-w-sm h-48 sm:h-64 rounded-2xl bg-background/50 shadow-2xl flex items-center justify-center mx-auto mb-8 backdrop-blur-xl overflow-hidden border">
                  <img
                    src={features[activeFeature].image}
                    alt={features[activeFeature].title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <h3 className="text-2xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">
                  {features[activeFeature].title}
                </h3>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="pt-12 pb-16 px-4 bg-muted/30">
        <div className="container mx-auto max-w-4xl" ref={containerRef}>
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">How Rekshift Works</h2>
            <p className="text-muted-foreground">
              Streamline your hiring process in three simple steps.
            </p>
          </div>

          <div className="relative">
            {/* The persistent background line */}
            <div className="absolute left-[40px] md:left-1/2 md:-translate-x-1/2 top-0 bottom-0 w-1 bg-muted rounded-full" />

            {/* The animated fill line */}
            <motion.div
              style={{ height: lineHeight }}
              className="absolute left-[40px] md:left-1/2 md:-translate-x-1/2 top-0 w-1 bg-primary rounded-full origin-top"
            />

            <div className="flex flex-col gap-16 relative z-10">
              {[
                { title: 'Create Job', desc: 'Define role requirements and AI will generate custom assessments.', icon: '1' },
                { title: 'AI Screening', desc: 'Candidates take proctored assessments and AI interviews.', icon: '2' },
                { title: 'Hire Top Talent', desc: 'Review detailed reports and hire the best fits with confidence.', icon: '3' },
              ].map((step, i) => (
                <div key={i} className={`flex flex-col md:flex-row items-start md:items-center gap-6 ${i % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'}`}>

                  {/* Content Container */}
                  <div className={`flex-1 w-full pl-20 md:pl-0 ${i % 2 === 0 ? 'md:pr-16 md:text-right' : 'md:pl-16 md:text-left'}`}>
                    <motion.div
                      initial={{ opacity: 0, x: i % 2 === 0 ? -20 : 20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true, margin: "-100px" }}
                      className="bg-card border rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <h3 className="text-xl font-bold mb-2">{step.title}</h3>
                      <p className="text-muted-foreground">{step.desc}</p>
                    </motion.div>
                  </div>

                  {/* Icon Container (Center) */}
                  <motion.div
                    initial={{ scale: 0 }}
                    whileInView={{ scale: 1 }}
                    viewport={{ once: true, margin: "-100px" }}
                    className="absolute left-4 md:static md:left-auto w-12 h-12 md:w-14 md:h-14 bg-background border-4 border-primary text-primary rounded-full flex items-center justify-center text-lg md:text-xl font-bold flex-shrink-0 z-20 shadow-lg"
                  >
                    {step.icon}
                  </motion.div>

                  {/* Empty Spacer */}
                  <div className="hidden md:block flex-1" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 px-4 bg-muted/30">
        <div className="container mx-auto max-w-4xl">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="relative rounded-3xl overflow-hidden"
            style={{ background: 'var(--gradient-hero)' }}
          >
            <div className="relative z-10 p-6 sm:p-12 text-center text-white">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Ready to Transform Your Hiring?
              </h2>
              <p className="text-lg opacity-80 mb-8 max-w-xl mx-auto">
                Join companies using AI to make faster, fairer, and more accurate hiring decisions.
              </p>
              {user ? (
                <Button size="lg" variant="secondary" asChild>
                  <Link to="/dashboard">
                    Go to Dashboard
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
              ) : (
                <Button size="lg" variant="secondary" asChild>
                  <Link to="/sign-up">
                    Get Started Free
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
              )}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
}
