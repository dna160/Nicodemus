/**
 * NudgeCard Component
 * Intervention message for distraction site usage
 */

import { AlertCircle } from "lucide-react";

interface NudgeCardProps {
  /** Domain name (hostname) */
  domain: string;
  /** Duration spent on domain in minutes */
  duration: number;
  /** Callback when snooze button clicked */
  onSnooze: () => void;
  /** Callback when dismiss button clicked */
  onDismiss: () => void;
}

export function NudgeCard({
  domain,
  duration,
  onSnooze,
  onDismiss,
}: NudgeCardProps) {
  const cleanDomain = domain.replace("www.", "");

  return (
    <div className="flex flex-col items-center gap-4 p-4 bg-gradient-to-b from-destructive/10 to-background rounded-lg border border-destructive/20">
      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-destructive/20">
        <AlertCircle className="w-6 h-6 text-destructive" />
      </div>

      <div className="text-center">
        <h3 className="text-sm font-semibold text-foreground">
          Stay Focused!
        </h3>
        <p className="text-xs text-muted-foreground mt-2">
          You've been on <span className="font-medium">{cleanDomain}</span> for{" "}
          <span className="font-medium">{duration} minutes</span>. Consider
          switching to a study site.
        </p>
      </div>

      <div className="flex gap-2 w-full">
        <button
          onClick={onDismiss}
          className="flex-1 py-2 px-3 text-xs font-medium rounded border border-muted-foreground/30 text-muted-foreground hover:bg-muted transition-colors"
        >
          Dismiss
        </button>
        <button
          onClick={onSnooze}
          className="flex-1 py-2 px-3 text-xs font-medium rounded bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
        >
          Snooze 10 min
        </button>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        You can always come back to this later.
      </p>
    </div>
  );
}
