import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { inngest } from '@/lib/inngest';
import { SUPABASE_TABLES, INNGEST_EVENTS } from 'shared';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Simple in-memory rate limit store (per Vercel function instance)
// For production, replace with Redis/Upstash
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record || now > record.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true; // Allowed
  }

  if (record.count >= RATE_LIMIT_MAX) {
    return false; // Blocked
  }

  record.count++;
  return true;
}

// ============================================================
// POST /api/public/inquiry-form
// Public endpoint — no authentication required.
// Accepts parent inquiry for a prospective student and
// saves to prospective_students + inquiry_forms tables.
// Rate-limited: 5 submissions per IP per hour.
// ============================================================

export async function POST(req: NextRequest) {
  try {
    // Rate limiting by IP
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      'unknown';

    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { success: false, error: 'Too many submissions. Please try again later.' },
        { status: 429 }
      );
    }

    const body = await req.json();
    const {
      schoolId,
      parentName,
      email,
      phone,
      childName,
      gradeInterested,
      source = 'inquiry_form',
      inquiryResponses = [], // [{question: "...", answer: "..."}]
    } = body;

    // Validate required fields
    if (!schoolId || !parentName || !email || !childName || !gradeInterested) {
      return NextResponse.json(
        {
          success: false,
          error: 'Required fields: schoolId, parentName, email, childName, gradeInterested',
        },
        { status: 400 }
      );
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email address' },
        { status: 400 }
      );
    }

    const supabaseAdmin = getAdminClient();

    // 1. Create prospective student record
    const { data: prospect, error: prospectError } = await supabaseAdmin
      .from(SUPABASE_TABLES.PROSPECTIVE_STUDENTS)
      .insert({
        school_id: schoolId,
        parent_name: parentName,
        email,
        phone: phone || null,
        child_name: childName,
        grade_interested: gradeInterested,
        current_stage: 'inquiry_received',
        source,
        last_contact_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (prospectError) {
      console.error('Failed to create prospective student:', prospectError);
      return NextResponse.json(
        { success: false, error: 'Failed to save inquiry. Please try again.' },
        { status: 500 }
      );
    }

    // 2. Save inquiry form data (open-ended Q&A)
    const { error: formError } = await supabaseAdmin
      .from(SUPABASE_TABLES.INQUIRY_FORMS)
      .insert({
        prospective_student_id: prospect.id,
        form_data: inquiryResponses,
        ip_address: ip === 'unknown' ? null : ip,
      });

    if (formError) {
      console.warn('Inquiry form data save failed (non-fatal):', formError.message);
    }

    // 3. Trigger Inngest event for async AI nurturing workflow
    try {
      await inngest.send({
        name: INNGEST_EVENTS.INQUIRY_RECEIVED,
        data: {
          prospectId: prospect.id,
          schoolId,
          parentName,
          childName,
          gradeInterested,
          email,
          inquiryResponses,
        },
      });
    } catch (inngestError: any) {
      console.warn('Inngest inquiry event skipped (non-fatal):', inngestError.message);
    }

    return NextResponse.json({
      success: true,
      message: "Thank you for your inquiry! We'll be in touch soon.",
      prospectId: prospect.id,
    });
  } catch (error: any) {
    console.error('Inquiry form submission failed:', error);
    return NextResponse.json(
      { success: false, error: 'Submission failed. Please try again.' },
      { status: 500 }
    );
  }
}
