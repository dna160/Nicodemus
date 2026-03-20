/**
 * GET /api/admin/overview?schoolId=xxx
 * Returns aggregate stats for the admin dashboard:
 * - Student, teacher, class counts
 * - Admissions funnel breakdown
 * - Pending invoice count + amount
 * - Recent enrollments / activity feed
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

  // Run all counts in parallel
  const [
    studentsRes,
    teachersRes,
    classesRes,
    invoicesRes,
    pipelineRes,
    recentStudentsRes,
  ] = await Promise.all([
    // Total enrolled students
    supabase
      .from('students')
      .select('id', { count: 'exact', head: true })
      .eq('users.school_id', schoolId)
      .eq('users.role', 'student'),

    // Total teachers
    supabase
      .from('teachers')
      .select('id', { count: 'exact', head: true })
      .eq('users.school_id', schoolId),

    // Total active classes
    supabase
      .from('classes')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', schoolId),

    // Pending invoices
    supabase
      .from('invoices')
      .select('id, total_amount_cents, status')
      .in('status', ['draft', 'sent', 'overdue']),

    // Admissions pipeline stages
    supabase
      .from('prospective_students')
      .select('current_stage')
      .eq('school_id', schoolId),

    // Recent student enrollments (last 10)
    supabase
      .from('students')
      .select(`
        id,
        created_at,
        users!inner ( name, school_id )
      `)
      .eq('users.school_id', schoolId)
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  // Total student count via enrollments (more reliable join)
  const { count: studentCount } = await supabase
    .from('users')
    .select('id', { count: 'exact', head: true })
    .eq('school_id', schoolId)
    .eq('role', 'student');

  const { count: teacherCount } = await supabase
    .from('users')
    .select('id', { count: 'exact', head: true })
    .eq('school_id', schoolId)
    .eq('role', 'teacher');

  // Compute pipeline summary
  const pipelineItems = pipelineRes.data ?? [];
  const pipelineSummary: Record<string, number> = {
    inquiry_received: 0,
    tour_scheduled: 0,
    waitlisted: 0,
    enrolled: 0,
    churned: 0,
  };
  for (const item of pipelineItems) {
    if (item.current_stage in pipelineSummary) {
      pipelineSummary[item.current_stage]++;
    }
  }

  // Compute invoice totals
  const invoices = invoicesRes.data ?? [];
  const pendingInvoiceCount = invoices.filter((i) =>
    ['draft', 'sent', 'overdue'].includes(i.status)
  ).length;
  const pendingInvoiceAmountCents = invoices
    .filter((i) => ['draft', 'sent', 'overdue'].includes(i.status))
    .reduce((sum, i) => sum + (i.total_amount_cents ?? 0), 0);

  // Build recent activity feed
  const recentStudents = recentStudentsRes.data ?? [];
  const recentActivity = recentStudents.map((s: any) => ({
    type: 'enrollment' as const,
    text: `${(s.users as any)?.name ?? 'Student'} enrolled`,
    at: s.created_at,
  }));

  return NextResponse.json({
    success: true,
    stats: {
      totalStudents: studentCount ?? 0,
      totalTeachers: teacherCount ?? 0,
      totalClasses: classesRes.count ?? 0,
      pendingInvoiceCount,
      pendingInvoiceAmountCents,
      pipelineSummary,
      totalProspects: pipelineItems.length,
    },
    recentActivity,
  });
}
