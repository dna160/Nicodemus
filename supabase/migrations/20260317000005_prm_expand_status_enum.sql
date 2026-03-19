-- ============================================================
-- Migration: Phase 1b - Expand parent_notifications status enum
-- Add 'approved' and 'rejected' to the status CHECK constraint
-- to support the full HITL workflow: draft → approved → sent
--                                              └→ rejected
-- ============================================================

-- Drop the old constraint and replace with expanded one
ALTER TABLE parent_notifications
  DROP CONSTRAINT IF EXISTS parent_notifications_status_check;

ALTER TABLE parent_notifications
  ADD CONSTRAINT parent_notifications_status_check
    CHECK (status IN ('draft', 'pending_approval', 'approved', 'sent', 'rejected', 'failed'));
