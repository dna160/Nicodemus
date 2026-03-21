/**
 * FocusRing Component
 * SVG circular progress ring showing focus score 0-100
 */

interface FocusRingProps {
  /** Focus score from 0-100 */
  score: number;
  /** Size in pixels (default 120) */
  size?: number;
  /** Stroke width in pixels (default 8) */
  strokeWidth?: number;
}

export function FocusRing({
  score,
  size = 120,
  strokeWidth = 8,
}: FocusRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - Math.min(score, 100) / 100);

  // Color based on score: red (0-40), yellow (40-70), green (70-100)
  let color = "#ef4444"; // red
  if (score >= 70) {
    color = "#10b981"; // green
  } else if (score >= 40) {
    color = "#f59e0b"; // amber
  }

  return (
    <div className="flex flex-col items-center justify-center gap-2">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="var(--muted, #f3f4f6)"
          strokeWidth={strokeWidth}
          fill="none"
        />

        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-500 ease-out"
        />
      </svg>

      {/* Score text */}
      <div className="flex flex-col items-center">
        <span className="text-2xl font-bold text-foreground">{score}</span>
        <span className="text-xs text-muted-foreground">Focus Score</span>
      </div>
    </div>
  );
}
