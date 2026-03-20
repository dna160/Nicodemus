import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_TABLES } from 'shared';

export const dynamic = 'force-dynamic';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// ============================================================
// GET /api/admissions/[id]/drafts
// Returns all draft/sent email notifications for a prospective student.
// Used by the admissions pipeline panel to show email history.
// ============================================================

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: prospectId } = await params;

  const supabaseAdmin = getAdminClient();

  const { data: notifications, error } = await supabaseAdmin
    .from(SUPABASE_TABLES.PARENT_NOTIFICATIONS)
    .select('id, type, subject, body, status, created_at, sent_at')
    .eq('prospective_student_id', prospectId)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    drafts: notifications ?? [],
  });
}
