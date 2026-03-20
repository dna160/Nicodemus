/**
 * PATCH /api/homework/[id]
 * Update homework questions and optionally regenerate rubric
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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body = await req.json();
    const { questions, regenerateRubric, subject, gradeLevel } = body;
    const { id: assignmentId } = await params;

    if (!assignmentId || !questions) {
      return NextResponse.json(
        { success: false, error: 'assignmentId and questions are required' },
        { status: 400 }
      );
    }

    const supabase = getAdminClient();

    // Get current assignment to preserve other fields
    const { data: current, error: fetchError } = await supabase
      .from('assignments')
      .select('*')
      .eq('id', assignmentId)
      .eq('status', 'draft')
      .single();

    if (fetchError || !current) {
      return NextResponse.json(
        { success: false, error: 'Assignment not found or is not a draft' },
        { status: 404 }
      );
    }

    let updates: Record<string, any> = {
      content: {
        ...current.content,
        questions,
      },
    };

    // Regenerate rubric if requested
    if (regenerateRubric && subject && gradeLevel) {
      try {
        // Create a prompt about the edited questions for the Modal to generate appropriate rubric
        const questionsText = questions
          .map((q: any, i: number) => `Q${i + 1}: ${q.prompt} (${q.points} pts)`)
          .join('\n');

        // Call Modal to generate a new rubric based on the edited questions
        const rubricResult = await modal.generateHomework({
          curriculumContent: `Updated questions for homework:\n${questionsText}`,
          subject,
          gradeLevel,
          gradingSystem: current.grading_system || 'local_alphabetical',
          numAssignments: 1,
          apiKey: process.env.CLAUDE_API_KEY,
        });

        if (rubricResult.assignments && rubricResult.assignments[0]) {
          // Extract rubric from generated assignment
          const newRubric = rubricResult.assignments[0].rubric;
          if (newRubric) {
            updates.content.rubric = newRubric;
            updates.rubric = newRubric;
          }
        }
      } catch (error) {
        console.warn('Failed to regenerate rubric, keeping existing:', error);
        // Don't fail the whole operation if rubric regeneration fails
      }
    }

    // Update the assignment
    const { data: updated, error: updateError } = await supabase
      .from('assignments')
      .update(updates)
      .eq('id', assignmentId)
      .select('id, title, description, due_at, content, rubric, status')
      .single();

    if (updateError) {
      throw updateError;
    }

    console.log(`[homework/${assignmentId}] Updated questions`);

    return NextResponse.json({
      success: true,
      assignment: updated,
    });
  } catch (error: any) {
    console.error('[homework/PATCH] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update homework' },
      { status: 500 }
    );
  }
}
