/**
 * POST /api/homework/generate
 * Generate homework assignments from a curriculum lesson via Modal/Claude.
 * Called automatically after curriculum creation (non-fatal).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { modal } from '@/lib/modal';

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
    const { lessonId, classId, teacherId, curriculumContent, subject, gradeLevel, gradingSystem } =
      body;

    if (!teacherId || !curriculumContent) {
      return NextResponse.json(
        { success: false, error: 'teacherId and curriculumContent are required' },
        { status: 400 }
      );
    }

    // Parse raw_response from curriculum if needed
    const rawContent = typeof curriculumContent === 'object'
      ? (curriculumContent.raw_response ?? JSON.stringify(curriculumContent))
      : String(curriculumContent);

    // Call Modal to generate homework questions
    const result = await modal.generateHomework({
      curriculumContent: rawContent,
      subject: subject ?? 'General',
      gradeLevel: gradeLevel ?? 'K',
      gradingSystem: gradingSystem ?? 'local_alphabetical',
      numAssignments: 3,
      apiKey: process.env.CLAUDE_API_KEY,
    });

    if (!result.assignments || result.assignments.length === 0) {
      return NextResponse.json({ success: false, error: 'No assignments generated' }, { status: 500 });
    }

    const supabase = getAdminClient();
    const now = new Date();

    // Insert each assignment in 'draft' status (teacher will publish when ready)
    const rows = result.assignments.map((a) => ({
      lesson_id: lessonId ?? null,
      class_id: classId ?? null,
      teacher_id: teacherId,
      subject: subject ?? null,
      title: a.title,
      description: a.description,
      content: a.content,
      rubric: a.rubric,
      due_at: new Date(now.getTime() + a.due_offset_days * 24 * 60 * 60 * 1000).toISOString(),
      points_possible: a.points_possible ?? 100,
      assignment_type: 'homework',
      status: 'draft',
    }));

    const { data: assignments, error } = await supabase
      .from('assignments')
      .insert(rows)
      .select('id, title, due_at');

    if (error) throw error;

    console.log(`[homework/generate] Created ${assignments?.length ?? 0} assignments for lesson ${lessonId}`);

    return NextResponse.json({ success: true, assignments: assignments ?? [] });
  } catch (error: any) {
    console.error('[homework/generate] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
