/**
 * GET /api/search
 *
 * Query params:
 *   q        — search query string (required, min 1 char)
 *   role     — 'teacher' | 'student' | 'admin'
 *   userId   — current user's ID (for scoping results)
 *   category — optional: 'user' | 'class' | 'curriculum' | 'subject' | 'all' (default: 'all')
 *
 * Returns grouped results:
 *   { users: [], classes: [], curriculum: [], subjects: [] }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const LIMIT = 6;

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// ─── Result types ──────────────────────────────────────────────────────────────

export interface SearchResult {
  id: string;
  category: 'user' | 'class' | 'curriculum' | 'subject';
  title: string;
  subtitle?: string;
  badge?: string;
  meta?: string;
  navigateTo?: string; // tab name to switch to on click
  navigateQuery?: string; // optional sub-query for the tab
}

// ─── Route handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const q        = (searchParams.get('q') ?? '').trim();
  const role     = (searchParams.get('role') ?? 'teacher') as 'teacher' | 'student' | 'admin';
  const userId   = searchParams.get('userId') ?? '';
  const category = searchParams.get('category') ?? 'all';

  if (!q || q.length < 1) {
    return NextResponse.json({
      success: true,
      results: { users: [], classes: [], curriculum: [], subjects: [] },
    });
  }

  // Demo mode — return empty
  if (!userId || userId === 'demo') {
    return NextResponse.json({
      success: true,
      results: { users: [], classes: [], curriculum: [], subjects: [] },
    });
  }

  const supabase = getAdminClient();
  const pattern  = `%${q}%`;

  const doUser       = category === 'all' || category === 'user';
  const doClass      = category === 'all' || category === 'class';
  const doCurriculum = (category === 'all' || category === 'curriculum') && role === 'teacher';
  const doSubject    = (category === 'all' || category === 'subject')    && role === 'student';

  const [usersRes, classesRes, curriculumRes, subjectsRes] = await Promise.all([
    // ── Users ─────────────────────────────────────────────────────────────────
    doUser
      ? supabase
          .from('users')
          .select('id, name, email, role')
          .or(`name.ilike.${pattern},email.ilike.${pattern}`)
          .neq('role', 'system')
          .order('name')
          .limit(LIMIT)
      : Promise.resolve({ data: [], error: null }),

    // ── Classes ───────────────────────────────────────────────────────────────
    doClass
      ? role === 'teacher'
        ? supabase
            .from('classes')
            .select('id, name, subject, grade_level, period')
            .eq('teacher_id', userId)
            .or(`name.ilike.${pattern},subject.ilike.${pattern}`)
            .order('name')
            .limit(LIMIT)
        : role === 'student'
        ? supabase
            .from('classes')
            .select('id, name, subject, grade_level, period, enrollments!inner(student_id)')
            .eq('enrollments.student_id', userId)
            .or(`name.ilike.${pattern},subject.ilike.${pattern}`)
            .order('name')
            .limit(LIMIT)
        : // admin — all classes
          supabase
            .from('classes')
            .select('id, name, subject, grade_level, period')
            .or(`name.ilike.${pattern},subject.ilike.${pattern}`)
            .order('name')
            .limit(LIMIT)
      : Promise.resolve({ data: [], error: null }),

    // ── Curriculum (lessons) — teacher only ───────────────────────────────────
    doCurriculum
      ? supabase
          .from('lessons')
          .select('id, title, subject, grade_level')
          .eq('teacher_id', userId)
          .or(`title.ilike.${pattern},subject.ilike.${pattern}`)
          .order('title')
          .limit(LIMIT)
      : Promise.resolve({ data: [], error: null }),

    // ── Subjects (assignments by subject) — student only ──────────────────────
    doSubject
      ? supabase
          .from('assignments')
          .select('id, title, subject, assignment_type, status, due_at')
          .or(`title.ilike.${pattern},subject.ilike.${pattern}`)
          .eq('status', 'active')
          .order('title')
          .limit(LIMIT)
      : Promise.resolve({ data: [], error: null }),
  ]);

  // ── Shape results ──────────────────────────────────────────────────────────

  const users: SearchResult[] = ((usersRes.data ?? []) as {id:string;name:string;email:string;role:string}[]).map((u) => ({
    id:           u.id,
    category:     'user',
    title:        u.name,
    subtitle:     u.email,
    badge:        u.role.charAt(0).toUpperCase() + u.role.slice(1),
    navigateTo:   u.role === 'student' ? 'students' : u.role === 'teacher' ? 'teachers' : undefined,
  }));

  const classes: SearchResult[] = ((classesRes.data ?? []) as {id:string;name:string;subject:string|null;grade_level:string|null;period:number|null}[]).map((c) => ({
    id:         c.id,
    category:   'class',
    title:      c.name,
    subtitle:   [c.subject, c.grade_level ? `Grade ${c.grade_level}` : null].filter(Boolean).join(' · '),
    badge:      c.period ? `Period ${c.period}` : undefined,
    navigateTo: 'classes',
  }));

  const curriculum: SearchResult[] = ((curriculumRes.data ?? []) as {id:string;title:string;subject:string|null;grade_level:string|null}[]).map((l) => ({
    id:         l.id,
    category:   'curriculum',
    title:      l.title,
    subtitle:   [l.subject, l.grade_level ? `Grade ${l.grade_level}` : null].filter(Boolean).join(' · '),
    navigateTo: 'curriculum',
  }));

  const subjects: SearchResult[] = ((subjectsRes.data ?? []) as {id:string;title:string;subject:string|null;assignment_type:string|null;due_at:string|null}[]).map((a) => ({
    id:           a.id,
    category:     'subject',
    title:        a.title,
    subtitle:     a.subject ?? undefined,
    badge:        a.assignment_type ?? undefined,
    meta:         a.due_at ? `Due ${new Date(a.due_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : undefined,
    navigateTo:   'homework',
    navigateQuery: a.subject ?? undefined,
  }));

  return NextResponse.json({
    success: true,
    results: { users, classes, curriculum, subjects },
  });
}
