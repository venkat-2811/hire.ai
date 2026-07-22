import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Landing page for email approve/reject token links.
 * URL: /company/action?token=...
 *
 * The token is sent to the backend which validates + performs the action.
 * No login required — the HMAC token authenticates the owner.
 */
export default function EmailApprovalLandingPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') ?? '';
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'expired'>('loading');
  const [result, setResult] = useState<{ action?: string; company_name?: string; recruiter_name?: string; error?: string } | null>(null);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setResult({ error: 'No token provided.' });
      return;
    }

    // Extract company_id from token (format: company_id:member_id:action:expires:sig)
    const parts = token.split(':');
    if (parts.length < 5) {
      setStatus('error');
      setResult({ error: 'Invalid token format.' });
      return;
    }
    const company_id = parts[0];

    // Call the backend action endpoint
    fetch(`/api/v2/companies/${company_id}/action?token=${encodeURIComponent(token)}`, { method: 'GET' })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (r.ok && data.ok) {
          setStatus('success');
          setResult(data);
        } else if (r.status === 400) {
          setStatus('expired');
          setResult({ error: data.error || 'Token expired or invalid.' });
        } else {
          setStatus('error');
          setResult({ error: data.error || 'Something went wrong.' });
        }
      })
      .catch(() => {
        setStatus('error');
        setResult({ error: 'Network error. Please try again.' });
      });
  }, [token]);

  const isApprove = result?.action === 'approved';

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border/50">
        <CardHeader className="text-center pb-4">
          <div className="flex justify-center mb-4">
            <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
              <Building2 className="h-6 w-6 text-indigo-400" />
            </div>
          </div>
          <div className="text-lg font-bold">Rekshift</div>
        </CardHeader>
        <CardContent className="space-y-6 text-center">
          {status === 'loading' && (
            <>
              <Loader2 className="h-10 w-10 animate-spin text-indigo-400 mx-auto" />
              <p className="text-sm text-muted-foreground">Processing your request…</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className={`h-14 w-14 rounded-full mx-auto flex items-center justify-center ${isApprove ? 'bg-emerald-500/15' : 'bg-red-500/15'}`}>
                {isApprove
                  ? <CheckCircle className="h-8 w-8 text-emerald-400" />
                  : <XCircle className="h-8 w-8 text-red-400" />
                }
              </div>
              <div>
                <h2 className="text-xl font-extrabold">
                  {isApprove ? 'Request Approved!' : 'Request Rejected'}
                </h2>
                <p className="text-sm text-muted-foreground mt-2">
                  {isApprove
                    ? `${result?.recruiter_name ?? 'The recruiter'} has been approved and a confirmation email was sent.`
                    : `${result?.recruiter_name ?? 'The recruiter'}'s request has been rejected.`
                  }
                </p>
                {result?.company_name && (
                  <p className="text-xs text-muted-foreground mt-1">Company: <span className="font-semibold text-foreground">{result.company_name}</span></p>
                )}
              </div>
              <Button className="w-full" onClick={() => navigate('/company/dashboard')}>
                Go to Company Dashboard
              </Button>
            </>
          )}

          {(status === 'error' || status === 'expired') && (
            <>
              <div className="h-14 w-14 rounded-full bg-red-500/15 mx-auto flex items-center justify-center">
                <XCircle className="h-8 w-8 text-red-400" />
              </div>
              <div>
                <h2 className="text-xl font-extrabold">
                  {status === 'expired' ? 'Link Expired' : 'Something Went Wrong'}
                </h2>
                <p className="text-sm text-muted-foreground mt-2">
                  {result?.error ?? 'This link is no longer valid. Please manage requests from your Company Dashboard.'}
                </p>
              </div>
              <Button className="w-full" onClick={() => navigate('/company/dashboard')}>
                Manage from Dashboard
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
