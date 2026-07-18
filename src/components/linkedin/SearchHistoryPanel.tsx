import { RotateCcw, Clock, Search, Users, MessageSquare, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSearchHistory } from '@/hooks/useLinkedInTalent';
import type { LinkedInFilters } from '@/hooks/useLinkedInTalent';
import { cn } from '@/lib/utils';

interface SearchHistoryPanelProps {
  jobId: string;
  onRerun: (filters: LinkedInFilters, count: number) => void;
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function FilterChips({ filters }: { filters: LinkedInFilters }) {
  const chips: string[] = [];
  if (filters.keywords) chips.push(filters.keywords);
  (filters.skills || []).slice(0, 3).forEach(s => chips.push(s));
  if (filters.location) chips.push(`📍 ${filters.location}`);
  if (filters.seniority) chips.push(filters.seniority);

  if (chips.length === 0) return <span className="text-xs text-muted-foreground/60">No filters</span>;

  return (
    <div className="flex flex-wrap gap-1">
      {chips.map((c, i) => (
        <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground">
          {c}
        </span>
      ))}
    </div>
  );
}

export function SearchHistoryPanel({ jobId, onRerun }: SearchHistoryPanelProps) {
  const { data, isLoading } = useSearchHistory(jobId);
  const searches = data?.searches || [];

  if (isLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-20 rounded-xl bg-muted/30" />
        ))}
      </div>
    );
  }

  if (searches.length === 0) {
    return (
      <div className="text-center py-10">
        <div className="w-12 h-12 rounded-full bg-muted/30 flex items-center justify-center mx-auto mb-3">
          <Clock className="h-5 w-5 text-muted-foreground/50" />
        </div>
        <p className="text-sm text-muted-foreground">No previous searches for this job.</p>
        <p className="text-xs text-muted-foreground/60 mt-1">Run a LinkedIn search to build history.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
        {searches.length} previous search{searches.length !== 1 ? 'es' : ''}
      </p>
      {searches.map((s) => (
        <div
          key={s.id}
          className="rounded-xl border border-border/50 bg-card p-4 hover:border-blue-500/30 transition-colors"
        >
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3 w-3 shrink-0" />
              {formatRelativeTime(s.created_at)}
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
              <div className="flex items-center gap-1">
                <Search className="h-3 w-3" />
                {s.profiles_retrieved}/{s.candidate_count_requested}
              </div>
              {s.candidates_contacted > 0 && (
                <div className="flex items-center gap-1 text-blue-400">
                  <MessageSquare className="h-3 w-3" />
                  {s.candidates_contacted}
                </div>
              )}
            </div>
          </div>

          <FilterChips filters={s.filters} />

          <div className="flex items-center justify-between mt-3">
            <div className="flex gap-1.5">
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {s.profiles_retrieved} profiles
              </Badge>
              {s.candidates_contacted > 0 && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-blue-500/30 text-blue-400">
                  {s.candidates_contacted} contacted
                </Badge>
              )}
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onRerun(s.filters, s.candidate_count_requested)}
              className="h-6 text-xs gap-1 hover:bg-blue-500/10 hover:text-blue-400"
            >
              <RotateCcw className="h-3 w-3" />
              Rerun
              <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
