-- Add student creation fields to prospective_students
ALTER TABLE prospective_students
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS student_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS profile_picture_url TEXT,
  ADD COLUMN IF NOT EXISTS curriculum_id UUID REFERENCES lessons(id) ON DELETE SET NULL;

-- Create index on student_id for fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_prospective_students_student_id
  ON prospective_students(student_id)
  WHERE student_id IS NOT NULL;

-- Create Supabase Storage bucket for student profile pictures
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'student-profiles',
  'student-profiles',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- RLS policy: allow service role full access to bucket
CREATE POLICY IF NOT EXISTS "service_role_student_profiles"
  ON storage.objects
  FOR ALL
  USING (bucket_id = 'student-profiles' AND auth.role() = 'service_role')
  WITH CHECK (bucket_id = 'student-profiles' AND auth.role() = 'service_role');

-- RLS policy: allow public read of profile pictures
CREATE POLICY IF NOT EXISTS "public_read_student_profiles"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'student-profiles');
