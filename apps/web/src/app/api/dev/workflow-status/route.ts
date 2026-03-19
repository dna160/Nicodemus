/**
 * API Route: Developer - Check Workflow Status
 *
 * Purpose: Query database to see if metrics were created and workflows triggered
 * Endpoint: GET /api/dev/workflow-status?metric_id=xxx
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * GET /api/dev/workflow-status
 */
export async function GET(request: NextRequest) {
  // Check if we're in development mode
  if (process.env.NODE_ENV === "production" && !process.env.ALLOW_DEV_ENDPOINTS) {
    return NextResponse.json({ error: "Dev endpoints disabled in production" }, { status: 403 });
  }

  try {
    const metricId = request.nextUrl.searchParams.get("metric_id");

    if (!metricId) {
      return NextResponse.json({ error: "metric_id parameter required" }, { status: 400 });
    }

    // Initialize Supabase
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.SUPABASE_SERVICE_ROLE_KEY || ""
    );

    console.log(`[Dev API] Checking status for metric ${metricId.substring(0, 8)}...`);

    // Check if metric exists
    const { data: metric, error: metricError } = await supabase
      .from("student_metrics")
      .select("*")
      .eq("id", metricId)
      .single();

    if (metricError || !metric) {
      console.log("[Dev API] Metric not found (yet) - may still be processing");
      return NextResponse.json({
        metric_found: false,
        message: "Metric not found in database - may still be processing",
        retry_in_seconds: 5
      });
    }

    console.log("[Dev API] Metric found, checking workflows...");

    // Check if HITL task was created
    const { data: reviewTask, error: taskError } = await supabase
      .from("teacher_review_tasks")
      .select("*")
      .eq("metric_id", metricId)
      .single();

    const erp_status = reviewTask ? "ACTIVE" : "NOT_TRIGGERED";
    const erp_message = reviewTask
      ? `Teacher review task created (ID: ${reviewTask.id.substring(0, 8)}...) - Status: ${reviewTask.status}`
      : "No HITL task created (student may not be enrolled)";

    // Check communications_log for parent email
    const { data: communications } = await supabase
      .from("communications_log")
      .select("*")
      .eq("type", "study_summary")
      .gte("created_at", new Date(Date.now() - 5 * 60 * 1000).toISOString());

    const prm_status = communications && communications.length > 0 ? "QUEUED" : "PENDING";
    const prm_message = communications
      ? `${communications.length} parent email(s) queued for sending`
      : "Waiting for teacher approval";

    return NextResponse.json({
      success: true,
      metric: {
        id: metric.id,
        focus_score: metric.focus_score,
        summary: metric.summary,
        recorded_at: metric.recorded_at
      },
      erp: {
        status: erp_status,
        message: erp_message,
        hitl_task: reviewTask
          ? {
              id: reviewTask.id,
              status: reviewTask.status,
              teacher_id: reviewTask.teacher_id,
              created_at: reviewTask.created_at
            }
          : null
      },
      prm: {
        status: prm_status,
        message: prm_message,
        emails_queued: communications ? communications.length : 0
      },
      next_check_in_seconds: erp_status === "ACTIVE" ? 10 : 5
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
