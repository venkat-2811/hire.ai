import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, XCircle, Loader2, FileText, Building2, Calendar, DollarSign } from 'lucide-react';
import { toast } from 'sonner';

interface OfferDetails {
  candidate_name: string;
  candidate_email: string;
  job_title: string;
  company_name: string;
  ctc?: string;
  time_period_years?: number;
  time_period_months?: number;
  sent_at: string;
}

export default function OfferAcceptPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [offer, setOffer] = useState<OfferDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signature, setSignature] = useState('');
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Invalid offer link');
      setLoading(false);
      return;
    }

    fetchOfferDetails();
  }, [token]);

  const fetchOfferDetails = async () => {
    try {
      const response = await fetch(`/api/offer-accept/${encodeURIComponent(token)}`);
      
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        if (response.status === 404) {
          setError('Offer letter not found or link has expired');
        } else if (response.status === 400) {
          setError(data.error || 'This offer has already been processed');
        } else {
          setError('Failed to load offer details');
        }
        setLoading(false);
        return;
      }

      const data = await response.json();
      setOffer(data);
      setLoading(false);
    } catch (err) {
      setError('Failed to load offer details. Please try again.');
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!signature.trim()) {
      toast.error('Please enter your full name as your digital signature');
      return;
    }

    if (signature.trim().length < 2) {
      toast.error('Please enter a valid full name');
      return;
    }

    setAccepting(true);
    try {
      const response = await fetch(`/api/offer-accept/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          signature_full_name: signature.trim(),
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to accept offer');
      }

      const data = await response.json();
      toast.success(data.message || 'Offer accepted successfully!');
      setAccepted(true);
    } catch (err: any) {
      toast.error(err.message || 'Failed to accept offer. Please try again.');
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading offer details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <CardTitle className="text-2xl">Offer Not Available</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={() => navigate('/')} variant="outline">
              Return to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (accepted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 via-white to-emerald-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <CardTitle className="text-2xl">Offer Accepted!</CardTitle>
            <CardDescription>
              Thank you for accepting our offer. Our HR team will be in touch shortly with next steps.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm text-green-800">
                <strong>Digital Signature:</strong> {signature}
              </p>
              <p className="text-sm text-green-800 mt-2">
                <strong>Accepted on:</strong> {new Date().toLocaleDateString()}
              </p>
            </div>
            <Button onClick={() => navigate('/')} className="w-full">
              Return to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <Card className="shadow-xl">
          <CardHeader className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-t-lg">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-3xl">Offer Letter</CardTitle>
                <CardDescription className="text-indigo-100 mt-2">
                  {offer?.company_name}
                </CardDescription>
              </div>
              <FileText className="h-12 w-12 text-indigo-200" />
            </div>
          </CardHeader>
          <CardContent className="p-8 space-y-6">
            {/* Candidate Info */}
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-gray-900">Dear {offer?.candidate_name},</h3>
              <p className="text-gray-600">
                We are delighted to extend this formal offer of employment to you for the position of:
              </p>
            </div>

            {/* Job Title Card */}
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-6 text-center">
              <h2 className="text-2xl font-bold text-green-800">{offer?.job_title}</h2>
              <p className="text-green-700 mt-2">{offer?.company_name}</p>
            </div>

            {/* Offer Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {offer?.ctc && (
                <div className="flex items-start space-x-3 p-4 bg-gray-50 rounded-lg">
                  <DollarSign className="h-5 w-5 text-indigo-600 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500">Annual CTC</p>
                    <p className="font-semibold text-gray-900">{offer.ctc}</p>
                  </div>
                </div>
              )}
              
              {(offer?.time_period_years || offer?.time_period_months) && (
                <div className="flex items-start space-x-3 p-4 bg-gray-50 rounded-lg">
                  <Calendar className="h-5 w-5 text-indigo-600 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500">Notice Period</p>
                    <p className="font-semibold text-gray-900">
                      {offer.time_period_years && `${offer.time_period_years} year${offer.time_period_years > 1 ? 's' : ''}`}
                      {offer.time_period_years && offer.time_period_months && ' and '}
                      {offer.time_period_months && `${offer.time_period_months} month${offer.time_period_months > 1 ? 's' : ''}`}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-start space-x-3 p-4 bg-gray-50 rounded-lg">
                <Building2 className="h-5 w-5 text-indigo-600 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">Company</p>
                  <p className="font-semibold text-gray-900">{offer?.company_name}</p>
                </div>
              </div>

              <div className="flex items-start space-x-3 p-4 bg-gray-50 rounded-lg">
                <Calendar className="h-5 w-5 text-indigo-600 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">Offer Sent On</p>
                  <p className="font-semibold text-gray-900">
                    {offer?.sent_at ? new Date(offer.sent_at).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
              </div>
            </div>

            {/* Terms */}
            <div className="space-y-3 text-gray-600">
              <p>
                This offer is contingent upon the successful completion of background verification and any other standard onboarding requirements.
              </p>
              <p>
                Our HR team will be in touch shortly with further details regarding your start date, complete compensation package, benefits, and onboarding process.
              </p>
            </div>

            {/* Digital Signature Section */}
            <div className="border-t pt-6 space-y-4">
              <div>
                <Label htmlFor="signature" className="text-base font-semibold">
                  Digital Signature *
                </Label>
                <p className="text-sm text-gray-500 mt-1">
                  Enter your full name to accept this offer
                </p>
              </div>
              <Input
                id="signature"
                type="text"
                placeholder="John Doe"
                value={signature}
                onChange={(e) => setSignature(e.target.value)}
                className="text-lg"
                disabled={accepting}
              />
              <Button
                onClick={handleAccept}
                disabled={accepting || !signature.trim()}
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white py-6 text-lg font-semibold"
                size="lg"
              >
                {accepting ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-5 w-5" />
                    Accept Offer Letter
                  </>
                )}
              </Button>
              <p className="text-xs text-gray-500 text-center">
                By clicking "Accept Offer Letter", you confirm that you have read and understood the terms of this offer.
              </p>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-gray-500 mt-6">
          If you have any questions, please contact our HR team.
        </p>
      </div>
    </div>
  );
}

export default OfferAcceptPage;
