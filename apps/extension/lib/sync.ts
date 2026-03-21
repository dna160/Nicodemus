/**
 * Sync operations to Supabase Edge Function
 * Handles metric aggregation, transmission, and storage cleanup
 */

import type { ExtensionState, IngestPayload, SyncResult } from "~/types";
import {
  clearRawSessions,
  getDeviceHash,
  getStudentId,
  setLastSyncTime,
} from "./storage";
import { sanitizeRawSessions, validateMetricPeriodSafety } from "./sanitizer";

/**
 * Sync extension state to Supabase
 * Aggregates raw sessions into metrics and sends to Edge Function
 *
 * @param state - Current extension state
 * @param periodStart - Start of sync period
 * @param periodEnd - End of sync period
 * @returns Sync result with status and error details
 */
export async function syncToSupabase(
  state: ExtensionState,
  periodStart: Date,
  periodEnd: Date
): Promise<SyncResult> {
  try {
    // Validate Supabase configuration
    const supabaseUrl = process.env.PLASMO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.PLASMO_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return {
        success: false,
        error: "Supabase not configured. Set PLASMO_PUBLIC_SUPABASE_URL and PLASMO_PUBLIC_SUPABASE_ANON_KEY",
      };
    }

    // Skip sync if no sessions to process
    if (state.rawSessions.length === 0) {
      return { success: true, metricIds: [] };
    }

    // Get device hash
    const deviceHash = await getDeviceHash();

    // Get student ID
    const studentId = await getStudentId();

    // Aggregate raw sessions into a single metric period
    const metric = sanitizeRawSessions(state.rawSessions, periodStart, periodEnd);

    // Validate metric doesn't contain raw data
    if (!validateMetricPeriodSafety(metric)) {
      return {
        success: false,
        error: "Metric validation failed: contains sensitive data",
      };
    }

    // Build payload for Edge Function
    const payload: IngestPayload = {
      device_hash: deviceHash,
      student_id: studentId || undefined,
      metrics: [metric],
      timestamp: Date.now(),
    };

    // Send to Supabase Edge Function
    const response = await fetch(
      `${supabaseUrl}/functions/v1/student-metrics-ingest`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseKey,
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      console.error(
        `Sync failed with status ${response.status}: ${errorData}`
      );

      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const responseData = (await response.json()) as {
      metric_ids?: string[];
    };

    // Clear raw sessions only on successful sync
    await clearRawSessions();
    await setLastSyncTime(Date.now());

    return {
      success: true,
      metricIds: responseData.metric_ids || [],
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("Sync error:", errorMessage);

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Check if we should perform a sync based on timing
 * Returns true if enough time has passed since last sync
 *
 * @param lastSyncTime - Unix timestamp of last sync
 * @param minIntervalMs - Minimum interval between syncs (default 60min)
 * @returns True if sync should be performed
 */
export function shouldSync(
  lastSyncTime: number,
  minIntervalMs: number = 60 * 60 * 1000
): boolean {
  return Date.now() - lastSyncTime >= minIntervalMs;
}

/**
 * Get the sync period (typically last hour)
 * Used to determine what time range to aggregate metrics for
 *
 * @param intervalMinutes - Minutes back to sync (default 60)
 * @returns [periodStart, periodEnd] as Date objects
 */
export function getSyncPeriod(
  intervalMinutes: number = 60
): [Date, Date] {
  const now = new Date();
  const start = new Date(now.getTime() - intervalMinutes * 60 * 1000);

  return [start, now];
}
