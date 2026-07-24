import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useUser, useAuth } from '@clerk/clerk-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Building2, CheckCircle2, XCircle } from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import { apiRequest } from '@/lib/api';
import { toast } from 'sonner';

export default function InviteAcceptPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const { isLoaded: userLoaded, isSignedIn, user } = useUser();
  const { isLoaded: authLoaded } = useAuth();
  
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Processing your invitation...');
  const [companyId, setCompanyId] = useState<string | null>(null);

  // Initial check - save token if not signed in
  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Invalid or missing invitation link.');
      return;
    }

    if (!userLoaded || !authLoaded) return;

    if (!isSignedIn) {
      // User is not signed in. Save token so we can redirect them back here after sign up
      sessionStorage.setItem('pending_invite_token', token);
      
      // Redirect to sign-up, passing this URL as redirect
      navigate(`/sign-up?redirect_url=${encodeURIComponent(`/accept-invite?token=${token}`)}`);
      return;
    }

    // User is signed in! Let's accept the invite
    acceptInvite(token);
  }, [token, userLoaded, authLoaded, isSignedIn, navigate]);

  const acceptInvite = async (inviteToken: string) => {
    try {
      const res = await apiRequest<any>('/companies/accept-invite', { 
        method: 'POST', 
        body: { token: inviteToken } 
      });
      
      if (res.action === 'already_active' || res.action === 'activated' || res.action === 'joined') {
        setStatus('success');
        setCompanyId(res.company_id);
        setMessage('You have successfully joined the company!');
        sessionStorage.removeItem('pending_invite_token');
        
        // Auto redirect after a brief delay
        setTimeout(() => {
          navigate('/company/dashboard');
        }, 2000);
      } else {
        setStatus('error');
        setMessage(res.error || 'Failed to accept invitation.');
      }
    } catch (err: any) {
      setStatus('error');
      setMessage(err.message || 'An error occurred while accepting the invitation.');
      toast.error('Invitation Failed', { description: err.message });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-32 pb-20 px-4 flex items-center justify-center">
        <Card className="w-full max-w-md shadow-lg border-primary/20 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-purple-500" />
          <CardHeader className="text-center pt-8">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold">Company Invitation</CardTitle>
            <CardDescription>
              {status === 'loading' ? 'Setting up your recruiter account...' : 'Invitation Status'}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center text-center pb-8">
            {status === 'loading' && (
              <div className="flex flex-col items-center gap-4 text-muted-foreground mt-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p>{message}</p>
              </div>
            )}
            
            {status === 'success' && (
              <div className="flex flex-col items-center gap-4 mt-4">
                <CheckCircle2 className="h-16 w-16 text-emerald-500 mb-2" />
                <h3 className="text-xl font-semibold text-emerald-600">Invitation Accepted!</h3>
                <p className="text-muted-foreground text-sm max-w-[250px]">{message}</p>
                <p className="text-xs text-muted-foreground mt-2 animate-pulse">Redirecting to your dashboard...</p>
                <Button className="mt-4 w-full" onClick={() => navigate('/company/dashboard')}>
                  Go to Dashboard Now
                </Button>
              </div>
            )}
            
            {status === 'error' && (
              <div className="flex flex-col items-center gap-4 mt-4">
                <XCircle className="h-16 w-16 text-destructive mb-2" />
                <h3 className="text-xl font-semibold text-destructive">Error</h3>
                <p className="text-muted-foreground text-sm">{message}</p>
                <Button variant="outline" className="mt-4 w-full" onClick={() => navigate('/dashboard')}>
                  Return Home
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
