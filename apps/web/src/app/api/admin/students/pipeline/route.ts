import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_TABLES } from 'shared';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const VALID_STAGES = ['inquiry_received', 'tour_scheduled', 'waitlisted', 'enrolled', 'churned'];

export async function PATCH(req: NextRequest) {
  try {
    const { studentId, stage } = await req.json();

    if (!studentId || !stage) {
      return NextResponse.json({ success: false, error: 'studentId and stage are required' }, { status: 400 });
    }
    if (!VALID_STAGES.includes(stage)) {
      return NextResponse.json({ success: false, error: `Invalid stage. Must be one of: ${VALID_STAGES.join(', ')}` }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from(SUPABASE_TABLES.PROSPECTIVE_STUDENTS)
      .update({ current_stage: stage, last_contact_at: new Date().toISOString() })
      .eq('id', studentId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, student: data });
  } catch (err: any) {
    console.error('Pipeline update error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
