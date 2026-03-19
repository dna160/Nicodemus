-- ============================================================
-- Migration: Phase 1b - Update communication_log for PRM
-- Add notification_id FK, channel, status, sent_at, subject_summary
-- Make parent_id nullable (drafts may not have a parent yet)
-- ============================================================

-- Make parent_id nullable (teacher drafts don't always have a parent linked)
ALTER TABLE communication_log
  ALTER COLUMN parent_id DROP NOT NULL;

-- Add FK to parent_notifications for traceability
ALTER TABLE communication_log
  ADD COLUMN IF NOT EXISTS notification_id UUID REFERENCES parent_notifications(id) ON DELETE SET NULL;

-- Add channel (email, phone, in-person, etc.)
ALTER TABLE communication_log
  ADD COLUMN IF NOT EXISTS channel TEXT;

-- Add delivery status
ALTER TABLE communication_log
  ADD COLUMN IF NOT EXISTS status TEXT;

-- Add sent timestamp
ALTER TABLE communication_log
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;

-- Add subject summary (no PII — audit trail only)
ALTER TABLE communication_log
  ADD COLUMN IF NOT EXISTS subject_summary TEXT;

-- Index for teacher dashboard queries
CREATE INDEX IF NOT EXISTS idx_communication_log_teacher_id ON communication_log(teacher_id);
CREATE INDEX IF NOT EXISTS idx_communication_log_notification_id ON communication_log(notification_id);
