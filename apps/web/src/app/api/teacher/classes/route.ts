/**
 * GET /api/teacher/classes?teacherId=xxx
 * Returns all classes taught by a teacher, with enrolled students,
 * assigned lessons, and submission stats per student.
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

  // Fetch classes for this teacher
  const { data: classes, error: classesError } = await supabase
    .from('classes')
    .select(`
      id,
      name,
      subject,
      grade_level,
      period,
      school_id,
      created_at,
      enrollments (
        student_id,
        enrolled_at,
        students!inner (
          id,
          grade_level,
          users!inner ( name, email )
        )
      )
    `)
    .eq('teacher_id', teacherId)
    .order('name');

  if (classesError) {
    return NextResponse.json({ success: false, error: classesError.message }, { status: 500 });
  }

  if (!classes || classes.length === 0) {
    return NextResponse.json({ success: true, classes: [] });
  }

  const classIds = classes.map((c) => c.id);

  // Fetch lessons assigned to these classes
  const { data: lessons } = await supabase
    .from('lessons')
    .select('id, title, subject, grade_level, class_id, status, published_at')
    .in('class_id', classIds)
    .order('published_at', { ascending: false });

  const lessonsByClass: Record<string, any[]> = {};
  for (const lesson of lessons ?? []) {
    if (lesson.class_id) {
      if (!lessonsByClass[lesson.class_id]) lessonsByClass[lesson.class_id] = [];
      lessonsByClass[lesson.class_id].push(lesson);
    }
  }

  // Fetch assignments for these classes
  const { data: assignments } = await supabase
    .from('assignments')
    .select('id, title, class_id, status, due_date, created_at')
    .in('class_id', classIds)
    .eq('status', 'active')
    .order('due_date', { ascending: true });

  const assignmentsByClass: Record<string, any[]> = {};
  for (const assignment of assignments ?? []) {
    if (!assignmentsByClass[assignment.class_id]) assignmentsByClass[assignment.class_id] = [];
    assignmentsByClass[assignment.class_id].push(assignment);
  }

  // Fetch all submission counts for these assignments (to show homework completion per class)
  const assignmentIds = (assignments ?? []).map((a) => a.id);
  const { data: submissions } = assignmentIds.length > 0
    ? await supabase
        .from('submissions')
        .select('assignment_id, student_id, submission_status, final_grade, ai_grade')
        .in('assignment_id', assignmentIds)
    : { data: [] };

  const submissionsByAssignment: Record<string, any[]> = {};
  for (const sub of submissions ?? []) {
    if (!submissionsByAssignment[sub.assignment_id]) submissionsByAssignment[sub.assignment_id] = [];
    submissionsByAssignment[sub.assignment_id].push(sub);
  }

  // Assemble class objects
  const enrichedClasses = classes.map((cls) => {
    const enrollments = (cls.enrollments as any[]) ?? [];

    // Build student list with quick stats
    const students = enrollments.map((enrollment) => {
      const student = enrollment.students;
      const user = student?.users;
      const studentId = student?.id;

      // Aggregate submission stats across this class's assignments
      const classAssignmentIds = (assignmentsByClass[cls.id] ?? []).map((a) => a.id);
      const studentSubs = (submissions ?? []).filter(
        (s) => s.student_id === studentId && classAssignmentIds.includes(s.assignment_id)
      );
      const submittedCount = studentSubs.length;
      const grades = studentSubs
        .filter((s) => s.submission_status === 'graded')
        .map((s) => s.final_grade ?? s.ai_grade)
        .filter((g) => g != null);
      const avgGrade =
        grades.length > 0
          ? Math.round(grades.reduce((a: number, b: number) => a + b, 0) / grades.length)
          : null;

      return {
        id: studentId,
        name: user?.name ?? 'Unknown',
        email: user?.email ?? '',
        grade_level: student?.grade_level ?? null,
        enrolled_at: enrollment.enrolled_at,
        submittedCount,
        totalAssignments: classAssignmentIds.length,
        avgGrade,
        completionRate:
          classAssignmentIds.length > 0
            ? Math.round((submittedCount / classAssignmentIds.length) * 100)
            : null,
      };
    });

    const classAssignments = assignmentsByClass[cls.id] ?? [];
    const classLessons = lessonsByClass[cls.id] ?? [];

    // Compute class-level stats
    const totalSubmissions = classAssignments.reduce(
      (sum, a) => sum + (submissionsByAssignment[a.id]?.length ?? 0),
      0
    );
    const maxPossibleSubmissions = classAssignments.length * students.length;

    return {
      id: cls.id,
      name: cls.name,
      subject: cls.subject,
      grade_level: cls.grade_level,
      period: cls.period,
      school_id: cls.school_id,
      students,
      studentCount: students.length,
      lessons: classLessons.map((l) => ({
        id: l.id,
        title: l.title,
        subject: l.subject,
        status: l.status,
        publishedAt: l.published_at,
      })),
      lessonCount: classLessons.length,
      activeAssignments: classAssignments.length,
      classCompletionRate:
        maxPossibleSubmissions > 0
          ? Math.round((totalSubmissions / maxPossibleSubmissions) * 100)
          : null,
    };
  });

  return NextResponse.json({ success: true, classes: enrichedClasses });
}
