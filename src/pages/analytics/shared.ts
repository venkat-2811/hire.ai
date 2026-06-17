import type { CandidateAnalytics } from '@/lib/api';

export type StatusTab = 'all' | 'selected' | 'rejected' | 'in_process';
export type SortField = 'name' | 'ats_score' | 'assessment_score' | 'interview_score' | 'overall_score';
export type SortOrder = 'asc' | 'desc';

export function getCandidateStatus(c: CandidateAnalytics): 'selected' | 'rejected' | 'in_process' {
  const fs = c.final_status;
  if (fs === 'accepted' || fs === 'offer_sent' || fs === 'offer_accepted') return 'selected';
  if (fs === 'rejected') return 'rejected';
  return 'in_process';
}

export function avg(nums: (number | null | undefined)[]): number {
  const valid = nums.filter((n): n is number => typeof n === 'number' && !isNaN(n));
  return valid.length > 0 ? Math.round(valid.reduce((a, b) => a + b, 0) / valid.length) : 0;
}

export function pct(part: number, total: number): string {
  if (total === 0) return '0%';
  return `${Math.round((part / total) * 100)}%`;
}

export const STATUS_CONFIG = {
  selected: {
    label: 'Selected',
    badgeClass: 'bg-success/10 text-success border-success/20',
    dotClass: 'bg-success',
    color: '#22c55e',
  },
  rejected: {
    label: 'Rejected',
    badgeClass: 'bg-destructive/10 text-destructive border-destructive/20',
    dotClass: 'bg-destructive',
    color: '#ef4444',
  },
  in_process: {
    label: 'In Process',
    badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    dotClass: 'bg-amber-500',
    color: '#f59e0b',
  },
};

export const RECOMMENDATION_CONFIG: Record<string, { label: string; className: string }> = {
  strong_hire: { label: 'Strong Hire', className: 'bg-success/10 text-success border-success/20' },
  hire: { label: 'Hire', className: 'bg-info/10 text-info border-info/20' },
  borderline: { label: 'Borderline', className: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  maybe: { label: 'Maybe', className: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  no_hire: { label: 'No Hire', className: 'bg-destructive/10 text-destructive border-destructive/20' },
};

export interface AnalyticsOutletContext {
  data: CandidateAnalytics[];
  candidatesLoading: boolean;
  selectedJobId: string;
}
