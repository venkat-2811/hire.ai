export function CandidateSkeletonCard() {
  return (
    <div className="rounded-2xl border border-border/50 bg-card p-5 animate-pulse">
      {/* Header row */}
      <div className="flex items-start gap-4 mb-4">
        {/* Avatar */}
        <div className="w-12 h-12 rounded-full bg-muted flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-36 bg-muted rounded" />
          <div className="h-3 w-52 bg-muted/60 rounded" />
          <div className="h-3 w-28 bg-muted/40 rounded" />
        </div>
        {/* Score ring */}
        <div className="w-14 h-14 rounded-full bg-muted flex-shrink-0" />
      </div>

      {/* Skills chips */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {[48, 64, 56, 40, 72].map((w, i) => (
          <div key={i} className="h-5 rounded-full bg-muted/60" style={{ width: w }} />
        ))}
      </div>

      {/* Summary text */}
      <div className="space-y-1.5 mb-4">
        <div className="h-3 w-full bg-muted/40 rounded" />
        <div className="h-3 w-5/6 bg-muted/40 rounded" />
        <div className="h-3 w-4/6 bg-muted/30 rounded" />
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-2 border-t border-border/40">
        <div className="h-8 flex-1 rounded-lg bg-muted/50" />
        <div className="h-8 w-24 rounded-lg bg-muted/50" />
        <div className="h-8 w-28 rounded-lg bg-muted/50" />
      </div>
    </div>
  );
}

export function SearchFiltersSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="space-y-1.5">
          <div className="h-3 w-20 bg-muted/50 rounded" />
          <div className="h-9 w-full bg-muted/40 rounded-lg" />
        </div>
      ))}
    </div>
  );
}
