/**
 * StatCard Component
 * Small metric card with icon, label, and value
 */

import type { ReactNode } from "react";

interface StatCardProps {
  /** Icon element (from lucide-react) */
  icon: ReactNode;
  /** Card label/title */
  label: string;
  /** Metric value to display */
  value: string | number;
  /** Optional secondary text */
  subtext?: string;
  /** Optional additional className */
  className?: string;
}

export function StatCard({
  icon,
  label,
  value,
  subtext,
  className = "",
}: StatCardProps) {
  return (
    <div
      className={`flex items-start gap-3 rounded-lg border border-muted bg-background p-3 ${className}`}
    >
      <div className="flex-shrink-0 text-primary mt-1">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground font-medium">{label}</p>
        <p className="text-lg font-semibold text-foreground mt-0.5">
          {value}
        </p>
        {subtext && (
          <p className="text-xs text-muted-foreground mt-1">{subtext}</p>
        )}
      </div>
    </div>
  );
}
