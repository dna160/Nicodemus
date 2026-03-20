/**
 * POST /api/homework/publish
 * Publishes draft homework assignments to students.
 * Changes assignment status from 'draft' to 'active' and sets published_at timestamp.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { lessonId, assignmentIds, teacherId } = body;

    if (!lessonId || !assignmentIds || !Array.isArray(assignmentIds) || assignmentIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'lessonId and assignmentIds array are required' },
        { status: 400 }
      );
    }

    if (!teacherId) {
      return NextResponse.json(
        { success: false, error: 'teacherId is required' },
        { status: 400 }
      );
    }

    const supabase = getAdminClient();
    const now = new Date().toISOString();

    // Verify that all assignments belong to this lesson and teacher
    const { data: assignments, error: fetchError } = await supabase
      .from('assignments')
      .select('id, status')
      .eq('lesson_id', lessonId)
      .in('id', assignmentIds);

    if (fetchError) {
      throw fetchError;
    }

    if (!assignments || assignments.length !== assignmentIds.length) {
      return NextResponse.json(
        { success: false, error: 'One or more assignments not found for this lesson' },
        { status: 404 }
      );
    }

    // Update assignments: set status to 'active' and published_at timestamp
    const { data: updated, error: updateError } = await supabase
      .from('assignments')
      .update({
        status: 'active',
        published_at: now,
      })
      .in('id', assignmentIds)
      .select('id, title, status, published_at');

    if (updateError) {
      throw updateError;
    }

    console.log(`[homework/publish] Published ${updated?.length ?? 0} assignments for lesson ${lessonId}`);

    return NextResponse.json({
      success: true,
      message: `Published ${updated?.length ?? 0} assignments`,
      assignments: updated ?? [],
    });
  } catch (error: any) {
    console.error('[homework/publish] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to publish homework' },
      { status: 500 }
    );
  }
}
