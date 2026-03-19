-- ============================================================
-- Migration: Phase 1b - PRM RLS Policies
-- Parent Relationship Management row-level security policies
-- ============================================================

-- parent_notifications: Teachers manage only their own notifications
CREATE POLICY teachers_manage_own_notifications ON parent_notifications
  FOR ALL
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

-- parent_notifications: Service role bypass for server-side API routes
CREATE POLICY service_role_all_notifications ON parent_notifications
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- parent_notifications: Parents can view notifications addressed to them (read-only)
CREATE POLICY parents_view_own_notifications ON parent_notifications
  FOR SELECT
  USING (parent_id = auth.uid() AND status = 'sent');

-- communication_log: Teachers view their own communication history
CREATE POLICY teachers_view_own_comms ON communication_log
  FOR SELECT
  USING (teacher_id = auth.uid());

-- communication_log: Service role bypass for logging
CREATE POLICY service_role_all_comms ON communication_log
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- student_parents: Teachers can view student-parent relationships for their students
CREATE POLICY teachers_view_student_parents ON student_parents
  FOR SELECT
  USING (
    student_id IN (
      SELECT s.id FROM students s
      JOIN enrollments e ON e.student_id = s.id
      JOIN classes c ON c.id = e.class_id
      WHERE c.teacher_id = auth.uid()
    )
  );

-- student_parents: Service role bypass
CREATE POLICY service_role_all_student_parents ON student_parents
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
