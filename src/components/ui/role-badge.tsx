import { cn } from "@/lib/utils";
import { ROLE_CONFIG, type JobRole } from "@/types/database";

interface RoleBadgeProps {
  role: JobRole;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  className?: string;
}

export function RoleBadge({ role, size = 'md', showIcon = true, className }: RoleBadgeProps) {
  const config = ROLE_CONFIG[role];
  
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-1.5 text-base',
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium",
        sizeClasses[size],
        config.color,
        className
      )}
    >
      {showIcon && <span>{config.icon}</span>}
      {config.label}
    </span>
  );
}
