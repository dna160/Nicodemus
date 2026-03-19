import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { inngest } from '@/lib/inngest';
import { SUPABASE_TABLES, INNGEST_EVENTS, NOTIFICATION_STATUS } from 'shared';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// POST /api/communications/[id]/approve
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: notificationId } = await params;
    const body = await req.json();
    const { teacherId } = body;

    if (!teacherId) {
      return NextResponse.json({ success: false, error: 'teacherId is required' }, { status: 400 });
    }

    const supabaseAdmin = getAdminClient();

    const { data: notification, error: fetchError } = await supabaseAdmin
      .from(SUPABASE_TABLES.PARENT_NOTIFICATIONS)
      .select('id, status, teacher_id, subject, student_id')
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
        { success: false, error: `Cannot approve notification with status '${notification.status}'` },
        { status: 409 }
      );
    }

    const sentAt = new Date().toISOString();

    // Mark as sent (email delivery is Phase 2 — for now, approval = sent)
    const { error: updateError } = await supabaseAdmin
      .from(SUPABASE_TABLES.PARENT_NOTIFICATIONS)
      .update({ status: NOTIFICATION_STATUS.SENT, sent_at: sentAt })
      .eq('id', notificationId);

    if (updateError) throw updateError;

    // Write FERPA audit log entry (subject only — no PII in logs)
    await supabaseAdmin
      .from(SUPABASE_TABLES.COMMUNICATION_LOG)
      .insert({
        teacher_id: teacherId,
        notification_id: notificationId,
        student_id: notification.student_id,
        channel: 'email',
        status: 'sent',
        sent_at: sentAt,
        subject_summary: notification.subject,
      })
      .then(({ error }) => {
        // Non-fatal: audit log failure should not block teacher workflow
        if (error) console.warn('Communication log write failed (non-fatal):', error.message);
      });

    // Trigger Inngest for additional processing (non-fatal)
    try {
      await inngest.send({
        name: INNGEST_EVENTS.PARENT_NOTIFICATION_APPROVED,
        data: { notificationId, teacherId },
      });
    } catch (inngestError: any) {
      console.warn('Inngest trigger skipped (non-fatal):', inngestError.message);
    }

    return NextResponse.json({ success: true, notificationId, status: NOTIFICATION_STATUS.SENT });
  } catch (error: any) {
    console.error('Notification approval failed:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}