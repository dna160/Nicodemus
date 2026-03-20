/**
 * GET /api/student/profile?studentId=xxx
 * Returns student profile — name, grade, school, enrollment date,
 * and a quick summary of their academic standing.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

  // Student + user + school
  const { data: student, error } = await supabase
    .from('students')
    .select(`
      id,
      grade_level,
      date_of_birth,
      created_at,
      users!inner (
        name,
        email,
        school_id,
        schools (
          name
        )
      )
    `)
    .eq('id', studentId)
    .single();

  if (error || !student) {
    return NextResponse.json({ success: false, error: 'Student not found' }, { status: 404 });
  }

  const user = (student as any).users;
  const school = user?.schools;

  // Grade summary — avg final grade across all graded submissions
  const { data: submissions } = await supabase
    .from('submissions')
    .select('final_grade, ai_grade, submission_status, subject')
    .eq('student_id', studentId)
    .eq('submission_status', 'graded');

  const graded = (submissions ?? []).filter(
    (s: any) => (s.final_grade ?? s.ai_grade) != null
  );
  const avgGrade =
    graded.length > 0
      ? Math.round(
          graded.reduce((sum: number, s: any) => sum + (s.final_grade ?? s.ai_grade ?? 0), 0) /
            graded.length
        )
      : null;

  // Pending homework count
  const { data: enrollments } = await supabase
    .from('enrollments')
    .select('class_id')
    .eq('student_id', studentId);

  const classIds = (enrollments ?? []).map((e: any) => e.class_id);

  let pendingCount = 0;
  if (classIds.length > 0) {
    const { data: assignments } = await supabase
      .from('assignments')
      .select('id')
      .eq('status', 'active')
      .or(`class_id.in.(${classIds.join(',')}),class_id.is.null`);

    if (assignments && assignments.length > 0) {
      const assignmentIds = assignments.map((a: any) => a.id);
      const { data: submitted } = await supabase
        .from('submissions')
        .select('assignment_id')
        .eq('student_id', studentId)
        .in('assignment_id', assignmentIds);

      const submittedIds = new Set((submitted ?? []).map((s: any) => s.assignment_id));
      pendingCount = assignments.filter((a: any) => !submittedIds.has(a.id)).length;
    }
  }

  return NextResponse.json({
    success: true,
    profile: {
      id: student.id,
      name: user?.name ?? 'Student',
      email: user?.email ?? '',
      grade_level: student.grade_level,
      date_of_birth: student.date_of_birth,
      enrollment_date: student.created_at,
      school_name: school?.name ?? 'Your School',
      avg_grade: avgGrade,
      graded_count: graded.length,
      pending_homework: pendingCount,
    },
  });
}
