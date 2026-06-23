import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi, type AdminLoginEvent } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PIICell } from './components/AdminHelpers';

const REFRESH_INTERVAL_MS = 60_000;
const LOGINS_PAGE_SIZE = 50;

export default function AdminLoginsTodayPage() {
  const [offset, setOffset] = useState(0);

  const loginsQuery = useQuery({
    queryKey: ['admin-logins-today', offset],
    queryFn: () => adminApi.loginsToday({ limit: LOGINS_PAGE_SIZE, offset }),
    retry: false,
    refetchInterval: REFRESH_INTERVAL_MS,
  });

  const logins = loginsQuery.data?.logins ?? [];
  const total = loginsQuery.data?.total ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" asChild>
          <Link to="/admin/operational">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to Operational
          </Link>
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Logins Today</CardTitle>
          <CardDescription>
            All successful login events recorded within the last 24 hours (today UTC).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loginsQuery.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : logins.length === 0 ? (
            <div className="text-sm text-muted-foreground">No login events recorded today.</div>
          ) : (
            <div className="space-y-4">
              <div className="overflow-auto border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Login Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(logins as AdminLoginEvent[]).map((login) => (
                      <TableRow key={login.id}>
                        <TableCell className="font-medium text-sm">
                          {login.full_name || login.first_name || 'Not Provided'}
                        </TableCell>
                        <TableCell className="text-sm">
                          <PIICell value={login.email === 'Not Provided' ? null : login.email} type="email" />
                          {(!login.email || login.email === 'Not Provided') && (
                            <span className="text-xs text-muted-foreground italic">Not Provided</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {login.company_name === 'Not Provided' ? (
                            <span className="italic">Not Provided</span>
                          ) : (
                            login.company_name || <span className="italic">Not Provided</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(login.logged_in_at).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="text-xs text-muted-foreground">
                  Showing {total === 0 ? 0 : offset + 1}–{Math.min(offset + LOGINS_PAGE_SIZE, total)} of {total}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={offset === 0}
                    onClick={() => setOffset(Math.max(0, offset - LOGINS_PAGE_SIZE))}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={offset + LOGINS_PAGE_SIZE >= total}
                    onClick={() => setOffset(offset + LOGINS_PAGE_SIZE)}
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
