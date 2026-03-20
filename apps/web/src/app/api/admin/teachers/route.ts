/**
 * GET /api/admin/teachers?schoolId=xxx
 * Returns all teachers in a school with their classes and student counts.
 * Admin-only endpoint.
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
  const schoolId = req.nextUrl.searchParams.get('schoolId');
  if (!schoolId) {
    return NextResponse.json({ success: false, error: 'schoolId required' }, { status: 400 });
  }

  const supabase = getAdminClient();

  // Fetch teachers in this school
  const { data: teacherUsers, error: teacherError } = await supabase
    .from('users')
    .select('id, name, email, created_at')
    .eq('school_id', schoolId)
    .eq('role', 'teacher')
    .order('name');

  if (teacherError) {
    return NextResponse.json({ success: false, error: teacherError.message }, { status: 500 });
  }

  if (!teacherUsers || teacherUsers.length === 0) {
    return NextResponse.json({ success: true, teachers: [] });
  }

  const teacherIds = teacherUsers.map((t) => t.id);

  // Fetch teacher profiles (subjects, grade_levels)
  const { data: teacherProfiles } = await supabase
    .from('teachers')
    .select('id, subjects, grade_levels, bio')
    .in('id', teacherIds);

  const profileMap = Object.fromEntries(
    (teacherProfiles ?? []).map((p) => [p.id, p])
  );

  // Fetch classes for these teachers with enrollment counts
  const { data: classes } = await supabase
    .from('classes')
    .select(`
      id,
      name,
      subject,
      grade_level,
      period,
      teacher_id,
      enrollments ( student_id )
    `)
    .in('teacher_id', teacherIds)
    .eq('school_id', schoolId)
    .order('name');

  // Group classes by teacher
  const classesByTeacher: Record<string, any[]> = {};
  for (const cls of classes ?? []) {
    if (!classesByTeacher[cls.teacher_id]) {
      classesByTeacher[cls.teacher_id] = [];
    }
    classesByTeacher[cls.teacher_id].push({
      id: cls.id,
      name: cls.name,
      subject: cls.subject,
      grade_level: cls.grade_level,
      period: cls.period,
      student_count: (cls.enrollments as any[])?.length ?? 0,
    });
  }

  // Fetch lesson counts per teacher
  const { data: lessons } = await supabase
    .from('lessons')
    .select('id, teacher_id, status')
    .in('teacher_id', teacherIds);

  const lessonCountByTeacher: Record<string, number> = {};
  for (const lesson of lessons ?? []) {
    lessonCountByTeacher[lesson.teacher_id] =
      (lessonCountByTeacher[lesson.teacher_id] ?? 0) + 1;
  }

  // Assemble response
  const teachers = teacherUsers.map((user) => {
    const profile = profileMap[user.id];
    const teacherClasses = classesByTeacher[user.id] ?? [];
    const totalStudents = teacherClasses.reduce(
      (sum, c) => sum + c.student_count,
      0
    );

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      subjects: profile?.subjects ?? [],
      grade_levels: profile?.grade_levels ?? [],
      bio: profile?.bio ?? null,
      classes: teacherClasses,
      totalClasses: teacherClasses.length,
      totalStudents,
      lessonCount: lessonCountByTeacher[user.id] ?? 0,
      joinedAt: user.created_at,
    };
  });

  return NextResponse.json({ success: true, teachers });
}
