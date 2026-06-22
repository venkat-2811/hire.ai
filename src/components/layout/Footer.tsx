import { Link } from 'react-router-dom';
import logoIcon from '@/assets/logo.png';
import { Linkedin, Mail, ArrowUpRight } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-card text-card-foreground border-t border-border/60 py-8 px-6 mt-auto">
      <div className="container mx-auto max-w-7xl">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          
          {/* Brand Column */}
          <div className="space-y-4">
            <Link to="/" className="flex items-center gap-2.5 w-fit">
              <img 
                src={logoIcon} 
                alt="Rekshift" 
                className="h-7 w-7 object-contain filter drop-shadow" 
                draggable={false} 
              />
              <span className="font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/80 text-xl">
                Rekshift
              </span>
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
              Enterprise-grade talent assessment platform powered by explainable AI. Screen resumes, run proctored assessments, and hire with confidence.
            </p>
          </div>

          {/* Quick Links Column */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold uppercase tracking-wider text-foreground/90">
              Quick Navigation
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 group">
                  Home
                  <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              </li>
              <li>
                <Link to="/pricing" className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 group">
                  Pricing
                  <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              </li>
              <li>
                <Link to="/onboarding" className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 group">
                  AI Training
                  <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              </li>
              <li>
                <Link to="/contact" className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 group">
                  Contact
                  <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact Details Column */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold uppercase tracking-wider text-foreground/90">
              Contact Us
            </h4>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p className="leading-relaxed">
                Have questions or need enterprise integrations? Get in touch with our team.
              </p>
              <a 
                href="mailto:admin@rekshift.com" 
                className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
              >
                <Mail className="h-4 w-4" />
                admin@rekshift.com
              </a>
            </div>
          </div>

          {/* Social Links Column */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold uppercase tracking-wider text-foreground/90">
              Connect With Us
            </h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Follow us on social media for the latest product updates and insights.
            </p>
            <div className="flex items-center gap-3">
              <a 
                href="https://linkedin.com" 
                target="_blank" 
                rel="noreferrer" 
                className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-all"
                aria-label="LinkedIn"
              >
                <Linkedin className="h-4 w-4" />
              </a>
            </div>
          </div>

        </div>

        <div className="border-t border-border/60 mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <p>
            © 2026 Rekshift. All rights reserved. <span className="mx-2">|</span> Powered by <a href="https://bvitsolutions.com" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors font-semibold">BVIT Solutions</a>
          </p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-foreground transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-foreground transition-colors">Terms of Service</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
