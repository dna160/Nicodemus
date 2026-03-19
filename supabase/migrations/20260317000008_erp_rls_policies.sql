-- ============================================================
-- Migration: Phase 1c - ERP RLS Policies
-- Row-level security for substitutes, absences, inventory
-- ============================================================

-- Enable RLS on all ERP tables
ALTER TABLE substitutes ENABLE ROW LEVEL SECURITY;
ALTER TABLE absences ENABLE ROW LEVEL SECURITY;
ALTER TABLE substitute_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE substitute_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE substitute_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_usage ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Substitutes: School admins manage, service role bypass
-- ============================================================

CREATE POLICY school_admins_manage_substitutes ON substitutes
  FOR ALL
  USING (school_id IN (SELECT school_id FROM schools WHERE id = school_id))
  WITH CHECK (school_id IN (SELECT school_id FROM schools WHERE id = school_id));

CREATE POLICY service_role_all_substitutes ON substitutes
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- Absences: Teachers create/manage own, service role bypass
-- ============================================================

CREATE POLICY teachers_create_own_absences ON absences
  FOR ALL
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY service_role_all_absences ON absences
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- Substitute Availability: Subs manage own, service role bypass
-- ============================================================

CREATE POLICY substitutes_manage_own_availability ON substitute_availability
  FOR ALL
  USING (substitute_id IN (SELECT id FROM substitutes WHERE user_id = auth.uid()))
  WITH CHECK (substitute_id IN (SELECT id FROM substitutes WHERE user_id = auth.uid()));

CREATE POLICY service_role_all_availability ON substitute_availability
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- Substitute Assignments: Service role manages, teachers view own
-- ============================================================

CREATE POLICY teachers_view_own_assignments ON substitute_assignments
  FOR SELECT
  USING (absence_id IN (SELECT id FROM absences WHERE teacher_id = auth.uid()));

CREATE POLICY service_role_all_assignments ON substitute_assignments
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- Substitute Feedback: Teachers create/update own, service role
-- ============================================================

CREATE POLICY teachers_manage_own_feedback ON substitute_feedback
  FOR ALL
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY service_role_all_feedback ON substitute_feedback
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- Inventory: School-level access, service role bypass
-- ============================================================

CREATE POLICY school_manage_inventory ON inventory
  FOR ALL
  USING (school_id IN (SELECT school_id FROM schools WHERE id = school_id))
  WITH CHECK (school_id IN (SELECT school_id FROM schools WHERE id = school_id));

CREATE POLICY service_role_all_inventory ON inventory
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- Inventory Usage: Logged by service role, visible to school
-- ============================================================

CREATE POLICY school_view_inventory_usage ON inventory_usage
  FOR SELECT
  USING (inventory_id IN (SELECT id FROM inventory WHERE school_id IN (
    SELECT school_id FROM schools WHERE id = school_id
  )));

CREATE POLICY service_role_all_inventory_usage ON inventory_usage
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
