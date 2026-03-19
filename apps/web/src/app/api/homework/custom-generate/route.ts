/**
 * POST /api/homework/custom-generate
 * Generate custom homework based on teacher's prompt/topic
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { modal } from '@/lib/modal';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      lessonId,
      teacherId,
      subject,
      gradeLevel,
      gradingSystem,
      topic,
      curriculumContent,
    } = body;

    if (!lessonId || !teacherId || !topic || !subject) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: lessonId, teacherId, topic, subject' },
        { status: 400 }
      );
    }

    // Call Modal to generate custom homework based on topic
    // Use generateHomework endpoint with topic-focused curriculum context
    const topicContext = `Topic: ${topic}\nSubject: ${subject}\n${curriculumContent ? 'Related curriculum: ' + JSON.stringify(curriculumContent).slice(0, 1000) : ''}`;

    const result = await modal.generateHomework({
      curriculumContent: topicContext,
      subject,
      gradeLevel: gradeLevel ?? 'K',
      gradingSystem: gradingSystem ?? 'local_alphabetical',
      numAssignments: 1, // Generate single assignment for custom topic
      apiKey: process.env.CLAUDE_API_KEY,
    });

    if (!result.assignments || result.assignments.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Failed to generate homework' },
        { status: 500 }
      );
    }

    const supabase = getAdminClient();
    const now = new Date();
    const assignment = result.assignments[0]; // Get first assignment from array

    // Insert the custom assignment in draft status
    const { data: savedAssignment, error } = await supabase
      .from('assignments')
      .insert({
        lesson_id: lessonId,
        teacher_id: teacherId,
        subject,
        title: assignment.title,
        description: assignment.description,
        content: assignment.content,
        rubric: assignment.rubric,
        due_at: new Date(now.getTime() + (assignment.due_offset_days ?? 3) * 24 * 60 * 60 * 1000).toISOString(),
        points_possible: assignment.points_possible ?? 100,
        assignment_type: 'homework',
        status: 'draft', // Custom homework starts as draft for teacher review
      })
      .select('id, title, due_at')
      .single();

    if (error) throw error;

    console.log(`[homework/custom-generate] Created custom assignment for lesson ${lessonId}`);

    return NextResponse.json({ success: true, assignment: savedAssignment });
  } catch (error: any) {
    console.error('[homework/custom-generate] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to generate custom homework' },
      { status: 500 }
    );
  }
}
