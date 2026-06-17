import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link, useOutletContext, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, Users, Search, ArrowUpDown, Eye, ChevronLeft, ChevronRight } from 'lucide-react';
import { ScoreBadge } from '@/components/ui/score-badge';
import type { AnalyticsOutletContext, StatusTab, SortField, SortOrder } from './shared';
import { getCandidateStatus, STATUS_CONFIG } from './shared';

const ITEMS_PER_PAGE = 10;

export default function PipelinePage() {
  const { data, candidatesLoading } = useOutletContext<AnalyticsOutletContext>();
  const [searchParams, setSearchParams] = useSearchParams();

  const [statusTab, setStatusTab] = useState<StatusTab>((searchParams.get('status') as StatusTab) || 'all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('overall_score');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const statusParam = searchParams.get('status');
    if (statusParam && statusParam !== statusTab) {
      setStatusTab(statusParam as StatusTab);
    }
  }, [searchParams, statusTab]);

  const handleStatusChange = (tab: StatusTab) => {
    setStatusTab(tab);
    setSearchParams(tab === 'all' ? {} : { status: tab });
    setCurrentPage(1);
  };

  const processedCandidates = useMemo(() => {
    let result = [...data];

    if (statusTab !== 'all') {
      result = result.filter((c) => getCandidateStatus(c) === statusTab);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.candidate_name.toLowerCase().includes(q) ||
          (c.candidate_email ?? '').toLowerCase().includes(q) ||
          c.job_title.toLowerCase().includes(q)
      );
    }

    result.sort((a, b) => {
      let valA: number | string = 0;
      let valB: number | string = 0;
      switch (sortField) {
        case 'name': valA = a.candidate_name; valB = b.candidate_name; break;
        case 'ats_score': valA = a.ats_score ?? -1; valB = b.ats_score ?? -1; break;
        case 'assessment_score': valA = a.assessment_score ?? -1; valB = b.assessment_score ?? -1; break;
        case 'interview_score': valA = a.interview_score ?? -1; valB = b.interview_score ?? -1; break;
        case 'overall_score': valA = a.overall_score ?? -1; valB = b.overall_score ?? -1; break;
      }
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [data, statusTab, searchQuery, sortField, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(processedCandidates.length / ITEMS_PER_PAGE));
  
  // Ensure current page is valid after filtering
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [processedCandidates.length, currentPage, totalPages]);

  const paginatedCandidates = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return processedCandidates.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [processedCandidates, currentPage]);

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortOrder('desc'); }
    setCurrentPage(1);
  };

  const STATUS_TABS: { id: StatusTab; label: string; count: number }[] = [
    { id: 'all', label: 'All Candidates', count: data.length },
    { id: 'selected', label: 'Selected', count: data.filter((c) => getCandidateStatus(c) === 'selected').length },
    { id: 'rejected', label: 'Rejected', count: data.filter((c) => getCandidateStatus(c) === 'rejected').length },
    { id: 'in_process', label: 'In Process', count: data.filter((c) => getCandidateStatus(c) === 'in_process').length },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <div>
            <CardTitle>Candidate Pipeline</CardTitle>
            <CardDescription>Full pipeline view with advanced filtering</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Tabs */}
        <div className="flex flex-wrap gap-2 border-b pb-4">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleStatusChange(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                statusTab === tab.id
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-muted-foreground border-border hover:text-foreground hover:border-foreground/30'
              }`}
            >
              {tab.label}
              <span
                className={`px-1.5 py-0.5 rounded-full text-xs ${
                  statusTab === tab.id
                    ? 'bg-primary-foreground/20 text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search + Sort */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email or role…"
              className="pl-9"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            />
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ArrowUpDown className="h-4 w-4" />
            <span>Sort:</span>
            {(
              [
                { field: 'overall_score', label: 'Overall' },
                { field: 'ats_score', label: 'Resume' },
                { field: 'assessment_score', label: 'Assessment' },
                { field: 'interview_score', label: 'Interview' },
                { field: 'name', label: 'Name' },
              ] as { field: SortField; label: string }[]
            ).map(({ field, label }) => (
              <button
                key={field}
                onClick={() => handleSort(field)}
                className={`px-2.5 py-1 rounded-md border text-xs font-medium transition-colors ${
                  sortField === field
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border hover:bg-muted'
                }`}
              >
                {label}
                {sortField === field && (
                  <span className="ml-1 opacity-80">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        {candidatesLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
          </div>
        ) : processedCandidates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
            <Users className="h-10 w-10 opacity-25" />
            <p className="font-medium">No candidates found</p>
            <p className="text-sm">
              {statusTab !== 'all'
                ? 'Try selecting a different status tab or clearing the search.'
                : 'No candidate activity recorded yet.'}
            </p>
          </div>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="font-semibold">Candidate</TableHead>
                  <TableHead className="font-semibold">Role</TableHead>
                  <TableHead className="font-semibold text-center">Resume</TableHead>
                  <TableHead className="font-semibold text-center">Assessment</TableHead>
                  <TableHead className="font-semibold text-center">Interview</TableHead>
                  <TableHead className="font-semibold text-center">Overall</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedCandidates.map((candidate, index) => {
                  const status = getCandidateStatus(candidate);
                  const cfg = STATUS_CONFIG[status];
                  const StatusIcon = cfg.icon;

                  return (
                    <motion.tr
                      key={`${candidate.candidate_id}-${candidate.job_id}`}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(index * 0.025, 0.5) }}
                      className="border-b last:border-b-0 hover:bg-muted/30 transition-colors group"
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-bold text-primary">
                              {candidate.candidate_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{candidate.candidate_name}</p>
                            {candidate.candidate_email && (
                              <p className="text-xs text-muted-foreground truncate">{candidate.candidate_email}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <Badge variant="outline" className="text-xs font-medium whitespace-nowrap">
                          {candidate.job_title}
                        </Badge>
                      </TableCell>

                      <TableCell className="text-center">
                        {typeof candidate.ats_score === 'number' ? (
                          <div className="flex justify-center"><ScoreBadge score={candidate.ats_score} size="sm" /></div>
                        ) : <span className="text-muted-foreground text-sm">—</span>}
                      </TableCell>

                      <TableCell className="text-center">
                        {typeof candidate.assessment_score === 'number' ? (
                          <div className="flex justify-center"><ScoreBadge score={candidate.assessment_score} size="sm" /></div>
                        ) : <span className="text-muted-foreground text-sm">—</span>}
                      </TableCell>

                      <TableCell className="text-center">
                        {typeof candidate.interview_score === 'number' ? (
                          <div className="flex justify-center"><ScoreBadge score={candidate.interview_score} size="sm" /></div>
                        ) : <span className="text-muted-foreground text-sm">—</span>}
                      </TableCell>

                      <TableCell className="text-center">
                        {typeof candidate.overall_score === 'number' ? (
                          <div className="flex justify-center"><ScoreBadge score={candidate.overall_score} size="sm" /></div>
                        ) : <span className="text-muted-foreground text-sm">—</span>}
                      </TableCell>

                      <TableCell>
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.badgeClass}`}
                        >
                          {StatusIcon && <StatusIcon className="h-3.5 w-3.5" />}
                          {cfg.label}
                        </span>
                      </TableCell>

                      <TableCell>
                        <Button variant="ghost" size="sm" asChild className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Link
                            to={`/candidates/${candidate.candidate_id}${candidate.job_id ? `?job_id=${candidate.job_id}` : ''}`}
                            title="View candidate details"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                      </TableCell>
                    </motion.tr>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Pagination Footer */}
        {processedCandidates.length > 0 && (
          <div className="flex items-center justify-between pt-4 border-t border-border mt-4">
            <div className="text-sm text-muted-foreground">
              Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to{' '}
              {Math.min(currentPage * ITEMS_PER_PAGE, processedCandidates.length)} of {processedCandidates.length} candidates
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <div className="text-sm font-medium px-2">
                Page {currentPage} of {totalPages}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
