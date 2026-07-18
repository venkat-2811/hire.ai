import { useState } from 'react';
import { MapPin, Briefcase, GraduationCap, ExternalLink, Bookmark, MessageSquare, Eye, User, TrendingUp, UserPlus, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MatchScoreChip } from './MatchScoreBadge';
import { MatchScoreBadge } from './MatchScoreBadge';
import { cn } from '@/lib/utils';
import type { LinkedInCandidate } from '@/hooks/useLinkedInTalent';

interface CandidateCardProps {
  candidate: LinkedInCandidate;
  isSaved?: boolean;
  onViewProfile: (c: LinkedInCandidate) => void;
  onSave: (c: LinkedInCandidate) => void;
  onContact: (c: LinkedInCandidate) => void;
  onAtsScore?: (c: LinkedInCandidate) => void;
  onAddCandidate?: (c: LinkedInCandidate) => Promise<boolean>;
  className?: string;
}

function AvatarFallback({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();
  return (
    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
      {initials || <User className="h-5 w-5" />}
    </div>
  );
}

function SkillChip({ skill }: { skill: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-primary/8 border border-primary/15 text-[11px] font-medium text-primary/90">
      {skill}
    </span>
  );
}

export function CandidateCard({ candidate, isSaved, onViewProfile, onSave, onContact, onAtsScore, onAddCandidate, className }: CandidateCardProps) {
  const [imgError, setImgError] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [isAdded, setIsAdded] = useState(false);
  const name = [candidate.first_name, candidate.last_name].filter(Boolean).join(' ') || 'Unknown';
  const score = candidate.match_score ?? 0;

  const currentWork = candidate.work_experience?.[0];
  const currentRole = currentWork?.position;
  const currentCompany = currentWork?.company;

  const latestEdu = candidate.education?.[0];

  // Extract skill names
  const skills = (candidate.skills || []).slice(0, 6).map((s: any) => {
    if (typeof s === 'string') return s;
    return s?.name || s?.skill_name || '';
  }).filter(Boolean);

  const publicUrl = candidate.public_profile_url ||
    (candidate.public_identifier ? `https://www.linkedin.com/in/${candidate.public_identifier}` : null);

  return (
    <div className={cn(
      'group rounded-2xl border border-border/50 bg-card transition-all duration-200',
      'hover:border-blue-500/30 hover:shadow-lg hover:shadow-blue-500/5 hover:-translate-y-0.5',
      className
    )}>
      <div className="p-5">
        {/* Header */}
        <div className="flex items-start gap-3 mb-3">
          {/* Avatar */}
          {candidate.profile_picture_url && !imgError ? (
            <img
              src={candidate.profile_picture_url}
              alt={name}
              onError={() => setImgError(true)}
              className="w-12 h-12 rounded-full object-cover shrink-0 ring-2 ring-border/40"
            />
          ) : (
            <AvatarFallback name={name} />
          )}

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-sm text-foreground leading-none">{name}</h3>
              {candidate.is_premium && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 font-medium">
                  Premium
                </span>
              )}
              {candidate.is_open_profile && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-medium">
                  Open
                </span>
              )}
            </div>

            {candidate.headline && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{candidate.headline}</p>
            )}

            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
              {(currentRole || currentCompany) && (
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Briefcase className="h-3 w-3 shrink-0" />
                  <span className="truncate">{[currentRole, currentCompany].filter(Boolean).join(' @ ')}</span>
                </div>
              )}
              {candidate.location && (
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="truncate">{candidate.location}</span>
                </div>
              )}
            </div>

            {latestEdu?.school && (
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
                <GraduationCap className="h-3 w-3 shrink-0" />
                <span className="truncate">{latestEdu.school}</span>
              </div>
            )}
          </div>

          {/* Match Score Ring */}
          {score > 0 && (
            <MatchScoreBadge score={score} size="sm" className="shrink-0" />
          )}
        </div>

        {/* Skills */}
        {skills.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {skills.map((s, i) => <SkillChip key={i} skill={s} />)}
          </div>
        )}

        {/* AI Summary */}
        {candidate.ai_summary && (
          <div className="mb-3 px-3 py-2 rounded-lg bg-violet-500/5 border border-violet-500/15">
            <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
              <span className="text-violet-400 font-medium">AI: </span>
              {candidate.ai_summary}
            </p>
          </div>
        )}

        {/* Strengths / Gaps pills */}
        {((candidate.strengths?.length ?? 0) > 0 || (candidate.gaps?.length ?? 0) > 0) && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {(candidate.strengths || []).slice(0, 2).map((s, i) => (
              <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                ✓ {s}
              </span>
            ))}
            {(candidate.gaps || []).slice(0, 1).map((g, i) => (
              <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                ~ {g}
              </span>
            ))}
          </div>
        )}

        {/* ATS Score Bar */}
        {score > 0 && (() => {
          const atsColor =
            score >= 80 ? { bar: 'bg-emerald-500', text: 'text-emerald-400', track: 'bg-emerald-500/15', label: 'Excellent' }
            : score >= 60 ? { bar: 'bg-amber-500', text: 'text-amber-400', track: 'bg-amber-500/15', label: 'Strong' }
            : score >= 40 ? { bar: 'bg-orange-500', text: 'text-orange-400', track: 'bg-orange-500/15', label: 'Fair' }
            : { bar: 'bg-red-500', text: 'text-red-400', track: 'bg-red-500/15', label: 'Weak' };
          return (
            <div className="mb-3 px-3 py-2.5 rounded-lg bg-muted/30 border border-border/30">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  ATS Score
                </span>
                <div className="flex items-center gap-1.5">
                  <span className={cn('text-xs font-bold tabular-nums', atsColor.text)}>
                    {score}%
                  </span>
                  <span className={cn(
                    'text-[10px] px-1.5 py-0.5 rounded-full font-medium',
                    atsColor.track, atsColor.text
                  )}>
                    {atsColor.label}
                  </span>
                </div>
              </div>
              <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all duration-700 ease-out', atsColor.bar)}
                  style={{ width: `${score}%` }}
                />
              </div>
            </div>
          );
        })()}

        {/* Footer */}
        <div className="pt-3 border-t border-border/40 space-y-2">
          {/* Row 1: View / Save / Contact / External */}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onViewProfile(candidate)}
              className="h-7 text-xs gap-1.5 hover:bg-blue-500/10 hover:text-blue-400 flex-1"
            >
              <Eye className="h-3.5 w-3.5" />
              Full Profile
            </Button>

            <Button
              size="sm"
              variant="ghost"
              onClick={() => onSave(candidate)}
              className={cn(
                'h-7 text-xs gap-1.5',
                isSaved
                  ? 'text-amber-400 hover:bg-amber-500/10'
                  : 'hover:bg-muted/60'
              )}
            >
              <Bookmark className={cn('h-3.5 w-3.5', isSaved && 'fill-current')} />
              {isSaved ? 'Saved' : 'Save'}
            </Button>

            <Button
              size="sm"
              onClick={() => onContact(candidate)}
              className="h-7 text-xs gap-1.5 bg-blue-600 hover:bg-blue-700 text-white flex-1"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Contact
            </Button>

            {publicUrl && (
              <Button
                size="sm"
                variant="ghost"
                asChild
                className="h-7 text-xs gap-1 hover:bg-muted/60 px-2"
              >
                <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </Button>
            )}
          </div>

          {/* Row 2: ATS Score + Add Candidate */}
          {(onAtsScore || onAddCandidate) && (
            <div className="flex items-center gap-2">
              {onAtsScore && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onAtsScore(candidate)}
                  className="h-7 text-xs gap-1.5 flex-1 border-violet-500/30 text-violet-400 hover:bg-violet-500/10 hover:border-violet-500/50 hover:text-violet-300"
                >
                  <TrendingUp className="h-3.5 w-3.5" />
                  ATS Score
                </Button>
              )}
              {onAddCandidate && (
                <Button
                  size="sm"
                  onClick={async () => {
                    if (isAdded || isAdding) return;
                    setIsAdding(true);
                    const success = await onAddCandidate(candidate);
                    setIsAdding(false);
                    if (success) setIsAdded(true);
                  }}
                  disabled={isAdded || isAdding}
                  className={cn(
                    'h-7 text-xs gap-1.5 flex-1 transition-all',
                    isAdded
                      ? 'bg-emerald-600 hover:bg-emerald-600 text-white cursor-default'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  )}
                >
                  {isAdding ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : isAdded ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <UserPlus className="h-3.5 w-3.5" />
                  )}
                  {isAdded ? 'Added ✓' : isAdding ? 'Adding…' : 'Add Candidate'}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
