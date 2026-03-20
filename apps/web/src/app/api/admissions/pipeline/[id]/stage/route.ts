import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { inngest } from '@/lib/inngest';
import { SUPABASE_TABLES, INNGEST_EVENTS, PROSPECT_STAGES } from 'shared';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const VALID_STAGES = Object.values(PROSPECT_STAGES);

// ============================================================
// PATCH /api/admissions/pipeline/[id]/stage
// Move a prospect to a new pipeline stage (Kanban drag-to-move).
// Body: { stage, adminId, notes? }
// ============================================================

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { stage, adminId, tourScheduledAt, notes } = body;

    if (!stage || !adminId) {
      return NextResponse.json(
        { success: false, error: 'stage and adminId are required' },
        { status: 400 }
      );
    }

    if (!VALID_STAGES.includes(stage)) {
      return NextResponse.json(
        { success: false, error: `Invalid stage. Must be one of: ${VALID_STAGES.join(', ')}` },
        { status: 400 }
      );
    }

    const supabaseAdmin = getAdminClient();

    // Build update payload
    const updatePayload: Record<string, any> = {
      current_stage: stage,
      last_contact_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (stage === 'tour_scheduled' && tourScheduledAt) {
      updatePayload.tour_scheduled_at = tourScheduledAt;
    }

    if (notes !== undefined) {
      updatePayload.notes = notes;
    }

    const { data: prospect, error } = await supabaseAdmin
      .from(SUPABASE_TABLES.PROSPECTIVE_STUDENTS)
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: 'Prospect not found' },
          { status: 404 }
        );
      }
      throw error;
    }

    // Audit log
    try {
      await supabaseAdmin.from(SUPABASE_TABLES.AUDIT_LOG).insert({
        user_id: adminId,
        action: 'prospect_stage_changed',
        table_name: 'prospective_students',
        record_id: id,
        changes: { stage_changed_to: stage },
      });
    } catch (auditError) {
      console.warn('Audit log failed (non-fatal):', auditError);
    }

    // Inngest event for downstream automation
    try {
      await inngest.send({
        name: INNGEST_EVENTS.PROSPECT_STAGE_CHANGED,
        data: { prospectId: id, newStage: stage, adminId },
      });
    } catch (inngestError: any) {
      console.warn('Inngest stage change event skipped (non-fatal):', inngestError.message);
    }

    return NextResponse.json({ success: true, prospect });
  } catch (error: any) {
    console.error('Stage update failed:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
