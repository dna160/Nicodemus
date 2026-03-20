/**
 * GET /api/teacher/students/[id]/quick-glance?teacherId=xxx
 * Returns a rich performance + behavior summary for a single student
 * scoped to the requesting teacher's classes.
 * This data powers the "Quick Glance" card in the teacher's student view.
 * AI behavioral analysis will be layered on top in a future phase.
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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: studentId } = await params;
  const teacherId = req.nextUrl.searchParams.get('teacherId');

  if (!teacherId) {
    return NextResponse.json({ success: false, error: 'teacherId required' }, { status: 400 });
  }

  const supabase = getAdminClient();

  // Fetch student profile
  const { data: student, error: studentError } = await supabase
    .from('students')
    .select(`
      id,
      grade_level,
      date_of_birth,
      created_at,
      users!inner ( name, email )
    `)
    .eq('id', studentId)
    .single();

  if (studentError || !student) {
    return NextResponse.json({ success: false, error: 'Student not found' }, { status: 404 });
  }

  // Get teacher's classes that this student is enrolled in
  const { data: teacherClasses } = await supabase
    .from('classes')
    .select('id, name, subject')
    .eq('teacher_id', teacherId);

  const teacherClassIds = (teacherClasses ?? []).map((c) => c.id);

  const { data: enrollments } = await supabase
    .from('enrollments')
    .select('class_id, enrolled_at')
    .eq('student_id', studentId)
    .in('class_id', teacherClassIds.length > 0 ? teacherClassIds : ['00000000-0000-0000-0000-000000000000']);

  const enrolledClassIds = (enrollments ?? []).map((e) => e.class_id);
  const enrolledClasses = (teacherClasses ?? []).filter((c) =>
    enrolledClassIds.includes(c.id)
  );

  // Fetch assignments for those classes
  const { data: assignments } = enrolledClassIds.length > 0
    ? await supabase
        .from('assignments')
        .select('id, title, class_id, due_date, status')
        .in('class_id', enrolledClassIds)
    : { data: [] };

  const assignmentIds = (assignments ?? []).map((a) => a.id);

  // Fetch submissions for those assignments
  const { data: submissions } = assignmentIds.length > 0
    ? await supabase
        .from('submissions')
        .select('id, assignment_id, submission_status, final_grade, ai_grade, submitted_at')
        .eq('student_id', studentId)
        .in('assignment_id', assignmentIds)
        .order('submitted_at', { ascending: false })
    : { data: [] };

  // Grade stats
  const gradedSubs = (submissions ?? []).filter(
    (s) => s.submission_status === 'graded' && (s.final_grade ?? s.ai_grade) != null
  );
  const grades = gradedSubs.map((s) => s.final_grade ?? s.ai_grade ?? 0);
  const avgGrade =
    grades.length > 0
      ? Math.round(grades.reduce((a, b) => a + b, 0) / grades.length)
      : null;
  const highestGrade = grades.length > 0 ? Math.max(...grades) : null;
  const lowestGrade = grades.length > 0 ? Math.min(...grades) : null;

  // Homework completion rate
  const totalAssignments = (assignments ?? []).filter((a) => a.status === 'active').length;
  const submittedCount = (submissions ?? []).length;
  const completionRate =
    totalAssignments > 0
      ? Math.round((submittedCount / totalAssignments) * 100)
      : null;

  // Pending homework
  const submittedAssignmentIds = new Set((submissions ?? []).map((s) => s.assignment_id));
  const pendingAssignments = (assignments ?? [])
    .filter((a) => a.status === 'active' && !submittedAssignmentIds.has(a.id))
    .map((a) => ({ id: a.id, title: a.title, dueDate: a.due_date }));

  // Fetch behavior metrics
  const { data: metrics } = await supabase
    .from('student_metrics')
    .select('distraction_index, time_spent_seconds, concept_id, recorded_at, class_id')
    .eq('student_id', studentId)
    .order('recorded_at', { ascending: false })
    .limit(30);

  const metricsData = metrics ?? [];
  const avgDistractionIndex =
    metricsData.length > 0
      ? parseFloat(
          (
            metricsData.reduce((sum, m) => sum + (m.distraction_index ?? 0), 0) /
            metricsData.length
          ).toFixed(1)
        )
      : null;

  const totalTimeOnTaskSeconds = metricsData.reduce(
    (sum, m) => sum + (m.time_spent_seconds ?? 0),
    0
  );

  const lastMetricAt =
    metricsData.length > 0 ? metricsData[0].recorded_at : null;

  // Fetch recent absences
  const { data: absences } = await supabase
    .from('absences')
    .select('id, date_start, date_end, reason')
    .eq('class_id', enrolledClassIds[0] ?? '')
    .order('date_start', { ascending: false })
    .limit(5);

  // Recent submissions (last 5)
  const recentSubmissions = (submissions ?? []).slice(0, 5).map((sub) => {
    const assignment = (assignments ?? []).find((a) => a.id === sub.assignment_id);
    return {
      id: sub.id,
      title: assignment?.title ?? 'Assignment',
      status: sub.submission_status,
      grade: sub.final_grade ?? sub.ai_grade,
      submittedAt: sub.submitted_at,
    };
  });

  // AI insight readiness
  const aiInsightReady = gradedSubs.length >= 10;
  const aiInsightMessage = aiInsightReady
    ? 'AI behavioral analysis will be available soon based on this student\'s activity patterns.'
    : `AI behavioral analysis unlocks after 10 graded submissions. (${gradedSubs.length}/10 completed)`;

  const user = (student as any).users;

  return NextResponse.json({
    success: true,
    student: {
      id: student.id,
      name: user?.name ?? 'Student',
      email: user?.email ?? '',
      grade_level: student.grade_level,
      date_of_birth: student.date_of_birth,
      enrolledAt: student.created_at,
    },
    enrolledClasses: enrolledClasses.map((c) => ({ id: c.id, name: c.name, subject: c.subject })),
    performance: {
      avgGrade,
      highestGrade,
      lowestGrade,
      gradedCount: gradedSubs.length,
      submittedCount,
      totalAssignments,
      completionRate,
      pendingAssignments,
    },
    behavior: {
      avgDistractionIndex,
      totalTimeOnTaskSeconds,
      totalTimeOnTaskHours: parseFloat((totalTimeOnTaskSeconds / 3600).toFixed(1)),
      lastMetricAt,
      metricsRecorded: metricsData.length,
    },
    recentSubmissions,
    recentAbsences: absences ?? [],
    aiInsight: {
      ready: aiInsightReady,
      message: aiInsightMessage,
    },
  });
}
