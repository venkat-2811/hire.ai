import { cn } from '@/lib/utils';

interface MatchScoreBadgeProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

function getScoreColor(score: number): { ring: string; text: string; bg: string } {
  if (score >= 80) return { ring: 'stroke-emerald-500', text: 'text-emerald-400', bg: 'bg-emerald-500/10' };
  if (score >= 60) return { ring: 'stroke-amber-500', text: 'text-amber-400', bg: 'bg-amber-500/10' };
  if (score >= 40) return { ring: 'stroke-orange-500', text: 'text-orange-400', bg: 'bg-orange-500/10' };
  return { ring: 'stroke-red-500', text: 'text-red-400', bg: 'bg-red-500/10' };
}

function getScoreLabel(score: number): string {
  if (score >= 85) return 'Excellent';
  if (score >= 70) return 'Strong';
  if (score >= 55) return 'Good';
  if (score >= 40) return 'Fair';
  return 'Weak';
}

const SIZES = {
  sm: { svgSize: 40, strokeWidth: 3, fontSize: 'text-[9px]', radius: 16 },
  md: { svgSize: 56, strokeWidth: 4, fontSize: 'text-[11px]', radius: 22 },
  lg: { svgSize: 72, strokeWidth: 5, fontSize: 'text-sm', radius: 29 },
};

export function MatchScoreBadge({ score, size = 'md', showLabel = false, className }: MatchScoreBadgeProps) {
  const { ring, text, bg } = getScoreColor(score);
  const { svgSize, strokeWidth, fontSize, radius } = SIZES[size];
  const circumference = 2 * Math.PI * radius;
  const filled = (score / 100) * circumference;
  const cx = svgSize / 2;
  const cy = svgSize / 2;

  return (
    <div className={cn('flex flex-col items-center gap-1', className)}>
      <div className={cn('relative rounded-full flex items-center justify-center', bg)}
        style={{ width: svgSize, height: svgSize }}>
        <svg
          width={svgSize}
          height={svgSize}
          className="absolute inset-0 -rotate-90"
          viewBox={`0 0 ${svgSize} ${svgSize}`}
        >
          {/* Track */}
          <circle
            cx={cx} cy={cy} r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-muted/30"
          />
          {/* Fill */}
          <circle
            cx={cx} cy={cy} r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - filled}
            className={cn(ring, 'transition-all duration-700 ease-out')}
          />
        </svg>
        <span className={cn('font-bold tabular-nums relative z-10', fontSize, text)}>
          {score}%
        </span>
      </div>
      {showLabel && (
        <span className={cn('text-xs font-medium', text)}>{getScoreLabel(score)}</span>
      )}
    </div>
  );
}

// Inline badge variant for cards
export function MatchScoreChip({ score, className }: { score: number; className?: string }) {
  const { text, bg } = getScoreColor(score);
  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold',
      bg, text, className
    )}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
      {score}% Match
    </span>
  );
}
