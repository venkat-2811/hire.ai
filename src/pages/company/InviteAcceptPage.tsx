/**
 * InviteAcceptPage.tsx
 * Route: /join?token=...
 *
 * Handles the recruiter invite flow:
 * 1. Validates the token (calls GET /companies/accept-invite)
 * 2. If user is NOT signed in → shows a branded "You've been invited" screen with Sign In / Sign Up buttons
 * 3. If user IS signed in → auto-calls POST /companies/accept-invite and redirects to /company/dashboard
 */
import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useUser, SignInButton, SignUpButton } from '@clerk/clerk-react';
import { Building2, CheckCircle, Loader2, XCircle, LogIn, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { companyApi } from '@/lib/api';
import { toast } from 'sonner';

type Phase = 'loading' | 'unauthenticated' | 'activating' | 'success' | 'error';

export default function InviteAcceptPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isLoaded, isSignedIn } = useUser();

  const token = searchParams.get('token') ?? '';

  const [phase, setPhase] = useState<Phase>('loading');
  const [companyName, setCompanyName] = useState('');
  const [invitedEmail, setInvitedEmail] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Step 1 — validate token (always, no auth required)
  useEffect(() => {
    if (!token) {
      setErrorMsg('No invite token found in the link. Please use the full link from your email.');
      setPhase('error');
      return;
    }

    companyApi.acceptInviteInfo(token)
      .then((data) => {
        setCompanyName(data.company_name);
        setInvitedEmail(data.invited_email);
        // Don't advance phase yet — wait for auth state
      })
      .catch((err) => {
        setErrorMsg(err?.message ?? 'This invite link is invalid or has expired.');
        setPhase('error');
      });
  }, [token]);

  // Step 2 — once auth state known and token info loaded
  useEffect(() => {
    if (!companyName) return; // token not validated yet
    if (!isLoaded) return;    // clerk not ready

    if (!isSignedIn) {
      setPhase('unauthenticated');
      return;
    }

    // Signed in → activate
    setPhase('activating');
    companyApi.activateInvite(token)
      .then((data) => {
        setPhase('success');
        toast.success(`You've joined ${data.company_name}! ${data.credits_allocated} credits allocated.`);
        setTimeout(() => navigate('/company/dashboard', { replace: true }), 1800);
      })
      .catch((err) => {
        setErrorMsg(err?.message ?? 'Failed to activate invite. Please try again or contact support.');
        setPhase('error');
      });
  }, [companyName, isLoaded, isSignedIn, token, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-sm font-medium mb-4">
            <Building2 className="h-4 w-4" />
            Company Invite
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            {companyName ? `You're invited to join ${companyName}` : 'Checking invite…'}
          </h1>
          {invitedEmail && (
            <p className="text-muted-foreground text-sm mt-2">
              Sent to <span className="font-semibold text-foreground">{invitedEmail}</span>
            </p>
          )}
        </div>

        {/* State cards */}
        <div className="rounded-2xl border border-border/60 bg-card shadow-xl p-8 space-y-6">

          {/* Loading / Validating */}
          {(phase === 'loading') && (
            <div className="flex flex-col items-center gap-3 py-4">
              <Loader2 className="h-10 w-10 animate-spin text-indigo-400" />
              <p className="text-sm text-muted-foreground">Validating your invite link…</p>
            </div>
          )}

          {/* Not signed in */}
          {phase === 'unauthenticated' && (
            <div className="space-y-5">
              <div className="text-center space-y-1">
                <Building2 className="h-12 w-12 mx-auto text-indigo-400 mb-2" />
                <h2 className="text-lg font-bold">{companyName} wants you on their team</h2>
                <p className="text-sm text-muted-foreground">
                  Sign in or create an account to accept this invitation and get started right away.
                  <br />Your seat and credits will be activated automatically.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <SignInButton
                  mode="redirect"
                  redirectUrl={`/join?token=${encodeURIComponent(token)}`}
                >
                  <Button variant="outline" className="w-full gap-2">
                    <LogIn className="h-4 w-4" />
                    Sign In
                  </Button>
                </SignInButton>

                <SignUpButton
                  mode="redirect"
                  redirectUrl={`/join?token=${encodeURIComponent(token)}`}
                >
                  <Button className="w-full gap-2 bg-indigo-600 hover:bg-indigo-500 text-white">
                    <UserPlus className="h-4 w-4" />
                    Sign Up
                  </Button>
                </SignUpButton>
              </div>

              <p className="text-center text-xs text-muted-foreground">
                This invite link is valid for 7 days.
              </p>
            </div>
          )}

          {/* Activating */}
          {phase === 'activating' && (
            <div className="flex flex-col items-center gap-3 py-4">
              <Loader2 className="h-10 w-10 animate-spin text-indigo-400" />
              <p className="text-sm text-muted-foreground">
                Activating your membership at <strong>{companyName}</strong>…
              </p>
            </div>
          )}

          {/* Success */}
          {phase === 'success' && (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <CheckCircle className="h-14 w-14 text-emerald-400" />
              <h2 className="text-lg font-bold text-emerald-400">You're in!</h2>
              <p className="text-sm text-muted-foreground">
                Welcome to <strong>{companyName}</strong>. Redirecting you to your dashboard…
              </p>
            </div>
          )}

          {/* Error */}
          {phase === 'error' && (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <XCircle className="h-12 w-12 text-red-400" />
              <h2 className="text-lg font-bold text-destructive">Invite Failed</h2>
              <p className="text-sm text-muted-foreground">{errorMsg}</p>
              <Button variant="outline" onClick={() => navigate('/')}>Go to Homepage</Button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
