import { useState } from 'react';
import { motion } from 'framer-motion';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useRequireAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Search, 
  Plus, 
  MoreHorizontal,
  Users,
  Eye,
  Edit,
  Archive,
  Trash2,
  Loader2,
  Link as LinkIcon,
  Copy,
  Check,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { RoleBadge } from '@/components/ui/role-badge';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator,
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { LEVEL_CONFIG, type JobRole, type RoleLevel } from '@/types/database';
import { useJobs, useDeleteJob, useUpdateJob } from '@/hooks/useJobs';
import { toast } from 'sonner';

export default function JobsPage() {
  const { loading: authLoading } = useRequireAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { data: jobs, isLoading: jobsLoading } = useJobs({ is_active: true });
  const deleteJob = useDeleteJob();
  const updateJob = useUpdateJob();

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [archiveJobId, setArchiveJobId] = useState<string | null>(null);
  const [archiveChecked, setArchiveChecked] = useState(false);

  // Fetch subscription info for limit checking

  const getApplicationLink = (jobId: string) => {
    return `${window.location.origin}/apply/${jobId}`;
  };

  const copyApplicationLink = async (jobId: string) => {
    const link = getApplicationLink(jobId);
    try {
      await navigator.clipboard.writeText(link);
      setCopiedId(jobId);
      toast.success('Application link copied to clipboard!');
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error('Failed to copy link');
    }
  };

  const filteredJobs = (jobs || []).filter(
    (j) => j.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleToggleArchive = (jobId: string, currentStatus: boolean) => {
    if (currentStatus) {
      // Archive (soft delete)
      deleteJob.mutate({ id: jobId, permanent: false });
    } else {
      // Activate
      updateJob.mutate({ id: jobId, data: { is_active: true } as any });
    }
  };

  const handlePermanentDelete = () => {
    if (deleteId) {
      deleteJob.mutate({ id: deleteId, permanent: true }, {
        onSuccess: () => setDeleteId(null)
      });
    }
  };

  const handleCreateJobClick = () => {
    navigate('/jobs/new');
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
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
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
          <Button onClick={handleCreateJobClick} className="w-full sm:w-auto mt-2 sm:mt-0">
            <Plus className="mr-2 h-4 w-4" />
            Create Job
          </Button>
        </div>

        {/* Search */}
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search jobs..."
              className="pl-10 w-full"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link to="/jobs/archived">Archived Jobs</Link>
          </Button>
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
                        <DropdownMenuItem onClick={() => copyApplicationLink(job.id)}>
                          {copiedId === job.id ? (
                            <Check className="mr-2 h-4 w-4 text-success" />
                          ) : (
                            <LinkIcon className="mr-2 h-4 w-4" />
                          )}
                          Copy Application Link
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link to={`/jobs/${job.id}`}>
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link to={`/jobs/${job.id}/edit`}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit Job
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => {
                          if (job.is_active) {
                            setArchiveJobId(job.id);
                            setArchiveChecked(false);
                          } else {
                            handleToggleArchive(job.id, job.is_active);
                          }
                        }}>
                          <Archive className="mr-2 h-4 w-4" />
                          {job.is_active ? 'Archive Job' : 'Activate Job'}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          className="text-destructive focus:text-destructive"
                          onClick={() => setDeleteId(job.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete Permanently
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

        {/* Archive Confirmation Dialog */}
        <AlertDialog open={!!archiveJobId} onOpenChange={(open) => !open && setArchiveJobId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Archive Job?</AlertDialogTitle>
              <AlertDialogDescription className="space-y-4 pt-2">
                <p>
                  This job will be moved to the archived state and will no longer appear as an active job.
                </p>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="archive-confirm" 
                    checked={archiveChecked}
                    onCheckedChange={(checked) => setArchiveChecked(!!checked)}
                  />
                  <label
                    htmlFor="archive-confirm"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    I understand that this job will be archived.
                  </label>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={() => {
                  if (archiveJobId) {
                    handleToggleArchive(archiveJobId, true);
                    setArchiveJobId(null);
                  }
                }}
                disabled={!archiveChecked}
              >
                Archive Job
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!deleteId} onOpenChange={(open) => {
          if (!open) {
            setDeleteId(null);
            setDeleteConfirmText('');
          }
        }}>
          <AlertDialogContent className="border-destructive/50">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-destructive flex items-center gap-2">
                <Trash2 className="h-5 w-5" />
                Permanently Delete Job?
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-4 pt-2">
                <p className="text-foreground">
                  <strong>Note:</strong> Deleting a job will remove it from your active jobs list. <strong>Candidates associated with this job will be safely preserved</strong> and moved to the "Unassigned Candidates" tab with all their assessment data intact.
                </p>
                <div className="space-y-2">
                  <label className="text-sm">
                    Please type <strong>Delete the job</strong> to confirm.
                  </label>
                  <Input 
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder="Delete the job"
                  />
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handlePermanentDelete}
                disabled={deleteConfirmText !== 'Delete the job'}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete Permanently
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
