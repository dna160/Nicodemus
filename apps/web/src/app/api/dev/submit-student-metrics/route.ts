/**
 * API Route: Developer - Submit Simulated Student Metrics
 *
 * Purpose: Accept simulated student data and insert directly into Supabase
 * This mimics what the extension would do when syncing metrics
 *
 * Endpoint: POST /api/dev/submit-student-metrics
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = 'force-dynamic';

function isValidUuid(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

interface SubmitPayload {
  device_hash: string;
  school_id?: string;
  student_id?: string;
  student_name?: string;
  metrics: Array<{
    id?: string;
    avg_idle_seconds: number;
    avg_keystrokes_per_minute: number;
    struggle_events_count: number;
    focus_score: number;
    dominant_tab_category: string;
    total_tab_switches?: number;
  }>;
  timestamp: number;
}

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

/**
 * POST /api/dev/submit-student-metrics
 */
export async function POST(request: NextRequest) {
  // Check if we're in development mode
  if (process.env.NODE_ENV === "production" && !process.env.ALLOW_DEV_ENDPOINTS) {
    return NextResponse.json({ error: "Dev endpoints disabled in production" }, { status: 403 });
  }

  try {
    const payload = (await request.json()) as SubmitPayload;

    // Validate payload
    if (!payload.device_hash || !Array.isArray(payload.metrics)) {
      return NextResponse.json({ error: "Invalid payload structure" }, { status: 400 });
    }

    console.log(
      `[Dev API] Received ${payload.metrics.length} metrics from device ${payload.device_hash.substring(0, 8)}...`
    );

    const supabase = getSupabaseClient();
    if (!supabase) {
      return NextResponse.json(
        { error: "Supabase configuration missing" },
        { status: 500 }
      );
    }

    if (payload.metrics.length === 0) {
      return NextResponse.json({
        success: true,
        metric_ids: [],
        summary: {},
        message: "No metrics to submit"
      });
    }

    // Build rows for student_metrics table
    const rows = payload.metrics.map((m) => ({
      student_id: isValidUuid(payload.student_id) ? payload.student_id : null,
      device_hash: payload.device_hash,
      school_id: isValidUuid(payload.school_id) ? payload.school_id : null,
      avg_idle_seconds: m.avg_idle_seconds,
      avg_keystrokes_per_minute: m.avg_keystrokes_per_minute,
      struggle_events_count: m.struggle_events_count,
      focus_score: m.focus_score,
      dominant_tab_category: m.dominant_tab_category,
      total_tab_switches: m.total_tab_switches ?? 0,
      summary: generateSimpleSummary(m)
      // recorded_at uses DEFAULT CURRENT_TIMESTAMP
    }));

    const { data, error } = await supabase
      .from("student_metrics")
      .insert(rows)
      .select("id, focus_score, dominant_tab_category");

    if (error) {
      console.error("[Dev API] Supabase insert error:", error);
      return NextResponse.json(
        { error: "Database insert failed", details: error.message },
        { status: 500 }
      );
    }

    const metricIds = data?.map((r: { id: string }) => r.id) ?? [];
    const firstMetric = payload.metrics[0];
    const summary = generateSimpleSummary(firstMetric);

    console.log(`[Dev API] Inserted ${metricIds.length} metrics:`, metricIds);

    // Create a teacher_review_task for HITL — find first available teacher
    if (metricIds.length > 0) {
      const { data: teacher } = await supabase
        .from("teachers")
        .select("id")
        .limit(1)
        .single();

      const { error: taskError } = await supabase
        .from("teacher_review_tasks")
        .insert({
          metric_id: metricIds[0],
          student_id: isValidUuid(payload.student_id) ? payload.student_id : null,
          teacher_id: teacher?.id ?? null,
          review_type: "study_progress",
          status: "pending"
        });

      if (taskError) {
        console.warn("[Dev API] Could not create review task:", taskError.message);
      } else {
        console.log(`[Dev API] Teacher review task created for teacher ${teacher?.id ?? "unassigned"}`);
      }
    }

    return NextResponse.json({
      success: true,
      metric_ids: metricIds,
      summary,
      hitl_status: "Teacher review task created — check ERP tab in dashboard"
    });
  } catch (error) {
    console.error("[Dev API] Error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

function generateSimpleSummary(metric: {
  focus_score: number;
  avg_idle_seconds: number;
  struggle_events_count: number;
  avg_keystrokes_per_minute: number;
}) {
  let focus_level: string;
  if (metric.focus_score >= 85) focus_level = "excellent";
  else if (metric.focus_score >= 70) focus_level = "good";
  else if (metric.focus_score >= 50) focus_level = "moderate";
  else focus_level = "poor";

  const fatigue_indicator =
    metric.avg_idle_seconds > 60 ? "high" : metric.avg_idle_seconds > 30 ? "moderate" : "low";

  const recommendations: string[] = [];
  if (metric.avg_idle_seconds > 30) recommendations.push("Try more frequent short breaks");
  if (metric.struggle_events_count > 3) recommendations.push("Review difficult concepts with teacher");
  if (metric.focus_score > 80) recommendations.push("Great focus! Keep up the momentum");
  if (recommendations.length === 0) recommendations.push("Session went well!");

  return {
    focus_level,
    fatigue_indicator,
    recommendations,
    engagement_score: metric.focus_score
  };
}

/**
 * GET /api/dev/submit-student-metrics - Check endpoint status
 */
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === "production" && !process.env.ALLOW_DEV_ENDPOINTS) {
    return NextResponse.json({ error: "Dev endpoints disabled in production" }, { status: 403 });
  }

  return NextResponse.json({
    message: "Dev metrics submission endpoint",
    method: "POST",
    status: "ready"
  });
}
