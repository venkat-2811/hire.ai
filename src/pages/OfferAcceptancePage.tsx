/**
 * OfferAcceptancePage — Public page for candidates to review and digitally accept an offer letter.
 * Accessed via the "Accept Offer" button in the offer email.
 * URL: /offer-acceptance?token=<jwt>
 */
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertCircle, Loader2, Building2, Briefcase, DollarSign, Calendar, MapPin, Clock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const API_BASE_URL = '/api';

interface OfferDetails {
  candidate_id: string;
  job_id: string;
  candidate_name: string;
  candidate_email?: string;
  job_title: string;
  company_name: string;
  ctc: string;
  time_period_years?: number | null;
  time_period_months?: number | null;
  start_date?: string | null;
  reporting_manager?: string | null;
  location?: string | null;
  accepted_signature_name?: string | null;
  accepted_at?: string | null;
  already_accepted: boolean;
}

export default function OfferAcceptancePage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offer, setOffer] = useState<OfferDetails | null>(null);
  const [fullNameInput, setFullNameInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('No offer token found in this link. Please use the link from your email.');
      setLoading(false);
      return;
    }

    async function fetchOffer() {
      try {
        const res = await fetch(`${API_BASE_URL}/candidates/offer-details?token=${encodeURIComponent(token!)}`);
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail || 'This offer link is invalid or has expired.');
        }
        const data: OfferDetails = await res.json();
        setOffer(data);
        if (data.already_accepted) {
          setAccepted(true);
        }
      } catch (e: any) {
        setError(e.message || 'Failed to load offer details.');
      } finally {
        setLoading(false);
      }
    }

    fetchOffer();
  }, [token]);

  const handleSubmitAcceptance = async () => {
    if (!fullNameInput.trim()) {
      toast.error('Please enter your full name as a digital signature.');
      return;
    }
    if (!offer) return;

    // Loose name match — must contain at least 2 words matching candidate name words
    const inputWords = fullNameInput.trim().toLowerCase().split(/\s+/);
    const nameWords = offer.candidate_name.toLowerCase().split(/\s+/);
    const matchCount = inputWords.filter(w => nameWords.includes(w)).length;
    if (matchCount < Math.min(2, nameWords.length)) {
      toast.error('Your name does not match the name on record. Please enter your full legal name.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/candidates/submit-offer-acceptance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          full_name_signature: fullNameInput.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to submit acceptance.');
      }

      setAccepted(true);
      toast.success('Your offer has been accepted. Welcome aboard! 🎉');
    } catch (e: any) {
      toast.error(e.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Build time period display string
  const timePeriodDisplay = (() => {
    if (!offer) return null;
    const parts: string[] = [];
    if (offer.time_period_years && offer.time_period_years > 0) {
      parts.push(`${offer.time_period_years} Year${offer.time_period_years > 1 ? 's' : ''}`);
    }
    if (offer.time_period_months && offer.time_period_months > 0) {
      parts.push(`${offer.time_period_months} Month${offer.time_period_months > 1 ? 's' : ''}`);
    }
    return parts.length > 0 ? parts.join(' & ') : null;
  })();

  // ─── Loading State ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center">
          <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
          <p className="text-muted-foreground font-medium">Loading your offer details…</p>
        </div>
      </div>
    );
  }

  // ─── Error State ──────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-rose-50 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white rounded-2xl shadow-xl p-10 text-center"
        >
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">Invalid or Expired Link</h1>
          <p className="text-gray-500 leading-relaxed">{error}</p>
          <p className="text-sm text-gray-400 mt-4">Please contact your recruiter for assistance.</p>
        </motion.div>
      </div>
    );
  }

  // ─── Already Accepted State ───────────────────────────────────────────────
  if (accepted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          className="max-w-md w-full bg-white rounded-2xl shadow-xl p-10 text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 300 }}
            className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6"
          >
            <CheckCircle className="h-10 w-10 text-emerald-500" />
          </motion.div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome Aboard! 🎉</h1>
          <p className="text-lg text-gray-600 mb-4">
            {offer?.candidate_name ? `Congratulations, ${offer.candidate_name.split(' ')[0]}!` : 'Congratulations!'}
          </p>
          <p className="text-gray-500 leading-relaxed">
            Your offer for <strong>{offer?.job_title}</strong> at <strong>{offer?.company_name}</strong> has been
            officially accepted. Your digital signature has been recorded.
          </p>
          <p className="text-gray-500 mt-4 leading-relaxed">
            Our HR team will reach out to you shortly with onboarding details and next steps. 🚀
          </p>
          <div className="mt-8 p-4 bg-emerald-50 rounded-xl border border-emerald-100">
            <p className="text-emerald-700 text-sm font-medium">✅ Acceptance Digitally Recorded</p>
          </div>
        </motion.div>
      </div>
    );
  }

  // ─── Main Offer Page ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* Header band */}
      <div className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white py-8 px-6 text-center shadow-lg">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <p className="text-indigo-200 text-sm uppercase tracking-widest mb-1 font-medium">
            Offer of Employment
          </p>
          <h1 className="text-4xl font-extrabold tracking-tight">{offer?.company_name}</h1>
          <p className="text-indigo-200 mt-2 text-base">Talent Acquisition &amp; People Operations</p>
        </motion.div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">

        {/* Greeting */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl shadow-sm border border-indigo-100 p-8 text-center"
        >
          <div className="text-5xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Congratulations, {offer?.candidate_name?.split(' ')[0]}!
          </h2>
          <p className="text-gray-500 leading-relaxed">
            We are pleased to present you with this formal offer of employment for the position of{' '}
            <strong className="text-indigo-700">{offer?.job_title}</strong> at{' '}
            <strong className="text-indigo-700">{offer?.company_name}</strong>.{' '}
            Please review the details below carefully before accepting.
          </p>
        </motion.div>

        {/* Offer Details Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
        >
          <div className="bg-gradient-to-r from-indigo-50 to-violet-50 px-6 py-4 border-b border-indigo-100">
            <h3 className="font-bold text-indigo-900 text-base">📋 Offer Details</h3>
          </div>
          <div className="divide-y divide-gray-50">
            <OfferRow
              icon={<Briefcase className="h-4 w-4 text-indigo-500" />}
              label="Position"
              value={offer?.job_title || '—'}
            />
            <OfferRow
              icon={<Building2 className="h-4 w-4 text-indigo-500" />}
              label="Company"
              value={offer?.company_name || '—'}
            />
            <OfferRow
              icon={<DollarSign className="h-4 w-4 text-emerald-500" />}
              label="Annual CTC"
              value={offer?.ctc || '—'}
              highlight
            />
            {offer?.start_date && (
              <OfferRow
                icon={<Calendar className="h-4 w-4 text-indigo-500" />}
                label="Proposed Start Date"
                value={offer.start_date}
              />
            )}
            {offer?.location && (
              <OfferRow
                icon={<MapPin className="h-4 w-4 text-indigo-500" />}
                label="Location"
                value={offer.location}
              />
            )}
            {offer?.reporting_manager && (
              <OfferRow
                icon={<Briefcase className="h-4 w-4 text-indigo-500" />}
                label="Reporting Manager"
                value={offer.reporting_manager}
              />
            )}
            {timePeriodDisplay && (
              <OfferRow
                icon={<Clock className="h-4 w-4 text-indigo-500" />}
                label="Contract Duration"
                value={timePeriodDisplay}
              />
            )}
            <OfferRow
              icon={<Briefcase className="h-4 w-4 text-gray-400" />}
              label="Employment Type"
              value="Full-Time, Permanent"
            />
          </div>
        </motion.div>

        {/* Terms note */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-amber-50 border border-amber-200 rounded-xl px-6 py-4 text-sm text-amber-800 leading-relaxed"
        >
          <p>
            <strong>📎 Note:</strong> The full offer letter document with all terms and conditions (benefits,
            probationary period, confidentiality clauses, etc.) was attached to the email. Please ensure
            you have reviewed that document before accepting.
          </p>
        </motion.div>

        {/* Signature & Accept Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8"
        >
          <h3 className="text-lg font-bold text-gray-900 mb-1">✍️ Digital Signature</h3>
          <p className="text-gray-500 text-sm mb-6 leading-relaxed">
            By typing your full legal name below and clicking <strong>Submit Acceptance</strong>, you confirm
            that you have read and agree to all terms in this offer letter. This serves as your
            legally binding digital signature.
          </p>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="signature" className="text-sm font-semibold text-gray-700">
                Type Your Full Name *
              </Label>
              <Input
                id="signature"
                placeholder={`e.g. ${offer?.candidate_name || 'Your Full Name'}`}
                value={fullNameInput}
                onChange={(e) => setFullNameInput(e.target.value)}
                className="text-lg font-medium h-12 border-2 focus:border-indigo-400"
                onKeyDown={(e) => e.key === 'Enter' && handleSubmitAcceptance()}
              />
              <p className="text-xs text-gray-400">
                Must match the name on your offer: <strong>{offer?.candidate_name}</strong>
              </p>
            </div>

            <Button
              onClick={handleSubmitAcceptance}
              disabled={submitting || !fullNameInput.trim()}
              className="w-full h-13 text-base font-bold bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-lg shadow-emerald-500/30 transition-all duration-200"
              size="lg"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Submitting…
                </>
              ) : (
                '✅ Submit Acceptance'
              )}
            </Button>

            <p className="text-xs text-center text-gray-400">
              Your acceptance will be digitally recorded with a timestamp and IP address for verification.
            </p>
          </div>
        </motion.div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 pb-8">
          © {new Date().getFullYear()} {offer?.company_name}. This offer is confidential and intended solely for {offer?.candidate_name}.
        </p>
      </div>
    </div>
  );
}

// ─── Helper sub-component ─────────────────────────────────────────────────────
function OfferRow({
  icon,
  label,
  value,
  highlight = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center gap-4 px-6 py-4">
      <div className="shrink-0 w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{label}</p>
        <p className={`font-semibold mt-0.5 ${highlight ? 'text-emerald-700 text-lg' : 'text-gray-900'}`}>
          {value}
        </p>
      </div>
    </div>
  );
}
