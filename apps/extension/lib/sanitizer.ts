/**
 * Session sanitizer: converts raw sessions into aggregated metrics
 * All personally identifiable info is stripped; only domains (hostnames) are retained
 */

import type { MetricPeriod, RawSession } from "~/types";
import { extractDomain } from "./domainCategories";

/**
 * Convert raw sessions for a time period into a single aggregated metric
 * This is the core data transformation before sending to Supabase
 *
 * @param sessions - Array of raw sessions to aggregate
 * @param periodStart - Start of metric period
 * @param periodEnd - End of metric period
 * @returns Aggregated metric matching IngestPayload schema
 */
export function sanitizeRawSessions(
  sessions: RawSession[],
  periodStart: Date,
  periodEnd: Date
): MetricPeriod {
  // Filter sessions that occurred during this period
  const periodStart_ms = periodStart.getTime();
  const periodEnd_ms = periodEnd.getTime();

  const sessionsInPeriod = sessions.filter((session) => {
    const sessionEnd = session.endTime || Date.now();
    // Session overlaps with period if it ended after period start and started before period end
    return sessionEnd >= periodStart_ms && session.startTime < periodEnd_ms;
  });

  // Calculate aggregate metrics
  const totalKeystrokes = sessionsInPeriod.reduce(
    (sum, s) => sum + s.keystrokes,
    0
  );
  const totalScrollEvents = sessionsInPeriod.reduce(
    (sum, s) => sum + s.scrollEvents,
    0
  );
  const totalTabSwitches = sessionsInPeriod.reduce(
    (sum, s) => sum + s.tabSwitches,
    0
  );

  // Calculate time spent by category
  const timeByCategory = calculateTimeByCategory(
    sessionsInPeriod,
    periodStart_ms,
    periodEnd_ms
  );

  const totalActiveTime =
    timeByCategory.productive + timeByCategory.distraction + timeByCategory.neutral;

  // Calculate focus score: productive time / total active time
  const focusScore =
    totalActiveTime > 0
      ? Math.round((timeByCategory.productive / totalActiveTime) * 100)
      : 0;

  // Calculate average keystrokes per minute
  const totalActiveMinutes = totalActiveTime / 1000 / 60;
  const avgKeystrokesPerMinute =
    totalActiveMinutes > 0
      ? Math.round((totalKeystrokes / totalActiveMinutes) * 10) / 10
      : 0;

  // Calculate idle time (period duration - active time)
  const periodDurationMs = periodEnd_ms - periodStart_ms;
  const idleTimeSeconds = Math.max(0, (periodDurationMs - totalActiveTime) / 1000);
  const avgIdleSeconds = Math.round(idleTimeSeconds);

  // Count "struggle events"
  // A struggle event = productive session with >10min duration but no keystrokes/scrolls
  const struggleEventsCount = sessionsInPeriod.filter((session) => {
    if (session.category !== "productive") return false;

    const sessionDuration = (session.endTime || Date.now()) - session.startTime;
    const isLongSession = sessionDuration > 10 * 60 * 1000; // 10 minutes
    const hasNoInteraction = session.keystrokes === 0 && session.scrollEvents === 0;

    return isLongSession && hasNoInteraction;
  }).length;

  // Determine dominant category
  const categoryTimings = [
    { category: "productive" as const, time: timeByCategory.productive },
    { category: "distraction" as const, time: timeByCategory.distraction },
    { category: "neutral" as const, time: timeByCategory.neutral },
  ];
  const dominantCategory =
    categoryTimings.reduce((max, current) =>
      current.time > max.time ? current : max
    ).category || "neutral";

  return {
    metric_period_start: periodStart.toISOString(),
    metric_period_end: periodEnd.toISOString(),
    avg_idle_seconds: avgIdleSeconds,
    avg_keystrokes_per_minute: avgKeystrokesPerMinute,
    total_tab_switches: totalTabSwitches,
    struggle_events_count: struggleEventsCount,
    focus_score: focusScore,
    dominant_tab_category: dominantCategory,
  };
}

/**
 * Calculate time spent in each category during a period
 * Handles overlapping sessions and partial periods
 */
function calculateTimeByCategory(
  sessions: RawSession[],
  periodStart: number,
  periodEnd: number
): Record<"productive" | "distraction" | "neutral", number> {
  const timeByCategory = {
    productive: 0,
    distraction: 0,
    neutral: 0,
  };

  for (const session of sessions) {
    const sessionStart = Math.max(session.startTime, periodStart);
    const sessionEnd = Math.min(session.endTime || Date.now(), periodEnd);

    // Only count if session actually overlaps with period
    if (sessionStart < sessionEnd) {
      const duration = sessionEnd - sessionStart;
      timeByCategory[session.category] += duration;
    }
  }

  return timeByCategory;
}

/**
 * Validate that a metric period is safe to send
 * (Does not contain any URL data, only aggregates)
 */
export function validateMetricPeriodSafety(metric: MetricPeriod): boolean {
  // Ensure no raw URL data in the metric
  const metricStr = JSON.stringify(metric);

  // Check for common URL indicators (paranoia check)
  if (metricStr.includes("http://") || metricStr.includes("https://")) {
    console.error("SECURITY: Metric contains URL data");
    return false;
  }

  // Validate numeric fields are reasonable
  if (metric.focus_score < 0 || metric.focus_score > 100) {
    console.error("SECURITY: Invalid focus score");
    return false;
  }

  if (metric.avg_idle_seconds < 0) {
    console.error("SECURITY: Invalid idle seconds");
    return false;
  }

  if (metric.avg_keystrokes_per_minute < 0) {
    console.error("SECURITY: Invalid keystrokes per minute");
    return false;
  }

  if (metric.struggle_events_count < 0) {
    console.error("SECURITY: Invalid struggle events count");
    return false;
  }

  if (metric.total_tab_switches < 0) {
    console.error("SECURITY: Invalid tab switches count");
    return false;
  }

  return true;
}
