import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { parseCurriculumContent } from '@/lib/curriculum-parser';
import { SUPABASE_TABLES } from 'shared';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// ============================================================
// GET /api/curriculum/[id]
// Returns full curriculum details with parsed content
// ============================================================

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: curriculumId } = await params;

    if (!curriculumId) {
      return NextResponse.json(
        { success: false, error: 'Curriculum ID is required' },
        { status: 400 }
      );
    }

    const supabaseAdmin = getAdminClient();

    // Fetch the curriculum
    const { data: curriculum, error } = await supabaseAdmin
      .from(SUPABASE_TABLES.LESSONS)
      .select('*')
      .eq('id', curriculumId)
      .single();

    if (error || !curriculum) {
      return NextResponse.json(
        { success: false, error: 'Curriculum not found' },
        { status: 404 }
      );
    }

    // Parse the content
    let parsedContent;
    try {
      const contentObj =
        typeof curriculum.content === 'string'
          ? JSON.parse(curriculum.content)
          : curriculum.content;

      parsedContent = parseCurriculumContent(contentObj, {
        title: curriculum.title,
        subject: curriculum.subject,
        gradeLevel: curriculum.grade_level,
        gradingSystem: curriculum.grading_system,
      });
    } catch (parseError) {
      console.warn('Failed to parse curriculum content:', parseError);
      // Return raw content if parsing fails
      parsedContent = {
        title: curriculum.title,
        subject: curriculum.subject,
        gradeLevel: curriculum.grade_level,
        gradingSystem: curriculum.grading_system,
        learningObjectives: [],
        units: [],
        keyConcepts: [],
        assessmentMethods: [],
        rawContent: curriculum.content,
      };
    }

    return NextResponse.json({
      success: true,
      curriculum: {
        id: curriculum.id,
        teacherId: curriculum.teacher_id,
        classId: curriculum.class_id,
        title: curriculum.title,
        subject: curriculum.subject,
        gradeLevel: curriculum.grade_level,
        gradingSystem: curriculum.grading_system,
        standardsAligned: curriculum.standards_aligned,
        createdAt: curriculum.created_at,
        updatedAt: curriculum.updated_at,
        parsed: parsedContent,
      },
    });
  } catch (error: any) {
    console.error('Curriculum detail failed:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// ============================================================
// DELETE /api/curriculum/[id]
// Delete a curriculum (soft delete or hard delete)
// ============================================================

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: curriculumId } = await params;
    const body = await req.json();
    const { teacherId } = body;

    if (!curriculumId || !teacherId) {
      return NextResponse.json(
        { success: false, error: 'curriculumId and teacherId are required' },
        { status: 400 }
      );
    }

    const supabaseAdmin = getAdminClient();

    // Verify teacher owns this curriculum
    const { data: curriculum, error: fetchError } = await supabaseAdmin
      .from(SUPABASE_TABLES.LESSONS)
      .select('id, teacher_id')
      .eq('id', curriculumId)
      .single();

    if (fetchError || !curriculum) {
      return NextResponse.json(
        { success: false, error: 'Curriculum not found' },
        { status: 404 }
      );
    }

    if (curriculum.teacher_id !== teacherId) {
      return NextResponse.json(
        { success: false, error: 'Not authorized' },
        { status: 403 }
      );
    }

    // Delete the curriculum
    const { error: deleteError } = await supabaseAdmin
      .from(SUPABASE_TABLES.LESSONS)
      .delete()
      .eq('id', curriculumId);

    if (deleteError) throw deleteError;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Curriculum deletion failed:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
