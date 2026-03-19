-- ============================================================
-- Migration: Phase 1b - Allow nullable parent_id and student_id
-- on parent_notifications for teacher-initiated draft emails
-- that haven't yet been linked to a specific parent/student.
-- ============================================================

ALTER TABLE parent_notifications
  ALTER COLUMN parent_id DROP NOT NULL;

ALTER TABLE parent_notifications
  ALTER COLUMN student_id DROP NOT NULL;

-- Also add teacher_id NOT NULL since drafts always have a teacher
-- (was nullable before, but HITL requires teacher ownership)
ALTER TABLE parent_notifications
  ALTER COLUMN teacher_id SET NOT NULL;

-- Add sent_at timestamp column for tracking delivery time
ALTER TABLE parent_notifications
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;

-- Add rejection_reason for audit trail of teacher rejections
ALTER TABLE parent_notifications
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
