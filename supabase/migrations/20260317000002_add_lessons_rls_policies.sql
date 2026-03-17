-- Add Row-Level Security policies for lessons table
-- Allows teachers to manage their own lessons

-- Teachers can INSERT lessons with their own teacher_id
CREATE POLICY "teachers_insert_own_lessons" ON lessons
  FOR INSERT
  WITH CHECK (teacher_id = auth.uid());

-- Teachers can SELECT (view) their own lessons
CREATE POLICY "teachers_select_own_lessons" ON lessons
  FOR SELECT
  USING (teacher_id = auth.uid());

-- Teachers can UPDATE their own lessons
CREATE POLICY "teachers_update_own_lessons" ON lessons
  FOR UPDATE
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

-- Teachers can DELETE their own lessons
CREATE POLICY "teachers_delete_own_lessons" ON lessons
  FOR DELETE
  USING (teacher_id = auth.uid());

-- Service role can bypass RLS (for admin/system operations)
CREATE POLICY "service_role_all_lessons" ON lessons
  FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================
-- RLS Policies for related tables
-- ============================================

-- Lesson variants: teachers can manage variants of their lessons
CREATE POLICY "teachers_manage_lesson_variants" ON lesson_variants
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM lessons
      WHERE lessons.id = lesson_variants.lesson_id
      AND lessons.teacher_id = auth.uid()
    )
  );

-- Service role bypass for lesson_variants
CREATE POLICY "service_role_all_lesson_variants" ON lesson_variants
  FOR ALL
  USING (auth.role() = 'service_role');
