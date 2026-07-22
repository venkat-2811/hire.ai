import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi, type AdminCompany, type CompanyMember, type CompanyCredits, type SubscriptionHistoryEntry } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Building2, ChevronDown, ChevronUp, Users, CreditCard, UserPlus, FileText, Trophy } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

function CompanyRow({ company }: { company: AdminCompany }) {
  const [expanded, setExpanded] = useState(false);

  const detailQuery = useQuery({
    queryKey: ['admin-company-detail', company.id],
    queryFn: () => adminApi.getCompany(company.id),
    enabled: expanded,
    staleTime: 60_000,
  });

  const creditPct = (company.total_credits ?? 0) > 0
    ? Math.min(100, (company.credits_consumed / (company.total_credits ?? 1)) * 100)
    : 0;
  const seatPct = company.seats_total > 0 ? (company.seats_used / company.seats_total) * 100 : 0;

  const statusBadge = company.status === 'active'
    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
    : 'bg-red-500/10 text-red-400 border-red-500/30';

  return (
    <>
      <TableRow
        className="hover:bg-muted/20 cursor-pointer border-border/40"
        onClick={() => setExpanded(e => !e)}
      >
        <TableCell className="font-medium">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
              {company.name[0].toUpperCase()}
            </div>
            <div>
              <div className="text-sm font-semibold">{company.name}</div>
              <div className="text-xs text-muted-foreground">{company.owner_email}</div>
            </div>
          </div>
        </TableCell>
        <TableCell>
          <Badge variant="outline" className={`text-xs ${statusBadge}`}>{company.status}</Badge>
        </TableCell>
        <TableCell className="text-xs">{company.plan_name ?? '—'}</TableCell>
        <TableCell>
          <div className="space-y-1 min-w-[100px]">
            <div className="flex justify-between text-xs">
              <span>{company.seats_used}/{company.seats_total}</span>
              <span className="text-muted-foreground">{Math.round(seatPct)}%</span>
            </div>
            <Progress value={seatPct} className="h-1" />
          </div>
        </TableCell>
        <TableCell>
          <div className="space-y-1 min-w-[100px]">
            <div className="flex justify-between text-xs">
              <span>{company.credits_consumed.toFixed(0)}/{company.total_credits ?? 0}</span>
              <span className="text-muted-foreground">{Math.round(creditPct)}%</span>
            </div>
            <Progress value={creditPct} className="h-1" />
          </div>
        </TableCell>
        <TableCell className="text-center text-sm font-semibold">{company.total_candidates}</TableCell>
        <TableCell className="text-center text-sm font-semibold">{company.total_assessments}</TableCell>
        <TableCell className="text-center text-sm font-semibold">{company.total_interviews}</TableCell>
        <TableCell className="text-center">
          <Badge variant="outline" className="bg-yellow-500/10 text-yellow-400 border-yellow-500/30 text-xs">
            {company.total_hires} 🏆
          </Badge>
        </TableCell>
        <TableCell className="text-xs text-muted-foreground">
          {new Date(company.created_at).toLocaleDateString()}
        </TableCell>
        <TableCell>
          <Button variant="ghost" size="icon" className="h-7 w-7">
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </Button>
        </TableCell>
      </TableRow>

      {expanded && (
        <TableRow className="bg-muted/5 border-b border-border/30">
          <TableCell colSpan={11} className="p-4">
            {detailQuery.isLoading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : detailQuery.data ? (
              <div className="space-y-3">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Member Hierarchy</div>
                <div className="space-y-2">
                  {(detailQuery.data.members as CompanyMember[]).filter(m => m.status !== 'removed').map(m => (
                    <div key={m.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-background/60 border border-border/30">
                      <div className="h-7 w-7 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">
                        {(m.name || 'U')[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold">{m.name || 'Unknown'}</div>
                        <div className="text-xs text-muted-foreground">{m.email}</div>
                      </div>
                      <Badge variant="outline" className="text-[10px] capitalize">{m.role === 'owner' ? '👑 Owner' : m.role}</Badge>
                      <div className="text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">{m.credits_consumed?.toFixed(1)}</span>/{m.credits_allocated} credits
                      </div>
                      <div className="flex gap-3 text-xs text-muted-foreground">
                        <span>👤 {m.candidates_added}</span>
                        <span>📋 {m.assessments_sent}</span>
                        <span>💬 {m.interviews_sent}</span>
                        <span>🏆 {m.hires}</span>
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${m.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-muted text-muted-foreground'}`}
                      >
                        {m.status}
                      </Badge>
                    </div>
                  ))}
                  {(detailQuery.data.members as CompanyMember[]).filter(m => m.status !== 'removed').length === 0 && (
                    <div className="text-xs text-muted-foreground">No members.</div>
                  )}
                </div>
              </div>
            ) : null}
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

export default function AdminCompaniesPage() {
  const companiesQuery = useQuery({
    queryKey: ['admin-companies'],
    queryFn: () => adminApi.companies({ limit: 100 }),
    refetchInterval: 60_000,
  });

  const companies = companiesQuery.data?.companies ?? [];
  const total = companiesQuery.data?.total ?? 0;

  const totalSeats = companies.reduce((s, c) => s + c.seats_total, 0);
  const totalSeatsUsed = companies.reduce((s, c) => s + c.seats_used, 0);
  const totalCandidates = companies.reduce((s, c) => s + c.total_candidates, 0);
  const totalHires = companies.reduce((s, c) => s + c.total_hires, 0);

  return (
    <div className="space-y-6">
      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Companies', value: total, icon: <Building2 className="h-4 w-4" />, color: 'text-indigo-400' },
          { label: 'Seats Occupied', value: `${totalSeatsUsed}/${totalSeats}`, icon: <Users className="h-4 w-4" />, color: 'text-violet-400' },
          { label: 'Total Candidates', value: totalCandidates, icon: <UserPlus className="h-4 w-4" />, color: 'text-emerald-400' },
          { label: 'Total Hires', value: totalHires, icon: <Trophy className="h-4 w-4" />, color: 'text-yellow-400' },
        ].map(k => (
          <Card key={k.label} className="border-border/40">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-muted/40 ${k.color}`}>{k.icon}</div>
              <div>
                <div className="text-xl font-extrabold">{k.value}</div>
                <div className="text-xs text-muted-foreground">{k.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Companies Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Companies</CardTitle>
          <CardDescription className="text-xs">
            Click any row to expand the full member hierarchy. {total} companies total.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {companiesQuery.isLoading ? (
            <div className="p-4 space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : companies.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              <Building2 className="h-8 w-8 mx-auto mb-3 opacity-30" />
              No companies created yet.
            </div>
          ) : (
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/40">
                    <TableHead>Company</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead className="min-w-[120px]">Seats</TableHead>
                    <TableHead className="min-w-[120px]">Credits</TableHead>
                    <TableHead className="text-center">Candidates</TableHead>
                    <TableHead className="text-center">Assessments</TableHead>
                    <TableHead className="text-center">Interviews</TableHead>
                    <TableHead className="text-center">Hires</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(companies as AdminCompany[]).map(co => (
                    <CompanyRow key={co.id} company={co} />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
