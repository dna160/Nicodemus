-- ============================================================
-- Migration: Phase 2 - Onboarding Checklist RLS Policies
-- Admins verify docs, parents upload their child's docs
-- ============================================================

ALTER TABLE onboarding_checklist ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Admins: Full access for their school's students
-- ============================================================

CREATE POLICY admin_manage_onboarding_checklist ON onboarding_checklist
  FOR ALL
  USING (
    student_id IN (
      SELECT s.id FROM students s
      JOIN users u ON s.id = u.id
      WHERE u.school_id IN (
        SELECT school_id FROM users WHERE id = auth.uid() AND role = 'admin'
      )
    )
    OR
    EXISTS (
      SELECT 1 FROM global_admins WHERE user_id = auth.uid() AND can_view_all_schools = TRUE
    )
  )
  WITH CHECK (
    student_id IN (
      SELECT s.id FROM students s
      JOIN users u ON s.id = u.id
      WHERE u.school_id IN (
        SELECT school_id FROM users WHERE id = auth.uid() AND role = 'admin'
      )
    )
  );

-- ============================================================
-- Parents: View and submit their own child's checklist
-- ============================================================

CREATE POLICY parents_view_child_checklist ON onboarding_checklist
  FOR SELECT
  USING (
    student_id IN (
      SELECT student_id FROM student_parents WHERE parent_id = auth.uid()
    )
  );

-- Parents can update (submit) pending items for their child
CREATE POLICY parents_submit_documents ON onboarding_checklist
  FOR UPDATE
  USING (
    student_id IN (
      SELECT student_id FROM student_parents WHERE parent_id = auth.uid()
    )
    AND status IN ('pending', 'rejected') -- Can only update pending/rejected items
  )
  WITH CHECK (
    student_id IN (
      SELECT student_id FROM student_parents WHERE parent_id = auth.uid()
    )
    AND status = 'submitted' -- Can only set to submitted
  );

-- ============================================================
-- Service role: Full bypass (used by cron jobs + enrollment API)
-- ============================================================

CREATE POLICY service_role_all_onboarding ON onboarding_checklist
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
