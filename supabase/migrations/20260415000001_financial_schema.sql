-- ============================================================
-- Migration: Phase 2 - Financial Schema
-- Stripe customers, invoices, and payment receipts
-- ============================================================

-- ============================================================
-- Stripe Customers (one-to-one with enrolled students)
-- ============================================================

CREATE TABLE IF NOT EXISTS stripe_customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE UNIQUE,
  stripe_customer_id TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- Invoices (Complex pricing: registration + tuition + activity)
-- Can belong to enrolled student OR prospective student
-- ============================================================

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID REFERENCES students(id) ON DELETE SET NULL,
  prospective_student_id UUID REFERENCES prospective_students(id) ON DELETE SET NULL,
  stripe_invoice_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  -- fee_breakdown JSONB: {registration_fee_cents, monthly_tuition_cents, activity_fees_cents}
  fee_breakdown JSONB NOT NULL DEFAULT '{}',
  total_amount_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled', 'refunded')),
  due_date DATE,
  sent_at TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  -- Ensure invoice belongs to someone
  CONSTRAINT invoices_must_have_owner
    CHECK (student_id IS NOT NULL OR prospective_student_id IS NOT NULL)
);

-- ============================================================
-- Payment Receipts (Audit trail for Stripe events)
-- ============================================================

CREATE TABLE IF NOT EXISTS payment_receipts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  stripe_payment_intent_id TEXT UNIQUE,
  amount_cents INTEGER NOT NULL,
  status TEXT NOT NULL
    CHECK (status IN ('succeeded', 'failed', 'processing', 'refunded')),
  email_sent_at TIMESTAMP WITH TIME ZONE,
  -- Full Stripe webhook payload for debugging/auditing
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- Indexes for Performance
-- ============================================================

CREATE INDEX idx_stripe_customers_student ON stripe_customers(student_id);
CREATE INDEX idx_stripe_customers_stripe_id ON stripe_customers(stripe_customer_id);

CREATE INDEX idx_invoices_student ON invoices(student_id);
CREATE INDEX idx_invoices_prospect ON invoices(prospective_student_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_stripe_id ON invoices(stripe_invoice_id);
CREATE INDEX idx_invoices_created ON invoices(created_at DESC);

CREATE INDEX idx_payment_receipts_invoice ON payment_receipts(invoice_id);
CREATE INDEX idx_payment_receipts_intent ON payment_receipts(stripe_payment_intent_id);
CREATE INDEX idx_payment_receipts_status ON payment_receipts(status);
