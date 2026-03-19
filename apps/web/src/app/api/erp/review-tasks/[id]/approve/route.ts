/**
 * POST /api/erp/review-tasks/[id]/approve
 * Teacher approves a study review task.
 * If send_to_parents=true, creates a parent notification draft in Communications tab.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: taskId } = await params;
  const body = await req.json();
  const { teacherId, notes = '', sendToParents = false } = body;

  if (!teacherId) {
    return NextResponse.json({ success: false, error: 'teacherId required' }, { status: 400 });
  }

  const supabase = getAdminClient();

  // 1. Fetch the review task + related data
  const { data: task, error: taskError } = await supabase
    .from('teacher_review_tasks')
    .select(`
      *,
      student_metrics (
        focus_score,
        avg_idle_seconds,
        avg_keystrokes_per_minute,
        struggle_events_count,
        dominant_tab_category,
        total_tab_switches,
        summary
      ),
      submissions (
        ai_grade,
        ai_feedback,
        ai_next_steps,
        assignments ( title, subject, points_possible )
      )
    `)
    .eq('id', taskId)
    .single();

  if (taskError || !task) {
    return NextResponse.json({ success: false, error: 'Task not found' }, { status: 404 });
  }

  // 2. Mark task as approved
  const { error: updateError } = await supabase
    .from('teacher_review_tasks')
    .update({
      status: 'approved',
      teacher_notes: notes,
      approved_at: new Date().toISOString(),
    })
    .eq('id', taskId);

  if (updateError) {
    return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
  }

  let notificationId: string | null = null;

  // 3. If teacher wants to send to parents, create a draft notification
  if (sendToParents) {
    let subject: string;
    let emailBody: string;

    if (task.review_type === 'homework_grade' && task.submissions) {
      const sub = task.submissions as any;
      const assignment = sub.assignments;
      const grade = sub.ai_grade ?? 0;
      const title = assignment?.title ?? 'Homework Assignment';
      const subject_area = assignment?.subject ?? '';
      const points = assignment?.points_possible ?? 100;
      const feedback = sub.ai_feedback ?? '';
      const nextSteps = sub.ai_next_steps ?? '';

      subject = `📝 Homework Graded: ${title} — ${grade}/${points}`;
      emailBody = buildHomeworkEmailBody(title, subject_area, grade, points, feedback, nextSteps, notes);
    } else {
      const metric = task.student_metrics as any;
      const focusScore = metric?.focus_score ?? 0;
      const summary = metric?.summary as Record<string, any> | null;
      const focusLevel = summary?.focus_level ?? (focusScore >= 70 ? 'good' : 'moderate');
      const recommendations: string[] = summary?.recommendations ?? ['Keep up the good work!'];

      subject = `📚 Study Session Summary — Focus Score: ${focusScore}/100`;
      emailBody = buildStudySessionEmailBody(focusScore, focusLevel, metric, recommendations, notes);
    }

    const { data: notification, error: notifError } = await supabase
      .from('parent_notifications')
      .insert({
        teacher_id: teacherId,
        student_id: task.student_id || null,
        type: task.review_type === 'homework_grade' ? 'progress' : 'progress',
        subject,
        body: emailBody,
        status: 'draft',
      })
      .select('id')
      .single();

    if (notifError) {
      console.error('[approve] Failed to create parent notification:', notifError.message);
      // Non-fatal — task is already approved
    } else {
      notificationId = notification.id;
    }
  }

  return NextResponse.json({
    success: true,
    task_id: taskId,
    notification_id: notificationId,
    message: sendToParents
      ? 'Task approved. Parent email draft created — check Communications tab.'
      : 'Task approved.',
  });
}

function buildHomeworkEmailBody(
  title: string,
  subject: string,
  grade: number,
  points: number,
  feedback: string,
  nextSteps: string,
  teacherNotes: string
): string {
  const pct = Math.round((grade / points) * 100);
  const performance = pct >= 90 ? 'Excellent' : pct >= 75 ? 'Good' : pct >= 60 ? 'Satisfactory' : 'Needs Improvement';

  return `Hello,

Your child's ${subject ? subject + ' ' : ''}homework has been graded by our AI tutor and reviewed by their teacher.

📝 Assignment: ${title}
📊 Score: ${grade}/${points} (${pct}%) — ${performance}

${feedback ? `Feedback:\n${feedback}\n` : ''}
${nextSteps ? `Next Steps for Improvement:\n${nextSteps}\n` : ''}
${teacherNotes ? `Teacher's Note:\n${teacherNotes}\n` : ''}
This grade was reviewed and approved by your child's teacher before being sent to you.

Best regards,
Nicodemus School System`.trim();
}

function buildStudySessionEmailBody(
  focusScore: number,
  focusLevel: string,
  metric: Record<string, any> | null,
  recommendations: string[],
  teacherNotes: string
): string {
  const idleMinutes = metric ? Math.round((metric.avg_idle_seconds ?? 0) / 60 * 10) / 10 : 0;
  const kpm = metric?.avg_keystrokes_per_minute ?? 0;
  const struggles = metric?.struggle_events_count ?? 0;
  const activity = metric?.dominant_tab_category ?? 'general study';
  const recLines = recommendations.map((r: string) => `• ${r}`).join('\n');

  return `Hello,

Your child completed a study session. Here's a summary of how it went:

📊 Focus Score: ${focusScore}/100 (${focusLevel})
⌨️  Keystrokes per minute: ${kpm}
⏱️  Average idle time: ${idleMinutes} min
🔄 Struggling moments: ${struggles}
📂 Primary activity: ${activity}

Recommendations:
${recLines}
${teacherNotes ? `\nTeacher's Note:\n${teacherNotes}` : ''}

This summary was reviewed and approved by your child's teacher before being sent to you.

Best regards,
Nicodemus School System`.trim();
}
