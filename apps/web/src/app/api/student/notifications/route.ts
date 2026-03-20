/**
 * GET /api/student/notifications?studentId=xxx
 * Returns parent notifications sent about this student — visible to the student
 * so they can see what communications have been sent to their parent/guardian.
 * Only shows 'sent' notifications (not drafts or rejected ones).
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
  const studentId = req.nextUrl.searchParams.get('studentId');
  if (!studentId) {
    return NextResponse.json({ success: false, error: 'studentId required' }, { status: 400 });
  }

  const supabase = getAdminClient();

  const { data: notifications, error } = await supabase
    .from('parent_notifications')
    .select('id, type, subject, body, status, sent_at, created_at')
    .eq('student_id', studentId)
    .eq('status', 'sent')
    .order('sent_at', { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, notifications: notifications ?? [] });
}
