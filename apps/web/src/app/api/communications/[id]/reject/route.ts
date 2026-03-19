import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_TABLES, NOTIFICATION_STATUS } from 'shared';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// POST /api/communications/[id]/reject
// Soft-delete: marks rejected, preserved for FERPA audit trail.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: notificationId } = await params;
    const body = await req.json();
    const { teacherId, reason } = body;

    if (!teacherId) {
      return NextResponse.json({ success: false, error: 'teacherId is required' }, { status: 400 });
    }

    const supabaseAdmin = getAdminClient();

    const { data: notification, error: fetchError } = await supabaseAdmin
      .from(SUPABASE_TABLES.PARENT_NOTIFICATIONS)
      .select('id, status, teacher_id')
      .eq('id', notificationId)
      .single();

    if (fetchError || !notification) {
      return NextResponse.json({ success: false, error: 'Notification not found' }, { status: 404 });
    }

    if (notification.teacher_id !== teacherId) {
      return NextResponse.json({ success: false, error: 'Not authorized' }, { status: 403 });
    }

    if (notification.status !== NOTIFICATION_STATUS.DRAFT) {
      return NextResponse.json(
        { success: false, error: `Cannot reject notification with status '${notification.status}'` },
        { status: 409 }
      );
    }

    const updatePayload: Record<string, unknown> = { status: NOTIFICATION_STATUS.REJECTED };
    if (reason) updatePayload.rejection_reason = reason;

    const { error: updateError } = await supabaseAdmin
      .from(SUPABASE_TABLES.PARENT_NOTIFICATIONS)
      .update(updatePayload)
      .eq('id', notificationId);

    if (updateError) throw updateError;

    return NextResponse.json({ success: true, notificationId, status: NOTIFICATION_STATUS.REJECTED });
  } catch (error: any) {
    console.error('Notification rejection failed:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}