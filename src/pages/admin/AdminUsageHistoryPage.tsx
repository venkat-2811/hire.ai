import { useQuery } from '@tanstack/react-query';
import { adminApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, Loader2 } from 'lucide-react';

export default function AdminUsageHistoryPage() {
  const usageHistoryQuery = useQuery({
    queryKey: ['admin-usage-history'],
    queryFn: () => adminApi.usageHistory(),
  });

  const usageHistory = usageHistoryQuery.data || [];

  return (
    <div className="space-y-6">
      <Card className="border border-border/60 shadow-md bg-card rounded-2xl overflow-hidden">
        <CardHeader className="border-b border-border/50 pb-5 pt-6 px-6 bg-muted/20">
          <CardTitle className="flex items-center gap-2.5 text-lg font-bold text-foreground">
            <div className="p-1.5 rounded-md bg-background border border-border shadow-sm">
              <Activity className="h-4 w-4 text-primary" />
            </div>
            Global Usage History
          </CardTitle>
          <CardDescription className="text-xs font-medium">Detailed breakdown of candidate usage and fractional billing points across all recruiters.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {usageHistoryQuery.isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : usageHistory.length === 0 ? (
            <div className="text-center py-12 px-4">
              <p className="text-sm font-semibold text-foreground">No usage history yet</p>
            </div>
          ) : (
            <div className="max-h-[600px] overflow-y-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead className="sticky top-0 bg-muted border-b border-border/50 z-10">
                  <tr className="text-muted-foreground">
                    <th className="py-3 px-6 text-[11px] font-bold uppercase tracking-wider">Date & Time</th>
                    <th className="py-3 px-6 text-[11px] font-bold uppercase tracking-wider">Recruiter</th>
                    <th className="py-3 px-6 text-[11px] font-bold uppercase tracking-wider">Action</th>
                    <th className="py-3 px-6 text-[11px] font-bold uppercase tracking-wider">Candidate</th>
                    <th className="py-3 px-6 text-[11px] font-bold uppercase tracking-wider">Job Title</th>
                    <th className="py-3 px-6 text-[11px] font-bold uppercase tracking-wider text-right">Points Used</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {usageHistory.map((item) => (
                    <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-6 whitespace-nowrap text-muted-foreground font-medium text-xs">
                        {new Date(item.created_at).toLocaleString()}
                      </td>
                      <td className="py-3 px-6">
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground text-xs">{item.recruiter_name || 'Unknown'}</span>
                          {item.recruiter_email && <span className="text-[10px] text-muted-foreground">{item.recruiter_email}</span>}
                        </div>
                      </td>
                      <td className="py-3 px-6">
                        <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-widest shadow-sm">
                          {item.action_type}
                        </Badge>
                      </td>
                      <td className="py-3 px-6">
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground text-xs">{item.candidate_name || 'Unknown'}</span>
                          {item.candidate_email && <span className="text-[10px] text-muted-foreground">{item.candidate_email}</span>}
                        </div>
                      </td>
                      <td className="py-3 px-6 text-xs text-muted-foreground truncate max-w-[200px]" title={item.job_title || '-'}>
                        {item.job_title || '-'}
                      </td>
                      <td className="py-3 px-6 text-right font-bold font-mono text-xs text-primary">
                        +{Number(item.points_used).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
