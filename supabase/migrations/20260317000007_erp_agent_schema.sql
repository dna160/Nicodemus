-- ============================================================
-- Migration: Phase 1c - ERP Agent Schema
-- Substitute allocation + inventory management
-- ============================================================

-- ============================================================
-- Substitutes Table
-- ============================================================

DROP TABLE IF EXISTS substitute_availability CASCADE;
DROP TABLE IF EXISTS substitute_feedback CASCADE;
DROP TABLE IF EXISTS absences CASCADE;
DROP TABLE IF EXISTS substitutes CASCADE;

CREATE TABLE IF NOT EXISTS substitutes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  subjects TEXT[], -- e.g. ['Math', 'Science', 'English']
  grade_levels TEXT[], -- e.g. ['4', '5', '6']
  is_active BOOLEAN DEFAULT true,
  rate_per_hour NUMERIC(10, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- Absences Table
-- ============================================================

CREATE TABLE IF NOT EXISTS absences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  date_start DATE NOT NULL,
  date_end DATE NOT NULL,
  reason TEXT, -- 'sick', 'personal', 'conference', 'other'
  lesson_plan_id UUID REFERENCES lessons(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CHECK (date_end >= date_start)
);

-- ============================================================
-- Substitute Availability (availability calendar)
-- ============================================================

CREATE TABLE IF NOT EXISTS substitute_availability (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  substitute_id UUID NOT NULL REFERENCES substitutes(id) ON DELETE CASCADE,
  date_available DATE NOT NULL,
  available BOOLEAN DEFAULT true, -- true = available, false = unavailable
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(substitute_id, date_available)
);

-- ============================================================
-- Substitute Assignments (which sub takes which absence)
-- ============================================================

CREATE TABLE IF NOT EXISTS substitute_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  absence_id UUID NOT NULL REFERENCES absences(id) ON DELETE CASCADE,
  substitute_id UUID NOT NULL REFERENCES substitutes(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'accepted', 'declined', 'completed')),
  email_sent_at TIMESTAMP WITH TIME ZONE,
  response_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(absence_id, substitute_id)
);

-- ============================================================
-- Substitute Feedback (teacher rates sub after absence)
-- ============================================================

CREATE TABLE IF NOT EXISTS substitute_feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  substitute_assignment_id UUID NOT NULL REFERENCES substitute_assignments(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5), -- 1-5 stars
  follow_up_notes TEXT,
  students_completed_work BOOLEAN,
  classroom_behavior_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- Inventory Table
-- ============================================================

CREATE TABLE IF NOT EXISTS inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  category TEXT, -- 'supplies', 'equipment', 'textbooks', 'technology'
  quantity_on_hand INTEGER NOT NULL DEFAULT 0,
  quantity_reserved INTEGER NOT NULL DEFAULT 0, -- allocated to lessons/classes
  reorder_point INTEGER,
  last_inventory_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- Inventory Usage Log
-- ============================================================

CREATE TABLE IF NOT EXISTS inventory_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inventory_id UUID NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
  lesson_id UUID REFERENCES lessons(id) ON DELETE SET NULL,
  class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
  teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
  quantity_used INTEGER NOT NULL,
  usage_type TEXT, -- 'allocation', 'return', 'loss', 'audit'
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- Indexes for Performance
-- ============================================================

CREATE INDEX idx_absences_teacher_id ON absences(teacher_id);
CREATE INDEX idx_absences_class_id ON absences(class_id);
CREATE INDEX idx_absences_date_range ON absences(date_start, date_end);

CREATE INDEX idx_substitute_availability_substitute_id ON substitute_availability(substitute_id);
CREATE INDEX idx_substitute_availability_date ON substitute_availability(date_available);

CREATE INDEX idx_substitute_assignments_absence_id ON substitute_assignments(absence_id);
CREATE INDEX idx_substitute_assignments_substitute_id ON substitute_assignments(substitute_id);
CREATE INDEX idx_substitute_assignments_status ON substitute_assignments(status);

CREATE INDEX idx_substitute_feedback_teacher_id ON substitute_feedback(teacher_id);
CREATE INDEX idx_substitute_feedback_assignment_id ON substitute_feedback(substitute_assignment_id);

CREATE INDEX idx_inventory_school_id ON inventory(school_id);
CREATE INDEX idx_inventory_category ON inventory(category);

CREATE INDEX idx_inventory_usage_inventory_id ON inventory_usage(inventory_id);
CREATE INDEX idx_inventory_usage_lesson_id ON inventory_usage(lesson_id);
CREATE INDEX idx_inventory_usage_class_id ON inventory_usage(class_id);
