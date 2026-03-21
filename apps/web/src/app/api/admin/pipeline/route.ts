import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_TABLES } from 'shared';

export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const schoolId = searchParams.get('schoolId');

    let query = supabaseAdmin
      .from(SUPABASE_TABLES.PROSPECTIVE_STUDENTS)
      .select('id, child_name, parent_name, email, phone, grade_interested, current_stage, date_of_birth, location, student_id, profile_picture_url, curriculum_id, created_at, last_contact_at');

    if (schoolId) query = query.eq('school_id', schoolId);

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;

    return NextResponse.json({ success: true, students: data ?? [] });
  } catch (err: any) {
    console.error('Pipeline fetch error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
