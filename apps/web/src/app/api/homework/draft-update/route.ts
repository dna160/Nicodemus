/**
 * PATCH /api/homework/draft-update
 * Update draft homework (due date, title, description)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { assignmentId, dueAt, title, description } = body;

    if (!assignmentId) {
      return NextResponse.json(
        { success: false, error: 'assignmentId is required' },
        { status: 400 }
      );
    }

    const supabase = getAdminClient();
    const updates: Record<string, any> = {};

    if (dueAt) updates.due_at = dueAt;
    if (title) updates.title = title;
    if (description) updates.description = description;

    const { data: assignment, error } = await supabase
      .from('assignments')
      .update(updates)
      .eq('id', assignmentId)
      .eq('status', 'draft') // Only allow updating drafts
      .select('id, title, description, due_at, content, rubric')
      .single();

    if (error) throw error;

    console.log(`[homework/draft-update] Updated draft assignment ${assignmentId}`);

    return NextResponse.json({ success: true, assignment });
  } catch (error: any) {
    console.error('[homework/draft-update] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update draft homework' },
      { status: 500 }
    );
  }
}
