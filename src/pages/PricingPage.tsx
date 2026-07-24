import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Phone, Building2, Globe } from 'lucide-react';
import Footer from '@/components/layout/Footer';
import Navbar from '@/components/layout/Navbar';
import { useQuery } from '@tanstack/react-query';
import { companyApi } from '@/lib/api';
import { useCountryDetection } from '@/hooks/useCountryDetection';
import {
  PRODUCTION_PLANS,
  formatPrice,
  getPlanPrice,
  type Currency,
  type PricingPlan,
} from '@/lib/pricing';

// ─────────────────────────────────────────────────────────────────────────────

/** Plan comparison table rows — dynamic based on active currency */
function getPlanComparisonRows(currency: Currency) {
  return PRODUCTION_PLANS.map((plan) => {
    const amount = getPlanPrice(plan, currency);
    return {
      name: plan.name,
      price: amount === null ? 'Contact Sales' : formatPrice(amount, currency),
      duration: plan.validity,
      limit: plan.candidates !== null ? String(plan.candidates) : 'Custom',
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────

const PricingPage = () => {
  const [isFirstVisit, setIsFirstVisit] = useState(true);
  const [manualCurrency, setManualCurrency] = useState<Currency | null>(null);
  const [planCategory, setPlanCategory] = useState<'individual' | 'company'>('individual');

  const companyPlansQuery = useQuery({
    queryKey: ['company-plans-public'],
    queryFn: () => companyApi.plans(),
    staleTime: 300_000,
  });

  const companyPlans = companyPlansQuery.data?.plans ?? [];

  useEffect(() => {
    const visited = sessionStorage.getItem('rekshift_visited_pricing');
    if (visited) {
      setIsFirstVisit(false);
    } else {
      sessionStorage.setItem('rekshift_visited_pricing', 'true');
    }
  }, []);

  // Geo-based country + currency detection (no-flicker strategy)
  const { currency: detectedCurrency, isLoading: geoLoading } = useCountryDetection();

  // Allow manual override via toggle; fall back to detected currency
  const activeCurrency: Currency = manualCurrency ?? detectedCurrency;

  const productionPlans = PRODUCTION_PLANS;

  const getPriceDisplay = (plan: PricingPlan): { symbol: string; amount: string } => {
    const price = getPlanPrice(plan, activeCurrency) ?? 0;
    return {
      symbol: activeCurrency === 'INR' ? '₹' : '$',
      amount: formatPrice(price, activeCurrency),
    };
  };

  // Render a single pricing card
  const renderPlanCard = (plan: PricingPlan, index: number) => {
    const { amount } = getPriceDisplay(plan);
    const isHighlighted = !!plan.highlighted;
    const isEnterprise = plan.id === 'enterprise';

    return (
      <motion.div
        key={plan.id}
        initial={isFirstVisit ? { opacity: 0, y: 20 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: isFirstVisit ? index * 0.1 : 0 }}
        className={`relative rounded-3xl overflow-hidden transition-all duration-300 ${
          isHighlighted
            ? 'ring-2 ring-primary shadow-2xl md:scale-105'
            : isEnterprise
            ? 'ring-2 ring-purple-500/40 bg-gradient-to-br from-purple-500/5 to-card border border-purple-500/30'
            : 'bg-card border hover:shadow-lg'
        }`}
      >
        {/* Card Background */}
        <div
          className={`p-8 h-full flex flex-col ${
            isHighlighted
              ? 'bg-gradient-to-br from-primary/10 via-card to-card border border-primary/20'
              : 'bg-card'
          }`}
        >
          {/* Popular Badge */}
          {isHighlighted && (
            <div className="absolute top-0 right-0 left-0 bg-primary text-primary-foreground text-center py-2 text-sm font-semibold">
              Most Popular
            </div>
          )}
          {/* Enterprise Custom badge */}
          {isEnterprise && (
            <div className="absolute top-0 right-0 left-0 bg-purple-600 text-white text-center py-2 text-sm font-semibold">
              Custom Plan
            </div>
          )}

          <div className={isHighlighted || isEnterprise ? 'mt-10' : ''}>
            {/* Plan Name */}
            <h3 className="text-2xl font-bold mb-2 text-foreground">
              {plan.name}
            </h3>

            {/* Price */}
            <div className="mb-6">
              {plan.isContactPlan ? (
                <>
                  <span className="text-4xl font-bold text-purple-600">
                    Contact Sales
                  </span>
                  <p className="text-muted-foreground mt-2 text-sm">Custom volume &amp; pricing</p>
                </>
              ) : (
                <>
                  <span className="text-4xl font-bold text-foreground">
                    {amount}
                  </span>
                  <p className="text-muted-foreground mt-2 text-sm">
                    {plan.candidates} Candidate Evaluation Credits
                  </p>
                </>
              )}
              <p className="text-muted-foreground text-sm">
                {plan.isContactPlan ? 'Custom SLA & Integrations' : `Valid for ${plan.validity}`}
              </p>
            </div>

            {/* CTA Button */}
            {plan.isContactPlan ? (
              <Button
                size="lg"
                className="w-full rounded-lg mb-8 font-semibold bg-purple-600 hover:bg-purple-700 text-white"
                asChild
              >
                <Link to="/contact">
                  <Phone className="h-4 w-4 mr-2" />
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
                Included Features
              </p>
              {plan.features.map((feature, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    isEnterprise ? 'bg-purple-500/20' : 'bg-primary/20'
                  }`}>
                    <Check className={`h-3 w-3 ${isEnterprise ? 'text-purple-500' : 'text-primary'}`} />
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
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-4">
              Choose the perfect plan for your hiring needs. All plans include our core AI-powered assessment features.
            </p>
            {!geoLoading && (
              <p className="text-sm text-muted-foreground">
                Showing {activeCurrency === 'INR' ? 'India (INR ₹)' : 'International (USD $)'} pricing for your location.
              </p>
            )}

            <div className="flex items-center justify-center gap-1.5 mt-4 mb-2 text-xs text-muted-foreground font-semibold bg-muted/50 w-fit mx-auto px-3 py-1.5 rounded-full border border-border/50 shadow-sm">
              <Globe className="h-4 w-4" />
              <span>Currency: </span>
              <button 
                onClick={() => setManualCurrency('USD')}
                className={`px-2 py-0.5 rounded-md transition-colors ${activeCurrency === 'USD' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted-foreground/10'}`}
              >
                USD ($)
              </button>
              <button 
                onClick={() => setManualCurrency('INR')}
                className={`px-2 py-0.5 rounded-md transition-colors ${activeCurrency === 'INR' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted-foreground/10'}`}
              >
                INR (₹)
              </button>
            </div>
            
            {/* Auto-detected pricing loaded in background */}
          </motion.div>

          {/* Individual vs Company Toggle */}
          <div className="flex justify-center mb-10">
            <div className="bg-muted p-1.5 rounded-full flex items-center gap-1 border shadow-sm">
              <Button 
                variant="ghost" 
                onClick={() => setPlanCategory('individual')}
                className={`rounded-full h-10 px-8 text-sm font-semibold transition-colors ${planCategory === 'individual' ? 'bg-background shadow-sm hover:bg-background text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted-foreground/10'}`}
              >
                Individual Plans
              </Button>
              <Button 
                variant="ghost" 
                onClick={() => setPlanCategory('company')}
                className={`rounded-full h-10 px-8 text-sm font-semibold transition-colors flex items-center gap-2 ${planCategory === 'company' ? 'bg-gradient-to-r from-indigo-600 to-purple-600 shadow-md hover:bg-indigo-700 text-white' : 'text-muted-foreground hover:text-foreground hover:bg-muted-foreground/10'}`}
              >
                <Building2 className="h-4 w-4" />
                Company Plans
                <span className={`ml-1 px-1.5 py-0.5 rounded-md text-[10px] uppercase font-bold tracking-wider ${planCategory === 'company' ? 'bg-white/20' : 'bg-purple-500 text-white'}`}>New</span>
              </Button>
            </div>
          </div>

          {/* Loading skeleton while geo-detecting */}
          {geoLoading && manualCurrency === null ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-5 mb-16">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-96 rounded-3xl bg-muted/30 animate-pulse" />
              ))}
            </div>
          ) : planCategory === 'individual' ? (
            <>
              {/* Production Pricing Cards */}
              <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-5 mb-16">
                {productionPlans.map((plan, i) => renderPlanCard(plan, i))}
              </div>
            </>
          ) : (
            <>
              {/* Company Pricing Cards */}
              {companyPlansQuery.isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-16">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-96 rounded-3xl bg-muted/30 animate-pulse border border-border/30" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-16">
                  {companyPlans.map((plan, idx) => {
                    const price = activeCurrency === 'INR' ? plan.price_inr : plan.price_usd;
                    const features = Array.isArray(plan.features) ? plan.features : [];
                    return (
                      <div
                        key={plan.id}
                        className="flex flex-col rounded-[24px] border border-indigo-500/30 bg-indigo-500/5 p-6 transition-all hover:shadow-xl hover:border-indigo-500/60 relative"
                      >
                        {idx === 1 && (
                          <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-violet-600 text-white text-[10px] uppercase tracking-wider font-bold py-0.5 px-3 rounded-full border-none shadow-md">
                            Popular Team Plan
                          </Badge>
                        )}
                        <div className="text-center mb-4 mt-2">
                          <div className="h-10 w-10 rounded-xl bg-indigo-500/15 flex items-center justify-center mx-auto text-indigo-400 mb-3">
                            <Building2 className="h-5 w-5" />
                          </div>
                          <h3 className="text-xl font-extrabold text-foreground">{plan.name}</h3>
                          <div className="mt-3 flex items-baseline justify-center gap-1">
                            <span className="text-3xl font-black">{price > 0 ? formatPrice(price, activeCurrency) : 'Custom'}</span>
                            {price > 0 && <span className="text-xs text-muted-foreground font-medium">/ {plan.validity}</span>}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 mb-6 bg-background/50 p-3 rounded-xl text-center border border-border/40">
                          <div>
                            <div className="text-xl font-bold text-indigo-400">{plan.recruiter_seats}</div>
                            <div className="text-[10px] text-muted-foreground font-medium uppercase mt-0.5">Seats</div>
                          </div>
                          <div>
                            <div className="text-xl font-bold text-indigo-400">{plan.total_credits}</div>
                            <div className="text-[10px] text-muted-foreground font-medium uppercase mt-0.5">Total Credits</div>
                          </div>
                        </div>

                        <ul className="space-y-3 mb-8 flex-1 text-sm text-muted-foreground">
                          {features.map((f, fi) => (
                            <li key={fi} className="flex items-start gap-3">
                              <Check className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />
                              <span>{f}</span>
                            </li>
                          ))}
                        </ul>

                        <Button
                          className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl h-11 shadow-md"
                          asChild
                        >
                          <Link to="/sign-up?type=company">Get Started</Link>
                        </Button>
                      </div>
                    );
                  })}
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
                { q: 'How does Enterprise billing work?', a: 'Enterprise uses the same secure checkout flow as all paid plans, with the highest candidate limits.' },
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
