import { cn } from "@/lib/utils";
import { type InterviewStatus, type HireRecommendation } from "@/types/database";

interface StatusBadgeProps {
  status: InterviewStatus;
  className?: string;
}

const STATUS_CONFIG: Record<InterviewStatus, { label: string; class: string }> = {
  pending: { label: 'Pending', class: 'status-pending' },
  in_progress: { label: 'In Progress', class: 'status-in-progress' },
  completed: { label: 'Completed', class: 'status-completed' },
  cancelled: { label: 'Cancelled', class: 'status-failed' },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
        config.class,
        className
      )}
    >
      {config.label}
    </span>
  );
}

interface RecommendationBadgeProps {
  recommendation: HireRecommendation;
  className?: string;
}

const RECOMMENDATION_CONFIG: Record<HireRecommendation, { label: string; class: string }> = {
  strong_hire: { label: 'Strong Hire', class: 'score-excellent' },
  hire: { label: 'Hire', class: 'score-good' },
  borderline: { label: 'Borderline', class: 'score-average' },
  no_hire: { label: 'No Hire', class: 'score-poor' },
};

export function RecommendationBadge({ recommendation, className }: RecommendationBadgeProps) {
  const config = RECOMMENDATION_CONFIG[recommendation];
  
  return (
    <span
      className={cn(
        "inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold",
        config.class,
        className
      )}
    >
      {config.label}
    </span>
  );
}
