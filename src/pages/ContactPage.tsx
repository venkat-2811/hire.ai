import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Mail, Send, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Footer from '@/components/layout/Footer';
import Navbar from '@/components/layout/Navbar';
import { useCountryDetection } from '@/hooks/useCountryDetection';

const ContactPage = () => {
  const { toast } = useToast();
  const { isIndia } = useCountryDetection();
  const [isFirstVisit, setIsFirstVisit] = useState(true);

  useEffect(() => {
    const visited = sessionStorage.getItem('rekshift_visited_contact');
    if (visited) {
      setIsFirstVisit(false);
    } else {
      sessionStorage.setItem('rekshift_visited_contact', 'true');
    }
  }, []);

  const [formData, setFormData] = useState({
    fullName: '',
    companyName: '',
    email: '',
    phone: '',
    subject: '',
    message: '',
  });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    // Validation
    if (!formData.fullName.trim() || !formData.email.trim() || !formData.message.trim()) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields (Name, Email, Message)",
        variant: "destructive",
      });
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    // Phone validation (if provided)
    if (formData.phone && !/^[\d+\-\s()]+$/.test(formData.phone)) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid phone number",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/v1/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        const errorMessage = errorBody?.detail || 'Failed to send message';
        throw new Error(errorMessage);
      }

      setSubmitted(true);
      setFormData({
        fullName: '',
        companyName: '',
        email: '',
        phone: '',
        subject: '',
        message: '',
      });

      toast({
        title: "Success!",
        description: "We've received your message and will get back to you soon.",
      });

      // Reset submitted state after 5 seconds
      setTimeout(() => setSubmitted(false), 5000);
    } catch (error) {
      console.error('Contact form error:', error);
      toast({
        title: "Error",
        description: "Failed to send your message. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <Navbar />

      {/* Contact Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="container mx-auto max-w-6xl">
          {/* Header */}
          <motion.div
            initial={isFirstVisit ? { opacity: 0, y: 20 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-16"
          >
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6">Get in Touch</h1>
            <div className="text-lg text-muted-foreground max-w-2xl mx-auto space-y-4 leading-relaxed">
              <p>Have a question or need assistance?</p>
              <p>Our team is here to help.</p>
              <p>We typically respond within 24 business hours.</p>
              <p>
                E-mail us at{" "}
                <a href="mailto:admin@rekshift.com" className="text-primary hover:underline font-medium">
                  admin@rekshift.com
                </a>
              </p>
            </div>
          </motion.div>

          <div className="grid md:grid-cols-1 gap-8 mb-16">
            {/* Contact Info Card */}
            <motion.div
              initial={isFirstVisit ? { opacity: 0, y: 20 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: isFirstVisit ? 0.1 : 0 }}
              className="bg-card border rounded-2xl p-8 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Mail className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Email</h3>
                  <p className="text-sm text-muted-foreground">We'll respond within 24 hours</p>
                </div>
              </div>
              <a href="mailto:admin@rekshift.com" className="text-lg font-semibold text-primary hover:text-primary/80 transition-colors break-all">
                admin@rekshift.com
              </a>
            </motion.div>
          </div>

          {/* Contact Form */}
          <motion.div
            initial={isFirstVisit ? { opacity: 0, y: 20 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: isFirstVisit ? 0.4 : 0 }}
            className="bg-card border rounded-3xl p-8 md:p-12 max-w-3xl mx-auto"
          >
            <h2 className="text-2xl font-bold text-foreground mb-8">Send us a Message</h2>

            {submitted && (
              <div className="mb-8 p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-green-900 dark:text-green-100">Message Sent!</h3>
                  <p className="text-sm text-green-800 dark:text-green-200">Thank you for contacting us. We'll get back to you soon.</p>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="fullName" className="block text-sm font-medium text-foreground mb-2">
                    Full Name *
                  </label>
                  <Input
                    id="fullName"
                    name="fullName"
                    type="text"
                    value={formData.fullName}
                    onChange={handleChange}
                    placeholder="John Doe"
                    required
                    className="rounded-lg"
                  />
                </div>
                <div>
                  <label htmlFor="companyName" className="block text-sm font-medium text-foreground mb-2">
                    Company Name
                  </label>
                  <Input
                    id="companyName"
                    name="companyName"
                    type="text"
                    value={formData.companyName}
                    onChange={handleChange}
                    placeholder="Your Company"
                    className="rounded-lg"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-foreground mb-2">
                    Email Address *
                  </label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="john@example.com"
                    required
                    className="rounded-lg"
                  />
                </div>
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-foreground mb-2">
                    Phone Number
                  </label>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder={isIndia ? "+91 98765 43210" : "+1 (555) 000-0000"}
                    className="rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="subject" className="block text-sm font-medium text-foreground mb-2">
                  Subject
                </label>
                <Input
                  id="subject"
                  name="subject"
                  type="text"
                  value={formData.subject}
                  onChange={handleChange}
                  placeholder="How can we help?"
                  className="rounded-lg"
                />
              </div>

              <div>
                <label htmlFor="message" className="block text-sm font-medium text-foreground mb-2">
                  Message *
                </label>
                <Textarea
                  id="message"
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  placeholder="Tell us more about your inquiry..."
                  rows={6}
                  required
                  className="rounded-lg resize-none"
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg h-11 font-semibold"
              >
                {loading ? (
                  <>
                    <span className="animate-spin mr-2">⏳</span>
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send Message
                  </>
                )}
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                We respect your privacy. Your information will only be used to respond to your inquiry.
              </p>
            </form>
          </motion.div>

          {/* Additional Info */}
          <motion.div
            initial={isFirstVisit ? { opacity: 0, y: 20 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: isFirstVisit ? 0.5 : 0 }}
            className="mt-16 grid md:grid-cols-4 gap-6"
          >
            {[
              { title: "Product Demos", desc: "See how Rekshift can transform your hiring" },
              { title: "Enterprise Plans", desc: "Custom solutions for large organizations" },
              { title: "Technical Support", desc: "Get help with integration and setup" },
              { title: "Partnerships", desc: "Explore partnership opportunities" },
            ].map((item, i) => (
              <div key={i} className="text-center">
                <h3 className="font-semibold text-foreground mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="py-16 px-4 bg-muted/30 border-t">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-3xl font-bold text-foreground mb-4">Ready to Transform Your Hiring?</h2>
          <p className="text-muted-foreground mb-8">Start with our free plan or schedule a demo today.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" variant="outline" asChild className="rounded-full">
              <Link to="/pricing">View Pricing</Link>
            </Button>
            <Button size="lg" asChild className="rounded-full">
              <Link to="/sign-up">Get Started Free</Link>
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default ContactPage;
