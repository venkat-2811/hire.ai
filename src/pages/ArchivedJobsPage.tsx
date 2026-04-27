import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArchiveRestore, ArrowLeft, Loader2, Search } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useRequireAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LEVEL_CONFIG, type JobRole, type RoleLevel } from '@/types/database';
import { RoleBadge } from '@/components/ui/role-badge';
import { useJobs, useUpdateJob } from '@/hooks/useJobs';

export default function ArchivedJobsPage() {
  const { loading: authLoading } = useRequireAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const { data: jobs, isLoading: jobsLoading } = useJobs({ is_active: false });
  const updateJob = useUpdateJob();

  const filteredJobs = (jobs || []).filter((j) => j.title.toLowerCase().includes(searchQuery.toLowerCase()));

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
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <motion.h1
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-2xl lg:text-3xl font-bold"
            >
              Archived Jobs
            </motion.h1>
            <p className="text-muted-foreground mt-1">Jobs you archived. Reactivate them to move back to active jobs.</p>
          </div>
          <Button asChild variant="outline" className="shrink-0">
            <Link to="/jobs">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Jobs
            </Link>
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search archived jobs..."
              className="pl-10 w-full"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {filteredJobs.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No archived jobs</CardTitle>
              <CardDescription>Archived jobs will appear here.</CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredJobs.map((job, index) => (
              <motion.div
                key={job.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08 }}
              >
                <Card className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="space-y-1">
                      <CardTitle className="text-lg">{job.title}</CardTitle>
                      <div className="flex items-center gap-2">
                        <RoleBadge role={job.role as JobRole} size="sm" showIcon={false} />
                        <span className="text-sm text-muted-foreground">
                          {LEVEL_CONFIG[job.level as RoleLevel]?.label || job.level}
                        </span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">Archived</span>
                      <span className="text-xs text-muted-foreground">Created {new Date(job.created_at).toLocaleDateString()}</span>
                    </div>

                    <Button
                      className="w-full"
                      variant="secondary"
                      onClick={() => updateJob.mutate({ id: job.id, data: { is_active: true } as any })}
                      disabled={updateJob.isPending}
                    >
                      <ArchiveRestore className="mr-2 h-4 w-4" />
                      Reactivate Job
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
