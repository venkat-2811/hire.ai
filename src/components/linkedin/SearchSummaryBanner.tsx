import { Users, Search, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SearchSummaryBannerProps {
  requested: number;
  retrieved: number;
  ranked?: boolean;
  className?: string;
}

export function SearchSummaryBanner({ requested, retrieved, ranked, className }: SearchSummaryBannerProps) {
  const isShortfall = retrieved < requested;
  const pct = requested > 0 ? Math.round((retrieved / requested) * 100) : 0;

  return (
    <div className={cn(
      'rounded-xl border p-4 flex items-start gap-4',
      isShortfall
        ? 'bg-amber-500/5 border-amber-500/20'
        : 'bg-blue-500/5 border-blue-500/20',
      className
    )}>
      <div className={cn(
        'rounded-lg p-2 shrink-0',
        isShortfall ? 'bg-amber-500/10' : 'bg-blue-500/10'
      )}>
        {isShortfall ? (
          <Info className="h-5 w-5 text-amber-400" />
        ) : (
          <Users className="h-5 w-5 text-blue-400" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="text-sm">
            <span className="text-muted-foreground">Requested: </span>
            <span className="font-bold text-foreground">{requested}</span>
          </div>
          <div className="text-sm">
            <span className="text-muted-foreground">Retrieved: </span>
            <span className={cn(
              'font-bold',
              isShortfall ? 'text-amber-400' : 'text-emerald-400'
            )}>{retrieved}</span>
          </div>
          {ranked && (
            <div className="text-sm">
              <span className="text-muted-foreground">Sorted by: </span>
              <span className="font-semibold text-violet-400">AI Match Score</span>
            </div>
          )}
        </div>

        {isShortfall && (
          <p className="text-xs text-amber-400/80 mt-1">
            Only {retrieved} matching candidates were found based on your selected criteria.
          </p>
        )}

        {/* Progress bar */}
        <div className="mt-2.5 h-1.5 rounded-full bg-border/40 overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-700',
              isShortfall ? 'bg-amber-400' : 'bg-blue-400'
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="shrink-0 text-right">
        <div className="text-xl font-black tabular-nums text-foreground">{retrieved}</div>
        <div className="text-xs text-muted-foreground">Profiles</div>
      </div>
    </div>
  );
}
