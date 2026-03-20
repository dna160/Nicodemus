/**
 * GET /api/student/homework?studentId=xxx
 * Returns active homework assignments for a student with submission status.
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
  const studentId = req.nextUrl.searchParams.get('studentId');
  if (!studentId) {
    return NextResponse.json({ success: false, error: 'studentId required' }, { status: 400 });
  }

  const supabase = getAdminClient();

  // Get class IDs the student is enrolled in
  const { data: enrollments } = await supabase
    .from('enrollments')
    .select('class_id')
    .eq('student_id', studentId);

  const classIds = enrollments?.map((e: { class_id: string }) => e.class_id) ?? [];

  // Fetch active assignments for enrolled classes OR class_id IS NULL (open assignments)
  let query = supabase
    .from('assignments')
    .select('id, title, description, subject, due_at, points_possible, assignment_type, status, class_id, lesson_id')
    .eq('status', 'active')
    .order('due_at', { ascending: true });

  if (classIds.length > 0) {
    query = query.or(`class_id.in.(${classIds.join(',')}),class_id.is.null`);
  } else {
    query = query.is('class_id', null);
  }

  const { data: assignments, error } = await query;

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  if (!assignments || assignments.length === 0) {
    return NextResponse.json({ success: true, assignments: [] });
  }

  // Fetch this student's submissions for these assignments
  const assignmentIds = assignments.map((a: { id: string }) => a.id);
  const { data: submissions } = await supabase
    .from('submissions')
    .select('id, assignment_id, submission_status, ai_grade, final_grade, graded, grade, submitted_at')
    .eq('student_id', studentId)
    .in('assignment_id', assignmentIds);

  const submissionByAssignment = Object.fromEntries(
    (submissions ?? []).map((s: any) => [s.assignment_id, s])
  );

  const result = assignments.map((a: any) => {
    const submission = submissionByAssignment[a.id] ?? null;
    const now = new Date();
    const due = new Date(a.due_at);
    const daysUntilDue = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    return {
      id: a.id,
      title: a.title,
      description: a.description,
      subject: a.subject,
      due_at: a.due_at,
      days_until_due: daysUntilDue,
      points_possible: a.points_possible,
      is_overdue: daysUntilDue < 0,
      submission: submission
        ? {
            id: submission.id,
            status: submission.submission_status ?? (submission.graded ? 'graded' : 'submitted'),
            ai_grade: submission.ai_grade ?? submission.grade ?? null,
            final_grade: submission.final_grade ?? submission.ai_grade ?? submission.grade ?? null,
            submitted_at: submission.submitted_at,
          }
        : null,
    };
  });

  return NextResponse.json({ success: true, assignments: result });
}
