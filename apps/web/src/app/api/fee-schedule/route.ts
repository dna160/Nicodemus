import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_TABLES } from 'shared';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// ============================================================
// GET /api/fee-schedule?schoolId=xxx&gradeLevel=9
// Returns the active fee schedule for a school + grade combination.
// Used by the enrollment dialog to auto-populate fee fields.
// ============================================================

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const schoolId = searchParams.get('schoolId');
  const gradeLevel = searchParams.get('gradeLevel');

  if (!schoolId) {
    return NextResponse.json(
      { success: false, error: 'schoolId is required' },
      { status: 400 }
    );
  }

  const supabaseAdmin = getAdminClient();
  const today = new Date().toISOString().split('T')[0];

  let query = supabaseAdmin
    .from(SUPABASE_TABLES.FEE_SCHEDULE)
    .select('*')
    .eq('school_id', schoolId)
    .lte('effective_from_date', today)
    .or(`effective_to_date.is.null,effective_to_date.gte.${today}`)
    .order('effective_from_date', { ascending: false });

  if (gradeLevel) {
    query = query.eq('grade_level', gradeLevel);
  }

  const { data: schedules, error } = await query;

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  // Return first match (most recent effective date)
  return NextResponse.json({
    success: true,
    schedule: schedules?.[0] ?? null,
    schedules: schedules ?? [],
  });
}
