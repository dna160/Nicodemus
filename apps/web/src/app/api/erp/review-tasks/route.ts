/**
 * GET /api/erp/review-tasks?teacherId=xxx
 * Returns pending homework/study review tasks assigned to a teacher.
 * Includes submission content (student answers) and assignment questions
 * so the teacher can review per-answer in the UI.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(req: NextRequest) {
  const teacherId = req.nextUrl.searchParams.get('teacherId');
  if (!teacherId) {
    return NextResponse.json({ success: false, error: 'teacherId required' }, { status: 400 });
  }

  const supabase = getAdminClient();

  // Fetch pending review tasks for this teacher (or unassigned tasks for dev)
  const { data: tasks, error } = await supabase
    .from('teacher_review_tasks')
    .select(`
      id,
      metric_id,
      submission_id,
      student_id,
      teacher_id,
      review_type,
      status,
      teacher_notes,
      created_at,
      approved_at,
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
        id,
        content,
        ai_grade,
        ai_feedback,
        ai_next_steps,
        submitted_at,
        assignments (
          id,
          title,
          subject,
          points_possible,
          content
        )
      )
    `)
    .or(`teacher_id.eq.${teacherId},teacher_id.is.null`)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, tasks: tasks ?? [] });
}
