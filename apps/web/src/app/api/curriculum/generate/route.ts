import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { modal } from '@/lib/modal';
import { inngest } from '@/lib/inngest';
import { SUPABASE_TABLES, INNGEST_EVENTS } from 'shared';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, gradeLevel, subject, gradingSystem, durationWeeks } = body;

    // 1. Call Modal function to generate curriculum
    const curriculum = await modal.generateCurriculum({
      title,
      gradeLevel,
      subject,
      gradingSystem,
      durationWeeks,
    });

    // 2. Save to Supabase
    const { data: lesson, error } = await supabase
      .from(SUPABASE_TABLES.LESSONS)
      .insert({
        title,
        grade_level: gradeLevel,
        subject,
        grading_system: gradingSystem,
        content: JSON.stringify(curriculum),
      })
      .select()
      .single();

    if (error) throw error;

    // 3. Trigger Inngest workflow
    await inngest.send({
      name: INNGEST_EVENTS.CURRICULUM_PUBLISHED,
      data: {
        teacherId: lesson.teacher_id, // Ensure this falls back if null
        lessonId: lesson.id,
        classId: body.classId || 'default-class',
        requiredResources: curriculum.resources || [],
      }
    });

    return NextResponse.json({ success: true, lesson });
  } catch (error: any) {
    console.error('Curriculum generation failed:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
