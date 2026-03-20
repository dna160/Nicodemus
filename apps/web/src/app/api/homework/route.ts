/**
 * GET /api/homework?lessonId=[id]
 * Fetch homework assignments for a given lesson
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

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const lessonId = searchParams.get('lessonId');

    if (!lessonId) {
      return NextResponse.json(
        { success: false, error: 'lessonId query parameter is required' },
        { status: 400 }
      );
    }

    const supabase = getAdminClient();

    const { data: assignments, error } = await supabase
      .from('assignments')
      .select('id, title, description, status, due_at, points_possible, published_at, content, rubric')
      .eq('lesson_id', lessonId)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      assignments: assignments || [],
    });
  } catch (error: any) {
    console.error('[homework] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch homework' },
      { status: 500 }
    );
  }
}
