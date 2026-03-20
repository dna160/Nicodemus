import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { modal } from '@/lib/modal';
import { inngest } from '@/lib/inngest';
import { SUPABASE_TABLES, INNGEST_EVENTS } from 'shared';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, gradeLevel, subject, gradingSystem, durationWeeks, teacherId, classId } = body;
    console.log('DEBUG: MODAL_API_URL is', process.env.MODAL_API_URL);

    if (!teacherId) {
      return NextResponse.json(
        { success: false, error: 'teacherId is required' },
        { status: 400 }
      );
    }

    // 1. Call Modal function to generate curriculum
    const curriculum = await modal.generateCurriculum({
      title,
      gradeLevel,
      subject,
      gradingSystem,
      durationWeeks,
      apiKey: process.env.CLAUDE_API_KEY,  // Pass API key from server to Modal
    });

    // 2. Save to Supabase (using admin client to bypass RLS)
    // Create admin client with service role key (server-only, never expose to client)
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: lesson, error } = await supabaseAdmin
      .from(SUPABASE_TABLES.LESSONS)
      .insert({
        teacher_id: teacherId,
        class_id: classId || null,
        title,
        grade_level: gradeLevel,
        subject,
        grading_system: gradingSystem,
        content: JSON.stringify(curriculum),
      })
      .select()
      .single();

    if (error) throw error;

    // 3. Trigger Inngest workflow (non-blocking - for homework generation)
    if (process.env.INNGEST_EVENT_KEY) {
      try {
        await inngest.send({
          name: INNGEST_EVENTS.CURRICULUM_PUBLISHED,
          data: {
            teacherId: lesson.teacher_id, // Ensure this falls back if null
            lessonId: lesson.id,
            classId: body.classId || 'default-class',
            requiredResources: curriculum.resources || [],
          }
        });
      } catch (inngestError: any) {
        // Log but don't fail - curriculum is already saved
        console.warn('Inngest trigger failed (non-blocking):', inngestError.message);
      }
    } else {
      console.warn('INNGEST_EVENT_KEY not configured - skipping homework generation trigger');
    }

    return NextResponse.json({ success: true, lesson });
  } catch (error: any) {
    console.error('Curriculum generation failed:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
