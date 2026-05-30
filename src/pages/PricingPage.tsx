import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import logoFull from '@/assets/LOGO_full.png';
import { Check, Globe } from 'lucide-react';

type Currency = 'USD' | 'INR';

interface PricingPlan {
  name: string;
  price: number;
  currency: string;
  candidates: number;
  validity: string;
  features: string[];
  cta: string;
  highlighted?: boolean;
}

const USD_PLANS: PricingPlan[] = [
  {
    name: 'Free',
    price: 0,
    currency: '$',
    candidates: 5,
    validity: '1 Month',
    features: [
      'End-to-End Assessment',
      'Resume Parsing',
      'MCQ Assessment',
      'Coding Assessment',
      'AI Interview',
    ],
    cta: 'Get Started',
  },
  {
    name: 'Starter',
    price: 300,
    currency: '$',
    candidates: 100,
    validity: '6 Months',
    features: [
      'End-to-End Assessment',
      'Resume Parsing',
      'MCQ Assessment',
      'Coding Assessment',
      'AI Interview',
    ],
    cta: 'Choose Plan',
    highlighted: true,
  },
  {
    name: 'Growth',
    price: 1100,
    currency: '$',
    candidates: 500,
    validity: '1 Year',
    features: [
      'End-to-End Assessment',
      'Resume Parsing',
      'MCQ Assessment',
      'Coding Assessment',
      'AI Interview',
    ],
    cta: 'Choose Plan',
  },
  {
    name: 'Enterprise',
    price: 1800,
    currency: '$',
    candidates: 1000,
    validity: '1 Year',
    features: [
      'End-to-End Assessment',
      'Resume Parsing',
      'MCQ Assessment',
      'Coding Assessment',
      'AI Interview',
    ],
    cta: 'Contact Sales',
  },
];

const INR_PLANS: PricingPlan[] = [
  {
    name: 'Free',
    price: 0,
    currency: '₹',
    candidates: 5,
    validity: '1 Month',
    features: [
      'End-to-End Assessment',
      'Resume Parsing',
      'MCQ Assessment',
      'Coding Assessment',
      'AI Interview',
    ],
    cta: 'Get Started',
  },
  {
    name: 'Starter',
    price: 27000,
    currency: '₹',
    candidates: 100,
    validity: '6 Months',
    features: [
      'End-to-End Assessment',
      'Resume Parsing',
      'MCQ Assessment',
      'Coding Assessment',
      'AI Interview',
    ],
    cta: 'Choose Plan',
    highlighted: true,
  },
  {
    name: 'Growth',
    price: 99000,
    currency: '₹',
    candidates: 500,
    validity: '1 Year',
    features: [
      'End-to-End Assessment',
      'Resume Parsing',
      'MCQ Assessment',
      'Coding Assessment',
      'AI Interview',
    ],
    cta: 'Choose Plan',
  },
  {
    name: 'Enterprise',
    price: 162000,
    currency: '₹',
    candidates: 1000,
    validity: '1 Year',
    features: [
      'End-to-End Assessment',
      'Resume Parsing',
      'MCQ Assessment',
      'Coding Assessment',
      'AI Interview',
    ],
    cta: 'Contact Sales',
  },
];

const formatPrice = (price: number): string => {
  if (price === 0) return '0';
  return price.toLocaleString();
};

const PricingPage = () => {
  const [currency, setCurrency] = useState<Currency>('USD');
  const [autoDetected, setAutoDetected] = useState(true);

  useEffect(() => {
    // Try to detect user's location
    const detectLocation = async () => {
      try {
        // Using IP geolocation API
        const response = await fetch('https://ipapi.co/json/');
        const data = await response.json();
        const country = data.country_code;

        // Check if user is in India or Asia region
        const asianCountries = ['IN', 'BD', 'PK', 'LK', 'NP', 'BT', 'MV'];
        if (asianCountries.includes(country)) {
          setCurrency('INR');
        } else {
          setCurrency('USD');
        }
        setAutoDetected(true);
      } catch (error) {
        // If location detection fails, default to USD
        console.log('Location detection failed, defaulting to USD');
        setCurrency('USD');
        setAutoDetected(false);
      }
    };

    detectLocation();
  }, []);

  const plans = currency === 'USD' ? USD_PLANS : INR_PLANS;

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-4 left-1/2 -translate-x-1/2 w-[95%] md:w-[80%] lg:w-[60%] z-50 bg-background/80 backdrop-blur-xl border rounded-full shadow-lg transition-all duration-300">
        <div className="px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center cursor-pointer">
            <img
              src={logoFull}
              alt="Rekshift"
              className="h-11 w-auto object-contain"
              draggable={false}
            />
          </Link>

          <div className="flex flex-wrap items-center justify-center gap-4 text-sm font-medium">
            <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors">Home</Link>
            <Link to="/#features" className="text-muted-foreground hover:text-foreground transition-colors">Features</Link>
            <Link to="/#how-it-works" className="text-muted-foreground hover:text-foreground transition-colors">How it Works</Link>
            <Link to="/pricing" className="text-primary">Pricing</Link>
            <Link to="/contact" className="text-muted-foreground hover:text-foreground transition-colors">Contact</Link>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" className="hidden sm:inline-flex rounded-full" asChild>
              <Link to="/sign-in">Sign In</Link>
            </Button>
            <Button size="sm" className="rounded-full" asChild>
              <Link to="/sign-up">Get Started</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Pricing Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="container mx-auto max-w-7xl">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">Simple, Transparent Pricing</h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
              Choose the perfect plan for your hiring needs. All plans include our core AI-powered assessment features.
            </p>

            {/* Currency Toggle */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-4 bg-card border rounded-full p-1"
            >
              <button
                onClick={() => setCurrency('USD')}
                className={`px-6 py-2 rounded-full font-semibold transition-all ${
                  currency === 'USD'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                USD
              </button>
              <button
                onClick={() => setCurrency('INR')}
                className={`px-6 py-2 rounded-full font-semibold transition-all ${
                  currency === 'INR'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                INR
              </button>
              {autoDetected && (
                <span className="ml-2 text-xs text-muted-foreground flex items-center gap-1">
                  <Globe className="h-3 w-3" />
                  Auto-detected
                </span>
              )}
            </motion.div>
          </motion.div>

          {/* Pricing Cards Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
            {plans.map((plan, index) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className={`relative rounded-3xl overflow-hidden transition-all duration-300 ${
                  plan.highlighted
                    ? 'ring-2 ring-primary shadow-2xl md:scale-105'
                    : 'bg-card border hover:shadow-lg'
                }`}
              >
                {/* Card Background */}
                <div
                  className={`p-8 h-full flex flex-col ${
                    plan.highlighted
                      ? 'bg-gradient-to-br from-primary/10 via-card to-card border border-primary/20'
                      : 'bg-card'
                  }`}
                >
                  {/* Popular Badge */}
                  {plan.highlighted && (
                    <div className="absolute top-0 right-0 left-0 bg-primary text-primary-foreground text-center py-2 text-sm font-semibold">
                      Most Popular
                    </div>
                  )}

                  <div className={plan.highlighted ? 'mt-10' : ''}>
                    {/* Plan Name */}
                    <h3 className="text-2xl font-bold text-foreground mb-2">{plan.name}</h3>

                    {/* Price */}
                    <div className="mb-6">
                      <span className="text-4xl font-bold text-foreground">
                        {plan.currency}{formatPrice(plan.price)}
                      </span>
                      <p className="text-muted-foreground mt-2 text-sm">
                        {plan.candidates} Candidate{plan.candidates !== 1 ? 's' : ''}
                      </p>
                      <p className="text-muted-foreground text-sm">Valid for {plan.validity}</p>
                    </div>

                    {/* CTA Button */}
                    <Button
                      size="lg"
                      className={`w-full rounded-lg mb-8 font-semibold ${
                        plan.highlighted
                          ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                          : ''
                      }`}
                      variant={plan.highlighted ? 'default' : 'outline'}
                      asChild
                    >
                      <Link
                        to={
                          plan.cta === 'Contact Sales'
                            ? '/contact'
                            : plan.price === 0
                            ? '/sign-up'
                            : '/sign-up'
                        }
                      >
                        {plan.cta}
                      </Link>
                    </Button>

                    {/* Divider */}
                    <div className="border-t border-border mb-6" />

                    {/* Features */}
                    <div className="space-y-4">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Included Features
                      </p>
                      {plan.features.map((feature, i) => (
                        <div key={i} className="flex items-start gap-3">
                          <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Check className="h-3 w-3 text-primary" />
                          </div>
                          <span className="text-sm text-muted-foreground">{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Features Comparison */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="bg-card border rounded-3xl p-8 md:p-12"
          >
            <h2 className="text-3xl font-bold text-foreground mb-8">What's Included in All Plans</h2>

            <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-8">
              {[
                {
                  title: 'End-to-End Assessment',
                  desc: 'Complete assessment workflow from resume to final evaluation',
                },
                {
                  title: 'Resume Parsing',
                  desc: 'AI-powered semantic analysis of candidate resumes',
                },
                {
                  title: 'MCQ Assessment',
                  desc: 'Multiple choice questions tailored to job requirements',
                },
                {
                  title: 'Coding Assessment',
                  desc: 'Real-time coding challenges with automated evaluation',
                },
                {
                  title: 'AI Interview',
                  desc: 'Intelligent interview with adaptive questions and scoring',
                },
              ].map((feature, i) => (
                <div key={i}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                      <Check className="h-4 w-4 text-primary" />
                    </div>
                    <h3 className="font-semibold text-foreground">{feature.title}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">{feature.desc}</p>
                </div>
              ))}
            </div>
          </motion.div>

          {/* FAQ Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="mt-16"
          >
            <h2 className="text-3xl font-bold text-foreground mb-8 text-center">Frequently Asked Questions</h2>

            <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              {[
                {
                  q: 'Can I change plans anytime?',
                  a: 'Yes, you can upgrade or downgrade your plan at any time. Changes will be reflected in your next billing cycle.',
                },
                {
                  q: 'Is there a free trial?',
                  a: 'Absolutely! Our Free plan gives you 5 candidate assessments valid for 1 month to test our platform.',
                },
                {
                  q: 'What payment methods do you accept?',
                  a: 'We accept all major credit cards, debit cards, and digital payment methods for your convenience.',
                },
                {
                  q: 'Can I get a custom plan?',
                  a: 'Yes! For enterprise needs, contact our sales team to discuss custom pricing and features.',
                },
              ].map((item, i) => (
                <div key={i} className="bg-card border rounded-2xl p-6 hover:shadow-lg transition-shadow">
                  <h3 className="font-semibold text-foreground mb-3">{item.q}</h3>
                  <p className="text-muted-foreground text-sm">{item.a}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="py-16 px-4 bg-muted/30 border-t mt-16">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-3xl font-bold text-foreground mb-4">Ready to Get Started?</h2>
          <p className="text-muted-foreground mb-8">Join hundreds of companies using Rekshift to hire smarter.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" variant="outline" asChild className="rounded-full">
              <Link to="/contact">Contact Sales</Link>
            </Button>
            <Button size="lg" asChild className="rounded-full">
              <Link to="/sign-up">Start Free Trial</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default PricingPage;
