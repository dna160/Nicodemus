-- ============================================================
-- Migration: Phase 2 - Admissions CRM RLS Policies
-- Controls access to prospective_students, inquiry_forms,
-- fee_schedule, and global_admins tables
-- ============================================================

ALTER TABLE prospective_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE inquiry_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE global_admins ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Helper: Check if a user is a global admin
-- ============================================================
-- Note: Used inline in policies via EXISTS subquery for performance

-- ============================================================
-- prospective_students: School admins + global admins access
-- ============================================================

-- School admins see prospects for their school
CREATE POLICY school_admin_view_prospects ON prospective_students
  FOR SELECT
  USING (
    school_id IN (
      SELECT school_id FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Global admins (all schools): see everything
CREATE POLICY global_admin_all_schools_view_prospects ON prospective_students
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM global_admins
      WHERE user_id = auth.uid()
        AND can_view_all_schools = TRUE
    )
  );

-- Global admins (scoped): see only managed schools
CREATE POLICY global_admin_scoped_view_prospects ON prospective_students
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM global_admins
      WHERE user_id = auth.uid()
        AND can_view_all_schools = FALSE
        AND school_id = ANY(managed_schools)
    )
  );

-- School admins can insert prospects
CREATE POLICY school_admin_insert_prospects ON prospective_students
  FOR INSERT
  WITH CHECK (
    school_id IN (
      SELECT school_id FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- School admins can update prospects (stage changes, notes)
CREATE POLICY school_admin_update_prospects ON prospective_students
  FOR UPDATE
  USING (
    school_id IN (
      SELECT school_id FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    school_id IN (
      SELECT school_id FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Service role bypasses all (used by API routes)
CREATE POLICY service_role_all_prospects ON prospective_students
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- inquiry_forms: Admin access via parent prospect
-- ============================================================

CREATE POLICY admin_view_inquiry_forms ON inquiry_forms
  FOR SELECT
  USING (
    prospective_student_id IN (
      SELECT id FROM prospective_students
      WHERE school_id IN (
        SELECT school_id FROM users WHERE id = auth.uid() AND role = 'admin'
      )
    )
    OR
    EXISTS (
      SELECT 1 FROM global_admins WHERE user_id = auth.uid() AND can_view_all_schools = TRUE
    )
  );

CREATE POLICY service_role_all_inquiry_forms ON inquiry_forms
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- fee_schedule: School admins manage own, global admins view all
-- ============================================================

CREATE POLICY school_admin_manage_fee_schedule ON fee_schedule
  FOR ALL
  USING (
    school_id IN (
      SELECT school_id FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    school_id IN (
      SELECT school_id FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY global_admin_view_all_fee_schedules ON fee_schedule
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM global_admins WHERE user_id = auth.uid() AND can_view_all_schools = TRUE
    )
  );

CREATE POLICY service_role_all_fee_schedule ON fee_schedule
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- global_admins: Only super-admins can manage; users see own record
-- ============================================================

-- Users can see their own global_admin record (for UI role detection)
CREATE POLICY users_view_own_global_admin ON global_admins
  FOR SELECT
  USING (user_id = auth.uid());

-- Service role manages all (super-admin operations via API)
CREATE POLICY service_role_all_global_admins ON global_admins
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
