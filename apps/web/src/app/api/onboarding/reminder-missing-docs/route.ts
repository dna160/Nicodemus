import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { modal } from '@/lib/modal';
import { SUPABASE_TABLES, DOCUMENT_TYPE_LABELS, NOTIFICATION_STATUS } from 'shared';

export const dynamic = 'force-dynamic';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const MAX_REMINDERS = 2;
const DAYS_BEFORE_REMINDER = 7;

// ============================================================
// POST /api/onboarding/reminder-missing-docs
// Called by Inngest cron (daily at 8AM UTC) or manually by admin.
// Finds students with pending documents > 7 days post-enrollment,
// generates AI reminder emails, and queues them for auto-send.
// Protected by internal API key (not public).
// Body: { schoolId? } — optional to limit scope
// ============================================================

export async function POST(req: NextRequest) {
  // Internal route: validate via API key header
  const apiKey = req.headers.get('x-internal-api-key');
  if (apiKey !== process.env.INTERNAL_API_KEY) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { schoolId } = body;

    const supabaseAdmin = getAdminClient();

    // Find pending checklist items older than DAYS_BEFORE_REMINDER days
    // with fewer than MAX_REMINDERS reminders already sent
    const cutoffDate = new Date(
      Date.now() - DAYS_BEFORE_REMINDER * 24 * 60 * 60 * 1000
    ).toISOString();

    const { data: pendingItems, error: fetchError } = await supabaseAdmin
      .from(SUPABASE_TABLES.ONBOARDING_CHECKLIST)
      .select(`
        id,
        student_id,
        document_type,
        reminder_count,
        created_at,
        students!inner (
          id,
          grade_level,
          users!inner (
            name,
            email,
            school_id
          )
        )
      `)
      .eq('status', 'pending')
      .lt('reminder_count', MAX_REMINDERS)
      .lt('created_at', cutoffDate);

    if (fetchError) throw fetchError;

    if (!pendingItems || pendingItems.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No pending documents requiring reminders.',
        remindersQueued: 0,
      });
    }

    // Group pending items by student for consolidated reminders
    const byStudent = new Map<
      string,
      {
        studentId: string;
        studentName: string;
        parentEmail: string;
        schoolId: string;
        missingDocs: string[];
        enrollmentDate: string;
        checklistIds: string[];
      }
    >();

    for (const item of pendingItems) {
      const student = (item as any).students;
      const user = student?.users;
      const itemSchoolId = user?.school_id;

      // Filter by school if specified
      if (schoolId && itemSchoolId !== schoolId) continue;

      const studentId = item.student_id;
      if (!byStudent.has(studentId)) {
        byStudent.set(studentId, {
          studentId,
          studentName: user?.name ?? 'Student',
          parentEmail: user?.email ?? '',
          schoolId: itemSchoolId,
          missingDocs: [],
          enrollmentDate: item.created_at,
          checklistIds: [],
        });
      }

      const record = byStudent.get(studentId)!;
      record.missingDocs.push(
        DOCUMENT_TYPE_LABELS[item.document_type as keyof typeof DOCUMENT_TYPE_LABELS] ??
          item.document_type
      );
      record.checklistIds.push(item.id);
    }

    if (byStudent.size === 0) {
      return NextResponse.json({
        success: true,
        message: 'No students need reminders.',
        remindersQueued: 0,
      });
    }

    // Fetch school names for email context
    const schoolIds = [...new Set([...byStudent.values()].map((s) => s.schoolId))];
    const { data: schools } = await supabaseAdmin
      .from('schools')
      .select('id, name')
      .in('id', schoolIds);
    const schoolNameMap = Object.fromEntries(schools?.map((s: any) => [s.id, s.name]) ?? []);

    const remindersQueued: string[] = [];

    // Generate and queue reminder email for each student
    for (const [studentId, record] of byStudent.entries()) {
      try {
        const schoolName = schoolNameMap[record.schoolId] ?? 'School';

        // Generate AI reminder email
        const emailDraft = await modal.generateOnboardingReminder({
          parentName: record.studentName.split(' ')[0] + "'s parent",
          childName: record.studentName,
          schoolName,
          missingDocuments: record.missingDocs,
          enrollmentDate: new Date(record.enrollmentDate).toLocaleDateString(),
          portalUrl: `${process.env.NEXT_PUBLIC_APP_URL}/parent/dashboard`,
          apiKey: process.env.CLAUDE_API_KEY,
        });

        // Save as parent_notification draft (auto-approved for onboarding reminders)
        await supabaseAdmin.from(SUPABASE_TABLES.PARENT_NOTIFICATIONS).insert({
          parent_id: null,
          student_id: studentId,
          type: 'onboarding_reminder',
          subject: emailDraft.subject,
          body: emailDraft.body,
          status: NOTIFICATION_STATUS.SENT, // Auto-approved (no HITL for reminders)
          sent_at: new Date().toISOString(),
        });

        // Increment reminder count for each affected checklist item
        const now = new Date().toISOString();
        for (const checklistId of record.checklistIds) {
          const { data: current } = await supabaseAdmin
            .from(SUPABASE_TABLES.ONBOARDING_CHECKLIST)
            .select('reminder_count')
            .eq('id', checklistId)
            .single();

          await supabaseAdmin
            .from(SUPABASE_TABLES.ONBOARDING_CHECKLIST)
            .update({
              reminder_count: (current?.reminder_count ?? 0) + 1,
              reminder_last_sent_at: now,
            })
            .eq('id', checklistId);
        }

        remindersQueued.push(studentId);
      } catch (studentError: any) {
        console.error(`Reminder failed for student ${studentId}:`, studentError.message);
        // Continue processing other students
      }
    }

    return NextResponse.json({
      success: true,
      message: `${remindersQueued.length} reminder emails queued.`,
      remindersQueued: remindersQueued.length,
      studentIds: remindersQueued,
    });
  } catch (error: any) {
    console.error('Missing docs reminder cron failed:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
