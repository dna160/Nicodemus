-- ============================================================
-- Migration: Phase 2 - Admissions CRM Schema
-- Prospective students pipeline, inquiry forms, global admins,
-- fee schedule, and parent_notifications extensions
-- ============================================================

-- ============================================================
-- Global Admins (District-level oversight)
-- ============================================================

CREATE TABLE IF NOT EXISTS global_admins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  can_view_all_schools BOOLEAN NOT NULL DEFAULT FALSE,
  managed_schools UUID[], -- NULL means all schools if can_view_all_schools=true
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- Fee Schedule (School-configurable pricing per grade)
-- ============================================================

CREATE TABLE IF NOT EXISTS fee_schedule (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  grade_level TEXT NOT NULL,
  registration_fee_cents INTEGER NOT NULL DEFAULT 0,
  monthly_tuition_cents INTEGER NOT NULL DEFAULT 0,
  activity_fee_cents INTEGER NOT NULL DEFAULT 0,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE, -- NULL = still active
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(school_id, grade_level, effective_from)
);

-- ============================================================
-- Prospective Students (CRM Pipeline)
-- ============================================================

CREATE TABLE IF NOT EXISTS prospective_students (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id TEXT UNIQUE,                  -- Generated ID e.g. NIC-JS2026-AB12
  parent_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  child_name TEXT NOT NULL,
  grade_interested TEXT NOT NULL,
  date_of_birth DATE,
  location TEXT,
  profile_picture_url TEXT,
  curriculum_id UUID REFERENCES lessons(id) ON DELETE SET NULL,
  current_stage TEXT NOT NULL DEFAULT 'inquiry_received'
    CHECK (current_stage IN (
      'inquiry_received',
      'tour_scheduled',
      'waitlisted',
      'enrolled',
      'churned'
    )),
  source TEXT NOT NULL DEFAULT 'inquiry_form'
    CHECK (source IN (
      'inquiry_form',
      'referral',
      'open_house',
      'walk_in',
      'phone_call',
      'other'
    )),
  tour_scheduled_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  last_contact_at TIMESTAMP WITH TIME ZONE,
  parent_communications_sent INTEGER NOT NULL DEFAULT 0,
  enrolled_student_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- Inquiry Forms (Public submission data)
-- ============================================================

CREATE TABLE IF NOT EXISTS inquiry_forms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prospective_student_id UUID NOT NULL REFERENCES prospective_students(id) ON DELETE CASCADE,
  -- form_data holds open-ended Q&A: [{question: "...", answer: "..."}, ...]
  form_data JSONB NOT NULL DEFAULT '[]',
  ip_address INET, -- For rate-limiting detection
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- Extend parent_notifications for admissions use
-- Allow parent_id to be NULL (prospective parents have no account)
-- Add prospective_student_id for pre-enrollment comms
-- Add new notification types: admissions_welcome, onboarding_reminder
-- ============================================================

-- 1. Make parent_id nullable (prospective parents don't have accounts yet)
ALTER TABLE parent_notifications
  ALTER COLUMN parent_id DROP NOT NULL;

-- 2. Add prospective_student_id FK for pre-enrollment notifications
ALTER TABLE parent_notifications
  ADD COLUMN IF NOT EXISTS prospective_student_id UUID
    REFERENCES prospective_students(id) ON DELETE SET NULL;

-- 3. Extend type constraint to include Phase 2 notification types
ALTER TABLE parent_notifications
  DROP CONSTRAINT IF EXISTS parent_notifications_type_check;

ALTER TABLE parent_notifications
  ADD CONSTRAINT parent_notifications_type_check
    CHECK (type IN (
      'progress',
      'alert',
      'milestone',
      'manual',
      'admissions_welcome',
      'onboarding_reminder'
    ));

-- ============================================================
-- Indexes for Performance
-- ============================================================

CREATE INDEX idx_prospective_students_school ON prospective_students(school_id);
CREATE INDEX idx_prospective_students_stage ON prospective_students(current_stage);
CREATE INDEX idx_prospective_students_email ON prospective_students(email);
CREATE INDEX idx_prospective_students_created ON prospective_students(created_at DESC);

CREATE INDEX idx_inquiry_forms_prospect ON inquiry_forms(prospective_student_id);

CREATE INDEX idx_fee_schedule_school ON fee_schedule(school_id);
CREATE INDEX idx_fee_schedule_grade ON fee_schedule(grade_level);

CREATE INDEX idx_global_admins_user ON global_admins(user_id);

CREATE INDEX idx_parent_notifications_prospect ON parent_notifications(prospective_student_id);
