/**
 * GET /api/student/homework/[id]?studentId=xxx
 * Returns full assignment detail + student's existing submission if any.
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
  const { id } = await params;
  const studentId = req.nextUrl.searchParams.get('studentId');

  const supabase = getAdminClient();

  const { data: assignment, error } = await supabase
    .from('assignments')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !assignment) {
    return NextResponse.json({ success: false, error: 'Assignment not found' }, { status: 404 });
  }

  let submission = null;
  if (studentId) {
    const { data } = await supabase
      .from('submissions')
      .select('*')
      .eq('assignment_id', id)
      .eq('student_id', studentId)
      .single();
    submission = data ?? null;
  }

  return NextResponse.json({ success: true, assignment, submission });
}
