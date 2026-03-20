import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_TABLES } from 'shared';

export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function generateStudentId(name: string): string {
  const year = new Date().getFullYear();
  const initials = name
    .split(' ')
    .map((n) => n[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 3)
    .padEnd(2, 'X');
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `NIC-${initials}${year}-${random}`;
}

function calcAgeAndGrade(dob: string): { age: number; recommendedGrade: string } {
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--;

  let recommendedGrade = 'Pre-K';
  if (age >= 5 && age < 6) recommendedGrade = 'Kindergarten';
  else if (age >= 6 && age < 7) recommendedGrade = 'Grade 1';
  else if (age >= 7 && age < 8) recommendedGrade = 'Grade 2';
  else if (age >= 8 && age < 9) recommendedGrade = 'Grade 3';
  else if (age >= 9 && age < 10) recommendedGrade = 'Grade 4';
  else if (age >= 10 && age < 11) recommendedGrade = 'Grade 5';
  else if (age >= 11 && age < 12) recommendedGrade = 'Grade 6';
  else if (age >= 12 && age < 13) recommendedGrade = 'Grade 7';
  else if (age >= 13 && age < 14) recommendedGrade = 'Grade 8';
  else if (age >= 14 && age < 15) recommendedGrade = 'Grade 9';
  else if (age >= 15 && age < 16) recommendedGrade = 'Grade 10';
  else if (age >= 16 && age < 17) recommendedGrade = 'Grade 11';
  else if (age >= 17) recommendedGrade = 'Grade 12';

  return { age, recommendedGrade };
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const studentName  = formData.get('studentName') as string;
    const pipeline     = formData.get('pipeline') as string;
    const dateOfBirth  = formData.get('dateOfBirth') as string;
    const gradeLevel   = formData.get('gradeLevel') as string;
    const location     = formData.get('location') as string;
    const parentName   = formData.get('parentName') as string;
    const parentEmail  = formData.get('parentEmail') as string;
    const parentPhone  = formData.get('parentPhone') as string;
    const curriculumId = formData.get('curriculumId') as string | null;
    const schoolId     = formData.get('schoolId') as string;
    const picture      = formData.get('profilePicture') as File | null;

    if (!studentName || !parentName || !parentEmail || !pipeline || !schoolId) {
      return NextResponse.json(
        { success: false, error: 'studentName, parentName, parentEmail, pipeline, schoolId are required' },
        { status: 400 }
      );
    }

    // Generate unique student ID (retry if collision)
    let studentId = generateStudentId(studentName);
    const { data: existing } = await supabaseAdmin
      .from(SUPABASE_TABLES.PROSPECTIVE_STUDENTS)
      .select('id')
      .eq('student_id', studentId)
      .maybeSingle();
    if (existing) studentId = generateStudentId(studentName + Date.now());

    // Upload profile picture if provided
    let profilePictureUrl: string | null = null;
    if (picture && picture.size > 0) {
      const ext = picture.name.split('.').pop() ?? 'jpg';
      const path = `${studentId}/${Date.now()}.${ext}`;
      const buffer = Buffer.from(await picture.arrayBuffer());
      const { error: uploadError } = await supabaseAdmin.storage
        .from('student-profiles')
        .upload(path, buffer, { contentType: picture.type, upsert: true });

      if (!uploadError) {
        const { data: urlData } = supabaseAdmin.storage
          .from('student-profiles')
          .getPublicUrl(path);
        profilePictureUrl = urlData.publicUrl;
      }
    }

    // Map frontend stage names to DB enum values
    const stageMap: Record<string, string> = {
      inquiry: 'inquiry_received',
      tour: 'tour_scheduled',
      waitlist: 'waitlisted',
      enrolled: 'enrolled',
      churned: 'churned',
    };
    const currentStage = stageMap[pipeline] ?? pipeline;

    // Calculate grade from DOB if not overridden
    let finalGrade = gradeLevel;
    if (!finalGrade && dateOfBirth) {
      finalGrade = calcAgeAndGrade(dateOfBirth).recommendedGrade;
    }

    const { data: student, error } = await supabaseAdmin
      .from(SUPABASE_TABLES.PROSPECTIVE_STUDENTS)
      .insert({
        school_id: schoolId,
        child_name: studentName,
        parent_name: parentName,
        email: parentEmail,
        phone: parentPhone || null,
        grade_interested: finalGrade || 'Unknown',
        current_stage: currentStage,
        source: 'walk_in',
        date_of_birth: dateOfBirth || null,
        location: location || null,
        student_id: studentId,
        profile_picture_url: profilePictureUrl,
        curriculum_id: curriculumId || null,
        last_contact_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, student, studentId });
  } catch (err: any) {
    console.error('Student create error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
