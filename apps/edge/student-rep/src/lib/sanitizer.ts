/**
 * Data Sanitizer - Anonymizes data before syncing to Supabase
 * Removes all personally identifiable information while preserving pedagogical insights
 */

import { ActivityEvent, BehaviorMetric, SanitizedMetric } from "~/types";
import * as crypto from "~/lib/crypto";

/**
 * Sanitize activity event (remove PII, extract category)
 */
export function sanitizeActivityEvent(
  event: ActivityEvent,
  deviceHash: string
): Omit<ActivityEvent, "active_tab_url" | "active_tab_title"> & {
  student_device_hash: string;
} {
  return {
    ...event,
    active_tab_url: "", // Remove URL entirely
    active_tab_title: "", // Remove title entirely
    student_device_hash: deviceHash
  };
}

/**
 * Convert activity events to behavior metric (5-minute aggregate)
 */
export function aggregateEventsToBehaviorMetric(
  events: ActivityEvent[],
  deviceHash: string,
  periodStart: number,
  periodEnd: number
): BehaviorMetric {
  if (events.length === 0) {
    return {
      id: crypto.generateId(),
      student_device_hash: deviceHash,
      metric_period_start: periodStart,
      metric_period_end: periodEnd,
      avg_idle_seconds: 0,
      avg_keystrokes_per_minute: 0,
      total_tab_switches: 0,
      struggle_events_count: 0,
      focus_score: 100,
      dominant_tab_category: "other",
      synced: false,
      created_at: Date.now()
    };
  }

  // Calculate averages
  const total_idle = events.reduce((sum, e) => sum + e.idle_seconds, 0);
  const avg_idle = total_idle / events.length;

  const total_kpm = events.reduce((sum, e) => sum + e.keystrokes_per_minute, 0);
  const avg_kpm = total_kpm / events.length;

  // Count struggle events (struggle_score > 0.6)
  const struggle_count = events.filter((e) => e.struggle_score > 0.6).length;

  // Find dominant tab category
  const categoryCount = events.reduce(
    (acc, e) => {
      acc[e.tab_category] = (acc[e.tab_category] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );
  const dominant = Object.entries(categoryCount).sort(([, a], [, b]) => b - a)[0];
  const dominant_category = dominant ? dominant[0] : "other";

  // Calculate focus score (0-100)
  // Higher idle time = lower focus
  // Lower keystroke rate = lower focus
  let focus_score = 100;
  if (avg_idle > 30) {
    focus_score -= Math.min(50, ((avg_idle - 30) / 120) * 50);
  }
  if (avg_kpm < 10) {
    focus_score -= Math.min(30, ((10 - avg_kpm) / 10) * 30);
  }
  focus_score = Math.max(0, Math.min(100, focus_score));

  return {
    id: crypto.generateId(),
    student_device_hash: deviceHash,
    metric_period_start: periodStart,
    metric_period_end: periodEnd,
    avg_idle_seconds: Math.round(avg_idle * 10) / 10, // Round to 1 decimal
    avg_keystrokes_per_minute: Math.round(avg_kpm),
    total_tab_switches: events.reduce((sum, e) => sum + e.tab_switches_in_period, 0),
    struggle_events_count: struggle_count,
    focus_score: Math.round(focus_score),
    dominant_tab_category: dominant_category,
    synced: false,
    created_at: Date.now()
  };
}

/**
 * Convert behavior metric to sanitized format for Supabase sync
 */
export function sanitizeBehaviorMetricForSync(metric: BehaviorMetric): SanitizedMetric {
  return {
    device_hash: metric.student_device_hash,
    metric_period_start: new Date(metric.metric_period_start).toISOString(),
    metric_period_end: new Date(metric.metric_period_end).toISOString(),
    avg_idle_seconds: metric.avg_idle_seconds,
    avg_keystrokes_per_minute: metric.avg_keystrokes_per_minute,
    total_tab_switches: metric.total_tab_switches,
    struggle_events_count: metric.struggle_events_count,
    focus_score: metric.focus_score,
    dominant_tab_category: metric.dominant_tab_category
  };
}

/**
 * Verify sanitization (debugging helper)
 */
export function verifySanitization(original: ActivityEvent): {
  has_url: boolean;
  has_title: boolean;
  has_device_hash: boolean;
} {
  return {
    has_url: Boolean(original.active_tab_url),
    has_title: Boolean(original.active_tab_title),
    has_device_hash: Boolean((original as any).student_device_hash)
  };
}

/**
 * Calculate privacy score (0-100, higher = more private)
 */
export function calculatePrivacyScore(events: ActivityEvent[]): number {
  if (events.length === 0) return 100;

  let private_events = 0;
  for (const event of events) {
    if (!event.active_tab_url && !event.active_tab_title) {
      private_events++;
    }
  }

  return Math.round((private_events / events.length) * 100);
}
