-- ============================================================
-- Migration: Study review pipeline fixes
-- 1. Make student_id nullable in parent_notifications (dev/mock support)
-- 2. Add teacher_notes to teacher_review_tasks
-- 3. Add 'expired' to teacher_review_tasks status enum
-- ============================================================

-- parent_notifications: allow null student_id (drafts and mock testing)
ALTER TABLE parent_notifications
  ALTER COLUMN student_id DROP NOT NULL;

-- teacher_review_tasks: add teacher_notes field
ALTER TABLE teacher_review_tasks
  ADD COLUMN IF NOT EXISTS teacher_notes TEXT;
