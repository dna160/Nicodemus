/**
 * Inngest Workflow: Student Study Progress Review (ERP)
 *
 * Triggered when: Student metrics are created
 * Purpose: Notify teacher of student study progress, get HITL approval, send to PRM
 *
 * Flow:
 * 1. Get student enrollment → find teacher
 * 2. Get curriculum for class
 * 3. Create HITL review task
 * 4. Notify teacher in dashboard
 * 5. Wait for teacher approval (with 24-hour timeout)
 * 6. On approval: send update to PRM agent
 */

import { inngest } from "./client";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

/**
 * Main ERP workflow for student study review
 */
export const studentStudyReviewWorkflow = inngest.createFunction(
  {
    id: "student-study-review",
    name: "Student Study Progress Review (ERP)",
    retryPolicy: {
      initialDelayMs: 1000,
      maxAttempts: 3,
      expireAfter: "24h"
    }
  },
  { event: "student/metrics/created" },
  async ({ event, step }) => {
    const metricId = event.data.id;
    const studentId = event.data.student_id;

    console.log(`[ERP] Processing study review for metric ${metricId}`);

    // Step 1: Get student enrollment and find teacher
    const teacher = await step.run("find-teacher", async () => {
      console.log(`[ERP] Finding teacher for student ${studentId}`);

      // Get enrollment
      const { data: enrollment, error: enrollError } = await supabase
        .from("enrollments")
        .select("class_id")
        .eq("student_id", studentId)
        .single();

      if (enrollError || !enrollment) {
        console.log("[ERP] Student not enrolled in any class");
        return null;
      }

      // Get teacher from class
      const { data: classData, error: classError } = await supabase
        .from("classes")
        .select("teacher_id, grade_level")
        .eq("id", enrollment.class_id)
        .single();

      if (classError || !classData) {
        console.log("[ERP] Class not found");
        return null;
      }

      // Get teacher details
      const { data: teacherData, error: teacherError } = await supabase
        .from("teachers")
        .select("id, user_id, email")
        .eq("id", classData.teacher_id)
        .single();

      if (teacherError || !teacherData) {
        console.log("[ERP] Teacher not found");
        return null;
      }

      return { ...teacherData, grade_level: classData.grade_level };
    });

    if (!teacher) {
      console.log("[ERP] Could not find teacher - skipping HITL review");
      return { success: false, reason: "no_teacher_found" };
    }

    // Step 2: Get metric and student details
    const metricData = await step.run("fetch-metric-and-student", async () => {
      const { data: metric } = await supabase
        .from("student_metrics")
        .select("*")
        .eq("id", metricId)
        .single();

      const { data: student } = await supabase
        .from("students")
        .select("id, first_name, last_name")
        .eq("id", studentId)
        .single();

      return { metric, student };
    });

    // Step 3: Create HITL review task
    const reviewTask = await step.run("create-hitl-task", async () => {
      console.log(`[ERP] Creating HITL review task for teacher ${teacher.id}`);

      const { data: task, error } = await supabase
        .from("teacher_review_tasks")
        .insert([
          {
            teacher_id: teacher.id,
            student_id: studentId,
            metric_id: metricId,
            review_type: "study_progress",
            status: "pending",
            created_at: new Date().toISOString()
          }
        ])
        .select()
        .single();

      if (error) {
        console.error("[ERP] Failed to create review task:", error);
        throw new Error("Failed to create review task");
      }

      return task;
    });

    // Step 4: Send notification to teacher
    await step.run("notify-teacher", async () => {
      console.log(`[ERP] Notifying teacher ${teacher.email}`);

      // Send notification (could be email, Slack, or dashboard notification)
      const studentName = `${metricData.student?.first_name} ${metricData.student?.last_name}`;
      const focusScore = metricData.metric?.focus_score || 0;
      const summary = metricData.metric?.summary || "Study session completed";

      // Log for now - in production, would send real notification
      console.log(`[ERP] Notification: ${studentName}'s study progress needs review`);
      console.log(`     Focus Score: ${focusScore}/100`);
      console.log(`     Summary: ${summary}`);

      // TODO: Send real notification (email/Slack/push)
      // await notificationService.sendTeacherNotification({
      //   teacher_id: teacher.id,
      //   type: "study_review",
      //   student_name: studentName,
      //   focus_score: focusScore,
      //   task_id: reviewTask.id
      // });
    });

    // Step 5: Wait for teacher approval (with timeout)
    const approval = await step.waitForEvent(
      "teacher-approved-study-review",
      {
        timeout: "24h",
        match: "data.review_task_id",
        if: `async.data.review_task_id == '${reviewTask.id}'`
      }
    );

    if (!approval) {
      console.log("[ERP] HITL review timed out (no teacher response)");
      // Mark task as expired
      await supabase
        .from("teacher_review_tasks")
        .update({ status: "expired" })
        .eq("id", reviewTask.id);

      return { success: false, reason: "timeout" };
    }

    // Step 6: Update task status and trigger PRM
    const result = await step.run("process-approval", async () => {
      console.log("[ERP] Teacher approved study review");

      // Mark task as approved
      const { error: updateError } = await supabase
        .from("teacher_review_tasks")
        .update({
          status: "approved",
          teacher_notes: approval.data.notes || "",
          approved_at: new Date().toISOString()
        })
        .eq("id", reviewTask.id);

      if (updateError) {
        console.error("[ERP] Failed to update review task:", updateError);
        throw new Error("Failed to update review task");
      }

      // If teacher wants to send to parents, trigger PRM
      if (approval.data.send_to_parents) {
        console.log("[ERP] Teacher approved - sending to PRM agent");

        // Trigger PRM workflow
        await inngest.send({
          name: "prm/parent-update-queued",
          data: {
            student_id: studentId,
            metric_id: metricId,
            review_task_id: reviewTask.id,
            triggered_by_teacher: teacher.id,
            include_focus_score: true,
            include_recommendations: true
          }
        });
      }

      return { success: true, approved: true };
    });

    console.log("[ERP] Study review workflow complete");
    return result;
  }
);

/**
 * Handle teacher approval event
 * This is triggered by API call from dashboard when teacher clicks "Approve"
 */
export const handleTeacherApproval = inngest.createFunction(
  {
    id: "teacher-approval-handler",
    name: "Teacher Approval Handler"
  },
  { event: "teacher/approved-study-review" },
  async ({ event, step }) => {
    console.log(`[ERP] Teacher approved review task ${event.data.review_task_id}`);
    // This function allows the main workflow to proceed
    // The workflow is waiting for this event via step.waitForEvent()
  }
);

/**
 * Rollup workflow: Aggregate all study reviews for a teacher
 * Runs daily to show summary in teacher dashboard
 */
export const dailyTeacherReviewSummary = inngest.createFunction(
  {
    id: "daily-teacher-review-summary",
    name: "Daily Teacher Review Summary"
  },
  { cron: "0 8 * * MON-FRI" }, // 8 AM on weekdays
  async ({ step }) => {
    console.log("[ERP] Generating daily review summary for all teachers");

    // Get all pending reviews
    const reviews = await step.run("fetch-pending-reviews", async () => {
      const { data, error } = await supabase
        .from("teacher_review_tasks")
        .select("teacher_id, student_id, focus_score")
        .eq("status", "pending")
        .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      return data || [];
    });

    console.log(`[ERP] Found ${reviews.length} pending reviews`);

    // Group by teacher
    const byTeacher: Record<string, any[]> = {};
    for (const review of reviews) {
      if (!byTeacher[review.teacher_id]) {
        byTeacher[review.teacher_id] = [];
      }
      byTeacher[review.teacher_id].push(review);
    }

    // Send summary to each teacher
    for (const [teacherId, teacherReviews] of Object.entries(byTeacher)) {
      console.log(`[ERP] Teacher ${teacherId} has ${teacherReviews.length} pending reviews`);
      // TODO: Send dashboard notification with count and direct link
    }

    return { processed: Object.keys(byTeacher).length };
  }
);

export default studentStudyReviewWorkflow;
