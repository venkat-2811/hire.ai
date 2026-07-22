import { useQuery } from '@tanstack/react-query';
import { adminApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ChevronLeft, Calendar, Briefcase, Users, FileCheck, BrainCircuit } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';

export default function AdminRecruiterDetailPage() {
  const { id } = useParams<{ id: string }>();

  const detailsQuery = useQuery({
    queryKey: ['admin-recruiter-details', id],
    queryFn: () => adminApi.recruiterDetails(id!),
    enabled: !!id,
    retry: false,
    refetchInterval: 60_000,
  });

  if (detailsQuery.isLoading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (detailsQuery.isError || !detailsQuery.data) {
    return (
      <div className="space-y-6">
        <Button variant="outline" size="sm" asChild>
          <Link to="/admin/people/recruiters">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to All Recruiters
          </Link>
        </Button>
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
          <CardContent className="p-6 text-red-600 dark:text-red-400">
            Failed to load recruiter details or recruiter not found.
          </CardContent>
        </Card>
      </div>
    );
  }

  const d = detailsQuery.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" asChild>
          <Link to="/admin/people/recruiters">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to All Recruiters
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Profile Card */}
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Recruiter Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm text-muted-foreground mb-1">Name</div>
              <div className="font-medium">{d.full_name}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">Email</div>
              <div className="font-medium">{d.email}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">Company</div>
              <div className="font-medium">{d.company_name || 'N/A'}</div>
              <Badge variant="outline" className={`mt-1.5 text-[10px] ${d.company_name ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30' : 'bg-muted text-muted-foreground'}`}>
                {d.company_name ? 'Company Member' : 'Independent'}
              </Badge>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">Joined</div>
              <div className="flex items-center gap-2 font-medium">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                {d.created_at ? new Date(d.created_at).toLocaleDateString() : 'Unknown'}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Subscription & Stats */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Platform Usage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-wrap gap-4">
              <div className="p-4 border rounded-md flex-1 min-w-[200px] bg-muted/20">
                <div className="text-sm text-muted-foreground mb-2 flex justify-between items-center">
                  Subscription
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="default" className="capitalize">{d.subscription_plan}</Badge>
                  <Badge variant={d.subscription_status === 'active' ? 'secondary' : 'destructive'} className="capitalize">
                    {d.subscription_status}
                  </Badge>
                </div>
              </div>

              <div className="p-4 border rounded-md flex-1 min-w-[200px] bg-muted/20">
                <div className="text-sm text-muted-foreground mb-1 flex items-center gap-2">
                  <Briefcase className="h-4 w-4" /> Total Jobs
                </div>
                <div className="text-3xl font-bold">{d.jobs_count}</div>
              </div>

              <div className="p-4 border rounded-md flex-1 min-w-[200px] bg-muted/20">
                <div className="text-sm text-muted-foreground mb-1 flex items-center gap-2">
                  <Users className="h-4 w-4" /> Candidates
                </div>
                <div className="text-3xl font-bold">{d.candidates_count}</div>
              </div>

              <div className="p-4 border rounded-md flex-1 min-w-[200px] bg-muted/20">
                <div className="text-sm text-muted-foreground mb-1 flex items-center gap-2">
                  <FileCheck className="h-4 w-4" /> Assessments
                </div>
                <div className="text-3xl font-bold">{d.assessments_count}</div>
              </div>

              <div className="p-4 border rounded-md flex-1 min-w-[200px] bg-muted/20">
                <div className="text-sm text-muted-foreground mb-1 flex items-center gap-2">
                  <BrainCircuit className="h-4 w-4" /> AI Interviews
                </div>
                <div className="text-3xl font-bold">{d.interviews_count}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Jobs ({d.recent_jobs?.length || 0})</CardTitle>
          <CardDescription>Up to 10 most recently created jobs</CardDescription>
        </CardHeader>
        <CardContent>
          {d.recent_jobs?.length === 0 ? (
            <div className="text-center text-muted-foreground py-8 border rounded-md bg-muted/10">
              No jobs created yet.
            </div>
          ) : (
            <div className="overflow-auto border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Level</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {d.recent_jobs.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell className="font-medium">{job.title}</TableCell>
                      <TableCell className="capitalize">{job.role?.replace('_', ' ')}</TableCell>
                      <TableCell className="capitalize">{job.level}</TableCell>
                      <TableCell>{new Date(job.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Badge variant={job.is_active ? 'default' : 'secondary'}>
                          {job.is_active ? 'Active' : 'Closed'}
                        </Badge>
                      </TableCell>
                    </TableRow>
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
