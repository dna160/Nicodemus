-- ============================================================
-- Migration: Add subject column to assignments table
-- Needed so student homework list can display the subject badge
-- ============================================================

ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS subject TEXT;
