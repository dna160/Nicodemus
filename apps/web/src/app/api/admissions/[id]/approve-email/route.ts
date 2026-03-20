import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { inngest } from '@/lib/inngest';
import { SUPABASE_TABLES, INNGEST_EVENTS, NOTIFICATION_STATUS } from 'shared';

export const dynamic = 'force-dynamic';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// ============================================================
// POST /api/admissions/[id]/approve-email
// Approves an AI-drafted welcome email for a prospective student.
// Moves notification from draft → sent (triggers email send).
// Body: { notificationId, adminId }
// ============================================================

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: prospectId } = await params;
    const body = await req.json();
    const { notificationId, adminId } = body;

    if (!notificationId || !adminId) {
      return NextResponse.json(
        { success: false, error: 'notificationId and adminId are required' },
        { status: 400 }
      );
    }

    const supabaseAdmin = getAdminClient();
    const sentAt = new Date().toISOString();

    // Update notification status to sent
    const { data: notification, error } = await supabaseAdmin
      .from(SUPABASE_TABLES.PARENT_NOTIFICATIONS)
      .update({
        status: NOTIFICATION_STATUS.SENT,
        approved_by: adminId,
        approved_at: sentAt,
        sent_at: sentAt,
      })
      .eq('id', notificationId)
      .eq('prospective_student_id', prospectId)
      .select()
      .single();

    if (error) throw error;

    // Update last_contact_at on prospect
    try {
      await supabaseAdmin
        .from(SUPABASE_TABLES.PROSPECTIVE_STUDENTS)
        .update({ last_contact_at: sentAt })
        .eq('id', prospectId);
    } catch {
      // Non-fatal: ignore if update fails
    }

    // Trigger Inngest for actual email delivery
    try {
      await inngest.send({
        name: INNGEST_EVENTS.WELCOME_EMAIL_APPROVED,
        data: {
          notificationId,
          prospectId,
          adminId,
          subject: notification.subject,
          body: notification.body,
        },
      });
    } catch (inngestError: any) {
      console.warn('Inngest email approval event skipped (non-fatal):', inngestError.message);
    }

    // Audit log
    try {
      await supabaseAdmin.from(SUPABASE_TABLES.AUDIT_LOG).insert({
        user_id: adminId,
        action: 'admissions_email_approved',
        table_name: 'parent_notifications',
        record_id: notificationId,
        changes: { prospective_student_id: prospectId, sent_at: sentAt },
      });
    } catch (auditError) {
      console.warn('Audit log failed (non-fatal):', auditError);
    }

    return NextResponse.json({
      success: true,
      notification,
      message: 'Welcome email approved and queued for delivery.',
    });
  } catch (error: any) {
    console.error('Email approval failed:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
