-- Add grading_system column to lessons table
-- Supports 5 grading frameworks: local_alphabetical, local_integer, national_ccss, state_standards, international_ib

ALTER TABLE lessons
ADD COLUMN grading_system TEXT DEFAULT 'local_alphabetical'
CHECK (grading_system IN ('local_alphabetical', 'local_integer', 'national_ccss', 'state_standards', 'international_ib'));
