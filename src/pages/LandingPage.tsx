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
import { useEffect } from 'react';

const features = [
  {
    icon: FileText,
    title: 'Semantic Resume Parsing',
    description: 'AI-powered analysis that understands context, not just keywords.',
  },
  {
    icon: Brain,
    title: 'Adaptive Questions',
    description: 'Unique, role-specific questions tailored to each candidate.',
  },
  {
    icon: Shield,
    title: 'Proctoring & Integrity',
    description: 'Tab switching, copy-paste detection, and session monitoring.',
  },
  {
    icon: BarChart3,
    title: 'Explainable AI Scoring',
    description: 'Transparent reason codes for every hiring decision.',
  },
];

const roles = [
  { name: 'Salesforce Developer', icon: '⚡', color: 'bg-info/10 text-info' },
  { name: 'QA Engineer', icon: '🔍', color: 'bg-purple-500/10 text-purple-500' },
  { name: 'Business Analyst', icon: '📊', color: 'bg-warning/10 text-warning' },
];

export default function LandingPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

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
              <Link to="/auth">Sign In</Link>
            </Button>
            <Button asChild>
              <Link to="/auth">Get Started</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="container mx-auto text-center max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
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
            
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
              Semantic resume screening, adaptive interviews, and transparent hiring decisions. 
              Built for international hiring committee standards.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" asChild>
                <Link to="/auth">
                  Start Hiring
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button size="lg" variant="outline">
                Watch Demo
              </Button>
            </div>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-16 grid grid-cols-3 gap-8"
          >
            {[
              { value: '95%', label: 'Screening Accuracy' },
              { value: '70%', label: 'Time Saved' },
              { value: '100%', label: 'Explainable' },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-foreground">{stat.value}</div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Roles Section */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Supported Roles</h2>
            <p className="text-muted-foreground">
              Role-specific evaluation criteria and practical assessments
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {roles.map((role, index) => (
              <motion.div
                key={role.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="p-6 rounded-2xl bg-card border hover:shadow-lg transition-shadow"
              >
                <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl ${role.color} text-2xl mb-4`}>
                  {role.icon}
                </div>
                <h3 className="text-lg font-semibold mb-2">{role.name}</h3>
                <p className="text-sm text-muted-foreground">
                  Custom assessments, role-specific questions, and tailored evaluation criteria.
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Enterprise-Grade Features</h2>
            <p className="text-muted-foreground">
              Everything you need for unbiased, efficient hiring
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="flex gap-4 p-6 rounded-2xl bg-card border"
              >
                <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
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
                <Link to="/auth">
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
