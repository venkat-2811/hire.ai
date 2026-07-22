import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { companyApi } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Building2, Search, Loader2, ArrowRight, CheckCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';

export function JoinCompanySection({ onContinue }: { onContinue: () => void }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedTerm, setDebouncedTerm] = useState('');
  const [requestPending, setRequestPending] = useState<{ companyName: string } | null>(null);

  // Debounce search
  import('react').then(React => {
    React.useEffect(() => {
      const timer = setTimeout(() => setDebouncedTerm(searchTerm), 500);
      return () => clearTimeout(timer);
    }, [searchTerm]);
  });

  const searchQuery = useQuery({
    queryKey: ['company-search', debouncedTerm],
    queryFn: () => companyApi.search(debouncedTerm),
    enabled: debouncedTerm.length > 1,
  });

  const joinMutation = useMutation({
    mutationFn: (companyId: string) => companyApi.joinRequest({ company_id: companyId }),
    onSuccess: (data) => {
      setRequestPending({ companyName: data.company_name });
      toast.success(`Join request sent to ${data.company_name}`);
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to send join request');
    },
  });

  if (requestPending) {
    return (
      <Card className="border-indigo-500/30 bg-indigo-500/5">
        <CardContent className="pt-6 text-center space-y-4">
          <div className="h-12 w-12 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto">
            <Clock className="h-6 w-6 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold">Request Pending</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Your request to join <strong>{requestPending.companyName}</strong> has been sent to the owner.
              You will receive an email once it is approved.
            </p>
          </div>
          <div className="text-xs text-muted-foreground">
            Want to start immediately with your own plan?
          </div>
          <Button variant="outline" onClick={onContinue}>
            Continue Independently
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Building2 className="h-4 w-4 text-indigo-400" />
          Join an Existing Company
        </CardTitle>
        <CardDescription className="text-xs">
          If your company already uses Rekshift, search for them here to request a seat.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search company name..."
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {debouncedTerm.length > 1 && (
          <div className="space-y-2 max-h-[200px] overflow-auto rounded-md border border-border/50 bg-background/50 p-2">
            {searchQuery.isLoading ? (
              <div className="flex justify-center p-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : searchQuery.data?.results?.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-4">
                No companies found matching "{debouncedTerm}"
              </div>
            ) : (
              searchQuery.data?.results?.map((co) => (
                <div key={co.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 transition-colors">
                  <div>
                    <div className="text-sm font-semibold">{co.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {co.seats_total - co.seats_used} seats available
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-7 text-xs"
                    disabled={co.seats_used >= co.seats_total || joinMutation.isPending}
                    onClick={() => joinMutation.mutate(co.id)}
                  >
                    {joinMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                    Request to Join
                  </Button>
                </div>
              ))
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
