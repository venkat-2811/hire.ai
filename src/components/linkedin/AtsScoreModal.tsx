import { X, Loader2, CheckCircle2, AlertCircle, MinusCircle, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MatchScoreBadge } from './MatchScoreBadge';
import { cn } from '@/lib/utils';
import type { LinkedInCandidate, AtsScoreResult } from '@/hooks/useLinkedInTalent';

interface AtsScoreModalProps {
  candidate: LinkedInCandidate;
  result: AtsScoreResult | null;
  isLoading: boolean;
  onClose: () => void;
}

function SubScoreBar({
  label,
  score,
  weight,
}: {
  label: string;
  score: number;
  weight: string;
}) {
  const color =
    score >= 80
      ? { bar: 'bg-emerald-500', text: 'text-emerald-400' }
      : score >= 60
      ? { bar: 'bg-amber-500', text: 'text-amber-400' }
      : score >= 40
      ? { bar: 'bg-orange-500', text: 'text-orange-400' }
      : { bar: 'bg-red-500', text: 'text-red-400' };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground font-medium">
          {label}{' '}
          <span className="text-muted-foreground/50 text-[10px]">({weight})</span>
        </span>
        <span className={cn('font-bold tabular-nums', color.text)}>{score}%</span>
      </div>
      <div className="h-2 rounded-full bg-muted/50 overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-700 ease-out', color.bar)}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

function RecommendationBadge({ recommendation }: { recommendation: string }) {
  const config: Record<string, { icon: typeof CheckCircle2; color: string; bg: string }> = {
    'Highly Recommended': {
      icon: CheckCircle2,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10 border-emerald-500/20',
    },
    Recommended: {
      icon: CheckCircle2,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10 border-blue-500/20',
    },
    Borderline: {
      icon: MinusCircle,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10 border-amber-500/20',
    },
    'Not Recommended': {
      icon: AlertCircle,
      color: 'text-red-400',
      bg: 'bg-red-500/10 border-red-500/20',
    },
  };

  const c = config[recommendation] ?? config['Borderline'];
  const Icon = c.icon;

  return (
    <div className={cn('flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-semibold', c.bg, c.color)}>
      <Icon className="h-4 w-4 shrink-0" />
      {recommendation}
    </div>
  );
}

export function AtsScoreModal({ candidate, result, isLoading, onClose }: AtsScoreModalProps) {
  const name = [candidate.first_name, candidate.last_name].filter(Boolean).join(' ') || 'Candidate';

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">

          {/* Header */}
          <div className="flex items-start justify-between p-5 border-b border-border shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-violet-500/10 border border-violet-500/20">
                <TrendingUp className="h-5 w-5 text-violet-400" />
              </div>
              <div>
                <h2 className="font-bold text-lg text-foreground">ATS Score</h2>
                <p className="text-sm text-muted-foreground">{name} · vs Job Description</p>
              </div>
            </div>
            <Button size="icon" variant="ghost" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto scrollbar-thin p-5 space-y-5">
            {isLoading ? (
              /* Loading skeleton */
              <div className="space-y-5">
                <div className="flex flex-col items-center gap-3 py-4">
                  <div className="w-20 h-20 rounded-full bg-muted/30 animate-pulse" />
                  <div className="h-4 w-32 bg-muted/30 rounded animate-pulse" />
                </div>
                <div className="space-y-3">
                  {['Skills Match', 'Experience Match', 'Education Match'].map((l) => (
                    <div key={l} className="space-y-1.5">
                      <div className="flex justify-between">
                        <div className="h-3 w-24 bg-muted/30 rounded animate-pulse" />
                        <div className="h-3 w-8 bg-muted/30 rounded animate-pulse" />
                      </div>
                      <div className="h-2 rounded-full bg-muted/30 animate-pulse" />
                    </div>
                  ))}
                </div>
                <div className="flex flex-col items-center gap-2 py-6 text-center">
                  <Loader2 className="h-7 w-7 animate-spin text-violet-400" />
                  <p className="text-sm text-muted-foreground">
                    AI is analyzing this profile against the JD…
                  </p>
                  <p className="text-xs text-muted-foreground/60">This takes 5–10 seconds</p>
                </div>
              </div>
            ) : result ? (
              <>
                {/* Overall Score Ring */}
                <div className="flex flex-col items-center gap-2 py-2">
                  <MatchScoreBadge score={result.overall_score} size="lg" showLabel />
                  <p className="text-xs text-muted-foreground">Overall ATS Score</p>
                </div>

                {/* Recommendation */}
                <div className="space-y-2">
                  <RecommendationBadge recommendation={result.recommendation} />
                  {result.recommendation_reason && (
                    <p className="text-xs text-muted-foreground leading-relaxed px-1">
                      {result.recommendation_reason}
                    </p>
                  )}
                </div>

                {/* Sub-score breakdown */}
                <div className="space-y-3 p-4 rounded-xl bg-muted/20 border border-border/40">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    Score Breakdown
                  </p>
                  <SubScoreBar label="Skills Match" score={result.skills_score} weight="50%" />
                  <SubScoreBar label="Experience Match" score={result.experience_score} weight="35%" />
                  <SubScoreBar label="Education Match" score={result.education_score} weight="15%" />
                </div>

                {/* Strengths */}
                {result.strengths.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Strengths
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {result.strengths.map((s, i) => (
                        <span
                          key={i}
                          className="text-[11px] px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium"
                        >
                          ✓ {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Gaps */}
                {result.gaps.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Gaps / Missing
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {result.gaps.map((g, i) => (
                        <span
                          key={i}
                          className="text-[11px] px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium"
                        >
                          ~ {g}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <AlertCircle className="h-10 w-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">Failed to load ATS score. Please try again.</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 pb-5 pt-3 border-t border-border shrink-0">
            <Button variant="outline" className="w-full" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
