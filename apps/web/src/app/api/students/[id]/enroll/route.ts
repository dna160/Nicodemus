import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  SUPABASE_TABLES,
  INNGEST_EVENTS,
  DOCUMENT_TYPES,
} from 'shared';

export const dynamic = 'force-dynamic';
// NOTE: Payment gateway integration is pending.
// The invoice record is created with status='draft' and no gateway IDs.
// Wire up a payment provider and uncomment the relevant steps below.

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// ============================================================
// POST /api/students/[id]/enroll
// Converts a prospective student to an enrolled student.
// [id] = prospective_student_id
// 1. Creates user + student records
// 2. Saves fee breakdown as a draft invoice (no payment gateway yet)
// 3. Creates onboarding checklist items
// 4. Triggers enrollment Inngest workflow
// Body: { adminId, gradeLevel, feeChoices: { registration_fee_cents, monthly_tuition_cents, activity_fees_cents } }
// ============================================================

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: prospectId } = await params;
    const body = await req.json();
    const { adminId, gradeLevel, feeChoices } = body;

    if (!adminId || !gradeLevel || !feeChoices) {
      return NextResponse.json(
        { success: false, error: 'adminId, gradeLevel, and feeChoices are required' },
        { status: 400 }
      );
    }

    const {
      registration_fee_cents = 0,
      monthly_tuition_cents = 0,
      activity_fees_cents = 0,
    } = feeChoices;

    const totalAmountCents =
      registration_fee_cents + monthly_tuition_cents + activity_fees_cents;

    if (totalAmountCents < 0) {
      return NextResponse.json(
        { success: false, error: 'Fee amounts cannot be negative' },
        { status: 400 }
      );
    }

    const supabaseAdmin = getAdminClient();

    // 1. Fetch the prospective student
    const { data: prospect, error: prospectError } = await supabaseAdmin
      .from(SUPABASE_TABLES.PROSPECTIVE_STUDENTS)
      .select('*')
      .eq('id', prospectId)
      .single();

    if (prospectError || !prospect) {
      return NextResponse.json(
        { success: false, error: 'Prospective student not found' },
        { status: 404 }
      );
    }

    if (prospect.current_stage === 'enrolled') {
      return NextResponse.json(
        { success: false, error: 'Student is already enrolled' },
        { status: 409 }
      );
    }

    // 2. Create user account for the student (no auth — parent logs in separately)
    const { data: newUser, error: userError } = await supabaseAdmin
      .from(SUPABASE_TABLES.USERS)
      .insert({
        school_id: prospect.school_id,
        email: prospect.email,
        name: prospect.child_name,
        role: 'student',
      })
      .select()
      .single();

    if (userError) {
      // Handle duplicate email
      if (userError.code === '23505') {
        return NextResponse.json(
          { success: false, error: 'A student with this email already exists.' },
          { status: 409 }
        );
      }
      throw userError;
    }

    // 3. Create student record
    const { data: newStudent, error: studentError } = await supabaseAdmin
      .from(SUPABASE_TABLES.STUDENTS)
      .insert({
        id: newUser.id,
        grade_level: gradeLevel,
      })
      .select()
      .single();

    if (studentError) throw studentError;

    // 4. Create parent user + parent record + link to student
    try {
      // Parent email: use a unique parent-scoped email to avoid conflict with student record
      const parentEmail = prospect.email.includes('+parent')
        ? prospect.email
        : prospect.email.replace('@', '+parent@');

      // Upsert parent user (idempotent if already exists)
      let parentUserId: string | null = null;
      const { data: existingParentUser } = await supabaseAdmin
        .from(SUPABASE_TABLES.USERS)
        .select('id')
        .eq('email', parentEmail)
        .eq('school_id', prospect.school_id)
        .single();

      if (existingParentUser) {
        parentUserId = existingParentUser.id;
      } else {
        const { data: newParentUser, error: parentUserError } = await supabaseAdmin
          .from(SUPABASE_TABLES.USERS)
          .insert({
            school_id: prospect.school_id,
            email: parentEmail,
            name: prospect.parent_name,
            role: 'parent',
          })
          .select()
          .single();
        if (!parentUserError && newParentUser) parentUserId = newParentUser.id;
      }

      if (parentUserId) {
        // Upsert parents record
        await supabaseAdmin
          .from(SUPABASE_TABLES.PARENTS)
          .upsert({ id: parentUserId, phone: prospect.phone }, { onConflict: 'id' });

        // Link student ↔ parent
        await supabaseAdmin
          .from(SUPABASE_TABLES.STUDENT_PARENTS)
          .upsert(
            { student_id: newStudent.id, parent_id: parentUserId, relationship: 'parent', primary_contact: true },
            { onConflict: 'student_id,parent_id' }
          );
      }
    } catch (parentError: any) {
      console.warn('Parent record creation failed (non-fatal):', parentError.message);
    }

    // 5. Update prospect stage to 'enrolled' + link to new student
    await supabaseAdmin
      .from(SUPABASE_TABLES.PROSPECTIVE_STUDENTS)
      .update({
        current_stage: 'enrolled',
        enrolled_student_id: newUser.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', prospectId);

    // 5. Save fee breakdown as a draft invoice (no payment gateway yet)
    // TODO: When a payment gateway is chosen, create the external invoice here
    // and populate gateway_invoice_id / gateway_customer_id before inserting.
    const { data: invoice } = await supabaseAdmin
      .from(SUPABASE_TABLES.INVOICES)
      .insert({
        student_id: newStudent.id,
        prospective_student_id: prospectId,
        fee_breakdown: { registration_fee_cents, monthly_tuition_cents, activity_fees_cents },
        total_amount_cents: totalAmountCents,
        status: 'draft',
        due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
      })
      .select()
      .single();

    // 8. Create onboarding checklist items for all required documents
    const checklistItems = Object.values(DOCUMENT_TYPES).map((docType) => ({
      student_id: newStudent.id,
      document_type: docType,
      status: 'pending',
      reminder_count: 0,
    }));

    await supabaseAdmin.from(SUPABASE_TABLES.ONBOARDING_CHECKLIST).insert(checklistItems);

    // 9. Audit log
    try {
      await supabaseAdmin.from(SUPABASE_TABLES.AUDIT_LOG).insert({
        user_id: adminId,
        action: 'student_enrolled',
        table_name: 'students',
        record_id: newStudent.id,
        changes: {
          prospect_id: prospectId,
          grade_level: gradeLevel,
          total_fee_cents: totalAmountCents,
        },
      });
    } catch (auditError) {
      console.warn('Audit log failed (non-fatal):', auditError);
    }

    // 10. Trigger Inngest enrollment workflow
    try {
      const { inngest } = await import('@/lib/inngest');
      await inngest.send({
        name: INNGEST_EVENTS.ENROLLMENT_TRIGGERED,
        data: {
          studentId: newStudent.id,
          prospectId,
          invoiceId: invoice?.id,
          parentName: prospect.parent_name,
          childName: prospect.child_name,
          email: prospect.email,
          gradeLevel,
          schoolId: prospect.school_id,
          feeBreakdown: { registration_fee_cents, monthly_tuition_cents, activity_fees_cents },
          totalAmountCents,
        },
      });
    } catch (inngestError: any) {
      console.warn('Inngest enrollment event skipped (non-fatal):', inngestError.message);
    }

    return NextResponse.json({
      success: true,
      student: newStudent,
      invoice,
      message: `${prospect.child_name} has been enrolled. Invoice of $${(totalAmountCents / 100).toFixed(2)} recorded — payment collection pending gateway setup.`,
    });
  } catch (error: any) {
    console.error('Enrollment failed:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
