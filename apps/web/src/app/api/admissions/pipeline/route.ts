import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_TABLES } from 'shared';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// ============================================================
// GET /api/admissions/pipeline
// Returns all prospective students for a school, grouped ready
// for the Kanban board. Supports filtering + pagination.
// Query params: schoolId (required), stage, search, limit, offset
// ============================================================

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const schoolId = searchParams.get('schoolId');
  const stage = searchParams.get('stage'); // Optional filter by stage
  const search = searchParams.get('search');
  const limit = parseInt(searchParams.get('limit') || '100');
  const offset = parseInt(searchParams.get('offset') || '0');

  if (!schoolId) {
    return NextResponse.json(
      { success: false, error: 'schoolId is required' },
      { status: 400 }
    );
  }

  const supabaseAdmin = getAdminClient();

  let query = supabaseAdmin
    .from(SUPABASE_TABLES.PROSPECTIVE_STUDENTS)
    .select(`
      *,
      inquiry_forms (
        id,
        form_data,
        submitted_at
      )
    `)
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (stage) {
    query = query.eq('current_stage', stage);
  }

  if (search) {
    query = query.or(
      `child_name.ilike.%${search}%,parent_name.ilike.%${search}%,email.ilike.%${search}%`
    );
  }

  const { data: prospects, error } = await query;

  if (error) {
    console.error('Pipeline fetch error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  // Group by stage for Kanban view
  const grouped = {
    inquiry_received: [] as any[],
    tour_scheduled: [] as any[],
    waitlisted: [] as any[],
    enrolled: [] as any[],
    churned: [] as any[],
  };

  for (const prospect of prospects ?? []) {
    const s = prospect.current_stage as keyof typeof grouped;
    if (grouped[s]) {
      grouped[s].push(prospect);
    }
  }

  return NextResponse.json({
    success: true,
    prospects: prospects ?? [],
    grouped,
    total: prospects?.length ?? 0,
  });
}
