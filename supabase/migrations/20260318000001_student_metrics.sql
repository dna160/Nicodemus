-- ============================================================
-- Migration: Student Rep Agent - extend student_metrics & add teacher_review_tasks
-- Adds browser extension study session columns to existing student_metrics table
-- ============================================================

-- Add study session columns to existing student_metrics table
ALTER TABLE student_metrics
  ADD COLUMN IF NOT EXISTS device_hash TEXT,
  ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS avg_idle_seconds NUMERIC(6, 1),
  ADD COLUMN IF NOT EXISTS avg_keystrokes_per_minute INTEGER,
  ADD COLUMN IF NOT EXISTS struggle_events_count INTEGER,
  ADD COLUMN IF NOT EXISTS focus_score INTEGER CHECK (focus_score IS NULL OR (focus_score >= 0 AND focus_score <= 100)),
  ADD COLUMN IF NOT EXISTS dominant_tab_category TEXT,
  ADD COLUMN IF NOT EXISTS total_tab_switches INTEGER,
  ADD COLUMN IF NOT EXISTS summary JSONB;

-- student_id is currently NOT NULL in the existing table; we need to allow NULL for mock/dev students
ALTER TABLE student_metrics ALTER COLUMN student_id DROP NOT NULL;
-- concept_id is also NOT NULL; allow NULL for extension-submitted metrics
ALTER TABLE student_metrics ALTER COLUMN concept_id DROP NOT NULL;

-- ============================================================
-- teacher_review_tasks - HITL tasks for teachers to review study sessions
-- ============================================================

CREATE TABLE IF NOT EXISTS teacher_review_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  metric_id UUID REFERENCES student_metrics(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE SET NULL,
  teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
  review_type TEXT NOT NULL DEFAULT 'study_progress',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'dismissed')),
  notes TEXT,
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_student_metrics_device_hash ON student_metrics(device_hash);
CREATE INDEX IF NOT EXISTS idx_student_metrics_focus_score ON student_metrics(focus_score);

CREATE INDEX IF NOT EXISTS idx_teacher_review_tasks_metric_id ON teacher_review_tasks(metric_id);
CREATE INDEX IF NOT EXISTS idx_teacher_review_tasks_teacher_id ON teacher_review_tasks(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_review_tasks_student_id ON teacher_review_tasks(student_id);
CREATE INDEX IF NOT EXISTS idx_teacher_review_tasks_status ON teacher_review_tasks(status);

-- ============================================================
-- RLS Policies for teacher_review_tasks
-- ============================================================

ALTER TABLE teacher_review_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_teacher_review_tasks"
  ON teacher_review_tasks FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "teachers_read_own_review_tasks"
  ON teacher_review_tasks FOR SELECT
  TO authenticated
  USING (teacher_id = auth.uid());

CREATE POLICY "teachers_update_own_review_tasks"
  ON teacher_review_tasks FOR UPDATE
  TO authenticated
  USING (teacher_id = auth.uid());
