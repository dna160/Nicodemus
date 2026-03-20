import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { inngest } from '@/lib/inngest';
import { SUPABASE_TABLES, INNGEST_EVENTS } from 'shared';

export const dynamic = 'force-dynamic';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// ============================================================
// GET /api/erp/absences
// Returns teacher's current/upcoming absences
// Query: teacherId (required)
// ============================================================

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const teacherId = searchParams.get('teacherId');

  if (!teacherId) {
    return NextResponse.json(
      { success: false, error: 'teacherId is required' },
      { status: 400 }
    );
  }

  const supabaseAdmin = getAdminClient();

  // Get all absences for this teacher (current and future)
  const { data: absences, error } = await supabaseAdmin
    .from(SUPABASE_TABLES.ABSENCES)
    .select(`
      id,
      teacher_id,
      class_id,
      date_start,
      date_end,
      reason,
      lesson_plan_id,
      created_at,
      substitute_assignments(
        id,
        substitute_id,
        status,
        email_sent_at,
        substitutes(name, email)
      )
    `)
    .eq('teacher_id', teacherId)
    .gte('date_end', new Date().toISOString().split('T')[0])
    .order('date_start', { ascending: true });

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    absences: absences ?? [],
  });
}

// ============================================================
// POST /api/erp/absences
// Create a new absence + generate substitute lesson plan
// Body: { teacherId, classId, dateStart, dateEnd, reason, lessonObjectives, materialsAvailable, specialInstructions }
// ============================================================

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      teacherId,
      classId,
      dateStart,
      dateEnd,
      reason = 'other',
      lessonObjectives = '',
      materialsAvailable = [],
      specialInstructions = '',
    } = body;

    if (!teacherId || !classId || !dateStart || !dateEnd) {
      return NextResponse.json(
        { success: false, error: 'teacherId, classId, dateStart, dateEnd are required' },
        { status: 400 }
      );
    }

    const supabaseAdmin = getAdminClient();

    // 1. Fetch class info for lesson plan generation
    const { data: classData, error: classError } = await supabaseAdmin
      .from(SUPABASE_TABLES.CLASSES)
      .select('id, name, grade_level, subject')
      .eq('id', classId)
      .single();

    if (classError || !classData) {
      return NextResponse.json(
        { success: false, error: 'Class not found' },
        { status: 404 }
      );
    }

    // 2. Get student count for that class
    const { count: studentCount } = await supabaseAdmin
      .from(SUPABASE_TABLES.ENROLLMENTS)
      .select('*', { count: 'exact', head: true })
      .eq('class_id', classId);

    // 3. Create the absence record
    const { data: absence, error: absenceError } = await supabaseAdmin
      .from(SUPABASE_TABLES.ABSENCES)
      .insert({
        teacher_id: teacherId,
        class_id: classId,
        date_start: dateStart,
        date_end: dateEnd,
        reason,
      })
      .select()
      .single();

    if (absenceError || !absence) throw absenceError;

    // 4. Fire Inngest event (generates lesson plan, finds subs, sends invites)
    try {
      await inngest.send({
        name: INNGEST_EVENTS.ABSENCE_CREATED,
        data: {
          absenceId: absence.id,
          teacherId,
          classId,
          className: classData.name,
          gradeLevel: classData.grade_level,
          subject: classData.subject,
          studentCount: studentCount ?? 20,
          dateStart,
          dateEnd,
          lessonObjectives,
          materialsAvailable,
          specialInstructions,
        },
      });
    } catch (inngestError: any) {
      console.warn('Inngest trigger skipped (non-fatal):', inngestError.message);
    }

    return NextResponse.json({
      success: true,
      absence,
    });
  } catch (error: any) {
    console.error('Absence creation failed:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
