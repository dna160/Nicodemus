/**
 * TimeBar Component
 * Horizontal stacked bar showing time breakdown by category
 */

interface TimeBarProps {
  /** Time spent on productive sites (ms) */
  productiveMs: number;
  /** Time spent on distraction sites (ms) */
  distractionMs: number;
  /** Time spent on neutral sites (ms) */
  neutralMs: number;
  /** Show percentage labels (default true) */
  showLabels?: boolean;
}

export function TimeBar({
  productiveMs,
  distractionMs,
  neutralMs,
  showLabels = true,
}: TimeBarProps) {
  const total = productiveMs + distractionMs + neutralMs;

  if (total === 0) {
    return (
      <div className="w-full">
        <div className="h-2 rounded bg-muted" />
        <p className="text-xs text-muted-foreground mt-1">No activity yet</p>
      </div>
    );
  }

  const productivePercent = Math.round((productiveMs / total) * 100);
  const distractionPercent = Math.round((distractionMs / total) * 100);
  const neutralPercent = Math.round((neutralMs / total) * 100);

  return (
    <div className="w-full">
      <div className="flex h-2 w-full overflow-hidden rounded bg-muted">
        {productiveMs > 0 && (
          <div
            style={{ width: `${productivePercent}%` }}
            className="bg-success transition-all"
          />
        )}
        {distractionMs > 0 && (
          <div
            style={{ width: `${distractionPercent}%` }}
            className="bg-destructive transition-all"
          />
        )}
        {neutralMs > 0 && (
          <div
            style={{ width: `${neutralPercent}%` }}
            className="bg-muted-foreground transition-all"
          />
        )}
      </div>

      {showLabels && (
        <div className="flex gap-3 mt-2 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-success" />
            <span className="text-muted-foreground">
              {productivePercent}% Focus
            </span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-destructive" />
            <span className="text-muted-foreground">
              {distractionPercent}% Distraction
            </span>
          </div>
          {neutralPercent > 0 && (
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-muted-foreground" />
              <span className="text-muted-foreground">
                {neutralPercent}% Neutral
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
