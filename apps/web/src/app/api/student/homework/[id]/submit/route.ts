/**
 * POST /api/student/homework/[id]/submit
 * Submit homework answers → AI pre-grades → held as 'pending_review' for teacher.
 * Student does NOT see grade until teacher completes review.
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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: assignmentId } = await params;
  const body = await req.json();
  const { studentId, answers } = body;

  if (!studentId || !answers) {
    return NextResponse.json(
      { success: false, error: 'studentId and answers are required' },
      { status: 400 }
    );
  }

  const supabase = getAdminClient();

  // Fetch the assignment
  const { data: assignment, error: assignmentError } = await supabase
    .from('assignments')
    .select('*')
    .eq('id', assignmentId)
    .single();

  if (assignmentError || !assignment) {
    return NextResponse.json({ success: false, error: 'Assignment not found' }, { status: 404 });
  }

  // Check for existing submission — block re-submission if already under review or graded
  const { data: existing } = await supabase
    .from('submissions')
    .select('id, submission_status')
    .eq('assignment_id', assignmentId)
    .eq('student_id', studentId)
    .single();

  if (existing && (existing.submission_status === 'pending_review' || existing.submission_status === 'graded')) {
    return NextResponse.json(
      { success: false, error: 'Assignment already submitted' },
      { status: 409 }
    );
  }

  // Format answers as readable text for Claude pre-grading
  const submissionText = Object.entries(answers as Record<string, string>)
    .map(([qId, answer]) => {
      const question = assignment.content?.questions?.find((q: any) => q.id === qId);
      return `Q: ${question?.prompt ?? qId}\nA: ${answer}`;
    })
    .join('\n\n');

  // Upsert submission with status 'grading'
  const submissionData = {
    assignment_id: assignmentId,
    student_id: studentId,
    content: answers,
    submission_status: 'grading',
    submitted_at: new Date().toISOString(),
    graded: false,
  };

  let submissionId: string;
  if (existing) {
    const { data: updated, error } = await supabase
      .from('submissions')
      .update(submissionData)
      .eq('id', existing.id)
      .select('id')
      .single();
    if (error) throw error;
    submissionId = updated.id;
  } else {
    const { data: inserted, error } = await supabase
      .from('submissions')
      .insert(submissionData)
      .select('id')
      .single();
    if (error) throw error;
    submissionId = inserted.id;
  }

  // AI pre-grades so teacher has a reference when reviewing
  let aiGrade: number | null = null;
  let aiFeedback = '';
  let aiNextSteps = '';

  try {
    const gradeResult = await modal.gradeHomework({
      submissionContent: submissionText,
      rubric: (assignment.rubric as Record<string, unknown>) ?? { criteria: [], total_points: 100 },
      subject: assignment.subject ?? 'General',
      apiKey: process.env.CLAUDE_API_KEY,
    });

    aiGrade = gradeResult.score ?? null;
    aiFeedback = gradeResult.feedback ?? '';
    aiNextSteps = gradeResult.next_steps ?? '';

    // Store AI analysis; status = 'pending_review' (not visible to student yet)
    await supabase
      .from('submissions')
      .update({
        ai_grade: aiGrade,
        ai_feedback: aiFeedback,
        ai_next_steps: aiNextSteps,
        submission_status: 'pending_review',
      })
      .eq('id', submissionId);

  } catch (gradingError: any) {
    console.error('[submit] AI pre-grading failed:', gradingError.message);
    // Still move to pending_review — teacher will grade manually
    await supabase
      .from('submissions')
      .update({ submission_status: 'pending_review' })
      .eq('id', submissionId);
  }

  // Create ERP teacher review task
  try {
    await supabase.from('teacher_review_tasks').insert({
      submission_id: submissionId,
      student_id: studentId,
      teacher_id: assignment.teacher_id ?? null,
      review_type: 'homework_grade',
      status: 'pending',
    });
  } catch (taskError: any) {
    console.warn('[submit] Could not create review task:', taskError.message);
  }

  return NextResponse.json({
    success: true,
    submission_id: submissionId,
    status: 'pending_review',
    message: 'Homework submitted! Your teacher will review it and return your grade shortly.',
  });
}
