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
import { Loader2, Trophy, Eye } from 'lucide-react';
import { ScoreBadge } from '@/components/ui/score-badge';
import type { AnalyticsOutletContext } from './shared';
import { RECOMMENDATION_CONFIG } from './shared';

export default function TopPerformersPage() {
  const { data, candidatesLoading } = useOutletContext<AnalyticsOutletContext>();

  const topPerformers = useMemo(() => {
    return [...data]
      .filter((c) => c.overall_score !== null)
      .sort((a, b) => (b.overall_score ?? 0) - (a.overall_score ?? 0))
      .slice(0, 10);
  }, [data]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary" />
          <div>
            <CardTitle>Top Performing Candidates</CardTitle>
            <CardDescription>Ranked by overall score — showing top 10 candidates</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {candidatesLoading ? (
          <div className="flex items-center justify-center py-14">
            <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
          </div>
        ) : topPerformers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-muted-foreground gap-3">
            <Trophy className="h-9 w-9 opacity-25" />
            <p className="font-medium">No scored candidates yet</p>
            <p className="text-sm">Scores appear after assessments and interviews are completed.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-b-lg">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="w-12 font-semibold">Rank</TableHead>
                  <TableHead className="font-semibold">Candidate</TableHead>
                  <TableHead className="font-semibold">Role</TableHead>
                  <TableHead className="font-semibold text-center">Resume</TableHead>
                  <TableHead className="font-semibold text-center">Assessment</TableHead>
                  <TableHead className="font-semibold text-center">Interview</TableHead>
                  <TableHead className="font-semibold text-center">Overall</TableHead>
                  <TableHead className="font-semibold">Recommendation</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {topPerformers.map((candidate, index) => {
                  const rec = candidate.recommendation ? RECOMMENDATION_CONFIG[candidate.recommendation] : null;
                  const rankIcon = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`;

                  return (
                    <motion.tr
                      key={`${candidate.candidate_id}-${candidate.job_id}`}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(index * 0.04, 0.4) }}
                      className="border-b last:border-b-0 hover:bg-muted/30 transition-colors"
                    >
                      <TableCell>
                        <span className={`font-bold text-sm ${index < 3 ? 'text-lg' : 'text-muted-foreground'}`}>
                          {rankIcon}
                        </span>
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-2.5">
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
                    </motion.tr>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
