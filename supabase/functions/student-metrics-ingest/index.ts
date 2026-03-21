/**
 * Supabase Edge Function: Student Metrics Ingestion
 *
 * Purpose: Privacy-first data ingestion pipeline from Student Edge browser extension
 * 1. Handle CORS for extension origins (chrome-extension://)
 * 2. Validate incoming payload schema
 * 3. Implement rate limiting per device_hash
 * 4. Verify student_id if provided (gracefully skip if not found)
 * 5. Sanitize string inputs (strip HTML, validate formats)
 * 6. Call summarization logic for AI-generated insights
 * 7. Insert metrics to database with all extension fields
 * 8. Emit Inngest events for low focus scenarios
 * 9. Return metric IDs and summary
 *
 * SCHEMA DESIGN NOTE:
 * - IngestPayload.student_id: TEXT format from extension (e.g., "NIC-JD2026-ABCD")
 * - Database column student_id: UUID FK to users.id (enrolled students only)
 * - Database column student_nicodemus_id: TEXT from extension payload
 * This allows metrics from pre-enrollment (device_hash only) and post-enrollment (both fields populated)
 *
 * Endpoint: POST /functions/v1/student-metrics-ingest
 * CORS: Allows chrome-extension:// origins for browser extension requests
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

// ============================================================
// Rate Limiting: In-memory store (resets per Edge Function instance)
// ============================================================
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 3600 * 1000; // 1 hour
const RATE_LIMIT_MAX_REQUESTS = 20; // 20 requests per hour per device_hash

/**
 * Check rate limit for device_hash. Returns true if within limit, false if exceeded.
 */
function checkRateLimit(deviceHash: string): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(deviceHash) ?? [];

  // Remove timestamps older than the window
  const recentTimestamps = timestamps.filter(
    (ts) => now - ts < RATE_LIMIT_WINDOW_MS
  );

  if (recentTimestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
    return false; // Rate limit exceeded
  }

  recentTimestamps.push(now);
  rateLimitMap.set(deviceHash, recentTimestamps);
  return true;
}

/**
 * Get seconds until rate limit resets for a device_hash
 */
function getRetryAfterSeconds(deviceHash: string): number {
  const timestamps = rateLimitMap.get(deviceHash) ?? [];
  if (timestamps.length === 0) return 0;

  const oldestTimestamp = timestamps[0];
  const now = Date.now();
  const msUntilReset = RATE_LIMIT_WINDOW_MS - (now - oldestTimestamp);

  return Math.max(0, Math.ceil(msUntilReset / 1000));
}

// ============================================================
// CORS Headers: Support chrome-extension:// origins
// ============================================================
const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*", // Extension origins vary per installation
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, apikey, Authorization",
  "Content-Type": "application/json",
};

// ============================================================
// Input Sanitization & Validation
// ============================================================

/**
 * Strip HTML tags and limit string length
 */
function sanitizeString(input: string, maxLength: number = 500): string {
  if (typeof input !== "string") return "";
  // Remove HTML tags: <...>
  const stripped = input.replace(/<[^>]*>/g, "");
  // Trim to max length
  return stripped.substring(0, maxLength).trim();
}

/**
 * Validate ISO 8601 timestamp
 */
function isValidISO8601(timestamp: string): boolean {
  if (typeof timestamp !== "string") return false;
  // Basic ISO 8601 validation: YYYY-MM-DDTHH:MM:SSZ or with timezone offset
  const iso8601Regex =
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})$/;
  return iso8601Regex.test(timestamp);
}

/**
 * Validate dominant_tab_category is one of allowed values
 */
function isValidActivityCategory(
  category: string
): category is "productive" | "distraction" | "neutral" {
  return ["productive", "distraction", "neutral"].includes(category);
}

/**
 * Validate focus_score is between 0 and 100
 */
function isValidFocusScore(score: number): boolean {
  return typeof score === "number" && score >= 0 && score <= 100;
}

interface Metric {
  metric_period_start: string; // ISO 8601
  metric_period_end: string;
  avg_idle_seconds: number;
  avg_keystrokes_per_minute: number;
  total_tab_switches: number;
  struggle_events_count: number;
  focus_score: number;
  dominant_tab_category: string;
}

interface IngestPayload {
  device_hash: string;
  school_id?: string; // Optional: UUID of school
  student_id?: string; // Optional: Student ID from extension (e.g., "NIC-JD2026-ABCD") - TEXT format
  metrics: Metric[];
  timestamp: number; // Unix timestamp
}

interface SummarizationResponse {
  summary: string;
  focus_level: "high" | "normal" | "low";
  fatigue_indicator: "none" | "mild" | "moderate" | "severe";
  recommendations: string[];
}

interface InsertRecord {
  device_hash: string;
  school_id: string | null;
  student_id: string | null;                    // UUID FK to enrolled students (null for pre-enrollment)
  student_nicodemus_id: string | null;          // TEXT student ID from extension (e.g., "NIC-JD2026-ABCD")
  metric_period_start: string;
  metric_period_end: string;
  focus_score: number;
  struggle_events_count: number;                // [REVISED] was missing from original migration
  avg_idle_seconds: number;
  avg_keystrokes_per_minute: number;
  total_tab_switches: number;
  dominant_activity: string;                    // [REVISED] was missing from original migration
  summary: string;                              // [REVISED] was missing from original migration
  focus_level: "high" | "normal" | "low";
  fatigue_indicator: "none" | "mild" | "moderate" | "severe";
  recommendations: string[];
}

/**
 * Validate incoming payload schema
 * Returns true if payload matches IngestPayload interface
 */
function validatePayload(payload: unknown): payload is IngestPayload {
  if (!payload || typeof payload !== "object") return false;

  const p = payload as any;

  // Top-level field validation
  if (typeof p.device_hash !== "string" || p.device_hash.length === 0) {
    return false;
  }

  if (!Array.isArray(p.metrics) || p.metrics.length === 0) {
    return false;
  }

  if (typeof p.timestamp !== "number" || p.timestamp <= 0) {
    return false;
  }

  // Optional: school_id should be a string if provided
  if (p.school_id !== undefined && typeof p.school_id !== "string") {
    return false;
  }

  // Optional: student_id should be a string if provided
  if (p.student_id !== undefined && typeof p.student_id !== "string") {
    return false;
  }

  // Validate each metric
  return p.metrics.every((m: any) => {
    // Required fields with type checks
    if (
      typeof m.metric_period_start !== "string" ||
      !isValidISO8601(m.metric_period_start)
    ) {
      return false;
    }

    if (
      typeof m.metric_period_end !== "string" ||
      !isValidISO8601(m.metric_period_end)
    ) {
      return false;
    }

    if (typeof m.avg_idle_seconds !== "number" || m.avg_idle_seconds < 0) {
      return false;
    }

    if (
      typeof m.avg_keystrokes_per_minute !== "number" ||
      m.avg_keystrokes_per_minute < 0
    ) {
      return false;
    }

    if (typeof m.total_tab_switches !== "number" || m.total_tab_switches < 0) {
      return false;
    }

    if (
      typeof m.struggle_events_count !== "number" ||
      m.struggle_events_count < 0
    ) {
      return false;
    }

    if (!isValidFocusScore(m.focus_score)) {
      return false;
    }

    if (!isValidActivityCategory(m.dominant_tab_category)) {
      return false;
    }

    return true;
  });
}

/**
 * Validate student_id exists in the prospective_students table
 * Returns true if student_id is found, or if student_id is not provided
 * (Graceful degradation: missing student_ids don't hard-fail)
 */
async function validateStudentId(studentId: string | undefined): Promise<boolean> {
  if (!studentId) {
    // No student_id provided is valid (device_hash links sessions before account creation)
    return true;
  }

  try {
    const { data, error } = await supabase
      .from("prospective_students")
      .select("id")
      .eq("student_id", studentId)
      .maybeSingle();

    if (error) {
      console.warn(`[Validation] Error checking student_id: ${error.message}`);
      // Gracefully continue even if validation fails
      return true;
    }

    if (!data) {
      console.warn(`[Validation] Student ID not found: ${studentId}`);
      // Still return true to allow insertion (device_hash links before account creation)
      return true;
    }

    return true;
  } catch (err) {
    console.warn(`[Validation] Exception checking student_id: ${err}`);
    // Gracefully continue on exception
    return true;
  }
}

/**
 * Summarize metrics batch using rule-based logic
 * Returns summary, focus_level, fatigue_indicator, and recommendations
 * Future: Can be enhanced to call external ML service (Modal, etc.)
 */
function summarizeMetrics(metrics: Metric[]): SummarizationResponse {
  // Aggregate metrics for batch
  const avgFocusScore =
    metrics.reduce((sum, m) => sum + m.focus_score, 0) / metrics.length;
  const totalStruggleEvents = metrics.reduce(
    (sum, m) => sum + m.struggle_events_count,
    0
  );
  const avgIdleSeconds =
    metrics.reduce((sum, m) => sum + m.avg_idle_seconds, 0) / metrics.length;
  const avgKeystrokesPerMinute =
    metrics.reduce((sum, m) => sum + m.avg_keystrokes_per_minute, 0) /
    metrics.length;
  const totalTabSwitches = metrics.reduce(
    (sum, m) => sum + m.total_tab_switches,
    0
  );

  // Determine focus level based on focus_score
  let focusLevel: "high" | "normal" | "low" = "normal";
  if (avgFocusScore > 80) focusLevel = "high";
  else if (avgFocusScore < 50) focusLevel = "low";

  // Determine fatigue based on idle time
  let fatigueIndicator: "none" | "mild" | "moderate" | "severe" = "none";
  if (avgIdleSeconds > 20) fatigueIndicator = "mild";
  if (avgIdleSeconds > 40) fatigueIndicator = "moderate";
  if (avgIdleSeconds > 60) fatigueIndicator = "severe";

  // Generate human-readable summary
  let summary = "";
  if (focusLevel === "high") {
    summary = `Excellent focus during study session. ${totalStruggleEvents} moments of difficulty across ${metrics.length} metric(s).`;
  } else if (focusLevel === "normal") {
    summary = `Good focus with ${totalStruggleEvents} struggle event(s). Typing speed: ${Math.round(avgKeystrokesPerMinute)} KPM.`;
  } else {
    summary = `Struggling to maintain focus (${totalStruggleEvents} struggle events). ${totalTabSwitches} tab switch(es) detected.`;
  }

  // Generate personalized recommendations
  const recommendations: string[] = [];

  if (fatigueIndicator === "mild") {
    recommendations.push("Take a 5-minute break to recharge");
  }
  if (fatigueIndicator === "moderate") {
    recommendations.push("Consider a longer 10-15 minute break");
  }
  if (fatigueIndicator === "severe") {
    recommendations.push("You're showing signs of fatigue - take a substantial break");
  }

  if (totalStruggleEvents > 5) {
    recommendations.push("Try breaking this concept into smaller chunks");
  }
  if (totalTabSwitches > 10) {
    recommendations.push("Try closing unnecessary tabs to reduce distractions");
  }
  if (avgFocusScore > 85) {
    recommendations.push("Great momentum - keep up this focus!");
  }

  return {
    summary,
    focus_level: focusLevel,
    fatigue_indicator: fatigueIndicator,
    recommendations:
      recommendations.length > 0 ? recommendations : ["Session went well!"],
  };
}

/**
 * Emit Inngest event for low-focus sessions
 * Triggers concept/struggle event if focus is very low or struggle count is high
 */
async function emitInngestEventIfNeeded(
  payload: IngestPayload,
  focusScore: number,
  struggleEventsCount: number
): Promise<void> {
  // Only emit if focus score is critically low OR struggle events are high
  const shouldEmit = focusScore < 40 || struggleEventsCount > 3;

  if (!shouldEmit) {
    return;
  }

  const inngestEventKey = Deno.env.get("INNGEST_EVENT_KEY");
  if (!inngestEventKey) {
    console.warn("[Inngest] INNGEST_EVENT_KEY not configured, skipping event");
    return;
  }

  try {
    const eventPayload = {
      name: "concept/struggle",
      data: {
        // Use student_nicodemus_id if available (pre-enrollment), fall back to device_hash
        studentId: payload.student_id || payload.device_hash,
        conceptId: "focus-session",
        classId: null,
        thresholdSeconds: 0,
        focusScore,
        struggleEventsCount,
        deviceHash: payload.device_hash,
      },
    };

    const response = await fetch("https://api.inngest.com/events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${inngestEventKey}`,
      },
      body: JSON.stringify([eventPayload]),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(
        `[Inngest] Event emission failed (${response.status}): ${error}`
      );
    } else {
      console.log(
        `[Inngest] Event emitted for low focus (score: ${focusScore}, struggles: ${struggleEventsCount})`
      );
    }
  } catch (err) {
    console.error(`[Inngest] Error emitting event: ${err}`);
    // Non-critical: don't fail the request if Inngest is unavailable
  }
}

/**
 * Main handler: POST /functions/v1/student-metrics-ingest
 */
Deno.serve(async (req) => {
  // ============================================================
  // 1. Handle CORS preflight (OPTIONS)
  // ============================================================
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  // ============================================================
  // 2. Validate HTTP method
  // ============================================================
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({
        error: "Method not allowed. Use POST.",
        code: "METHOD_NOT_ALLOWED",
      }),
      {
        status: 405,
        headers: corsHeaders,
      }
    );
  }

  try {
    // ============================================================
    // 3. Parse and validate payload
    // ============================================================
    let payload: IngestPayload;

    try {
      payload = await req.json();
    } catch (err) {
      return new Response(
        JSON.stringify({
          error: "Invalid JSON payload",
          code: "INVALID_JSON",
        }),
        {
          status: 400,
          headers: corsHeaders,
        }
      );
    }

    // Validate schema
    if (!validatePayload(payload)) {
      console.warn(
        `[Ingest] Invalid payload schema from device ${payload?.device_hash?.substring(0, 8)}...`
      );
      return new Response(
        JSON.stringify({
          error: "Invalid payload schema",
          code: "SCHEMA_VALIDATION_FAILED",
          details:
            "Payload must include device_hash, metrics array, and timestamp",
        }),
        {
          status: 400,
          headers: corsHeaders,
        }
      );
    }

    // ============================================================
    // 4. Check rate limit
    // ============================================================
    if (!checkRateLimit(payload.device_hash)) {
      const retryAfter = getRetryAfterSeconds(payload.device_hash);
      console.warn(
        `[RateLimit] Device exceeded limit: ${payload.device_hash.substring(0, 8)}...`
      );
      return new Response(
        JSON.stringify({
          error: "Rate limit exceeded",
          code: "RATE_LIMIT_EXCEEDED",
          retryAfter,
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Retry-After": String(retryAfter),
          },
        }
      );
    }

    console.log(
      `[Ingest] Received ${payload.metrics.length} metrics from device ${payload.device_hash.substring(0, 8)}...`
    );

    // ============================================================
    // 5. Validate student_id if provided
    // ============================================================
    if (payload.student_id) {
      const studentIdValid = await validateStudentId(payload.student_id);
      if (!studentIdValid) {
        console.warn(
          `[Ingest] Student ID validation failed: ${payload.student_id}`
        );
        // Note: We don't hard-fail here, allowing device_hash to link sessions
      }
    }

    // ============================================================
    // 6. Perform summarization
    // ============================================================
    const summarization = summarizeMetrics(payload.metrics);

    // ============================================================
    // 7. Prepare records for insertion with sanitization
    //    REVISED: student_id now maps to student_nicodemus_id (TEXT from extension)
    //    student_id column (UUID FK) remains null for pre-enrollment sessions
    // ============================================================
    const records: InsertRecord[] = payload.metrics.map((metric) => ({
      device_hash: sanitizeString(payload.device_hash, 255),
      school_id: payload.school_id
        ? sanitizeString(payload.school_id, 255)
        : null,
      student_id: null, // UUID FK to enrolled students - populated by separate enrollment flow
      student_nicodemus_id: payload.student_id
        ? sanitizeString(payload.student_id, 255)
        : null, // TEXT student ID from extension (e.g., "NIC-JD2026-ABCD")
      metric_period_start: metric.metric_period_start,
      metric_period_end: metric.metric_period_end,
      focus_score: metric.focus_score,
      struggle_events_count: metric.struggle_events_count,
      avg_idle_seconds: metric.avg_idle_seconds,
      avg_keystrokes_per_minute: metric.avg_keystrokes_per_minute,
      total_tab_switches: metric.total_tab_switches,
      dominant_activity: metric.dominant_tab_category,
      summary: sanitizeString(summarization.summary, 1000),
      focus_level: summarization.focus_level,
      fatigue_indicator: summarization.fatigue_indicator,
      recommendations: summarization.recommendations.map((r) =>
        sanitizeString(r, 200)
      ),
    }));

    // ============================================================
    // 8. Insert to database
    // ============================================================
    const { data, error } = await supabase
      .from("student_metrics")
      .insert(records)
      .select("id");

    if (error) {
      console.error(`[Ingest] Database error: ${error.message}`);
      return new Response(
        JSON.stringify({
          error: "Database insertion failed",
          code: "DATABASE_ERROR",
        }),
        {
          status: 500,
          headers: corsHeaders,
        }
      );
    }

    console.log(
      `[Ingest] Successfully inserted ${data?.length || 0} metrics`
    );

    // ============================================================
    // 9. Emit Inngest events if focus is critically low
    // ============================================================
    // Get the average focus score from all metrics
    const avgFocusScore =
      payload.metrics.reduce((sum, m) => sum + m.focus_score, 0) /
      payload.metrics.length;
    const totalStruggleEvents = payload.metrics.reduce(
      (sum, m) => sum + m.struggle_events_count,
      0
    );

    await emitInngestEventIfNeeded(
      payload,
      avgFocusScore,
      totalStruggleEvents
    );

    // ============================================================
    // 10. Return success response
    // ============================================================
    return new Response(
      JSON.stringify({
        success: true,
        metric_ids: data?.map((m) => m.id) || [],
        summary: {
          focus_level: summarization.focus_level,
          fatigue: summarization.fatigue_indicator,
          recommendations: summarization.recommendations,
        },
        message: `Ingested ${data?.length || 0} metrics successfully`,
      }),
      {
        status: 200,
        headers: corsHeaders,
      }
    );
  } catch (error) {
    console.error(`[Ingest] Unexpected error: ${error}`);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        code: "INTERNAL_SERVER_ERROR",
      }),
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
});
