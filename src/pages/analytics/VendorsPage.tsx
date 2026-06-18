import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Link, useOutletContext } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Loader2, Users, Eye, Building } from 'lucide-react';
import { ScoreBadge } from '@/components/ui/score-badge';
import type { AnalyticsOutletContext } from './shared';
import { RECOMMENDATION_CONFIG, getCandidateStatus, avg } from './shared';
import type { CandidateAnalytics } from '@/lib/api';

interface VendorStats {
  vendorName: string;
  candidates: CandidateAnalytics[];
  totalCandidates: number;
  hiredCandidates: number;
  avgAtsScore: number;
  avgInterviewScore: number;
  avgOverallScore: number;
}

export default function VendorsPage() {
  const { data, candidatesLoading } = useOutletContext<AnalyticsOutletContext>();

  const vendorStats = useMemo(() => {
    const vendorsMap = new Map<string, CandidateAnalytics[]>();
    
    // Group candidates by vendorName
    data.forEach((c) => {
      if (c.vendorName) {
        if (!vendorsMap.has(c.vendorName)) {
          vendorsMap.set(c.vendorName, []);
        }
        vendorsMap.get(c.vendorName)!.push(c);
      }
    });

    // Compute stats for each vendor
    const stats: VendorStats[] = Array.from(vendorsMap.entries()).map(([vendorName, candidates]) => {
      const hiredCandidates = candidates.filter((c) => getCandidateStatus(c) === 'selected').length;
      const avgAtsScore = avg(candidates.map((c) => c.ats_score));
      const avgInterviewScore = avg(candidates.map((c) => c.interview_score));
      const avgOverallScore = avg(candidates.map((c) => c.overall_score));

      return {
        vendorName,
        candidates,
        totalCandidates: candidates.length,
        hiredCandidates,
        avgAtsScore,
        avgInterviewScore,
        avgOverallScore,
      };
    });

    // Sort by total candidates descending
    return stats.sort((a, b) => b.totalCandidates - a.totalCandidates);
  }, [data]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Building className="h-5 w-5 text-primary" />
          <div>
            <CardTitle>Vendor Tracking</CardTitle>
            <CardDescription>Analyze candidate submissions and performance by third-party vendors and agencies</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {candidatesLoading ? (
          <div className="flex items-center justify-center py-14">
            <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
          </div>
        ) : vendorStats.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-muted-foreground gap-3">
            <Building className="h-9 w-9 opacity-25" />
            <p className="font-medium">No vendors found</p>
            <p className="text-sm">Candidates attributed to vendors will appear here.</p>
          </div>
        ) : (
          <div className="p-4 sm:p-6 pt-2">
            <Accordion type="single" collapsible className="w-full space-y-4">
              {vendorStats.map((vendor, index) => (
                <AccordionItem 
                  key={vendor.vendorName} 
                  value={vendor.vendorName}
                  className="border rounded-lg px-4 overflow-hidden bg-card"
                >
                  <AccordionTrigger className="hover:no-underline py-4">
                    <div className="flex flex-1 items-center justify-between pr-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Building className="h-5 w-5 text-primary" />
                        </div>
                        <div className="text-left">
                          <h3 className="font-semibold text-base">{vendor.vendorName}</h3>
                          <p className="text-xs text-muted-foreground font-normal">
                            {vendor.totalCandidates} {vendor.totalCandidates === 1 ? 'candidate' : 'candidates'} submitted
                          </p>
                        </div>
                      </div>

                      <div className="hidden sm:flex items-center gap-6 text-sm font-normal">
                        <div className="flex flex-col items-center">
                          <span className="text-muted-foreground text-xs">Hired</span>
                          <span className="font-medium">{vendor.hiredCandidates}</span>
                        </div>
                        <div className="flex flex-col items-center">
                          <span className="text-muted-foreground text-xs">Avg ATS</span>
                          <ScoreBadge score={vendor.avgAtsScore} size="sm" />
                        </div>
                        <div className="flex flex-col items-center">
                          <span className="text-muted-foreground text-xs">Avg Interview</span>
                          <ScoreBadge score={vendor.avgInterviewScore} size="sm" />
                        </div>
                        <div className="flex flex-col items-center">
                          <span className="text-muted-foreground text-xs">Avg Overall</span>
                          <ScoreBadge score={vendor.avgOverallScore} size="sm" />
                        </div>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-2 pb-4">
                    <div className="border rounded-md overflow-hidden mt-2">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/30">
                            <TableHead className="font-semibold">Candidate</TableHead>
                            <TableHead className="font-semibold">Role</TableHead>
                            <TableHead className="font-semibold text-center">Resume</TableHead>
                            <TableHead className="font-semibold text-center">Interview</TableHead>
                            <TableHead className="font-semibold text-center">Overall</TableHead>
                            <TableHead className="font-semibold">Recommendation</TableHead>
                            <TableHead className="w-10" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {vendor.candidates.map((candidate) => {
                            const rec = candidate.recommendation ? RECOMMENDATION_CONFIG[candidate.recommendation] : null;
                            return (
                              <TableRow key={candidate.candidate_id} className="hover:bg-muted/30 transition-colors">
                                <TableCell>
                                  <div className="flex items-center gap-2.5">
                                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                      <span className="text-xs font-bold text-primary">
                                        {candidate.candidate_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                                      </span>
                                    </div>
                                    <div className="min-w-0">
                                      <p className="font-medium text-sm truncate">{candidate.candidate_name}</p>
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
                                  {rec ? (
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${rec.className}`}>
                                      {rec.label}
                                    </span>
                                  ) : <span className="text-muted-foreground text-xs">—</span>}
                                </TableCell>
                                <TableCell>
                                  <Button variant="ghost" size="sm" asChild className="h-7 w-7 p-0">
                                    <Link
                                      to={`/candidates/${candidate.candidate_id}${candidate.job_id ? `?job_id=${candidate.job_id}` : ''}`}
                                      title="View candidate details"
                                    >
                                      <Eye className="h-3.5 w-3.5" />
                                    </Link>
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
