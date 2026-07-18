import { useState } from 'react';
import {
  X, MapPin, Briefcase, GraduationCap, Globe, Award, Languages,
  Users, ExternalLink, ChevronDown, ChevronUp, MessageSquare, Bookmark, Star
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MatchScoreBadge } from './MatchScoreBadge';
import { cn } from '@/lib/utils';
import type { LinkedInCandidate } from '@/hooks/useLinkedInTalent';

interface CandidateProfileDrawerProps {
  candidate: LinkedInCandidate | null;
  isSaved?: boolean;
  onClose: () => void;
  onContact: (c: LinkedInCandidate) => void;
  onSave: (c: LinkedInCandidate) => void;
}

function Section({ title, icon: Icon, children, defaultOpen = true }: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-border/40 last:border-0">
      <button
        className="w-full flex items-center justify-between py-3 px-4 hover:bg-muted/30 transition-colors text-left"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Icon className="h-4 w-4 text-muted-foreground" />
          {title}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

function formatDate(d?: string | null) {
  if (!d) return 'Present';
  try {
    return new Date(d).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  } catch {
    return d;
  }
}

export function CandidateProfileDrawer({
  candidate, isSaved, onClose, onContact, onSave
}: CandidateProfileDrawerProps) {
  const [imgError, setImgError] = useState(false);

  if (!candidate) return null;

  const name = [candidate.first_name, candidate.last_name].filter(Boolean).join(' ') || 'Unknown';
  const score = candidate.match_score ?? 0;
  const publicUrl = candidate.public_profile_url ||
    (candidate.public_identifier ? `https://www.linkedin.com/in/${candidate.public_identifier}` : null);

  const skills = (candidate.skills || []).map((s: any) => {
    if (typeof s === 'string') return s;
    return s?.name || s?.skill_name || '';
  }).filter(Boolean);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-[480px] max-w-full bg-background border-l border-border shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="relative">
          {/* Background picture */}
          {candidate.public_identifier && (
            <div className="h-24 bg-gradient-to-br from-blue-600/30 via-violet-600/20 to-background" />
          )}
          <div className={cn('px-5 pb-4', candidate.public_identifier ? '-mt-8' : 'pt-5')}>
            <div className="flex items-end justify-between mb-3">
              <div className="flex items-end gap-3">
                {candidate.profile_picture_url_large || candidate.profile_picture_url && !imgError ? (
                  <img
                    src={candidate.profile_picture_url_large || candidate.profile_picture_url}
                    alt={name}
                    onError={() => setImgError(true)}
                    className="w-16 h-16 rounded-full object-cover ring-4 ring-background shadow-lg"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white font-bold text-xl ring-4 ring-background shadow-lg">
                    {name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()}
                  </div>
                )}
                <div className="mb-1">
                  <h2 className="font-bold text-lg text-foreground leading-none">{name}</h2>
                  {candidate.headline && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{candidate.headline}</p>
                  )}
                </div>
              </div>
              <Button size="icon" variant="ghost" onClick={onClose} className="shrink-0">
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Meta row */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3">
              {candidate.location && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" />{candidate.location}
                </div>
              )}
              {candidate.connections_count != null && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Users className="h-3 w-3" />{candidate.connections_count} connections
                </div>
              )}
              {candidate.follower_count != null && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Star className="h-3 w-3" />{candidate.follower_count.toLocaleString()} followers
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {score > 0 && <MatchScoreBadge score={score} size="sm" showLabel />}
              {candidate.network_distance && (
                <Badge variant="outline" className="text-[10px]">{candidate.network_distance}</Badge>
              )}
              {candidate.is_premium && (
                <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-[10px]">Premium</Badge>
              )}
              {candidate.is_open_profile && (
                <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px]">Open Profile</Badge>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 mt-3">
              <Button size="sm" onClick={() => onContact(candidate)} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white gap-1.5">
                <MessageSquare className="h-3.5 w-3.5" />
                Contact
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onSave(candidate)}
                className={cn('gap-1.5', isSaved && 'text-amber-400 border-amber-500/40')}
              >
                <Bookmark className={cn('h-3.5 w-3.5', isSaved && 'fill-current')} />
                {isSaved ? 'Saved' : 'Save'}
              </Button>
              {publicUrl && (
                <Button size="sm" variant="outline" asChild className="gap-1.5">
                  <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3.5 w-3.5" />
                    LinkedIn
                  </a>
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto divide-y divide-border/30">
          {/* About */}
          {candidate.summary && (
            <Section title="About" icon={Users}>
              <p className="text-sm text-muted-foreground leading-relaxed">{candidate.summary}</p>
            </Section>
          )}

          {/* AI Summary */}
          {candidate.ai_summary && (
            <Section title="AI Match Summary" icon={Star}>
              <div className="rounded-lg bg-violet-500/5 border border-violet-500/15 p-3">
                <p className="text-sm text-muted-foreground leading-relaxed">{candidate.ai_summary}</p>
              </div>
              {(candidate.strengths?.length ?? 0) > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {candidate.strengths!.map((s, i) => (
                    <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">✓ {s}</span>
                  ))}
                </div>
              )}
              {(candidate.gaps?.length ?? 0) > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {candidate.gaps!.map((g, i) => (
                    <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">~ {g}</span>
                  ))}
                </div>
              )}
            </Section>
          )}

          {/* Experience */}
          {(candidate.work_experience?.length ?? 0) > 0 && (
            <Section title="Experience" icon={Briefcase}>
              <div className="space-y-4">
                {candidate.work_experience!.map((exp, i) => (
                  <div key={i} className="flex gap-3">
                    {exp.company_picture_url ? (
                      <img src={exp.company_picture_url} alt={exp.company} className="w-8 h-8 rounded object-cover shrink-0 mt-0.5" />
                    ) : (
                      <div className="w-8 h-8 rounded bg-muted/50 flex items-center justify-center shrink-0 mt-0.5">
                        <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-semibold text-foreground leading-none">{exp.position}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{exp.company}</p>
                      {exp.location && <p className="text-xs text-muted-foreground/60">{exp.location}</p>}
                      <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                        {formatDate(exp.start)} — {formatDate(exp.end)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Education */}
          {(candidate.education?.length ?? 0) > 0 && (
            <Section title="Education" icon={GraduationCap}>
              <div className="space-y-3">
                {candidate.education!.map((edu, i) => (
                  <div key={i} className="flex gap-3">
                    {edu.school_picture_url ? (
                      <img src={edu.school_picture_url} alt={edu.school} className="w-8 h-8 rounded object-cover shrink-0 mt-0.5" />
                    ) : (
                      <div className="w-8 h-8 rounded bg-muted/50 flex items-center justify-center shrink-0 mt-0.5">
                        <GraduationCap className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-semibold text-foreground">{edu.school}</p>
                      {edu.degree && <p className="text-xs text-muted-foreground">{edu.degree}</p>}
                      <p className="text-[11px] text-muted-foreground/60">
                        {formatDate(edu.start)}{edu.end ? ` — ${formatDate(edu.end)}` : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Skills */}
          {skills.length > 0 && (
            <Section title={`Skills (${skills.length})`} icon={Award}>
              <div className="flex flex-wrap gap-1.5">
                {skills.map((s, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">{s}</Badge>
                ))}
              </div>
            </Section>
          )}

          {/* Certifications */}
          {(candidate.certifications?.length ?? 0) > 0 && (
            <Section title="Certifications" icon={Award} defaultOpen={false}>
              <div className="space-y-2">
                {candidate.certifications!.map((c: any, i) => (
                  <div key={i}>
                    <p className="text-sm font-medium text-foreground">{c.name}</p>
                    {c.issuer && <p className="text-xs text-muted-foreground">{c.issuer}</p>}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Languages */}
          {(candidate.languages?.length ?? 0) > 0 && (
            <Section title="Languages" icon={Languages} defaultOpen={false}>
              <div className="flex flex-wrap gap-1.5">
                {candidate.languages!.map((l: any, i) => (
                  <Badge key={i} variant="outline" className="text-xs">
                    {l.name || l}{l.proficiency ? ` · ${l.proficiency}` : ''}
                  </Badge>
                ))}
              </div>
            </Section>
          )}

          {/* Websites */}
          {(candidate.websites?.length ?? 0) > 0 && (
            <Section title="Websites" icon={Globe} defaultOpen={false}>
              <div className="space-y-1">
                {candidate.websites!.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-sm text-blue-400 hover:underline">
                    <Globe className="h-3 w-3" />
                    {url}
                  </a>
                ))}
              </div>
            </Section>
          )}
        </div>
      </div>
    </>
  );
}
