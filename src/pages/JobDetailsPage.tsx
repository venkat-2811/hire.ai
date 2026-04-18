import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useRequireAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft, 
  Edit, 
  Archive, 
  Copy, 
  Check, 
  Loader2,
  Users,
  Briefcase,
  Clock,
  Link as LinkIcon,
} from 'lucide-react';
import { RoleBadge } from '@/components/ui/role-badge';
import { LEVEL_CONFIG, type JobRole, type RoleLevel } from '@/types/database';
import { useJob, useDeleteJob } from '@/hooks/useJobs';
import { toast } from 'sonner';

export default function JobDetailsPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { loading: authLoading } = useRequireAuth();
  const { data: job, isLoading } = useJob(jobId || '');
  const deleteJob = useDeleteJob();
  const [copiedLink, setCopiedLink] = useState(false);

  const getApplicationLink = () => {
    return `${window.location.origin}/apply/${jobId}`;
  };

  const copyApplicationLink = async () => {
    try {
      await navigator.clipboard.writeText(getApplicationLink());
      setCopiedLink(true);
      toast.success('Application link copied!');
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      toast.error('Failed to copy link');
    }
  };

  const handleArchive = () => {
    if (jobId) {
      deleteJob.mutate(jobId, {
        onSuccess: () => navigate('/jobs'),
      });
    }
  };

  if (authLoading || isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (!job) {
    return (
      <DashboardLayout>
        <div className="p-6 lg:p-8">
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">Job not found</p>
              <Button asChild className="mt-4">
                <Link to="/jobs">Back to Jobs</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/jobs')} className="shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <motion.h1 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-2xl lg:text-3xl font-bold truncate"
              >
                {job.title}
              </motion.h1>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <RoleBadge role={job.role as JobRole} size="sm" />
                <Badge variant="outline">
                  {LEVEL_CONFIG[job.level as RoleLevel]?.label || job.level}
                </Badge>
                <Badge variant={job.is_active ? 'default' : 'secondary'}>
                  {job.is_active ? 'Active' : 'Archived'}
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 w-full lg:w-auto mt-2 lg:mt-0">
            <Button variant="outline" onClick={copyApplicationLink}>
              {copiedLink ? <Check className="mr-2 h-4 w-4" /> : <LinkIcon className="mr-2 h-4 w-4" />}
              Copy Link
            </Button>
            <Button variant="outline" asChild>
              <Link to={`/jobs/${jobId}/edit`}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Link>
            </Button>
            <Button variant="outline" onClick={handleArchive}>
              <Archive className="mr-2 h-4 w-4" />
              {job.is_active ? 'Archive' : 'Activate'}
            </Button>
          </div>
        </div>

        {/* Job Details */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap">{job.description}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Required Skills</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {(job.must_have_skills || []).map((skill: string, i: number) => (
                    <Badge key={i} variant="default">{skill}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            {job.good_to_have_skills?.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Nice to Have Skills</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {job.good_to_have_skills.map((skill: string, i: number) => (
                      <Badge key={i} variant="secondary">{skill}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Job Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Briefcase className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Role</p>
                    <p className="font-medium">{job.role}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Experience</p>
                    <p className="font-medium">{job.min_experience_years}+ years</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Created</p>
                    <p className="font-medium">{new Date(job.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Application Link</CardTitle>
                <CardDescription>Share this link with candidates</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="p-3 bg-muted rounded-lg text-sm break-all">
                  {getApplicationLink()}
                </div>
                <Button className="w-full mt-3" onClick={copyApplicationLink}>
                  {copiedLink ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                  Copy Link
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
