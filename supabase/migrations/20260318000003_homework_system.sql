-- ============================================================
-- Migration: Homework System
-- Extends assignments + submissions tables, adds submission_id to review tasks
-- ============================================================

-- Make class_id and teacher_id nullable in assignments (curriculum-generated
-- homework may not be tied to a specific class immediately)
ALTER TABLE assignments
  ALTER COLUMN class_id DROP NOT NULL,
  ALTER COLUMN teacher_id DROP NOT NULL;

-- Add homework-specific columns to assignments
ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS lesson_id UUID REFERENCES lessons(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assignment_type TEXT DEFAULT 'homework'
    CHECK (assignment_type IN ('homework', 'classwork', 'quiz', 'project')),
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active'
    CHECK (status IN ('draft', 'active', 'archived')),
  ADD COLUMN IF NOT EXISTS points_possible INTEGER DEFAULT 100;

-- Add AI grading columns to submissions
ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS ai_grade DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS ai_feedback TEXT,
  ADD COLUMN IF NOT EXISTS ai_next_steps TEXT,
  ADD COLUMN IF NOT EXISTS submission_status TEXT DEFAULT 'submitted'
    CHECK (submission_status IN ('draft', 'submitted', 'grading', 'graded', 'returned'));

-- Make submission content optional (saves draft before submission)
ALTER TABLE submissions
  ALTER COLUMN content DROP NOT NULL;

-- Add submission_id FK to teacher_review_tasks (links homework reviews to submissions)
ALTER TABLE teacher_review_tasks
  ADD COLUMN IF NOT EXISTS submission_id UUID REFERENCES submissions(id) ON DELETE SET NULL;

-- ============================================================
-- Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_assignments_lesson_id ON assignments(lesson_id);
CREATE INDEX IF NOT EXISTS idx_assignments_class_id_status ON assignments(class_id, status);
CREATE INDEX IF NOT EXISTS idx_assignments_teacher_id ON assignments(teacher_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student_id ON submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_submissions_assignment_id ON submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_submissions_graded ON submissions(graded);
CREATE INDEX IF NOT EXISTS idx_teacher_review_tasks_submission_id ON teacher_review_tasks(submission_id);

-- ============================================================
-- RLS Policies for assignments and submissions
-- ============================================================

ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "service_role_all_assignments"
  ON assignments FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_submissions"
  ON submissions FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Students read assignments for classes they're enrolled in
CREATE POLICY "students_read_enrolled_assignments"
  ON assignments FOR SELECT TO authenticated
  USING (
    class_id IN (SELECT class_id FROM enrollments WHERE student_id = auth.uid())
    OR class_id IS NULL
  );

-- Students manage their own submissions
CREATE POLICY "students_manage_own_submissions"
  ON submissions FOR ALL TO authenticated
  USING (student_id = auth.uid());
