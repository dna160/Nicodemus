-- Add student creation fields to prospective_students
-- Wrapped in a DO block so this is a no-op if the table doesn't exist yet
-- (the columns are included in the CREATE TABLE in 20260401000001_admissions_crm_schema.sql)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'prospective_students'
  ) THEN
    ALTER TABLE prospective_students
      ADD COLUMN IF NOT EXISTS date_of_birth DATE,
      ADD COLUMN IF NOT EXISTS location TEXT,
      ADD COLUMN IF NOT EXISTS student_id TEXT,
      ADD COLUMN IF NOT EXISTS profile_picture_url TEXT,
      ADD COLUMN IF NOT EXISTS curriculum_id UUID REFERENCES lessons(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Unique index on student_id (safe to run after table exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'prospective_students'
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS idx_prospective_students_student_id
      ON prospective_students(student_id)
      WHERE student_id IS NOT NULL;
  END IF;
END $$;

-- Storage bucket for student profile pictures
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'student-profiles',
  'student-profiles',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- RLS: service role full access to bucket
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'service_role_student_profiles'
  ) THEN
    CREATE POLICY "service_role_student_profiles"
      ON storage.objects FOR ALL
      USING (bucket_id = 'student-profiles' AND auth.role() = 'service_role')
      WITH CHECK (bucket_id = 'student-profiles' AND auth.role() = 'service_role');
  END IF;
END $$;

-- RLS: public read of profile pictures
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'public_read_student_profiles'
  ) THEN
    CREATE POLICY "public_read_student_profiles"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'student-profiles');
  END IF;
END $$;
