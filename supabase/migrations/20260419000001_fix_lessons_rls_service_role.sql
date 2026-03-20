-- Fix lessons RLS service role bypass policy
-- The original policy only had USING, which doesn't work for INSERT operations
-- We need WITH CHECK for INSERT/UPDATE operations to bypass RLS properly

-- Drop the broken service role policy
DROP POLICY IF EXISTS "service_role_all_lessons" ON lessons;

-- Create the corrected service role policy with both USING and WITH CHECK
CREATE POLICY "service_role_all_lessons" ON lessons
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Similarly fix the lesson_variants service role policy
DROP POLICY IF EXISTS "service_role_all_lesson_variants" ON lesson_variants;

CREATE POLICY "service_role_all_lesson_variants" ON lesson_variants
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
