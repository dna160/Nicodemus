import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { modal } from '@/lib/modal';
import { SUPABASE_TABLES, NOTIFICATION_STATUS } from 'shared';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// ============================================================
// POST /api/admissions/[id]/generate-welcome-email
// Generates a personalized AI welcome email for a prospective
// parent based on their open-ended inquiry form responses.
// Saved as a draft for admin approval before sending.
// Body: { adminId, schoolName, suggestedTourTimes? }
// ============================================================

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { adminId, schoolName = 'Our School', suggestedTourTimes = [] } = body;

    if (!adminId) {
      return NextResponse.json(
        { success: false, error: 'adminId is required' },
        { status: 400 }
      );
    }

    const supabaseAdmin = getAdminClient();

    // 1. Fetch the prospective student + their inquiry form
    const { data: prospect, error: prospectError } = await supabaseAdmin
      .from(SUPABASE_TABLES.PROSPECTIVE_STUDENTS)
      .select(`
        *,
        inquiry_forms (
          id,
          form_data
        )
      `)
      .eq('id', id)
      .single();

    if (prospectError || !prospect) {
      return NextResponse.json(
        { success: false, error: 'Prospect not found' },
        { status: 404 }
      );
    }

    // Extract inquiry responses from the most recent form submission
    const inquiryForms = prospect.inquiry_forms as Array<{ form_data: any[] }>;
    const latestForm = inquiryForms?.[0];
    const inquiryResponses = Array.isArray(latestForm?.form_data)
      ? latestForm.form_data
      : [];

    // 2. Generate personalized email via Modal → Claude Haiku
    const emailDraft = await modal.generateAdmissionsWelcome({
      parentName: prospect.parent_name,
      childName: prospect.child_name,
      gradeInterested: prospect.grade_interested,
      schoolName,
      inquiryResponses,
      suggestedTourTimes,
      apiKey: process.env.CLAUDE_API_KEY,
    });

    // 3. Save draft to parent_notifications (status=draft, HITL approval required)
    const { data: notification, error: notifError } = await supabaseAdmin
      .from(SUPABASE_TABLES.PARENT_NOTIFICATIONS)
      .insert({
        // parent_id is NULL — prospective parents don't have accounts yet
        parent_id: null,
        prospective_student_id: id,
        student_id: null,
        teacher_id: adminId,
        type: 'admissions_welcome',
        subject: emailDraft.subject,
        body: emailDraft.body,
        status: NOTIFICATION_STATUS.DRAFT,
      })
      .select()
      .single();

    if (notifError) throw notifError;

    // 4. Update prospect's last contact timestamp
    await supabaseAdmin
      .from(SUPABASE_TABLES.PROSPECTIVE_STUDENTS)
      .update({ last_contact_at: new Date().toISOString() })
      .eq('id', id);

    return NextResponse.json({
      success: true,
      notification,
      message: 'Welcome email draft generated. Review and approve before sending.',
    });
  } catch (error: any) {
    console.error('Welcome email generation failed:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
