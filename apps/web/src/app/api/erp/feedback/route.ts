import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_TABLES } from 'shared';

export const dynamic = 'force-dynamic';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// ============================================================
// POST /api/erp/feedback
// Submit teacher feedback on substitute performance
// Body: { teacherId, substituteAssignmentId, rating, followUpNotes, studentsCompletedWork, classroomBehaviorNotes }
// ============================================================

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      teacherId,
      substituteAssignmentId,
      rating,
      followUpNotes = '',
      studentsCompletedWork = true,
      classroomBehaviorNotes = '',
    } = body;

    if (!teacherId || !substituteAssignmentId || rating === undefined) {
      return NextResponse.json(
        { success: false, error: 'teacherId, substituteAssignmentId, rating are required' },
        { status: 400 }
      );
    }

    if (rating < 1 || rating > 5) {
      return NextResponse.json(
        { success: false, error: 'rating must be between 1 and 5' },
        { status: 400 }
      );
    }

    const supabaseAdmin = getAdminClient();

    // 1. Verify assignment exists and belongs to this teacher
    const { data: assignment, error: fetchError } = await supabaseAdmin
      .from(SUPABASE_TABLES.SUBSTITUTE_ASSIGNMENTS)
      .select(`
        id,
        absence_id,
        substitutes(id),
        absences!inner(teacher_id)
      `)
      .eq('id', substituteAssignmentId)
      .single();

    if (fetchError || !assignment) {
      return NextResponse.json(
        { success: false, error: 'Assignment not found' },
        { status: 404 }
      );
    }

    const absence = (assignment as any).absences;
    if (absence.teacher_id !== teacherId) {
      return NextResponse.json(
        { success: false, error: 'Not authorized to submit feedback for this assignment' },
        { status: 403 }
      );
    }

    // 2. Insert feedback record
    const { data: feedback, error: feedbackError } = await supabaseAdmin
      .from(SUPABASE_TABLES.SUBSTITUTE_FEEDBACK)
      .insert({
        substitute_assignment_id: substituteAssignmentId,
        teacher_id: teacherId,
        rating,
        follow_up_notes: followUpNotes,
        students_completed_work: studentsCompletedWork,
        classroom_behavior_notes: classroomBehaviorNotes,
      })
      .select()
      .single();

    if (feedbackError) throw feedbackError;

    return NextResponse.json({
      success: true,
      feedback,
    });
  } catch (error: any) {
    console.error('Feedback submission failed:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
