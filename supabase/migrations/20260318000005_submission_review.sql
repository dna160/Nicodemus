-- ============================================================
-- Migration: Teacher Review Workflow for Homework Submissions
-- Adds per-answer feedback, teacher grade override, and final grade.
-- Submissions are held in 'pending_review' until teacher signs off.
-- ============================================================

-- Add teacher review columns to submissions
ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS teacher_grade DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS final_grade DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS per_answer_feedback JSONB,
  ADD COLUMN IF NOT EXISTS overall_feedback TEXT;

-- Extend submission_status to include 'pending_review'
-- Drop old constraint and recreate with new value
ALTER TABLE submissions DROP CONSTRAINT IF EXISTS submissions_submission_status_check;
ALTER TABLE submissions ADD CONSTRAINT submissions_submission_status_check
  CHECK (submission_status IN ('draft', 'submitted', 'grading', 'pending_review', 'graded', 'returned'));

-- Index for efficient pending review queries
CREATE INDEX IF NOT EXISTS idx_submissions_pending_review
  ON submissions(submission_status)
  WHERE submission_status = 'pending_review';
