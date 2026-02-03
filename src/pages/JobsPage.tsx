import { useState } from 'react';
import { motion } from 'framer-motion';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useRequireAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Search, 
  Plus, 
  MoreHorizontal,
  Users,
  Eye,
  Edit,
  Archive,
  Loader2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { RoleBadge } from '@/components/ui/role-badge';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { LEVEL_CONFIG, type JobRole, type RoleLevel } from '@/types/database';
import { useJobs, useDeleteJob } from '@/hooks/useJobs';

export default function JobsPage() {
  const { loading: authLoading } = useRequireAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const { data: jobs, isLoading: jobsLoading } = useJobs();
  const deleteJob = useDeleteJob();

  const filteredJobs = (jobs || []).filter(
    (j) => j.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleArchive = (jobId: string) => {
    deleteJob.mutate(jobId);
  };

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
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <motion.h1 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-2xl lg:text-3xl font-bold"
            >
              Job Positions
            </motion.h1>
            <p className="text-muted-foreground mt-1">
              Manage job descriptions and requirements
            </p>
          </div>
          <Button asChild>
            <Link to="/jobs/new">
              <Plus className="mr-2 h-4 w-4" />
              Create Job
            </Link>
          </Button>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search jobs..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Jobs Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredJobs.map((job, index) => (
            <motion.div
              key={job.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className={`hover:shadow-md transition-shadow ${!job.is_active && 'opacity-60'}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-lg">{job.title}</CardTitle>
                      <div className="flex items-center gap-2">
                        <RoleBadge role={job.role as JobRole} size="sm" showIcon={false} />
                        <span className="text-sm text-muted-foreground">
                          {LEVEL_CONFIG[job.level as RoleLevel]?.label || job.level}
                        </span>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Eye className="mr-2 h-4 w-4" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit Job
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleArchive(job.id)}>
                          <Archive className="mr-2 h-4 w-4" />
                          {job.is_active ? 'Archive' : 'Activate'}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Users className="h-4 w-4" />
                      <span className="text-sm">{job.min_experience_years}+ years exp</span>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      job.is_active 
                        ? 'bg-success/10 text-success' 
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {job.is_active ? 'Active' : 'Archived'}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    Created {new Date(job.created_at).toLocaleDateString()}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
