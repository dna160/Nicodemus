-- ============================================================
-- Migration: Phase 2 - Financial RLS Policies
-- Controls access to invoices, stripe_customers, payment_receipts
-- ============================================================

ALTER TABLE stripe_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_receipts ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- stripe_customers: Admins see school's, parents see own child
-- ============================================================

CREATE POLICY admin_view_stripe_customers ON stripe_customers
  FOR SELECT
  USING (
    student_id IN (
      SELECT s.id FROM students s
      JOIN users u ON s.id = u.id
      WHERE u.school_id IN (
        SELECT school_id FROM users WHERE id = auth.uid() AND role = 'admin'
      )
    )
  );

CREATE POLICY parents_view_own_child_stripe ON stripe_customers
  FOR SELECT
  USING (
    student_id IN (
      SELECT student_id FROM student_parents WHERE parent_id = auth.uid()
    )
  );

CREATE POLICY service_role_all_stripe_customers ON stripe_customers
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- invoices: Admins see school's, parents see own child's
-- ============================================================

CREATE POLICY admin_view_invoices ON invoices
  FOR SELECT
  USING (
    (student_id IS NOT NULL AND student_id IN (
      SELECT s.id FROM students s
      JOIN users u ON s.id = u.id
      WHERE u.school_id IN (
        SELECT school_id FROM users WHERE id = auth.uid() AND role = 'admin'
      )
    ))
    OR
    (prospective_student_id IS NOT NULL AND prospective_student_id IN (
      SELECT id FROM prospective_students
      WHERE school_id IN (
        SELECT school_id FROM users WHERE id = auth.uid() AND role = 'admin'
      )
    ))
    OR
    EXISTS (
      SELECT 1 FROM global_admins WHERE user_id = auth.uid() AND can_view_all_schools = TRUE
    )
  );

CREATE POLICY parents_view_own_child_invoices ON invoices
  FOR SELECT
  USING (
    student_id IN (
      SELECT student_id FROM student_parents WHERE parent_id = auth.uid()
    )
  );

CREATE POLICY service_role_all_invoices ON invoices
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- payment_receipts: Admin + parent access via invoice
-- ============================================================

CREATE POLICY admin_view_payment_receipts ON payment_receipts
  FOR SELECT
  USING (
    invoice_id IN (
      SELECT id FROM invoices
      WHERE student_id IN (
        SELECT s.id FROM students s
        JOIN users u ON s.id = u.id
        WHERE u.school_id IN (
          SELECT school_id FROM users WHERE id = auth.uid() AND role = 'admin'
        )
      )
    )
    OR
    EXISTS (
      SELECT 1 FROM global_admins WHERE user_id = auth.uid() AND can_view_all_schools = TRUE
    )
  );

CREATE POLICY parents_view_own_receipts ON payment_receipts
  FOR SELECT
  USING (
    invoice_id IN (
      SELECT id FROM invoices
      WHERE student_id IN (
        SELECT student_id FROM student_parents WHERE parent_id = auth.uid()
      )
    )
  );

CREATE POLICY service_role_all_payment_receipts ON payment_receipts
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
