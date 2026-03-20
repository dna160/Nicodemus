/**
 * GET /api/admin/students?schoolId=xxx&search=xxx&grade=xxx&limit=50&offset=0
 * Returns all students in a school with performance summary and parent contact info.
 * Admin-only endpoint.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const PAGE_SIZE = 50;

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const schoolId = searchParams.get('schoolId');
  const search = searchParams.get('search') ?? '';
  const grade = searchParams.get('grade') ?? '';
  const limit = Math.min(parseInt(searchParams.get('limit') ?? `${PAGE_SIZE}`), 100);
  const offset = parseInt(searchParams.get('offset') ?? '0');

  if (!schoolId) {
    return NextResponse.json({ success: false, error: 'schoolId required' }, { status: 400 });
  }

  const supabase = getAdminClient();

  // Fetch student users in this school
  let query = supabase
    .from('users')
    .select('id, name, email, created_at')
    .eq('school_id', schoolId)
    .eq('role', 'student')
    .order('name');

  if (search) {
    query = query.ilike('name', `%${search}%`);
  }

  const { data: studentUsers, error: usersError } = await query
    .range(offset, offset + limit - 1);

  if (usersError) {
    return NextResponse.json({ success: false, error: usersError.message }, { status: 500 });
  }

  if (!studentUsers || studentUsers.length === 0) {
    return NextResponse.json({ success: true, students: [], total: 0 });
  }

  const studentIds = studentUsers.map((u) => u.id);

  // Fetch student profiles (grade_level, date_of_birth)
  const { data: studentProfiles } = await supabase
    .from('students')
    .select('id, grade_level, date_of_birth')
    .in('id', studentIds);

  const profileMap = Object.fromEntries(
    (studentProfiles ?? []).map((p) => [p.id, p])
  );

  // Filter by grade if specified (post-fetch since grade is on students table)
  const filteredIds = grade
    ? studentIds.filter((id) => profileMap[id]?.grade_level === grade)
    : studentIds;

  const filteredUsers = studentUsers.filter((u) => filteredIds.includes(u.id));

  // Fetch parent info via student_parents join
  const { data: studentParents } = await supabase
    .from('student_parents')
    .select(`
      student_id,
      parents!inner ( id, users!inner ( name, email ) )
    `)
    .in('student_id', filteredIds);

  const parentMap: Record<string, { name: string; email: string }> = {};
  for (const sp of studentParents ?? []) {
    const parent = (sp as any).parents;
    const parentUser = parent?.users;
    if (parentUser && !parentMap[sp.student_id]) {
      parentMap[sp.student_id] = {
        name: parentUser.name,
        email: parentUser.email,
      };
    }
  }

  // Fetch graded submissions for avg grade
  const { data: submissions } = await supabase
    .from('submissions')
    .select('student_id, final_grade, ai_grade, submission_status')
    .in('student_id', filteredIds)
    .eq('submission_status', 'graded');

  const gradesByStudent: Record<string, number[]> = {};
  for (const sub of submissions ?? []) {
    const grade = sub.final_grade ?? sub.ai_grade;
    if (grade != null) {
      if (!gradesByStudent[sub.student_id]) gradesByStudent[sub.student_id] = [];
      gradesByStudent[sub.student_id].push(grade);
    }
  }

  // Fetch total submission counts for completion rate
  const { data: allSubmissions } = await supabase
    .from('submissions')
    .select('student_id, submission_status')
    .in('student_id', filteredIds);

  const submissionCountByStudent: Record<string, number> = {};
  for (const sub of allSubmissions ?? []) {
    submissionCountByStudent[sub.student_id] =
      (submissionCountByStudent[sub.student_id] ?? 0) + 1;
  }

  // Fetch latest metric per student (distraction index)
  const { data: metrics } = await supabase
    .from('student_metrics')
    .select('student_id, distraction_index, time_spent_seconds, recorded_at')
    .in('student_id', filteredIds)
    .order('recorded_at', { ascending: false });

  const latestMetricByStudent: Record<string, any> = {};
  for (const metric of metrics ?? []) {
    if (!latestMetricByStudent[metric.student_id]) {
      latestMetricByStudent[metric.student_id] = metric;
    }
  }

  // Assemble response
  const students = filteredUsers.map((user) => {
    const profile = profileMap[user.id];
    const grades = gradesByStudent[user.id] ?? [];
    const avgGrade =
      grades.length > 0
        ? Math.round(grades.reduce((a, b) => a + b, 0) / grades.length)
        : null;
    const metric = latestMetricByStudent[user.id];

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      grade_level: profile?.grade_level ?? null,
      date_of_birth: profile?.date_of_birth ?? null,
      enrolledAt: user.created_at,
      parent: parentMap[user.id] ?? null,
      avgGrade,
      submissionCount: submissionCountByStudent[user.id] ?? 0,
      gradedCount: grades.length,
      distractionIndex: metric?.distraction_index ?? null,
      lastActivity: metric?.recorded_at ?? user.created_at,
    };
  });

  return NextResponse.json({
    success: true,
    students,
    total: filteredUsers.length,
  });
}
