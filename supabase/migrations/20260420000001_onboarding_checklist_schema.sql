-- ============================================================
-- Migration: Phase 2 - Onboarding Checklist Schema
-- Document tracking for newly enrolled students
-- ============================================================

CREATE TABLE IF NOT EXISTS onboarding_checklist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL
    CHECK (document_type IN (
      'medical_records',
      'emergency_contacts',
      'proof_of_residency',
      'immunization_records',
      'birth_certificate'
    )),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'submitted', 'verified', 'rejected')),
  -- Supabase Storage path: student-onboarding-documents/{student_id}/{document_type}/{filename}
  submission_file_path TEXT,
  submission_date TIMESTAMP WITH TIME ZONE,
  admin_verification_date TIMESTAMP WITH TIME ZONE,
  verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
  rejection_reason TEXT, -- Admin notes when rejecting a document
  reminder_count INTEGER NOT NULL DEFAULT 0, -- Max 2 automated reminders
  reminder_last_sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  -- One checklist item per document type per student
  UNIQUE(student_id, document_type)
);

-- ============================================================
-- Indexes for Performance
-- ============================================================

CREATE INDEX idx_onboarding_checklist_student ON onboarding_checklist(student_id);
CREATE INDEX idx_onboarding_checklist_status ON onboarding_checklist(status);
CREATE INDEX idx_onboarding_checklist_type ON onboarding_checklist(document_type);
-- For cron job: find pending items needing reminders
CREATE INDEX idx_onboarding_checklist_pending_reminders
  ON onboarding_checklist(status, reminder_count, reminder_last_sent_at)
  WHERE status = 'pending';
