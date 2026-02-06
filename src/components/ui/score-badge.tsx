import { cn } from "@/lib/utils";

interface ScoreBadgeProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

export function ScoreBadge({ score, size = 'md', showLabel = false, className }: ScoreBadgeProps) {
  const normalizedScore = Math.round(score);

  const getScoreCategory = (score: number) => {
    if (score >= 85) return { label: 'Excellent', class: 'score-excellent' };
    if (score >= 70) return { label: 'Good', class: 'score-good' };
    if (score >= 50) return { label: 'Average', class: 'score-average' };
    return { label: 'Poor', class: 'score-poor' };
  };

  const category = getScoreCategory(normalizedScore);
  
  const sizeClasses = {
    sm: 'h-6 w-6 text-xs',
    md: 'h-10 w-10 text-sm font-medium',
    lg: 'h-14 w-14 text-lg font-semibold',
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        className={cn(
          "flex items-center justify-center rounded-full",
          sizeClasses[size],
          category.class
        )}
      >
        {normalizedScore}
      </div>
      {showLabel && (
        <span className="text-sm text-muted-foreground">{category.label}</span>
      )}
    </div>
  );
}
