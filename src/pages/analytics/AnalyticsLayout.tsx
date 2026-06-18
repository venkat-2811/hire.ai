import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useRequireAuth } from '@/hooks/useAuth';
import { useCandidateAnalytics } from '@/hooks/useAnalytics';
import { useJobs } from '@/hooks/useJobs';
import { Loader2, BarChart3, Briefcase } from 'lucide-react';
import type { AnalyticsOutletContext } from './shared';

const NAV_LINKS = [
  { path: '/analytics/overview', label: 'Overview' },
  { path: '/analytics/assessments', label: 'Assessments & Roles' },
  { path: '/analytics/top-performers', label: 'Top Performers' },
  { path: '/analytics/pipeline', label: 'Candidate Pipeline' },
  { path: '/analytics/vendors', label: 'Vendor Tracking' },
];

export default function AnalyticsLayout() {
  const { loading: authLoading } = useRequireAuth();
  const { data: jobs, isLoading: jobsLoading } = useJobs();
  const location = useLocation();

  const [selectedJobId, setSelectedJobId] = useState<string>('all');

  const analyticsParams = useMemo(
    () => (selectedJobId && selectedJobId !== 'all' ? { job_id: selectedJobId } : undefined),
    [selectedJobId]
  );
  
  const { data: allCandidates, isLoading: candidatesLoading } = useCandidateAnalytics(analyticsParams);
  const data = useMemo(() => allCandidates ?? [], [allCandidates]);

  if (authLoading || jobsLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  const selectedJobTitle = jobs?.find((j) => j.id === selectedJobId)?.title;
  const contextValue: AnalyticsOutletContext = {
    data,
    candidatesLoading,
    selectedJobId,
  };

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Header & Filter */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <motion.h1
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-2xl lg:text-3xl font-bold flex items-center gap-2"
            >
              <BarChart3 className="h-7 w-7 text-primary" />
              Analytics Dashboard
            </motion.h1>
            <p className="text-muted-foreground mt-1">
              {selectedJobId === 'all'
                ? 'Recruitment insights across all job roles'
                : `Insights for: ${selectedJobTitle}`}
            </p>
          </div>

          <Select value={selectedJobId} onValueChange={setSelectedJobId}>
            <SelectTrigger className="w-full sm:w-[260px]">
              <Briefcase className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Filter by job role…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Job Roles</SelectItem>
              {(jobs ?? []).map((job) => (
                <SelectItem key={job.id} value={job.id}>
                  {job.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Sub-Navigation */}
        <div className="border-b border-border">
          <nav className="-mb-px flex space-x-6 overflow-x-auto" aria-label="Tabs">
            {NAV_LINKS.map((link) => {
              const isActive = location.pathname.startsWith(link.path);
              return (
                <NavLink
                  key={link.path}
                  to={link.path}
                  className={`
                    whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors
                    ${isActive 
                      ? 'border-primary text-primary' 
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                    }
                  `}
                >
                  {link.label}
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Child Pages */}
        <div className="pt-2">
          <Outlet context={contextValue} />
        </div>
      </div>
    </DashboardLayout>
  );
}
