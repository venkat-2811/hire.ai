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
  Briefcase,
  Sparkles,
  Code,
  Video,
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
              className="text-2xl lg:text-3xl font-bold flex items-center gap-2"
            >
              Job Positions
              <Briefcase className="h-6 w-6 lg:h-8 lg:w-8 text-primary" />
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
              className="pl-10 w-full border-slate-400 dark:border-slate-800 shadow-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button asChild variant="outline" className="w-full sm:w-auto border-slate-500 dark:border-slate-800 shadow-sm">
            <Link to="/jobs/archived">Archived Jobs</Link>
          </Button>
        </div>

        {jobs && jobs.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="text-center py-10 px-6 glass-card rounded-2xl border border-border/80 shadow-md flex flex-col items-center justify-center max-w-4xl mx-auto mt-6 space-y-6"
          >
            <div className="relative">
              {/* Pulsing glow backdrop */}
              <div className="absolute inset-0 bg-gradient-to-tr from-primary/25 to-info/25 rounded-2xl blur-lg animate-float opacity-75 animate-pulse" />
              <div className="relative p-3.5 bg-gradient-to-tr from-primary/10 to-info/10 border border-primary/20 rounded-2xl animate-float">
                <Briefcase className="h-9 w-9 text-primary" />
              </div>
            </div>

            <div className="space-y-1.5 max-w-xl">
              <h3 className="text-2xl font-bold text-gradient">
                Create Your First Job Position
              </h3>
              <p className="text-sm text-muted-foreground max-w-xl mx-auto">
                Establish job requirements to unlock AI-powered resume screening, automated coding challenges, and interactive speech-to-text video interviews.
              </p>
            </div>

            {/* Feature Value Propositions Grid (Slightly larger horizontal layout) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full pt-1">
              <div className="flex items-center gap-3.5 p-3.5 bg-muted/40 rounded-xl border border-border/60 hover:border-border transition-colors text-left">
                <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                  <svg className="h-5 w-5 text-primary" width="100%" height="100%" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M14 2.26953V6.40007C14 6.96012 14 7.24015 14.109 7.45406C14.2049 7.64222 14.3578 7.7952 14.546 7.89108C14.7599 8.00007 15.0399 8.00007 15.6 8.00007H19.7305M16 13H8M16 17H8M10 9H8M14 2H8.8C7.11984 2 6.27976 2 5.63803 2.32698C5.07354 2.6146 4.6146 3.07354 4.32698 3.63803C4 4.27976 4 5.11984 4 6.8V17.2C4 18.8802 4 19.7202 4.32698 20.362C4.6146 20.9265 5.07354 21.3854 5.63803 21.673C6.27976 22 7.11984 22 8.8 22H15.2C16.8802 22 17.7202 22 18.362 21.673C18.9265 21.3854 19.3854 20.9265 19.673 20.362C20 19.7202 20 18.8802 20 17.2V8L14 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </div>
                <div className="space-y-0.5">
                  <h4 className="text-sm font-semibold text-foreground leading-none">AI Resume Screening</h4>
                  <p className="text-xs text-muted-foreground leading-normal mt-1">
                    Analyze resumes and rank match scores instantly.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3.5 p-3.5 bg-muted/40 rounded-xl border border-border/60 hover:border-border transition-colors text-left">
                <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                  <svg className="h-5 w-5 text-primary" width="100%" height="100%" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M17 17L22 12L17 7M7 7L2 12L7 17M14 3L10 21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </div>
                <div className="space-y-0.5">
                  <h4 className="text-sm font-semibold text-foreground leading-none">Automated Testing</h4>
                  <p className="text-xs text-muted-foreground leading-normal mt-1">
                    Evaluate skills with MCQ, coding, or SQL tasks.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3.5 p-3.5 bg-muted/40 rounded-xl border border-border/60 hover:border-border transition-colors text-left">
                <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                  <svg className="h-5 w-5 text-primary" width="100%" height="100%" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22 8.93137C22 8.32555 22 8.02265 21.8802 7.88238C21.7763 7.76068 21.6203 7.69609 21.4608 7.70865C21.2769 7.72312 21.0627 7.93731 20.6343 8.36569L17 12L20.6343 15.6343C21.0627 16.0627 21.2769 16.2769 21.4608 16.2914C21.6203 16.3039 21.7763 16.2393 21.8802 16.1176C22 15.9774 22 15.6744 22 15.0686V8.93137Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M2 9.8C2 8.11984 2 7.27976 2.32698 6.63803C2.6146 6.07354 3.07354 5.6146 3.63803 5.32698C4.27976 5 5.11984 5 6.8 5H12.2C13.8802 5 14.7202 5 15.362 5.32698C15.9265 5.6146 16.3854 6.07354 16.673 6.63803C17 7.27976 17 8.11984 17 9.8V14.2C17 15.8802 17 16.7202 16.673 17.362C16.3854 17.9265 15.9265 18.3854 15.362 18.673C14.7202 19 13.8802 19 12.2 19H6.8C5.11984 19 4.27976 19 3.63803 18.673C3.07354 18.3854 2.6146 17.9265 2.32698 17.362C2 16.7202 2 15.8802 2 14.2V9.8Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </div>
                <div className="space-y-0.5">
                  <h4 className="text-sm font-semibold text-foreground leading-none">AI Video Interviews</h4>
                  <p className="text-xs text-muted-foreground leading-normal mt-1">
                    Interactive audio-visual screening & evaluation.
                  </p>
                </div>
              </div>
            </div>

            <Button
              onClick={handleCreateJobClick}
              className="w-52 font-semibold shadow-md bg-gradient-to-r from-primary to-primary/95 hover:from-primary/95 hover:to-primary text-primary-foreground transform hover:scale-[1.01] active:scale-[0.99] transition-all duration-150 h-11 rounded-lg"
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Create Job Position
            </Button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredJobs.length === 0 ? (
              <div className="col-span-full text-center py-10 text-muted-foreground">
                No jobs found matching your search.
              </div>
            ) : (
              filteredJobs.map((job, index) => (
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
                        <span className={`text-xs px-2 py-1 rounded-full ${job.is_active
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
              ))
            )}
          </div>
        )}

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
