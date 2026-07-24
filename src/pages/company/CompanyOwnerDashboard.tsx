import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  Users, CreditCard, TrendingUp, BarChart3, Activity, Shield,
  CheckCircle, XCircle, Trash2, ChevronDown, ChevronUp,
  Briefcase, UserPlus, FileText, MessageSquare, Trophy,
  Building2, Clock, AlertCircle
} from 'lucide-react';
import { companyApi, type CompanyMember, type ActivityEvent, type AuditLog, type SubscriptionHistoryEntry } from '@/lib/api';
import { useCompany } from '@/hooks/useCompany';
import { useActivityFeed, useCompanyAnalytics } from '@/hooks/useCompanyAnalytics';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

// ── Activity icon mapping ─────────────────────────────────────────────────────
const ACTION_META: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  candidate_added:   { icon: <UserPlus  className="h-3.5 w-3.5" />, color: 'text-emerald-400', label: 'Candidate Added' },
  assessment_sent:   { icon: <FileText  className="h-3.5 w-3.5" />, color: 'text-blue-400',    label: 'Assessment Sent' },
  interview_sent:    { icon: <MessageSquare className="h-3.5 w-3.5" />, color: 'text-violet-400', label: 'Interview Sent' },
  job_posted:        { icon: <Briefcase className="h-3.5 w-3.5" />, color: 'text-amber-400',   label: 'Job Posted' },
  hire_marked:       { icon: <Trophy    className="h-3.5 w-3.5" />, color: 'text-yellow-400',  label: 'Hire Marked' },
  member_joined:     { icon: <CheckCircle className="h-3.5 w-3.5" />, color: 'text-green-400', label: 'Member Joined' },
  member_removed:    { icon: <XCircle   className="h-3.5 w-3.5" />, color: 'text-red-400',    label: 'Member Removed' },
  seat_approved:     { icon: <CheckCircle className="h-3.5 w-3.5" />, color: 'text-green-400', label: 'Seat Approved' },
  seat_rejected:     { icon: <XCircle   className="h-3.5 w-3.5" />, color: 'text-red-400',    label: 'Seat Rejected' },
  company_created:   { icon: <Building2 className="h-3.5 w-3.5" />, color: 'text-indigo-400', label: 'Company Created' },
};

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, icon, color }: { label: string; value: string | number; sub?: string; icon: React.ReactNode; color: string }) {
  return (
    <Card className="relative overflow-hidden border-border/50">
      <div className={`absolute inset-0 opacity-5 ${color}`} />
      <CardContent className="p-5 flex items-start gap-4">
        <div className={`p-2.5 rounded-lg bg-muted/60 ${color} mt-0.5`}>{icon}</div>
        <div>
          <div className="text-2xl font-extrabold tracking-tight">{value}</div>
          <div className="text-xs text-muted-foreground mt-0.5 font-medium">{label}</div>
          {sub && <div className="text-xs text-muted-foreground/70 mt-0.5">{sub}</div>}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Member Row ────────────────────────────────────────────────────────────────
function MemberRow({ member, companyId, onRemove }: { member: CompanyMember; companyId: string; onRemove: (uid: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const qc = useQueryClient();

  const statsQuery = useQuery({
    queryKey: ['member-stats', companyId, member.user_id],
    queryFn: () => companyApi.memberStats(companyId, member.user_id),
    enabled: expanded,
  });

  const creditPct = member.credits_allocated > 0
    ? Math.min(100, (member.credits_consumed / member.credits_allocated) * 100)
    : 0;

  const statusColor = {
    active: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    pending: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    rejected: 'bg-red-500/15 text-red-400 border-red-500/30',
    removed: 'bg-muted text-muted-foreground border-border',
  }[member.status] ?? 'bg-muted text-muted-foreground';

  return (
    <>
      <TableRow className="hover:bg-muted/30 cursor-pointer" onClick={() => setExpanded(e => !e)}>
        <TableCell className="font-medium">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-xs font-bold text-white">
              {(member.name || 'U')[0].toUpperCase()}
            </div>
            <div>
              <div className="text-sm font-semibold">{member.name || 'Unknown'}</div>
              <div className="text-xs text-muted-foreground">{member.email || '—'}</div>
            </div>
          </div>
        </TableCell>
        <TableCell>
          <Badge variant="outline" className={`text-xs capitalize ${statusColor}`}>
            {member.role === 'owner' ? '👑 Owner' : member.role}
          </Badge>
        </TableCell>
        <TableCell>
          <div className="space-y-1 min-w-[120px]">
            <div className="flex justify-between text-xs">
              <span>{member.credits_consumed.toFixed(1)} / {member.credits_allocated}</span>
              <span className="text-muted-foreground">{creditPct.toFixed(0)}%</span>
            </div>
            <Progress value={creditPct} className="h-1.5" />
          </div>
        </TableCell>
        <TableCell className="text-center text-sm font-semibold">{member.candidates_added}</TableCell>
        <TableCell className="text-center text-sm font-semibold">{member.assessments_sent}</TableCell>
        <TableCell className="text-center text-sm font-semibold">{member.interviews_sent}</TableCell>
        <TableCell className="text-center text-sm font-semibold">{member.jobs_posted}</TableCell>
        <TableCell className="text-center">
          <Badge variant="outline" className="bg-yellow-500/10 text-yellow-400 border-yellow-500/30 text-xs">
            {member.hires} 🏆
          </Badge>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setExpanded(x => !x); }}>
              {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </Button>
            {member.role !== 'owner' && member.status === 'active' && (
              <Button
                variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                onClick={(e) => { e.stopPropagation(); onRemove(member.user_id); }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow className="bg-muted/10 border-b border-border/30">
          <TableCell colSpan={9} className="pb-4 pt-2 px-6">
            {statsQuery.isLoading ? (
              <div className="space-y-2">
                {[1,2,3].map(i => <Skeleton key={i} className="h-6 w-full" />)}
              </div>
            ) : statsQuery.data ? (
              <div className="space-y-3">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Recent Activity</div>
                <div className="space-y-1.5 max-h-48 overflow-auto">
                  {(statsQuery.data.recent_activity || []).length === 0 && (
                    <div className="text-xs text-muted-foreground">No recent activity</div>
                  )}
                  {(statsQuery.data.recent_activity || []).map(ev => {
                    const meta = ACTION_META[ev.action_type] || { icon: <Activity className="h-3.5 w-3.5" />, color: 'text-muted-foreground', label: ev.action_type };
                    return (
                      <div key={ev.id} className="flex items-start gap-2 text-xs py-1">
                        <span className={`mt-0.5 ${meta.color}`}>{meta.icon}</span>
                        <span className="text-foreground/80 flex-1">{ev.description}</span>
                        <span className="text-muted-foreground whitespace-nowrap">{timeAgo(ev.created_at)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function CompanyOwnerDashboard() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { company, role, isOwner, isMember, credits, companyCredits, isLoading: companyLoading } = useCompany();
  const companyId = company?.id ?? null;
  
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');

  const analyticsQuery = useCompanyAnalytics(companyId);
  const feedQuery = useActivityFeed(companyId, { limit: 60 });

  const membersQuery = useQuery({
    queryKey: ['company-members', companyId],
    queryFn: () => companyApi.members(companyId!),
    enabled: !!companyId && isOwner,
    refetchInterval: 30_000,
  });

  const joinRequestsQuery = useQuery({
    queryKey: ['company-join-requests', companyId],
    queryFn: () => companyApi.joinRequests(companyId!),
    enabled: !!companyId && isOwner,
    refetchInterval: 30_000,
  });

  const auditQuery = useQuery({
    queryKey: ['company-audit', companyId],
    queryFn: () => companyApi.auditLogs(companyId!, { limit: 100 }),
    enabled: !!companyId && isOwner,
    staleTime: 60_000,
  });

  const subHistoryQuery = useQuery({
    queryKey: ['company-sub-history', companyId],
    queryFn: () => companyApi.subscriptionHistory(companyId!),
    enabled: !!companyId && isOwner,
  });

  const approveMutation = useMutation({
    mutationFn: ({ memberId }: { memberId: string }) => companyApi.approve(companyId!, memberId),
    onSuccess: () => {
      toast.success('Member approved! Seat allocated and confirmation email sent.');
      qc.invalidateQueries({ queryKey: ['company-join-requests', companyId] });
      qc.invalidateQueries({ queryKey: ['company-members', companyId] });
      qc.invalidateQueries({ queryKey: ['company-my'] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Failed to approve'),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ memberId }: { memberId: string }) => companyApi.reject(companyId!, memberId),
    onSuccess: () => {
      toast.success('Request rejected.');
      qc.invalidateQueries({ queryKey: ['company-join-requests', companyId] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Failed to reject'),
  });

  const removeMutation = useMutation({
    mutationFn: ({ userId }: { userId: string }) => companyApi.removeMember(companyId!, userId),
    onSuccess: () => {
      toast.success('Member removed. Seat reclaimed.');
      qc.invalidateQueries({ queryKey: ['company-members', companyId] });
      qc.invalidateQueries({ queryKey: ['company-my'] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Failed to remove'),
  });

  const inviteMutation = useMutation({
    mutationFn: ({ email }: { email: string }) => companyApi.inviteRecruiter(companyId!, email),
    onSuccess: () => {
      toast.success(`Invite sent to ${inviteEmail}`);
      setIsInviteModalOpen(false);
      setInviteEmail('');
    },
    onError: (e: any) => toast.error(e?.message ?? 'Failed to send invite'),
  });

  if (companyLoading) {
    return (
      <DashboardLayout>
        <div className="p-8 space-y-4">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      </DashboardLayout>
    );
  }

  if (!company || (!isOwner && !isMember)) {
    return (
      <DashboardLayout>
        <div className="p-8 flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <Building2 className="h-12 w-12 text-muted-foreground" />
          <h2 className="text-xl font-bold">No Company Found</h2>
          <p className="text-muted-foreground text-sm text-center max-w-sm">
            You don't own a company yet. Create one through the Company Plans page.
          </p>
          <Button onClick={() => navigate('/company/plans')}>View Company Plans</Button>
        </div>
      </DashboardLayout>
    );
  }

  const analytics = analyticsQuery.data;
  const summary = analytics?.summary;
  const members = membersQuery.data?.members ?? [];
  const pendingRequests = joinRequestsQuery.data?.join_requests ?? [];
  const feed = feedQuery.data ?? [];
  const auditLogs = auditQuery.data?.logs ?? [];
  const subHistory = subHistoryQuery.data?.history ?? [];

  const seatPct = company.seats_total > 0 ? (company.seats_used / company.seats_total) * 100 : 0;
  const creditPct = companyCredits.total_allocated > 0 ? (companyCredits.total_consumed / companyCredits.total_allocated) * 100 : 0;

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Building2 className="h-6 w-6 text-indigo-400" />
              <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight">{company.name}</h1>
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-xs">
                Active
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {isOwner
                ? `Company Owner Dashboard · ${company.seats_used} of ${company.seats_total} seats used`
                : `My Workspace · ${company.name}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {pendingRequests.length > 0 && (
              <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30">
                <AlertCircle className="h-3 w-3 mr-1" />
                {pendingRequests.length} Pending Request{pendingRequests.length > 1 ? 's' : ''}
              </Badge>
            )}
          </div>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <KpiCard
            label="Seats Used" value={`${company.seats_used}/${company.seats_total}`}
            icon={<Users className="h-4 w-4" />} color="text-indigo-400"
            sub={`${Math.round(seatPct)}% occupied`}
          />
          <KpiCard
            label={isOwner ? 'Total Credits Used' : 'My Credits Used'}
            value={isOwner
              ? `${companyCredits.total_consumed.toFixed(0)}/${companyCredits.total_allocated}`
              : `${credits.consumed.toFixed(0)}/${credits.allocated}`}
            icon={<CreditCard className="h-4 w-4" />} color="text-violet-400"
            sub={isOwner
              ? `${Math.round(creditPct)}% consumed company-wide`
              : `${credits.allocated > 0 ? Math.round((credits.consumed / credits.allocated) * 100) : 0}% of your seat`}
          />
          <KpiCard
            label="Candidates" value={summary?.total_candidates ?? 0}
            icon={<UserPlus className="h-4 w-4" />} color="text-emerald-400"
          />
          <KpiCard
            label="Assessments" value={summary?.total_assessments ?? 0}
            icon={<FileText className="h-4 w-4" />} color="text-blue-400"
          />
          <KpiCard
            label="Hires" value={summary?.total_hires ?? 0}
            icon={<Trophy className="h-4 w-4" />} color="text-yellow-400"
          />
        </div>

        {/* Main Tabs */}
        <Tabs defaultValue={isOwner ? "members" : "activity"} className="space-y-4">
          <TabsList className="mb-4">
            {isOwner && (
              <TabsTrigger value="members" className="gap-1.5">
                <Users className="h-3.5 w-3.5" />
                Members
                {pendingRequests.length > 0 && (
                  <span className="ml-1 h-4 w-4 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">
                    {pendingRequests.length}
                  </span>
                )}
              </TabsTrigger>
            )}
            <TabsTrigger value="activity" className="gap-1.5">
              <Activity className="h-3.5 w-3.5" />
              Activity Feed
            </TabsTrigger>
            {isOwner && (
              <>
                <TabsTrigger value="analytics" className="gap-1.5">
                  <BarChart3 className="h-3.5 w-3.5" />
                  Analytics
                </TabsTrigger>
                <TabsTrigger value="audit" className="gap-1.5">
                  <Shield className="h-3.5 w-3.5" />
                  Audit Logs
                </TabsTrigger>
              </>
            )}
          </TabsList>

          {/* ── Members Tab ───────────────────────────────────────── */}
          <TabsContent value="members" className="space-y-4">

            {/* Pending Requests */}
            {pendingRequests.length > 0 && (
              <Card className="border-amber-500/20 bg-amber-500/5">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-400" />
                    Pending Join Requests ({pendingRequests.length})
                  </CardTitle>
                  <CardDescription className="text-xs">
                    These recruiters are waiting for your approval to join {company.name}.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {pendingRequests.map(req => (
                    <div key={req.id} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-background/60 border border-border/40">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                          {(req.recruiter_name || 'U')[0].toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold truncate">{req.recruiter_name}</div>
                          <div className="text-xs text-muted-foreground truncate">{req.recruiter_email}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Button
                          size="sm" variant="outline"
                          className="h-7 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300"
                          disabled={approveMutation.isPending}
                          onClick={() => approveMutation.mutate({ memberId: req.id })}
                        >
                          <CheckCircle className="h-3.5 w-3.5 mr-1" /> Approve
                        </Button>
                        <Button
                          size="sm" variant="outline"
                          className="h-7 border-red-500/40 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                          disabled={rejectMutation.isPending}
                          onClick={() => rejectMutation.mutate({ memberId: req.id })}
                        >
                          <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Members Table */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle className="text-base">Recruiter Hierarchy</CardTitle>
                  <CardDescription className="text-xs">
                    Click any row to expand and see recent activity. Remove members to reclaim their seat.
                  </CardDescription>
                </div>
                <Dialog open={isInviteModalOpen} onOpenChange={setIsInviteModalOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="bg-indigo-600 hover:bg-indigo-500 text-white">
                      <UserPlus className="h-4 w-4 mr-2" />
                      Invite Recruiter
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                      <DialogTitle>Invite a Recruiter</DialogTitle>
                      <DialogDescription>
                        Send an email invitation to join {company.name}. They will need to sign up for an account if they don't have one.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <label htmlFor="email" className="text-sm font-medium">Email address</label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="recruiter@example.com"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setIsInviteModalOpen(false)}
                        disabled={inviteMutation.isPending}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={() => inviteMutation.mutate({ email: inviteEmail })}
                        disabled={!inviteEmail || inviteMutation.isPending}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white"
                      >
                        {inviteMutation.isPending ? 'Sending...' : 'Send Invite'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent className="p-0">
                {membersQuery.isLoading ? (
                  <div className="p-4 space-y-3">
                    {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
                  </div>
                ) : members.filter(m => m.status !== 'removed').length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    No active members yet. Share your company name with recruiters to let them request to join.
                  </div>
                ) : (
                  <div className="overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border/40">
                          <TableHead>Recruiter</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead className="min-w-[140px]">Credits</TableHead>
                          <TableHead className="text-center">Candidates</TableHead>
                          <TableHead className="text-center">Assessments</TableHead>
                          <TableHead className="text-center">Interviews</TableHead>
                          <TableHead className="text-center">Jobs</TableHead>
                          <TableHead className="text-center">Hires</TableHead>
                          <TableHead />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {members
                          .filter(m => m.status !== 'removed')
                          .map(m => (
                            <MemberRow
                              key={m.id}
                              member={m}
                              companyId={companyId!}
                              onRemove={(uid) => removeMutation.mutate({ userId: uid })}
                            />
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Activity Feed Tab ──────────────────────────────────── */}
          <TabsContent value="activity">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Activity className="h-4 w-4 text-indigo-400" />
                      Real-Time Activity Feed
                    </CardTitle>
                    <CardDescription className="text-xs mt-1">Auto-refreshes every 10 seconds.</CardDescription>
                  </div>
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-xs animate-pulse">
                    ● Live
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {feedQuery.isLoading ? (
                  <div className="space-y-3">
                    {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                  </div>
                ) : feed.length === 0 ? (
                  <div className="text-center py-12 text-sm text-muted-foreground">
                    <Activity className="h-8 w-8 mx-auto mb-3 opacity-30" />
                    No activity yet. Actions by your recruiters will appear here in real-time.
                  </div>
                ) : (
                  <div className="space-y-1 max-h-[500px] overflow-auto">
                    {(feed as ActivityEvent[]).map(ev => {
                      const meta = ACTION_META[ev.action_type] ?? { icon: <Activity className="h-3.5 w-3.5" />, color: 'text-muted-foreground', label: ev.action_type };
                      return (
                        <div key={ev.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/20 transition-colors">
                          <div className={`mt-0.5 flex-shrink-0 ${meta.color}`}>{meta.icon}</div>
                          <div className="flex-1 min-w-0">
                            <span className="text-sm text-foreground/90">{ev.description}</span>
                            {ev.recruiter_name && ev.recruiter_name !== 'Unknown' && (
                              <span className="text-xs text-muted-foreground ml-2">by {ev.recruiter_name}</span>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0 flex items-center gap-1">
                            <Clock className="h-3 w-3" />{timeAgo(ev.created_at)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Analytics Tab ─────────────────────────────────────── */}
          <TabsContent value="analytics" className="space-y-4">
            {analyticsQuery.isLoading ? (
              <div className="grid grid-cols-2 gap-4">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-40" />)}
              </div>
            ) : analytics ? (
              <>
                {/* Funnel */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Recruitment Funnel</CardTitle>
                    <CardDescription className="text-xs">Company-wide funnel across all recruiters.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {[
                      { label: 'Jobs Posted', value: analytics.funnel.jobs_posted, max: analytics.funnel.jobs_posted, color: 'bg-amber-500' },
                      { label: 'Candidates Added', value: analytics.funnel.candidates_added, max: analytics.funnel.candidates_added, color: 'bg-emerald-500' },
                      { label: 'Assessments Sent', value: analytics.funnel.assessments_sent, max: analytics.funnel.candidates_added || 1, color: 'bg-blue-500' },
                      { label: 'Interviews Sent', value: analytics.funnel.interviews_sent, max: analytics.funnel.candidates_added || 1, color: 'bg-violet-500' },
                      { label: 'Hires', value: analytics.funnel.hires, max: analytics.funnel.candidates_added || 1, color: 'bg-yellow-500' },
                    ].map(f => (
                      <div key={f.label} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">{f.label}</span>
                          <span className="font-semibold">{f.value}</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${f.color}`}
                            style={{ width: `${f.max > 0 ? Math.min(100, (f.value / f.max) * 100) : 0}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Per-Recruiter Breakdown */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Per-Recruiter Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {analytics.per_recruiter.map(rec => (
                        <div key={rec.user_id} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold">{rec.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {rec.credits_consumed.toFixed(1)} / {rec.credits_allocated} credits
                            </span>
                          </div>
                          <Progress
                            value={rec.credits_allocated > 0 ? (rec.credits_consumed / rec.credits_allocated) * 100 : 0}
                            className="h-2"
                          />
                          <div className="flex gap-4 text-xs text-muted-foreground">
                            <span>👤 {rec.candidates_added} candidates</span>
                            <span>📋 {rec.assessments_sent} assessments</span>
                            <span>💬 {rec.interviews_sent} interviews</span>
                            <span>🏆 {rec.hires} hires</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Subscription History */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Subscription History</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {subHistory.length === 0 ? (
                      <div className="text-sm text-muted-foreground">No history yet.</div>
                    ) : (
                      <div className="space-y-2">
                        {(subHistory as SubscriptionHistoryEntry[]).map(h => (
                          <div key={h.id} className="flex items-start justify-between gap-3 p-3 rounded-lg bg-muted/20 border border-border/30">
                            <div>
                              <div className="text-sm font-medium capitalize">{h.action.replace(/_/g, ' ')}</div>
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {h.company_plans?.name ?? 'Plan'} · {h.seats_before ?? '?'} → {h.seats_after ?? '?'} seats
                              </div>
                              {h.notes && <div className="text-xs text-muted-foreground">{h.notes}</div>}
                            </div>
                            <div className="text-xs text-muted-foreground whitespace-nowrap">
                              {new Date(h.created_at).toLocaleDateString()}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            ) : null}
          </TabsContent>

          {/* ── Audit Logs Tab ─────────────────────────────────────── */}
          <TabsContent value="audit">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="h-4 w-4 text-violet-400" />
                  Audit Log
                </CardTitle>
                <CardDescription className="text-xs">
                  Immutable record of all company actions. Never modified, never deleted.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {auditQuery.isLoading ? (
                  <div className="p-4 space-y-2">
                    {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                  </div>
                ) : auditLogs.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">No audit entries yet.</div>
                ) : (
                  <div className="overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border/40">
                          <TableHead>Action</TableHead>
                          <TableHead>Actor</TableHead>
                          <TableHead>Target</TableHead>
                          <TableHead>IP</TableHead>
                          <TableHead>Timestamp</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(auditLogs as AuditLog[]).map(log => (
                          <TableRow key={log.id} className="text-xs border-border/30">
                            <TableCell>
                              <Badge variant="outline" className="text-xs font-mono">{log.action}</Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground font-mono">{log.actor_id.slice(0, 12)}…</TableCell>
                            <TableCell className="text-muted-foreground">{log.target_type ?? '—'} {log.target_id ? `(${log.target_id.slice(0, 8)}…)` : ''}</TableCell>
                            <TableCell className="text-muted-foreground font-mono">{log.ip_address ?? '—'}</TableCell>
                            <TableCell className="text-muted-foreground whitespace-nowrap">
                              {new Date(log.created_at).toLocaleString()}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
