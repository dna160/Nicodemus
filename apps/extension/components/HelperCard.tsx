/**
 * HelperCard Component
 * Single study tip or encouragement message
 */

import type { ReactNode } from "react";

interface HelperCardProps {
  /** Icon to display (from lucide-react) */
  icon: ReactNode;
  /** Title of the tip */
  title: string;
  /** Detailed tip text */
  description: string;
  /** Optional action button text */
  actionText?: string;
  /** Callback when action button clicked */
  onAction?: () => void;
}

export function HelperCard({
  icon,
  title,
  description,
  actionText,
  onAction,
}: HelperCardProps) {
  return (
    <div className="rounded-lg border border-muted bg-muted/50 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 text-primary mt-0.5">{icon}</div>
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-foreground">{title}</h4>
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        </div>
      </div>

      {actionText && (
        <button
          onClick={onAction}
          className="w-full py-2 px-3 text-xs font-medium rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
        >
          {actionText}
        </button>
      )}
    </div>
  );
}
