/**
 * POST /api/erp/review-tasks/[id]/complete-review
 * Teacher finalises their review of a student homework submission.
 *
 * Steps:
 *  1. Receive teacherGrade (optional override), perAnswerFeedback, overallNotes
 *  2. Build annotated submission text (student answers + teacher notes per question)
 *  3. Call Modal/Claude to synthesize overall feedback incorporating teacher context
 *  4. Persist: final_grade, per_answer_feedback, overall_feedback → submission
 *  5. Mark submission status = 'graded' (now visible to student)
 *  6. Mark teacher_review_task status = 'approved'
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

type PerAnswerInput = {
  questionId: string;
  questionPrompt: string;
  answer: string;
  feedback: string;
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: taskId } = await params;
  const body = await req.json();
  const teacherId: string = body.teacherId;
  const teacherGrade: number | null = body.teacherGrade ?? null;
  const perAnswerFeedback: PerAnswerInput[] = Array.isArray(body.perAnswerFeedback) ? body.perAnswerFeedback : [];
  const overallNotes: string = body.overallNotes ?? '';

  if (!teacherId) {
    return NextResponse.json({ success: false, error: 'teacherId required' }, { status: 400 });
  }

  const supabase = getAdminClient();

  // 1. Fetch the review task with submission + assignment details
  const { data: task, error: taskError } = await supabase
    .from('teacher_review_tasks')
    .select(`
      *,
      submissions (
        id,
        content,
        ai_grade,
        ai_feedback,
        ai_next_steps,
        assignments (
          id,
          title,
          subject,
          points_possible,
          content,
          rubric,
          lesson_id
        )
      )
    `)
    .eq('id', taskId)
    .single();

  if (taskError || !task) {
    return NextResponse.json({ success: false, error: 'Task not found' }, { status: 404 });
  }

  const sub = task.submissions as any;
  const assignment = sub?.assignments;

  if (!sub || !assignment) {
    return NextResponse.json({ success: false, error: 'Submission or assignment data missing' }, { status: 422 });
  }

  const submissionId: string = sub.id;
  const aiGrade: number | null = sub.ai_grade ?? null;
  const aiFeedback: string = sub.ai_feedback ?? '';
  const aiNextSteps: string = sub.ai_next_steps ?? '';
  const pointsPossible: number = assignment.points_possible ?? 100;

  // Fetch lesson info to get grade level
  let gradeLevel: string = 'K';
  if (assignment.lesson_id) {
    const { data: lesson } = await supabase
      .from('lessons')
      .select('grade_level')
      .eq('id', assignment.lesson_id)
      .single();
    if (lesson?.grade_level) {
      gradeLevel = lesson.grade_level;
    }
  }

  // 2. Build annotated submission text for AI synthesis
  //    Weave teacher per-answer notes into the text so the AI produces
  //    a synthesized overall feedback that reflects the teacher's observations.
  const answerMap: Record<string, string> = (sub.content as Record<string, string>) ?? {};
  const questions: Array<{ id: string; prompt: string }> =
    assignment.content?.questions ?? [];

  const annotatedLines: string[] = [];
  for (const q of questions) {
    const answer = answerMap[q.id] ?? '(no answer)';
    const teacherNote = perAnswerFeedback.find((p) => p.questionId === q.id)?.feedback ?? '';
    annotatedLines.push(`Q: ${q.prompt}\nA: ${answer}${teacherNote ? `\n[Teacher observation: ${teacherNote}]` : ''}`);
  }

  // If perAnswerFeedback contains entries for questions not in content, append them too
  for (const p of perAnswerFeedback) {
    if (!questions.find((q) => q.id === p.questionId)) {
      annotatedLines.push(`Q: ${p.questionPrompt}\nA: ${p.answer}${p.feedback ? `\n[Teacher observation: ${p.feedback}]` : ''}`);
    }
  }

  const annotatedSubmission = annotatedLines.join('\n\n');
  const synthesisContext = overallNotes
    ? `${annotatedSubmission}\n\n[Teacher's overall note: ${overallNotes}]`
    : annotatedSubmission;

  // 3. Call AI to produce synthesized overall feedback
  let aiSynthesis = aiFeedback; // fallback: original AI feedback
  let suggestedGrade = aiGrade;

  try {
    const synthesisResult = await modal.gradeHomework({
      submissionContent: synthesisContext,
      rubric: (assignment.rubric as Record<string, unknown>) ?? { criteria: [], total_points: pointsPossible },
      subject: assignment.subject ?? 'General',
      gradeLevel, // Pass grade level for context-aware grading
      apiKey: process.env.CLAUDE_API_KEY,
    });

    aiSynthesis = synthesisResult.feedback ?? aiFeedback;
    suggestedGrade = synthesisResult.score ?? aiGrade;
  } catch (err: any) {
    console.warn('[complete-review] AI synthesis failed, using original feedback:', err.message);
    aiSynthesis = aiFeedback;
  }

  // 3b. Generate per-answer AI insights (for answers that have teacher feedback)
  const perAnswerInsights: Record<string, string> = {};
  for (const p of perAnswerFeedback) {
    if (p.feedback) {
      try {
        // Create a focused context for this specific answer
        const answerContext = `Question: ${p.questionPrompt}\n\nStudent's Answer: ${p.answer}\n\nTeacher's Feedback: ${p.feedback}`;
        const insightResult = await modal.gradeHomework({
          submissionContent: answerContext,
          rubric: (assignment.rubric as Record<string, unknown>) ?? { criteria: [], total_points: pointsPossible },
          subject: assignment.subject ?? 'General',
          gradeLevel, // Pass grade level for context-aware feedback
          apiKey: process.env.CLAUDE_API_KEY,
        });
        // Extract a brief insight from the feedback
        const insight = insightResult.feedback ?? '';
        if (insight) {
          perAnswerInsights[p.questionId] = insight;
        }
      } catch (err: any) {
        console.warn(`[complete-review] Failed to generate insight for answer ${p.questionId}:`, err.message);
        // Continue without insight for this answer
      }
    }
  }

  // 4. Determine final grade
  //    Teacher override takes precedence; fall back to AI suggestion
  const finalGrade =
    teacherGrade != null && typeof teacherGrade === 'number'
      ? teacherGrade
      : (suggestedGrade ?? aiGrade);

  // 5. Build per_answer_feedback JSONB (store teacher notes alongside question context)
  const perAnswerFeedbackRecord = perAnswerFeedback.map((p) => ({
    questionId: p.questionId,
    questionPrompt: p.questionPrompt,
    answer: p.answer,
    teacher_feedback: p.feedback,
    ai_feedback: perAnswerInsights[p.questionId] ?? null, // AI synthesis of teacher feedback for this answer
  }));

  // 6. Update submission — mark graded so student can now see results
  // Store overall feedback as JSON with separated teacher notes and AI synthesis
  const overallFeedbackJson = {
    teacher_notes: overallNotes || null,
    ai_synthesis: aiSynthesis,
  };

  const { error: submissionUpdateError } = await supabase
    .from('submissions')
    .update({
      teacher_grade: teacherGrade ?? null,
      final_grade: finalGrade,
      per_answer_feedback: perAnswerFeedbackRecord,
      overall_feedback: JSON.stringify(overallFeedbackJson),
      // Keep ai_next_steps; update grade + graded fields for legacy compatibility
      grade: finalGrade,
      feedback: aiSynthesis,
      graded: true,
      graded_at: new Date().toISOString(),
      submission_status: 'graded',
    })
    .eq('id', submissionId);

  if (submissionUpdateError) {
    return NextResponse.json(
      { success: false, error: submissionUpdateError.message },
      { status: 500 }
    );
  }

  // 7. Mark review task as approved
  const { error: taskUpdateError } = await supabase
    .from('teacher_review_tasks')
    .update({
      status: 'approved',
      teacher_notes: overallNotes || null,
      approved_at: new Date().toISOString(),
    })
    .eq('id', taskId);

  if (taskUpdateError) {
    console.error('[complete-review] Failed to update task status:', taskUpdateError.message);
    // Non-fatal — submission already updated
  }

  return NextResponse.json({
    success: true,
    task_id: taskId,
    submission_id: submissionId,
    final_grade: finalGrade,
    teacher_grade_applied: teacherGrade != null,
    message: 'Review complete. Results are now visible to the student.',
  });
}
