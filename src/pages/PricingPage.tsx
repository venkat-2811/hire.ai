import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Check, Phone, FlaskConical } from 'lucide-react';
import Footer from '@/components/layout/Footer';
import Navbar from '@/components/layout/Navbar';
import { useCountryDetection } from '@/hooks/useCountryDetection';
import {
  PRODUCTION_PLANS,
  TEST_PLANS,
  shouldShowTestPlans,
  formatPrice,
  type Currency,
  type PricingPlan,
} from '@/lib/pricing';

// ─────────────────────────────────────────────────────────────────────────────

/** Plan comparison table rows — dynamic based on active currency */
function getPlanComparisonRows(currency: Currency) {
  return [
    { name: 'Free',       price: formatPrice(0, currency),     duration: '1 Month',  limit: '5' },
    { name: 'Starter',    price: formatPrice(currency === 'INR' ? 15000 : 300, currency), duration: '6 Months', limit: '50' },
    { name: 'Growth',     price: formatPrice(currency === 'INR' ? 27000 : 500, currency), duration: '6 Months', limit: '100' },
    { name: 'Scale',      price: formatPrice(currency === 'INR' ? 99000 : 2000, currency), duration: '1 Year',  limit: '500' },
    { name: 'Enterprise', price: 'Contact Sales',              duration: 'Custom',   limit: 'Custom' },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────

const PricingPage = () => {
  const [isFirstVisit, setIsFirstVisit] = useState(true);
  const [manualCurrency, setManualCurrency] = useState<Currency | null>(null);

  useEffect(() => {
    const visited = sessionStorage.getItem('rekshift_visited_pricing');
    if (visited) {
      setIsFirstVisit(false);
    } else {
      sessionStorage.setItem('rekshift_visited_pricing', 'true');
    }
  }, []);

  // Geo-based country + currency detection (no-flicker strategy)
  const { currency: detectedCurrency, country, isLoading: geoLoading } = useCountryDetection();

  // Allow manual override via toggle; fall back to detected currency
  const activeCurrency: Currency = manualCurrency ?? detectedCurrency;

  // Plans to display: production + test (if dev)
  const productionPlans = PRODUCTION_PLANS;
  const testPlans = shouldShowTestPlans()
    ? TEST_PLANS.filter(p =>
        activeCurrency === 'INR' ? (p.priceINR ?? 0) > 0 : (p.priceUSD ?? 0) > 0
      )
    : [];

  const getPriceDisplay = (plan: PricingPlan): { symbol: string; amount: string } => {
    if (plan.isEnterprise) return { symbol: '', amount: '' };
    const price = activeCurrency === 'INR' ? (plan.priceINR ?? 0) : (plan.priceUSD ?? 0);
    return {
      symbol: activeCurrency === 'INR' ? '₹' : '$',
      amount: formatPrice(price, activeCurrency),
    };
  };

  // Render a single pricing card
  const renderPlanCard = (plan: PricingPlan, index: number) => {
    const { amount } = getPriceDisplay(plan);
    const isHighlighted = plan.highlighted && !plan.isTestPlan;

    return (
      <motion.div
        key={plan.id}
        initial={isFirstVisit ? { opacity: 0, y: 20 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: isFirstVisit ? index * 0.1 : 0 }}
        className={`relative rounded-3xl overflow-hidden transition-all duration-300 ${
          plan.isTestPlan
            ? 'ring-2 ring-dashed ring-yellow-500/40 bg-card border border-yellow-500/30 hover:shadow-lg'
            : isHighlighted
            ? 'ring-2 ring-primary shadow-2xl md:scale-105'
            : plan.isEnterprise
            ? 'ring-2 ring-purple-500/30 bg-card border border-purple-500/20 hover:shadow-lg'
            : 'bg-card border hover:shadow-lg'
        }`}
      >
        {/* Card Background */}
        <div
          className={`p-8 h-full flex flex-col ${
            plan.isTestPlan
              ? 'bg-yellow-500/5'
              : isHighlighted
              ? 'bg-gradient-to-br from-primary/10 via-card to-card border border-primary/20'
              : plan.isEnterprise
              ? 'bg-gradient-to-br from-purple-500/5 via-card to-card'
              : 'bg-card'
          }`}
        >
          {/* Test Plan Banner */}
          {plan.isTestPlan && (
            <div className="absolute top-0 right-0 left-0 bg-yellow-500/20 border-b border-yellow-500/30 text-center py-1.5 text-xs font-semibold text-yellow-700 flex items-center justify-center gap-1.5">
              <FlaskConical className="h-3.5 w-3.5" />
              DEV / TEST ONLY — Not visible in production
            </div>
          )}

          {/* Popular Badge */}
          {isHighlighted && (
            <div className="absolute top-0 right-0 left-0 bg-primary text-primary-foreground text-center py-2 text-sm font-semibold">
              Most Popular
            </div>
          )}

          <div className={plan.isTestPlan ? 'mt-8' : isHighlighted ? 'mt-10' : ''}>
            {/* Plan Name */}
            <h3 className={`text-2xl font-bold mb-2 ${
              plan.isTestPlan ? 'text-yellow-700'
              : plan.isEnterprise ? 'text-purple-600'
              : 'text-foreground'
            }`}>
              {plan.name}
            </h3>

            {/* Price */}
            <div className="mb-6">
              {plan.isEnterprise ? (
                <>
                  <span className="text-3xl font-bold text-purple-600">Contact Sales</span>
                  <p className="text-muted-foreground mt-2 text-sm">Custom pricing</p>
                </>
              ) : (
                <>
                  <span className={`text-4xl font-bold ${plan.isTestPlan ? 'text-yellow-700' : 'text-foreground'}`}>
                    {amount}
                  </span>
                  <p className="text-muted-foreground mt-2 text-sm">
                    {plan.candidates} Candidate{typeof plan.candidates === 'number' && plan.candidates !== 1 ? 's' : ''}
                  </p>
                </>
              )}
              <p className="text-muted-foreground text-sm">
                {plan.isEnterprise ? 'Custom duration' : `Valid for ${plan.validity}`}
              </p>
            </div>

            {/* CTA Button */}
            {plan.isTestPlan ? (
              <Button
                size="lg"
                className="w-full rounded-lg mb-8 font-semibold bg-yellow-500 hover:bg-yellow-600 text-white border-0"
                asChild
              >
                <Link to="/sign-up">⚗ Test This Plan</Link>
              </Button>
            ) : plan.isEnterprise ? (
              <Button
                size="lg"
                className="w-full rounded-lg mb-8 font-semibold bg-purple-600 hover:bg-purple-700 text-white border-0"
                asChild
              >
                <Link to="/contact">
                  <Phone className="mr-2 h-4 w-4" />
                  Contact Sales
                </Link>
              </Button>
            ) : (
              <Button
                size="lg"
                className={`w-full rounded-lg mb-8 font-semibold ${
                  isHighlighted ? 'bg-primary text-primary-foreground hover:bg-primary/90' : ''
                }`}
                variant={isHighlighted ? 'default' : 'outline'}
                asChild
              >
                <Link to="/sign-up">{plan.id === 'free' ? 'Get Started' : 'Choose Plan'}</Link>
              </Button>
            )}

            {/* Divider */}
            <div className="border-t border-border mb-6" />

            {/* Features */}
            <div className="space-y-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {plan.isEnterprise ? 'Enterprise Features' : 'Included Features'}
              </p>
              {plan.features.map((feature, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    plan.isTestPlan ? 'bg-yellow-500/20'
                    : plan.isEnterprise ? 'bg-purple-500/20'
                    : 'bg-primary/20'
                  }`}>
                    <Check className={`h-3 w-3 ${
                      plan.isTestPlan ? 'text-yellow-600'
                      : plan.isEnterprise ? 'text-purple-500'
                      : 'text-primary'
                    }`} />
                  </div>
                  <span className="text-sm text-muted-foreground">{feature}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <Navbar />

      {/* Pricing Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="container mx-auto max-w-7xl">
          {/* Header */}
          <motion.div
            initial={isFirstVisit ? { opacity: 0, y: 20 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">Simple, Transparent Pricing</h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
              Choose the perfect plan for your hiring needs. All plans include our core AI-powered assessment features.
            </p>

            {/* Auto-detected pricing loaded in background */}
          </motion.div>

          {/* Loading skeleton while geo-detecting */}
          {geoLoading && manualCurrency === null ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-5 mb-16">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-96 rounded-3xl bg-muted/30 animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              {/* Production Pricing Cards */}
              <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-5 mb-16">
                {productionPlans.map((plan, i) => renderPlanCard(plan, i))}
              </div>

              {/* Test Plans — DEV/QA only */}
              {testPlans.length > 0 && (
                <div className="mb-16">
                  <div className="flex items-center gap-3 mb-6">
                    <FlaskConical className="h-5 w-5 text-yellow-600" />
                    <h2 className="text-xl font-bold text-yellow-700">Test Plans (Dev / QA Only)</h2>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-medium border border-yellow-300">
                      Hidden in Production
                    </span>
                  </div>
                  <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
                    {testPlans.map((plan, i) => renderPlanCard(plan, productionPlans.length + i))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Plan Comparison Table */}
          {!geoLoading || manualCurrency !== null ? (
            <motion.div
              initial={isFirstVisit ? { opacity: 0, y: 20 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: isFirstVisit ? 0.4 : 0 }}
              className="bg-card border rounded-3xl p-8 md:p-12 mb-16 overflow-x-auto"
            >
              <h2 className="text-3xl font-bold text-foreground mb-2">Plan Comparison</h2>
              <p className="text-sm text-muted-foreground mb-8">
                All prices shown in {activeCurrency === 'INR' ? 'Indian Rupees (₹ INR)' : 'US Dollars ($ USD)'}.
              </p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="pb-4 text-left font-semibold text-muted-foreground">Plan</th>
                    <th className="pb-4 text-center font-semibold text-muted-foreground">
                      Price ({activeCurrency === 'INR' ? '₹ INR' : '$ USD'})
                    </th>
                    <th className="pb-4 text-center font-semibold text-muted-foreground">Duration</th>
                    <th className="pb-4 text-center font-semibold text-muted-foreground">Candidate Limit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {getPlanComparisonRows(activeCurrency).map((row) => (
                    <tr key={row.name} className="hover:bg-muted/20 transition-colors">
                      <td className="py-4 font-semibold text-foreground">{row.name}</td>
                      <td className="py-4 text-center text-muted-foreground">{row.price}</td>
                      <td className="py-4 text-center text-muted-foreground">{row.duration}</td>
                      <td className="py-4 text-center text-muted-foreground">{row.limit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </motion.div>
          ) : null}

          {/* Features Included in All Plans */}
          <motion.div
            initial={isFirstVisit ? { opacity: 0, y: 20 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: isFirstVisit ? 0.5 : 0 }}
            className="bg-card border rounded-3xl p-8 md:p-12"
          >
            <h2 className="text-3xl font-bold text-foreground mb-8">What's Included in All Plans</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-8">
              {[
                { title: 'End-to-End Assessment', desc: 'Complete assessment workflow from resume to final evaluation' },
                { title: 'Resume Parsing', desc: 'AI-powered semantic analysis of candidate resumes' },
                { title: 'MCQ Assessment', desc: 'Multiple choice questions tailored to job requirements' },
                { title: 'Coding Assessment', desc: 'Real-time coding challenges with automated evaluation' },
                { title: 'AI Interview', desc: 'Intelligent interview with adaptive questions and scoring' },
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
            initial={isFirstVisit ? { opacity: 0, y: 20 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: isFirstVisit ? 0.6 : 0 }}
            className="mt-16"
          >
            <h2 className="text-3xl font-bold text-foreground mb-8 text-center">Frequently Asked Questions</h2>
            <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              {[
                { q: 'Can I change plans anytime?', a: 'Yes, you can upgrade your plan at any time. Changes will be reflected immediately upon payment.' },
                { q: 'Is there a free trial?', a: 'Absolutely! Our Free plan gives you 5 candidate assessments valid for 1 month to test our platform.' },
                { q: 'What payment methods do you accept?', a: 'We accept all major credit cards, debit cards, and digital payment methods for your convenience.' },
                { q: 'How do I get an Enterprise plan?', a: 'Enterprise plans have custom pricing and candidate limits. Click "Contact Sales" to connect with our team.' },
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

      <Footer />
    </div>
  );
};

export default PricingPage;
