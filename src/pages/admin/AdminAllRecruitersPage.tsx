import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi, type AdminAllRecruiterEntry } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import { Link } from 'react-router-dom';

const REFRESH_INTERVAL_MS = 60_000;
const RECRUITERS_PAGE_SIZE = 20;

export default function AdminAllRecruitersPage() {
  const [offset, setOffset] = useState(0);
  const [searchFilter, setSearchFilter] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchFilter);
      setOffset(0);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchFilter]);

  const recruitersQuery = useQuery({
    queryKey: ['admin-all-recruiters', debouncedSearch, offset],
    queryFn: () => adminApi.allRecruiters({ search: debouncedSearch || undefined, limit: RECRUITERS_PAGE_SIZE, offset }),
    retry: false,
    refetchInterval: REFRESH_INTERVAL_MS,
  });

  const recruiters = recruitersQuery.data?.recruiters ?? [];
  const total = recruitersQuery.data?.total ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" asChild>
          <Link to="/admin/people">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to People
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Recruiters</CardTitle>
          <CardDescription>
            Comprehensive list of all registered recruiters and their usage statistics across the platform.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Input
              placeholder="Search by name, email, or company..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="max-w-md"
            />
            {recruitersQuery.isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>

          <div className="overflow-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Recruiter</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead className="text-right">Jobs</TableHead>
                  <TableHead className="text-right">Candidates</TableHead>
                  <TableHead className="text-right">Assessments</TableHead>
                  <TableHead className="text-right">Interviews</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recruiters.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      {recruitersQuery.isLoading ? 'Loading recruiters...' : 'No recruiters found.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  (recruiters as AdminAllRecruiterEntry[]).map((r) => (
                    <TableRow key={r.recruiter_user_id}>
                      <TableCell>
                        <div className="font-medium text-sm">{r.full_name}</div>
                        <div className="text-xs text-muted-foreground">{r.email}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">{r.company_name || '—'}</div>
                        <Badge variant="outline" className={`mt-1 text-[10px] ${r.company_name ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30' : 'bg-muted text-muted-foreground'}`}>
                          {r.company_name ? 'Company Member' : 'Independent'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {r.subscription_plan}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{r.jobs_count}</TableCell>
                      <TableCell className="text-right">{r.candidates_count}</TableCell>
                      <TableCell className="text-right">{r.assessments_count}</TableCell>
                      <TableCell className="text-right">{r.interviews_count}</TableCell>
                      <TableCell className="text-center">
                        <Button variant="ghost" size="icon" asChild title="View Details">
                          <Link to={`/admin/people/recruiters/${r.recruiter_user_id}`}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="text-xs text-muted-foreground">
              Showing {total === 0 ? 0 : offset + 1}–{Math.min(offset + RECRUITERS_PAGE_SIZE, total)} of {total}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - RECRUITERS_PAGE_SIZE))}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={offset + RECRUITERS_PAGE_SIZE >= total}
                onClick={() => setOffset(offset + RECRUITERS_PAGE_SIZE)}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
