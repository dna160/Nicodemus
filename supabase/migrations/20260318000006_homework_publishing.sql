-- ============================================================
-- Migration: Homework Publishing Workflow
-- Allows teachers to create homework in draft state and publish when ready
-- ============================================================

-- Add published_at and draft_id columns to assignments
ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS draft_id UUID NULL;

-- Update status constraint to include 'draft'
-- (Note: constraint already includes draft from homework_system migration)

-- Create homework_drafts table to track unpublished homework sets
CREATE TABLE IF NOT EXISTS homework_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  content JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  published_at TIMESTAMP NULL,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_homework_drafts_teacher_id ON homework_drafts(teacher_id);
CREATE INDEX IF NOT EXISTS idx_homework_drafts_lesson_id ON homework_drafts(lesson_id);
CREATE INDEX IF NOT EXISTS idx_homework_drafts_unpublished ON homework_drafts(teacher_id, published_at) WHERE published_at IS NULL;

-- Enable RLS on homework_drafts
ALTER TABLE homework_drafts ENABLE ROW LEVEL SECURITY;

-- Teachers can read their own drafts
CREATE POLICY "teachers_read_own_drafts"
  ON homework_drafts FOR SELECT TO authenticated
  USING (teacher_id = auth.uid());

-- Teachers can create and update their own drafts
CREATE POLICY "teachers_create_own_drafts"
  ON homework_drafts FOR INSERT TO authenticated
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "teachers_update_own_drafts"
  ON homework_drafts FOR UPDATE TO authenticated
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "teachers_delete_own_drafts"
  ON homework_drafts FOR DELETE TO authenticated
  USING (teacher_id = auth.uid());

-- Service role full access
CREATE POLICY "service_role_all_homework_drafts"
  ON homework_drafts FOR ALL TO service_role USING (true) WITH CHECK (true);
