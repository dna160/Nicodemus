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
// GET /api/curriculum
// Returns teacher's curriculums (lessons) with pagination
// ============================================================

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const teacherId = searchParams.get('teacherId');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const search = searchParams.get('search') || '';
    const subject = searchParams.get('subject') || '';
    const gradeLevel = searchParams.get('gradeLevel') || '';

    if (!teacherId) {
      return NextResponse.json(
        { success: false, error: 'teacherId is required' },
        { status: 400 }
      );
    }

    const supabaseAdmin = getAdminClient();

    // Build base query without count to avoid potential issues
    let query = supabaseAdmin
      .from(SUPABASE_TABLES.LESSONS)
      .select('id, title, subject, grade_level, grading_system, created_at, updated_at')
      .eq('teacher_id', teacherId)
      .order('created_at', { ascending: false });

    // Apply filters (empty string means no filter)
    if (subject) {
      query = query.eq('subject', subject);
    }

    if (gradeLevel) {
      query = query.eq('grade_level', gradeLevel);
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: curriculums, error } = await query;

    if (error) {
      console.error('Supabase query error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // Apply search filter on client side if search term provided
    let filtered = curriculums || [];
    if (search && search.trim()) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.title.toLowerCase().includes(searchLower) ||
          c.subject.toLowerCase().includes(searchLower)
      );
    }

    return NextResponse.json({
      success: true,
      curriculums: filtered,
      total: filtered.length,
      limit,
      offset,
    });
  } catch (error: any) {
    console.error('Curriculum list GET failed:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}
