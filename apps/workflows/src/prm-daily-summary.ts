/**
 * Inngest Workflow: Parent Daily Study Summary (PRM)
 *
 * Triggered:
 * - When teacher approves study review (via ERP workflow)
 * - Daily at 6 PM (batch all day's activities)
 *
 * Purpose: Generate parent-friendly daily summary of student study habits
 *
 * Output: Email draft queued for parent notification
 */

import { inngest } from "./client";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

/**
 * PRM workflow triggered by ERP approval
 */
export const parentStudySummaryOnApproval = inngest.createFunction(
  {
    id: "parent-summary-on-approval",
    name: "Parent Study Summary (On Teacher Approval)",
    retryPolicy: {
      initialDelayMs: 1000,
      maxAttempts: 2,
      expireAfter: "24h"
    }
  },
  { event: "prm/parent-update-queued" },
  async ({ event, step }) => {
    const studentId = event.data.student_id;
    const metricId = event.data.metric_id;

    console.log(`[PRM] Generating parent summary for student ${studentId}`);

    // Step 1: Get parent contact info
    const parent = await step.run("fetch-parent", async () => {
      const { data: enrollment } = await supabase
        .from("enrollments")
        .select("parent_id")
        .eq("student_id", studentId)
        .single();

      if (!enrollment) return null;

      const { data: parentData } = await supabase
        .from("parents")
        .select("id, email, first_name, notification_preferences")
        .eq("id", enrollment.parent_id)
        .single();

      return parentData;
    });

    if (!parent) {
      console.log("[PRM] No parent found for student");
      return { success: false, reason: "no_parent" };
    }

    // Step 2: Get today's metrics for this student
    const todayMetrics = await step.run("fetch-todays-metrics", async () => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { data: metrics } = await supabase
        .from("student_metrics")
        .select("*")
        .eq("student_id", studentId)
        .gte("created_at", todayStart.toISOString())
        .order("created_at", { ascending: true });

      return metrics || [];
    });

    if (todayMetrics.length === 0) {
      console.log("[PRM] No metrics for today");
      return { success: false, reason: "no_metrics" };
    }

    // Step 3: Generate summary from metrics
    const summary = await step.run("generate-summary", async () => {
      return generateParentSummary(todayMetrics);
    });

    // Step 4: Get student name
    const studentData = await step.run("fetch-student", async () => {
      const { data } = await supabase
        .from("students")
        .select("first_name, last_name")
        .eq("id", studentId)
        .single();
      return data;
    });

    // Step 5: Prepare email
    const email = await step.run("prepare-email", async () => {
      return prepareParentEmail({
        parentName: parent.first_name,
        studentName: `${studentData?.first_name} ${studentData?.last_name}`,
        summary,
        hasRecommendations: summary.recommendations.length > 0
      });
    });

    // Step 6: Queue for sending
    await step.run("queue-notification", async () => {
      console.log(`[PRM] Queueing email for parent ${parent.email}`);

      // Insert into communication log
      const { error } = await supabase.from("communications_log").insert([
        {
          school_id: (await getSchoolId(studentId)) || null,
          teacher_id: null,
          student_id: studentId,
          parent_id: parent.id,
          type: "study_summary",
          subject: email.subject,
          body: email.body,
          html_body: email.htmlBody,
          status: "queued",
          scheduled_for: new Date().toISOString(),
          created_at: new Date().toISOString()
        }
      ]);

      if (error) {
        console.error("[PRM] Failed to queue email:", error);
        throw new Error("Failed to queue parent email");
      }

      // TODO: Integrate with real email service (SendGrid, etc.)
      // For now, just log it
      console.log(`[PRM] Email queued for ${parent.email}`);
    });

    console.log("[PRM] Parent summary workflow complete");
    return { success: true, parent_email: parent.email };
  }
);

/**
 * Daily aggregation: Summary for all students at end of day
 */
export const dailyParentSummaryBatch = inngest.createFunction(
  {
    id: "daily-parent-summary-batch",
    name: "Daily Parent Summary Batch"
  },
  { cron: "0 18 * * *" }, // 6 PM daily
  async ({ step }) => {
    console.log("[PRM] Running daily parent summary batch");

    // Get all students with metrics today
    const students = await step.run("fetch-students-with-metrics", async () => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { data } = await supabase
        .from("student_metrics")
        .select("DISTINCT student_id")
        .gte("created_at", todayStart.toISOString());

      return data?.map((row: any) => row.student_id) || [];
    });

    console.log(`[PRM] Found ${students.length} students with metrics today`);

    // Queue summary for each student
    for (const studentId of students) {
      await inngest.send({
        name: "prm/parent-update-queued",
        data: {
          student_id: studentId,
          metric_id: null,
          triggered_by: "daily_batch",
          include_focus_score: true,
          include_recommendations: true
        }
      });
    }

    return { processed: students.length };
  }
);

/**
 * Generate parent-friendly summary from metrics
 */
function generateParentSummary(metrics: any[]): {
  focus_time_minutes: number;
  peak_focus_score: number;
  avg_focus_score: number;
  struggles: string[];
  strengths: string[];
  recommendations: string[];
} {
  // Calculate totals
  const totalFocusTime = metrics.length * 5; // 5 minutes per metric
  const focusScores = metrics.map((m) => m.focus_score || 0);
  const avgFocusScore = Math.round(focusScores.reduce((a, b) => a + b, 0) / focusScores.length);
  const peakFocusScore = Math.max(...focusScores);

  const struggles: string[] = [];
  const strengths: string[] = [];
  const recommendations: string[] = [];

  // Analyze patterns
  const highFocusCount = focusScores.filter((s) => s > 80).length;
  const lowFocusCount = focusScores.filter((s) => s < 50).length;
  const totalStruggleEvents = metrics.reduce((sum, m) => sum + (m.struggle_events_count || 0), 0);

  // Generate insights
  if (highFocusCount > metrics.length * 0.7) {
    strengths.push("Excellent sustained focus throughout the day");
  } else if (highFocusCount > metrics.length * 0.4) {
    strengths.push("Good focus during most study sessions");
  }

  if (lowFocusCount > metrics.length * 0.3) {
    struggles.push("Difficulty maintaining focus in some sessions");
    recommendations.push("Try studying in shorter 25-minute blocks (Pomodoro technique)");
  }

  if (totalStruggleEvents > 5) {
    struggles.push(`${totalStruggleEvents} moments of difficulty during study`);
    recommendations.push("Consider taking more frequent breaks");
  }

  if (totalStruggleEvents === 0 && avgFocusScore > 75) {
    strengths.push("Smooth study flow with no major obstacles");
    recommendations.push("Keep up this excellent momentum!");
  }

  return {
    focus_time_minutes: totalFocusTime,
    peak_focus_score: peakFocusScore,
    avg_focus_score: avgFocusScore,
    struggles,
    strengths,
    recommendations
  };
}

/**
 * Prepare parent email
 */
function prepareParentEmail(data: {
  parentName: string;
  studentName: string;
  summary: any;
  hasRecommendations: boolean;
}): {
  subject: string;
  body: string;
  htmlBody: string;
} {
  const subject = `📚 ${data.studentName}'s Daily Study Summary`;

  const body = `Dear ${data.parentName},

Here's a summary of ${data.studentName}'s study session today:

📊 Focus Time: ${data.summary.focus_time_minutes} minutes
⭐ Average Focus Score: ${data.summary.avg_focus_score}/100
🎯 Peak Focus: ${data.summary.peak_focus_score}/100

${data.summary.strengths.length > 0 ? `✨ Strengths:\n${data.summary.strengths.map((s: string) => `  • ${s}`).join("\n")}\n` : ""}
${data.summary.struggles.length > 0 ? `⚠️  Areas to improve:\n${data.summary.struggles.map((s: string) => `  • ${s}`).join("\n")}\n` : ""}
${data.hasRecommendations ? `💡 Suggestions:\n${data.summary.recommendations.map((r: string) => `  • ${r}`).join("\n")}\n` : ""}

If you have any questions about ${data.studentName}'s progress, please reach out to their teacher.

Best regards,
Nicodemus Learning System`;

  // Simple HTML version
  const htmlBody = `
    <h2>📚 ${data.studentName}'s Daily Study Summary</h2>
    <p>Dear ${data.parentName},</p>
    <p>Here's a summary of ${data.studentName}'s study session today:</p>
    <ul>
      <li>📊 <strong>Focus Time:</strong> ${data.summary.focus_time_minutes} minutes</li>
      <li>⭐ <strong>Average Focus Score:</strong> ${data.summary.avg_focus_score}/100</li>
      <li>🎯 <strong>Peak Focus:</strong> ${data.summary.peak_focus_score}/100</li>
    </ul>
    ${data.summary.strengths.length > 0 ? `<h3>✨ Strengths</h3><ul>${data.summary.strengths.map((s: string) => `<li>${s}</li>`).join("")}</ul>` : ""}
    ${data.summary.struggles.length > 0 ? `<h3>⚠️ Areas to Improve</h3><ul>${data.summary.struggles.map((s: string) => `<li>${s}</li>`).join("")}</ul>` : ""}
    ${data.hasRecommendations ? `<h3>💡 Suggestions</h3><ul>${data.summary.recommendations.map((r: string) => `<li>${r}</li>`).join("")}</ul>` : ""}
    <p>If you have any questions, please reach out to your student's teacher.</p>
  `;

  return { subject, body, htmlBody };
}

/**
 * Helper: Get school ID for a student
 */
async function getSchoolId(studentId: string): Promise<string | null> {
  const { data } = await supabase
    .from("enrollments")
    .select("classes!inner(school_id)")
    .eq("student_id", studentId)
    .single();

  return data?.classes?.school_id || null;
}

export default parentStudySummaryOnApproval;
