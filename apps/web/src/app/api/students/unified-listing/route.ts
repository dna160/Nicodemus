import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// ============================================================
// GET /api/students/unified-listing
// Returns all enrolled students for a school with aggregated
// cross-functional data: attendance, metrics, submissions, comms.
// Supports pagination, filtering, and searching.
// Query params: schoolId (required), gradeLevel, search, limit, offset
// ============================================================

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const schoolId = searchParams.get('schoolId');
  const gradeLevel = searchParams.get('gradeLevel');
  const search = searchParams.get('search');
  const limit = parseInt(searchParams.get('limit') || '100');
  const offset = parseInt(searchParams.get('offset') || '0');

  if (!schoolId) {
    return NextResponse.json(
      { success: false, error: 'schoolId is required' },
      { status: 400 }
    );
  }

  const supabaseAdmin = getAdminClient();

  // Fetch students with all cross-functional data in one joined query
  let query = supabaseAdmin
    .from('students')
    .select(`
      id,
      grade_level,
      date_of_birth,
      created_at,
      users!inner (
        id,
        name,
        email,
        school_id,
        created_at
      ),
      student_metrics (
        distraction_index,
        time_spent_seconds,
        success_rate,
        attempt_count,
        concept_id,
        recorded_at
      ),
      submissions (
        id,
        submission_status,
        submitted_at,
        graded,
        ai_grade
      ),
      parent_notifications (
        id,
        type,
        status,
        sent_at,
        created_at
      )
    `)
    .eq('users.school_id', schoolId)
    .order('users(name)', { ascending: true })
    .range(offset, offset + limit - 1);

  if (gradeLevel) {
    query = query.eq('grade_level', gradeLevel);
  }

  if (search) {
    query = query.ilike('users.name', `%${search}%`);
  }

  const { data: students, error } = await query;

  if (error) {
    console.error('Unified listing fetch error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  // Fetch attendance logs separately (simpler join)
  const studentIds = students?.map((s) => s.id) ?? [];

  const { data: absences } = await supabaseAdmin
    .from('absences')
    .select('teacher_id, date_start, date_end, reason, created_at')
    .order('date_start', { ascending: false });

  // Fetch onboarding checklist status for each student
  const { data: onboardingItems } = studentIds.length
    ? await supabaseAdmin
        .from('onboarding_checklist')
        .select('student_id, document_type, status')
        .in('student_id', studentIds)
    : { data: [] };

  // Build a lookup of onboarding completeness per student
  const onboardingMap: Record<string, { total: number; completed: number }> = {};
  for (const item of onboardingItems ?? []) {
    if (!onboardingMap[item.student_id]) {
      onboardingMap[item.student_id] = { total: 0, completed: 0 };
    }
    onboardingMap[item.student_id].total++;
    if (item.status === 'verified') {
      onboardingMap[item.student_id].completed++;
    }
  }

  // Enrich each student with computed summary fields
  const enriched = students?.map((student) => {
    const metrics = student.student_metrics ?? [];
    const submissions = student.submissions ?? [];
    const notifications = student.parent_notifications ?? [];

    // Compute avg distraction index
    const avgDistraction =
      metrics.length > 0
        ? metrics.reduce((sum: number, m: any) => sum + (m.distraction_index ?? 0), 0) /
          metrics.length
        : null;

    // Latest metric
    const latestMetric = metrics.sort(
      (a: any, b: any) =>
        new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime()
    )[0];

    // Submission breakdown
    const submissionBreakdown = submissions.reduce(
      (acc: Record<string, number>, s: any) => {
        acc[s.submission_status] = (acc[s.submission_status] || 0) + 1;
        return acc;
      },
      {}
    );

    // Parent communications sent
    const parentUpdatesSent = notifications.filter(
      (n: any) => n.status === 'sent'
    ).length;

    // Build chronological timeline events
    const timelineEvents = [
      // Enrollment date
      {
        type: 'enrollment',
        label: 'Student Enrolled',
        date: (student as any).users?.created_at,
        color: 'green',
      },
      // Metrics events (most recent 5)
      ...metrics
        .sort(
          (a: any, b: any) =>
            new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime()
        )
        .slice(0, 5)
        .map((m: any) => ({
          type: 'metric',
          label: `Learning Session: ${m.concept_id?.replace(/_/g, ' ')}`,
          date: m.recorded_at,
          color: (m.distraction_index ?? 0) > 0.7 ? 'red' : 'blue',
          detail: `Distraction: ${Math.round((m.distraction_index ?? 0) * 100)}%`,
        })),
      // Parent notifications
      ...notifications
        .filter((n: any) => n.status === 'sent' && n.sent_at)
        .map((n: any) => ({
          type: 'communication',
          label: `Parent Update Sent (${n.type})`,
          date: n.sent_at,
          color: 'blue',
        })),
    ]
      .filter((e) => e.date)
      .sort((a, b) => new Date(b.date!).getTime() - new Date(a.date!).getTime());

    const onboarding = onboardingMap[student.id] ?? { total: 0, completed: 0 };

    return {
      id: student.id,
      name: (student as any).users?.name,
      email: (student as any).users?.email,
      gradeLevel: student.grade_level,
      dateOfBirth: student.date_of_birth,
      enrolledAt: (student as any).users?.created_at,
      // Summary stats
      avgDistractionIndex: avgDistraction !== null ? Math.round(avgDistraction * 100) / 100 : null,
      totalMetricEvents: metrics.length,
      lastMetricAt: latestMetric?.recorded_at ?? null,
      submissionBreakdown,
      totalSubmissions: submissions.length,
      parentUpdatesSent,
      // Onboarding
      onboardingCompleted: onboarding.completed,
      onboardingTotal: onboarding.total,
      onboardingComplete: onboarding.total > 0 && onboarding.completed === onboarding.total,
      // Timeline
      timeline: timelineEvents,
    };
  });

  return NextResponse.json({
    success: true,
    students: enriched ?? [],
    total: enriched?.length ?? 0,
    pagination: { limit, offset },
  });
}
