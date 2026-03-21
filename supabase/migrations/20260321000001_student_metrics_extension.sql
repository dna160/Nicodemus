-- ============================================================
-- Migration: Browser Extension Study Session Metrics
-- Date: 2026-03-21
-- Purpose: Add required columns for Student Edge browser extension
--          metrics ingestion and enhance student_metrics table
-- ============================================================

-- ============================================================
-- 1. Add missing metric columns to student_metrics
--    CRITICAL FIX: Added device_hash, dominant_activity, summary,
--                  struggle_events_count which were in Edge Function
--                  but missing from original migration
-- ============================================================

ALTER TABLE student_metrics
  ADD COLUMN IF NOT EXISTS device_hash TEXT,
  ADD COLUMN IF NOT EXISTS dominant_activity TEXT,
  ADD COLUMN IF NOT EXISTS summary TEXT,
  ADD COLUMN IF NOT EXISTS struggle_events_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS metric_period_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS metric_period_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS focus_score DECIMAL(5, 2) CHECK (focus_score IS NULL OR (focus_score >= 0 AND focus_score <= 100)),
  ADD COLUMN IF NOT EXISTS avg_keystrokes_per_minute DECIMAL(8, 2),
  ADD COLUMN IF NOT EXISTS avg_idle_seconds DECIMAL(8, 2),
  ADD COLUMN IF NOT EXISTS total_tab_switches INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS focus_level TEXT CHECK (focus_level IS NULL OR focus_level IN ('high', 'normal', 'low')),
  ADD COLUMN IF NOT EXISTS fatigue_indicator TEXT CHECK (fatigue_indicator IS NULL OR fatigue_indicator IN ('none', 'mild', 'moderate', 'severe')),
  ADD COLUMN IF NOT EXISTS recommendations TEXT[],
  ADD COLUMN IF NOT EXISTS student_nicodemus_id TEXT;

-- ============================================================
-- 2. Add explanatory comment for schema design decision
--    The original student_id FK (UUID) references users.id (enrolled students)
--    The extension sends student_id as text format (e.g., "NIC-JD2026-ABCD")
--    SOLUTION: student_nicodemus_id TEXT stores the text identifier
--    This allows metrics from before account creation (device_hash only)
--    and metrics from after enrollment (both student_id FK + student_nicodemus_id)
-- ============================================================

COMMENT ON COLUMN student_metrics.student_nicodemus_id IS
  'Text-format student identifier from browser extension (e.g., NIC-JD2026-ABCD). '
  'Used to link metrics from pre-enrollment sessions. Separate from student_id (UUID FK).';

COMMENT ON COLUMN student_metrics.device_hash IS
  'SHA-256 hash of device UUID from browser extension. '
  'Links all metrics from the same device, even before account creation.';

COMMENT ON COLUMN student_metrics.dominant_activity IS
  'Category of dominant tab activity during metric period: productive, distraction, or neutral.';

COMMENT ON COLUMN student_metrics.struggle_events_count IS
  'Count of struggle/difficulty moments detected during this metric period.';

-- ============================================================
-- 3. Create indexes for query performance
-- ============================================================

-- Index for device_hash lookups (sessions before account creation)
CREATE INDEX IF NOT EXISTS idx_student_metrics_device_hash
  ON student_metrics(device_hash);

-- Index for student_id lookups (enrolled students, UUID FK)
CREATE INDEX IF NOT EXISTS idx_student_metrics_student_id
  ON student_metrics(student_id);

-- Index for student_nicodemus_id lookups (text identifier from extension)
CREATE INDEX IF NOT EXISTS idx_student_metrics_student_nicodemus_id
  ON student_metrics(student_nicodemus_id);

-- Index for time-range queries (metric period filtering)
CREATE INDEX IF NOT EXISTS idx_student_metrics_metric_period_start
  ON student_metrics(metric_period_start);

-- Composite index for common query pattern: device_hash + time range
CREATE INDEX IF NOT EXISTS idx_student_metrics_device_time
  ON student_metrics(device_hash, metric_period_start);

-- ============================================================
-- 4. Down migration (commented for reference)
-- ============================================================

/*
-- To rollback this migration, run:

DROP INDEX IF EXISTS idx_student_metrics_device_time CASCADE;
DROP INDEX IF EXISTS idx_student_metrics_metric_period_start CASCADE;
DROP INDEX IF EXISTS idx_student_metrics_student_nicodemus_id CASCADE;
DROP INDEX IF EXISTS idx_student_metrics_student_id CASCADE;
DROP INDEX IF EXISTS idx_student_metrics_device_hash CASCADE;

ALTER TABLE student_metrics
  DROP COLUMN IF EXISTS recommendations,
  DROP COLUMN IF EXISTS fatigue_indicator,
  DROP COLUMN IF EXISTS focus_level,
  DROP COLUMN IF EXISTS total_tab_switches,
  DROP COLUMN IF EXISTS avg_idle_seconds,
  DROP COLUMN IF EXISTS avg_keystrokes_per_minute,
  DROP COLUMN IF EXISTS focus_score,
  DROP COLUMN IF EXISTS metric_period_end,
  DROP COLUMN IF EXISTS metric_period_start,
  DROP COLUMN IF EXISTS student_nicodemus_id,
  DROP COLUMN IF EXISTS struggle_events_count,
  DROP COLUMN IF EXISTS summary,
  DROP COLUMN IF EXISTS dominant_activity,
  DROP COLUMN IF EXISTS device_hash;
*/
