import { useState } from 'react';
import { motion } from 'framer-motion';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useRequireAuth } from '@/hooks/useAuth';
import { useJobs } from '@/hooks/useJobs';
import { useLinkedInAccounts } from '@/hooks/useLinkedInTalent';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Search,
  Briefcase,
  MapPin,
  Clock,
  Users,
  Loader2,
  Linkedin,
  AlertTriangle,
  ChevronRight,
  Building2,
  CalendarDays,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

function LinkedInConnectionBanner({ connected }: { connected: boolean }) {
  if (connected) return null;
  return (
    <div className="shrink-0 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 flex items-center gap-2.5 shadow-sm">
      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
      <div className="flex flex-col">
        <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 leading-tight">
          LinkedIn Account Not Connected
        </span>
        <span className="text-[10px] font-medium text-amber-600/90 dark:text-amber-400/80 leading-tight">
          Work In Progress
        </span>
      </div>
    </div>
  );
}

export default function LinkedInTalentPage() {
  const { loading: authLoading } = useRequireAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const { data: jobs, isLoading: jobsLoading } = useJobs({ is_active: true });
  const { data: accountsData, isLoading: accountsLoading } = useLinkedInAccounts();

  const isConnected = accountsData?.connected ?? false;
  const connectionMessage = accountsData?.message;

  const filteredJobs = (jobs || []).filter((j) => {
    const q = searchQuery.toLowerCase();
    return j.title.toLowerCase().includes(q) ||
      (j.end_customer_name || '').toLowerCase().includes(q);
  });

  if (authLoading || jobsLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-start justify-between gap-4"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#0077B5]/15 border border-[#0077B5]/30 shrink-0">
              <Linkedin className="h-6 w-6 text-[#0077B5]" />
            </div>
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-foreground">
                LinkedIn Talent Discovery
              </h1>
              <p className="text-muted-foreground text-sm">
                Find, rank, and contact top LinkedIn candidates for your open roles
              </p>
            </div>
          </div>

          {/* Connection Banner */}
          {!accountsLoading && (
            <LinkedInConnectionBanner connected={isConnected} />
          )}
        </motion.div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { label: 'Active Jobs', value: jobs?.length ?? 0, icon: Briefcase, color: 'text-blue-400' },
            { label: 'LinkedIn Connected', value: isConnected ? 'Yes' : 'No', icon: Linkedin, color: isConnected ? 'text-emerald-400' : 'text-amber-400' },
            { label: 'Max per Search', value: '30', icon: Users, color: 'text-blue-400' },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="rounded-xl border border-border/50 bg-card p-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <stat.icon className={cn('h-4 w-4', stat.color)} />
                <span className="text-xs text-muted-foreground">{stat.label}</span>
              </div>
              <p className="text-xl font-bold text-foreground">{stat.value}</p>
            </motion.div>
          ))}
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Filter jobs…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-background/50 border-border/60"
          />
        </div>

        {/* Job Cards */}
        {(jobs?.length ?? 0) === 0 ? (
          <div className="text-center py-16 px-6 rounded-2xl border border-dashed border-border/60">
            <div className="w-14 h-14 rounded-full bg-[#0077B5]/10 border border-[#0077B5]/20 flex items-center justify-center mx-auto mb-4">
              <Briefcase className="h-7 w-7 text-[#0077B5]/60" />
            </div>
            <h3 className="text-lg font-bold mb-1">No Jobs Created Yet</h3>
            <p className="text-sm text-muted-foreground">
              Create a job from the <strong>Jobs</strong> page first, then come back to find LinkedIn candidates.
            </p>
            <Button className="mt-4" onClick={() => navigate('/jobs/new')}>
              Create Your First Job
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filteredJobs.map((job, index) => (
              <motion.div
                key={job.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <div className="group rounded-2xl border border-border/50 bg-card hover:border-[#0077B5]/40 hover:shadow-lg hover:shadow-[#0077B5]/5 transition-all duration-200 flex flex-col">
                  {/* Card Header */}
                  <div className="p-5 flex-1">
                    {/* Status + Date */}
                    <div className="flex items-center justify-between mb-3">
                      <Badge className={cn(
                        'text-xs font-medium',
                        job.is_active
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : 'bg-muted text-muted-foreground border-border/50'
                      )}>
                        {job.is_active ? 'Open' : 'Closed'}
                      </Badge>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground/60">
                        <CalendarDays className="h-3 w-3" />
                        {new Date(job.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                    </div>

                    {/* Title */}
                    <h3 className="font-bold text-foreground mb-1">{job.title}</h3>

                    {/* Company / Customer */}
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-3">
                      <Building2 className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">
                        {job.end_customer_name || 'Your Company'}
                      </span>
                    </div>

                    {/* Meta chips */}
                    <div className="flex flex-wrap gap-1.5">
                      {job.location && (
                        <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-muted/40 text-muted-foreground border border-border/40">
                          <MapPin className="h-2.5 w-2.5" />
                          {job.location}
                        </span>
                      )}
                      {job.min_experience_years != null && (
                        <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-muted/40 text-muted-foreground border border-border/40">
                          <Clock className="h-2.5 w-2.5" />
                          {job.min_experience_years}+ yrs
                        </span>
                      )}
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted/40 text-muted-foreground border border-border/40">
                        {job.role}
                      </span>
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="px-5 pb-5 pt-3 border-t border-border/40">
                    <Button
                      className="w-full gap-2 bg-[#0077B5] hover:bg-[#005885] text-white group-hover:shadow-md transition-all"
                      onClick={() => navigate(`/linkedin-talent/${job.id}`)}
                    >
                      <Linkedin className="h-4 w-4" />
                      Find LinkedIn Candidates
                      <ChevronRight className="h-4 w-4 ml-auto opacity-70 group-hover:translate-x-0.5 transition-transform" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
