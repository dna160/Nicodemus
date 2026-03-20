import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { inngest } from '@/lib/inngest';
import { SUPABASE_TABLES, INNGEST_EVENTS, DOCUMENT_TYPES } from 'shared';

export const dynamic = 'force-dynamic';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const STORAGE_BUCKET = 'student-onboarding-documents';
const VALID_DOC_TYPES = Object.values(DOCUMENT_TYPES);

// ============================================================
// POST /api/onboarding/upload-document
// Accepts a parent's document upload for their child's
// onboarding checklist. Stores in Supabase Storage and
// updates the onboarding_checklist record.
// Body: multipart/form-data with file, document_type, studentId
// ============================================================

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const documentType = formData.get('document_type') as string | null;
    const studentId = formData.get('student_id') as string | null;
    const parentId = formData.get('parent_id') as string | null;

    // Validate required fields
    if (!file || !documentType || !studentId) {
      return NextResponse.json(
        { success: false, error: 'file, document_type, and student_id are required' },
        { status: 400 }
      );
    }

    // Validate document type
    if (!VALID_DOC_TYPES.includes(documentType as any)) {
      return NextResponse.json(
        { success: false, error: `Invalid document_type. Must be one of: ${VALID_DOC_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { success: false, error: 'File size exceeds 10MB limit' },
        { status: 413 }
      );
    }

    // Validate file type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid file type. Allowed: PDF, JPG, PNG, DOC, DOCX',
        },
        { status: 400 }
      );
    }

    const supabaseAdmin = getAdminClient();

    // Verify checklist item exists and is pending/rejected
    const { data: checklistItem, error: checklistError } = await supabaseAdmin
      .from(SUPABASE_TABLES.ONBOARDING_CHECKLIST)
      .select('id, status')
      .eq('student_id', studentId)
      .eq('document_type', documentType)
      .single();

    if (checklistError || !checklistItem) {
      return NextResponse.json(
        { success: false, error: 'Checklist item not found for this student and document type' },
        { status: 404 }
      );
    }

    if (checklistItem.status === 'verified') {
      return NextResponse.json(
        { success: false, error: 'This document has already been verified. No re-upload needed.' },
        { status: 409 }
      );
    }

    // Build storage path
    const timestamp = Date.now();
    const fileExtension = file.name.split('.').pop() ?? 'pdf';
    const storagePath = `${studentId}/${documentType}/${timestamp}.${fileExtension}`;

    // Upload to Supabase Storage
    const fileBuffer = await file.arrayBuffer();
    const { error: uploadError } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType: file.type,
        upsert: true, // Allow re-uploads (replace existing file)
      });

    if (uploadError) {
      console.error('Storage upload failed:', uploadError);
      return NextResponse.json(
        { success: false, error: 'File upload failed. Please try again.' },
        { status: 500 }
      );
    }

    const submissionDate = new Date().toISOString();

    // Update onboarding checklist record
    const { error: updateError } = await supabaseAdmin
      .from(SUPABASE_TABLES.ONBOARDING_CHECKLIST)
      .update({
        status: 'submitted',
        submission_file_path: storagePath,
        submission_date: submissionDate,
        rejection_reason: null, // Clear any previous rejection reason
        updated_at: submissionDate,
      })
      .eq('student_id', studentId)
      .eq('document_type', documentType);

    if (updateError) {
      // Attempt to clean up orphaned file
      await supabaseAdmin.storage.from(STORAGE_BUCKET).remove([storagePath]);
      throw updateError;
    }

    // Audit log
    try {
      await supabaseAdmin.from(SUPABASE_TABLES.AUDIT_LOG).insert({
        user_id: parentId || null,
        action: 'document_uploaded',
        table_name: 'onboarding_checklist',
        record_id: checklistItem.id,
        changes: { document_type: documentType, storage_path: storagePath, student_id: studentId },
      });
    } catch (auditError) {
      console.warn('Audit log failed (non-fatal):', auditError);
    }

    // Trigger Inngest for admin notification
    try {
      await inngest.send({
        name: INNGEST_EVENTS.DOCUMENT_SUBMITTED,
        data: { studentId, documentType, storagePath, parentId },
      });
    } catch (inngestError: any) {
      console.warn('Inngest document submitted event skipped (non-fatal):', inngestError.message);
    }

    return NextResponse.json({
      success: true,
      message: `${documentType.replace(/_/g, ' ')} uploaded successfully. Awaiting admin verification.`,
      storagePath,
    });
  } catch (error: any) {
    console.error('Document upload failed:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
