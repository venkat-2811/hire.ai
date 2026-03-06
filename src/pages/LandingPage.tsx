import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
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

const roles = [
  { name: 'Frontend Developer', image: '/frontend.png' },
  { name: 'Backend Engineer', image: '/backend.png' },
  { name: 'Data Scientist', image: '/data-scientist.png' },
  { name: 'DevOps Engineer', image: '/devops.png' },
  { name: 'Product Manager', image: '/product-manager.png' },
  { name: 'UX Designer', image: '/ux-design.webp' },
  { name: 'QA Engineer', image: '/QA-Engineer.png' },
];

export default function LandingPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const dragConstraintsRef = useRef<HTMLDivElement>(null);
  const [activeFeature, setActiveFeature] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveFeature((prev) => (prev + 1) % features.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <Sparkles className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">HireAI</span>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" asChild>
              <Link to="/sign-in">Sign In</Link>
            </Button>
            <Button asChild>
              <Link to="/sign-up">Get Started</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="container mx-auto grid md:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 text-accent text-sm font-medium mb-6">
              <Sparkles className="h-4 w-4" />
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
              <Button size="lg" asChild>
                <Link to="/sign-up">
                  Start Hiring
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </div>

            {/* Stats */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
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
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
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

      {/* Roles Section */}
      <section className="py-20 bg-muted/30 overflow-hidden">
        <div className="container mx-auto px-4 text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">Supported Roles</h2>
          <p className="text-muted-foreground">
            Role-specific evaluation criteria and practical assessments
          </p>
        </div>

        <div className="relative w-full flex overflow-x-hidden">
          {/* Fading Edges */}
          <div className="pointer-events-none absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-muted/30 to-transparent z-10" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-muted/30 to-transparent z-10" />

          <motion.div
            className="flex gap-6 px-4 py-4 w-max"
            animate={{ x: ["0%", "-50%"] }}
            transition={{ repeat: Infinity, ease: "linear", duration: 40 }}
          >
            {[...roles, ...roles].map((role, index) => (
              <div
                key={index}
                className="w-[300px] flex-shrink-0 p-6 rounded-2xl bg-card border hover:shadow-lg transition-shadow flex flex-col items-center text-center"
              >
                <div className="w-24 h-24 mb-4 relative overflow-hidden rounded-full border-4 border-muted/50">
                  <img src={role.image} alt={role.name} className="object-cover w-full h-full" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{role.name}</h3>
                <p className="text-sm text-muted-foreground">
                  Custom assessments, role-specific questions, and tailored evaluation criteria.
                </p>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4">
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
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">How HireAI Works</h2>
            <p className="text-muted-foreground">
              Streamline your hiring process in three simple steps. Drag to explore.
            </p>
          </div>

          <div className="relative overflow-hidden cursor-grab active:cursor-grabbing pb-8" ref={dragConstraintsRef}>
            <motion.div
              drag="x"
              dragConstraints={dragConstraintsRef}
              className="flex gap-8 w-max px-4"
            >
              {[
                { title: 'Create Job', desc: 'Define role requirements and AI will generate custom assessments.', icon: '1' },
                { title: 'AI Screening', desc: 'Candidates take proctored assessments and AI interviews.', icon: '2' },
                { title: 'Hire Top Talent', desc: 'Review detailed reports and hire the best fits with confidence.', icon: '3' },
                { title: 'Onboarding', desc: 'Seamlessly transition successful candidates into your HRIS system.', icon: '4' }
              ].map((step, i) => (
                <motion.div
                  key={i}
                  className="w-[320px] bg-card border rounded-2xl p-8 text-center flex-shrink-0 select-none shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-6 pointer-events-none">
                    {step.icon}
                  </div>
                  <h3 className="text-xl font-bold mb-3 pointer-events-none">{step.title}</h3>
                  <p className="text-muted-foreground pointer-events-none">{step.desc}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-4xl">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="relative rounded-3xl overflow-hidden"
            style={{ background: 'var(--gradient-hero)' }}
          >
            <div className="relative z-10 p-12 text-center text-white">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Ready to Transform Your Hiring?
              </h2>
              <p className="text-lg opacity-80 mb-8 max-w-xl mx-auto">
                Join companies using AI to make faster, fairer, and more accurate hiring decisions.
              </p>
              <Button size="lg" variant="secondary" asChild>
                <Link to="/sign-up">
                  Get Started Free
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t">
        <div className="container mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <span className="font-semibold">HireAI</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © 2024 HireAI. Built with Lovable.
          </p>
        </div>
      </footer>
    </div>
  );
}
