import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { modal } from '@/lib/modal';
import { inngest } from '@/lib/inngest';
import {
  SUPABASE_TABLES,

  INNGEST_EVENTS,
  NOTIFICATION_STATUS,
  NOTIFICATION_TYPES,
} from 'shared';

export const dynamic = 'force-dynamic';

// Server-only admin client — never expose service role key to browser
function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// ============================================================
// GET /api/communications
// Returns all draft and pending notifications for a teacher,
// plus recent sent history (last 30 days).
// Query params: teacherId (required)
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

  // Fetch pending drafts (awaiting teacher review)
  const { data: drafts, error: draftsError } = await supabaseAdmin
    .from(SUPABASE_TABLES.PARENT_NOTIFICATIONS)
    .select('*')
    .eq('teacher_id', teacherId)
    .eq('status', NOTIFICATION_STATUS.DRAFT)
    .order('created_at', { ascending: false });

  if (draftsError) {
    return NextResponse.json(
      { success: false, error: draftsError.message },
      { status: 500 }
    );
  }

  // Fetch recent sent history (last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: history, error: historyError } = await supabaseAdmin
    .from(SUPABASE_TABLES.PARENT_NOTIFICATIONS)
    .select('*')
    .eq('teacher_id', teacherId)
    .eq('status', NOTIFICATION_STATUS.SENT)
    .gte('sent_at', thirtyDaysAgo)
    .order('sent_at', { ascending: false })
    .limit(50);

  if (historyError) {
    return NextResponse.json(
      { success: false, error: historyError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    drafts: drafts ?? [],
    history: history ?? [],
  });
}

// ============================================================
// POST /api/communications
// Create a new parent notification draft via AI (Claude Haiku).
// Body: { teacherId, studentName, notificationType, details, teacherName, schoolName }
// Returns the saved draft with AI-generated subject + body.
// HITL: Draft is saved with status='draft', teacher must approve before send.
// ============================================================

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      teacherId,
      studentId,
      studentName,
      notificationType = NOTIFICATION_TYPES.PROGRESS,
      details = {},
      teacherName = 'Your Teacher',
      schoolName = 'School',
    } = body;

    if (!teacherId) {
      return NextResponse.json(
        { success: false, error: 'teacherId is required' },
        { status: 400 }
      );
    }

    // 1. Call Modal → Claude Haiku to generate email draft
    const emailDraft = await modal.generateParentEmail({
      notificationType,
      studentName: studentName || 'the student',
      teacherName,
      schoolName,
      details,
      apiKey: process.env.CLAUDE_API_KEY,
    });

    // 2. Save draft to Supabase (status='draft', awaiting teacher approval)
    const supabaseAdmin = getAdminClient();

    const { data: notification, error } = await supabaseAdmin
      .from(SUPABASE_TABLES.PARENT_NOTIFICATIONS)
      .insert({
        teacher_id: teacherId,
        student_id: studentId || null,
        type: notificationType,
        subject: emailDraft.subject,
        body: emailDraft.body,
        status: NOTIFICATION_STATUS.DRAFT,
      })
      .select()
      .single();

    if (error) throw error;

    // 3. Trigger Inngest event so workflows can react (non-fatal)
    try {
      await inngest.send({
        name: INNGEST_EVENTS.PARENT_NOTIFICATION_TRIGGERED,
        data: {
          notificationId: notification.id,
          teacherId,
          studentId: studentId || null,
          notificationType,
        },
      });
    } catch (inngestError: any) {
      console.warn('Inngest trigger skipped (non-fatal):', inngestError.message);
    }

    return NextResponse.json({ success: true, notification });
  } catch (error: any) {
    console.error('Parent notification creation failed:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
