import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_TABLES } from 'shared';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const STORAGE_BUCKET = 'student-onboarding-documents';

// ============================================================
// GET /api/onboarding/checklist/[studentId]
// Returns all checklist items for a student with signed URLs
// for any uploaded documents.
// ============================================================

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  const { studentId } = await params;

  const supabaseAdmin = getAdminClient();

  const { data: items, error } = await supabaseAdmin
    .from(SUPABASE_TABLES.ONBOARDING_CHECKLIST)
    .select('*')
    .eq('student_id', studentId)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  // Generate signed URLs for uploaded documents (valid for 1 hour)
  const enriched = await Promise.all(
    (items ?? []).map(async (item) => {
      let signedUrl: string | null = null;
      if (item.submission_file_path) {
        const { data: signed } = await supabaseAdmin.storage
          .from(STORAGE_BUCKET)
          .createSignedUrl(item.submission_file_path, 3600);
        signedUrl = signed?.signedUrl ?? null;
      }
      return { ...item, signed_url: signedUrl };
    })
  );

  const total = enriched.length;
  const completed = enriched.filter((i) => i.status === 'verified').length;
  const pending = enriched.filter((i) => i.status === 'pending').length;
  const submitted = enriched.filter((i) => i.status === 'submitted').length;

  return NextResponse.json({
    success: true,
    items: enriched,
    summary: { total, completed, pending, submitted },
    isComplete: total > 0 && completed === total,
  });
}

// ============================================================
// PATCH /api/onboarding/checklist/[studentId]
// Admin verifies or rejects a document.
// Body: { documentType, action: 'verify' | 'reject', adminId, rejectionReason? }
// ============================================================

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  try {
    const { studentId } = await params;
    const body = await req.json();
    const { documentType, action, adminId, rejectionReason } = body;

    if (!documentType || !action || !adminId) {
      return NextResponse.json(
        { success: false, error: 'documentType, action, and adminId are required' },
        { status: 400 }
      );
    }

    if (!['verify', 'reject'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'action must be verify or reject' },
        { status: 400 }
      );
    }

    const supabaseAdmin = getAdminClient();
    const now = new Date().toISOString();

    const updatePayload: Record<string, any> = {
      updated_at: now,
    };

    if (action === 'verify') {
      updatePayload.status = 'verified';
      updatePayload.admin_verification_date = now;
      updatePayload.verified_by = adminId;
      updatePayload.rejection_reason = null;
    } else {
      updatePayload.status = 'rejected';
      updatePayload.rejection_reason = rejectionReason ?? 'Document could not be verified. Please resubmit.';
      updatePayload.submission_file_path = null; // Clear old file on rejection
    }

    const { data: item, error } = await supabaseAdmin
      .from(SUPABASE_TABLES.ONBOARDING_CHECKLIST)
      .update(updatePayload)
      .eq('student_id', studentId)
      .eq('document_type', documentType)
      .select()
      .single();

    if (error) throw error;

    // Audit log
    try {
      await supabaseAdmin.from(SUPABASE_TABLES.AUDIT_LOG).insert({
        user_id: adminId,
        action: `document_${action}ed`,
        table_name: 'onboarding_checklist',
        record_id: item.id,
        changes: { document_type: documentType, student_id: studentId },
      });
    } catch (auditError) {
      console.warn('Audit log failed (non-fatal):', auditError);
    }

    return NextResponse.json({ success: true, item });
  } catch (error: any) {
    console.error('Checklist update failed:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
