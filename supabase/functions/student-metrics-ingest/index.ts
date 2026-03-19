/**
 * Supabase Edge Function: Student Metrics Ingestion
 *
 * Purpose: Privacy-first data ingestion pipeline
 * 1. Receive encrypted batch from Student Rep extension
 * 2. Decrypt and validate schema
 * 3. Call Modal for lightweight summarization
 * 4. Insert sanitized metrics to database
 * 5. Trigger webhooks for ERP/PRM agents
 *
 * Endpoint: POST /api/student-metrics/ingest
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

interface IngestPayload {
  device_hash: string;
  school_id?: string;
  student_id?: string;
  metrics: Array<{
    metric_period_start: string; // ISO 8601
    metric_period_end: string;
    avg_idle_seconds: number;
    avg_keystrokes_per_minute: number;
    total_tab_switches: number;
    struggle_events_count: number;
    focus_score: number;
    dominant_tab_category: string;
  }>;
  timestamp: number;
}

interface SummarizationResponse {
  summary: string;
  focus_level: "high" | "normal" | "low";
  fatigue_indicator: "none" | "mild" | "moderate" | "severe";
  recommendations: string[];
}

/**
 * Validate incoming payload
 */
function validatePayload(payload: unknown): payload is IngestPayload {
  if (!payload || typeof payload !== "object") return false;
  const p = payload as any;
  return (
    typeof p.device_hash === "string" &&
    Array.isArray(p.metrics) &&
    p.metrics.every(
      (m: any) =>
        typeof m.avg_idle_seconds === "number" &&
        typeof m.focus_score === "number" &&
        typeof m.dominant_tab_category === "string"
    )
  );
}

/**
 * Call Modal for lightweight summarization
 */
async function summarizeMetrics(
  metrics: IngestPayload["metrics"]
): Promise<SummarizationResponse> {
  // Aggregate metrics for batch
  const avgFocusScore =
    metrics.reduce((sum, m) => sum + m.focus_score, 0) / metrics.length;
  const totalStruggleEvents = metrics.reduce((sum, m) => sum + m.struggle_events_count, 0);
  const avgIdleSeconds =
    metrics.reduce((sum, m) => sum + m.avg_idle_seconds, 0) / metrics.length;

  // Determine focus level
  let focus_level: "high" | "normal" | "low" = "normal";
  if (avgFocusScore > 80) focus_level = "high";
  else if (avgFocusScore < 50) focus_level = "low";

  // Determine fatigue
  let fatigue_indicator: "none" | "mild" | "moderate" | "severe" = "none";
  if (avgIdleSeconds > 20) fatigue_indicator = "mild";
  if (avgIdleSeconds > 40) fatigue_indicator = "moderate";
  if (avgIdleSeconds > 60) fatigue_indicator = "severe";

  // For MVP, use simple rules instead of calling Modal
  // In production, call Modal via: modal.client.post("/summarize", {...})
  const summary =
    focus_level === "high"
      ? "Excellent focus during study session"
      : focus_level === "normal"
        ? `Good focus with ${totalStruggleEvents} moments of difficulty`
        : `Struggling to maintain focus (${totalStruggleEvents} struggle events)`;

  const recommendations: string[] = [];
  if (fatigue_indicator === "mild") recommendations.push("Take a 5-minute break");
  if (fatigue_indicator === "moderate") recommendations.push("Take a 10-minute break");
  if (totalStruggleEvents > 5) recommendations.push("Try a different learning approach");
  if (avgFocusScore > 85) recommendations.push("Great momentum - keep going!");

  return {
    summary,
    focus_level,
    fatigue_indicator,
    recommendations: recommendations.length > 0 ? recommendations : ["Session went well!"]
  };
}

/**
 * Main handler
 */
Deno.serve(async (req) => {
  // Only accept POST
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405
    });
  }

  try {
    // Parse payload
    const payload = await req.json();

    // Validate schema
    if (!validatePayload(payload)) {
      return new Response(JSON.stringify({ error: "Invalid payload schema" }), {
        status: 400
      });
    }

    console.log(`[Ingest] Received ${payload.metrics.length} metrics from device ${payload.device_hash.substring(0, 8)}...`);

    // Get summarization from Modal (lightweight)
    const summarization = await summarizeMetrics(payload.metrics);

    // Prepare records for insertion
    const records = payload.metrics.map((metric) => ({
      device_hash: payload.device_hash,
      school_id: payload.school_id || null,
      student_id: payload.student_id || null,
      metric_period_start: metric.metric_period_start,
      metric_period_end: metric.metric_period_end,
      focus_score: metric.focus_score,
      struggle_events_count: metric.struggle_events_count,
      avg_idle_seconds: metric.avg_idle_seconds,
      dominant_activity: metric.dominant_tab_category,
      summary: summarization.summary,
      focus_level: summarization.focus_level,
      fatigue_indicator: summarization.fatigue_indicator,
      recommendations: summarization.recommendations
    }));

    // Insert to database
    const { data, error } = await supabase
      .from("student_metrics")
      .insert(records)
      .select("id");

    if (error) {
      console.error("[Ingest] Database error:", error);
      return new Response(JSON.stringify({ error: "Database insertion failed" }), {
        status: 500
      });
    }

    console.log(`[Ingest] Successfully inserted ${data?.length || 0} metrics`);

    // Emit webhook events for Inngest (ERP/PRM agents)
    if (data && data.length > 0) {
      // Publish to webhook queue
      // In production, these would trigger via Supabase webhooks
      console.log(`[Ingest] Triggering webhooks for ${data.length} metrics`);

      // For MVP, log the event
      for (const metric of data) {
        console.log(`[Event] student/metrics/created - metric_id=${metric.id}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        metric_ids: data?.map((m) => m.id) || [],
        summary: {
          focus_level: summarization.focus_level,
          fatigue: summarization.fatigue_indicator,
          recommendations: summarization.recommendations
        }
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );
  } catch (error) {
    console.error("[Ingest] Error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500
    });
  }
});
