import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { adminApi, type AdminRecruiterCandidateCount, type AdminCandidateEntry } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { EyeOff, ChevronLeft, ChevronRight } from 'lucide-react';
import { getAdminDisplayName, getAdminDisplayEmail, getAdminDisplayCompany } from '@/lib/adminIdentity';
import { PIICell } from './components/AdminHelpers';

const REFRESH_INTERVAL_MS = 60_000;
const CANDIDATES_PAGE_SIZE = 25;

export default function AdminPeoplePage() {
  const [candidatesOffset, setCandidatesOffset] = useState(0);

  const recruitersQuery = useQuery({
    queryKey: ['admin-recruiter-counts'],
    queryFn: () => adminApi.recruiterCandidateCounts({ limit: 200, offset: 0 }),
    retry: false,
    refetchInterval: REFRESH_INTERVAL_MS,
  });

  const candidatesQuery = useQuery({
    queryKey: ['admin-candidates-list', candidatesOffset],
    queryFn: () => adminApi.candidatesList({ limit: CANDIDATES_PAGE_SIZE, offset: candidatesOffset }),
    retry: false,
    refetchInterval: REFRESH_INTERVAL_MS,
  });

  const recruiters = recruitersQuery.data?.recruiters ?? [];
  const candidates = candidatesQuery.data?.candidates ?? [];
  const candidatesTotal = candidatesQuery.data?.total ?? 0;

  return (
    <div className="space-y-6">
      {/* Recruiter Directory — moved to top */}
      <Card>
        <CardHeader>
          <CardTitle>Recruiter Directory</CardTitle>
          <CardDescription>
            View a comprehensive list of all registered recruiters on the platform along with their usage statistics, subscription details, and recent activity.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link to="/admin/people/recruiters">View All Recruiters</Link>
          </Button>
        </CardContent>
      </Card>

      {/* Recruiter Candidate Enrollment */}
      <Card>
        <CardHeader>
          <CardTitle>Recruiter Candidate Enrollment</CardTitle>
          <CardDescription>Candidate count linked to each recruiter via jobs/applications.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 max-h-[420px] overflow-auto">
          {(recruiters as AdminRecruiterCandidateCount[]).map((r) => (
            <div key={r.recruiter_user_id} className="border rounded-md p-3">
              <div className="font-semibold text-sm">{getAdminDisplayName(r)}</div>
              <div className="text-xs text-muted-foreground">
                {getAdminDisplayEmail(r.email)} • {getAdminDisplayCompany(r.company_name)}
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <Badge variant="outline">Enrolled: {r.candidates_enrolled_count}</Badge>
                <Badge variant="outline">Consumed Counter: {r.candidates_consumed_counter}</Badge>
                <Badge variant="outline">Plan: {r.subscription_plan || 'free'}</Badge>
              </div>
            </div>
          ))}
          {!recruiters.length && <div className="text-sm text-muted-foreground">No recruiter data available.</div>}
        </CardContent>
      </Card>

      {/* All Candidates */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                All Candidates
                <Badge variant="outline" className="text-amber-400 border-amber-400/40 text-xs font-normal">
                  PII — Access Logged
                </Badge>
              </CardTitle>
              <CardDescription>
                Full candidate listing across all recruiters. Email and phone are masked by default —
                click the eye icon to reveal. Every page view is audit-logged.
              </CardDescription>
            </div>
            <div className="text-sm text-muted-foreground">
              {candidatesTotal} total
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {candidatesQuery.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : candidates.length === 0 ? (
            <div className="text-sm text-muted-foreground">No candidates found.</div>
          ) : (
            <>
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>
                        <span className="flex items-center gap-1">
                          Email
                          <EyeOff className="h-3 w-3 text-amber-400" />
                        </span>
                      </TableHead>
                      <TableHead>
                        <span className="flex items-center gap-1">
                          Phone
                          <EyeOff className="h-3 w-3 text-amber-400" />
                        </span>
                      </TableHead>
                      <TableHead>Job</TableHead>
                      <TableHead>Recruiter</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(candidates as AdminCandidateEntry[]).map((c) => (
                      <TableRow key={c.candidate_id}>
                        <TableCell className="font-medium text-sm">
                          {c.full_name}
                        </TableCell>
                        <TableCell>
                          <PIICell value={c.email} type="email" />
                        </TableCell>
                        <TableCell>
                          <PIICell value={c.phone} type="phone" />
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[160px] truncate">
                          {c.job_title || '—'}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[140px] truncate">
                          <div className="font-medium text-foreground">
                            {getAdminDisplayName({ full_name: c.recruiter_full_name })}
                          </div>
                          <div>{getAdminDisplayEmail(c.recruiter_email)}</div>
                          <div>{getAdminDisplayCompany(c.recruiter_company_name)}</div>
                        </TableCell>
                        <TableCell>
                          {c.application_status ? (
                            <Badge variant="outline" className="capitalize text-xs">
                              {c.application_status}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(c.created_at).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <div className="text-xs text-muted-foreground">
                  Showing {candidatesOffset + 1}–{Math.min(candidatesOffset + CANDIDATES_PAGE_SIZE, candidatesTotal)} of {candidatesTotal}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={candidatesOffset === 0}
                    onClick={() => setCandidatesOffset(Math.max(0, candidatesOffset - CANDIDATES_PAGE_SIZE))}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={candidatesOffset + CANDIDATES_PAGE_SIZE >= candidatesTotal}
                    onClick={() => setCandidatesOffset(candidatesOffset + CANDIDATES_PAGE_SIZE)}
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

    </div>
  );
}

