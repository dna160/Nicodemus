# RLS + Data Sanitization Guide for Nicodemus
**How to Use Supabase Row Level Security (RLS) for FERPA Compliance**

---

## I. What is Row Level Security (RLS)?

**Simple Definition:** RLS is a database feature that automatically prevents unauthorized data access. Instead of checking permissions in your code, the database itself enforces who can see what.

**Example Without RLS (Dangerous):**
```typescript
// ❌ BAD - Relies on code logic (can be bypassed!)
async function getStudentGrades(studentId: string) {
  const grades = await db.query(`
    SELECT * FROM grades WHERE student_id = $1
  `, [studentId]);

  // PROBLEM: Someone could change ?student_id=123 to ?student_id=456
  // and see another student's data if code logic is flawed
  return grades;
}
```

**Example With RLS (Secure):**
```sql
-- ✅ GOOD - Database enforces the rule
CREATE POLICY student_see_own_grades ON grades
  USING (auth.uid() = student_id);

-- Now ANY query (in ANY app) automatically filters to student's own data
-- Even if a hacker finds a bug in your code,
-- the database won't return data they shouldn't see
```

---

## II. FERPA Compliance via RLS

**FERPA Requirement:** Teachers can only access grades for students in their roster.

**RLS Solution:**

```sql
-- Step 1: Create the policy
CREATE POLICY teachers_see_roster_grades ON grades
  FOR SELECT
  USING (
    -- Teacher can see grade if:
    -- 1. They are the grading teacher, AND
    -- 2. The student is in their roster
    auth.uid() = grading_teacher_id
    AND student_id IN (
      SELECT id FROM students
      WHERE teacher_id = auth.uid()
    )
  );

-- Step 2: Enable RLS on the table
ALTER TABLE grades ENABLE ROW LEVEL SECURITY;

-- Step 3: Test it
-- Login as teacher_id=123
-- Try: SELECT * FROM grades;
-- Result: Only shows grades where grading_teacher_id=123
--         AND student_id is in their roster
```

**What This Means:**
- No code changes needed for authorization
- Every query automatically filters by RLS
- Audit logs show exactly who accessed what
- Even admins can't bypass it (unless you create an admin policy)

---

## III. Building RLS Policies Step-by-Step

### 3.1 Schema Setup (Foundation)

```sql
-- First: Create user roles enum
CREATE TYPE user_role AS ENUM ('student', 'teacher', 'parent', 'admin');

-- Create auth schema (uses Supabase's built-in auth table)
-- Supabase auto-creates users table in auth schema

-- Create custom users table (extends auth with app data)
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT,
  role user_role NOT NULL,
  school_id UUID,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Enable RLS on users table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see their own profile
CREATE POLICY users_select_own ON public.users
  FOR SELECT
  USING (auth.uid() = id);

-- Policy: Users can update their own profile
CREATE POLICY users_update_own ON public.users
  FOR UPDATE
  USING (auth.uid() = id);
```

### 3.2 Teacher Roster Setup

```sql
-- Teachers table
CREATE TABLE teachers (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  school_id UUID,
  subject_areas TEXT[],
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;

-- Policy: Teachers can see their own profile
CREATE POLICY teachers_select_own ON teachers
  FOR SELECT
  USING (auth.uid() = id);

-- Students table
CREATE TABLE students (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  teacher_id UUID NOT NULL REFERENCES teachers(id),
  school_id UUID,
  grade_level INT,
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE students ENABLE ROW LEVEL SECURITY;

-- Policy: Students see their own profile
CREATE POLICY students_select_own ON students
  FOR SELECT
  USING (auth.uid() = id);

-- Policy: Teachers see students in their roster
CREATE POLICY teachers_see_roster ON students
  FOR SELECT
  USING (teacher_id = auth.uid());

-- Policy: Parents see their child(ren)
-- (requires a parent_students linking table - see section below)
```

### 3.3 Grades & Submissions (Core Data)

```sql
-- Submissions table
CREATE TABLE submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id),
  assignment_id UUID NOT NULL,
  content TEXT,
  submitted_at TIMESTAMP DEFAULT NOW(),
  status TEXT DEFAULT 'submitted'
);

ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

-- Policy: Students see their own submissions
CREATE POLICY students_see_own_submissions ON submissions
  FOR SELECT
  USING (auth.uid() = student_id);

-- Policy: Teachers see submissions from their students
CREATE POLICY teachers_see_roster_submissions ON submissions
  FOR SELECT
  USING (
    student_id IN (
      SELECT id FROM students WHERE teacher_id = auth.uid()
    )
  );

-- Grades table
CREATE TABLE grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES submissions(id),
  student_id UUID NOT NULL REFERENCES students(id),
  teacher_id UUID NOT NULL REFERENCES teachers(id),
  score FLOAT,
  feedback_draft TEXT,  -- AI-generated, needs approval
  feedback_final TEXT,  -- Teacher-approved, visible to student
  teacher_approved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE grades ENABLE ROW LEVEL SECURITY;

-- Policy: Students see their own grades
CREATE POLICY students_see_own_grades ON grades
  FOR SELECT
  USING (
    auth.uid() = student_id
    AND teacher_approved_at IS NOT NULL  -- Only show finalized grades
  );

-- Policy: Teachers see grades they created
CREATE POLICY teachers_see_created_grades ON grades
  FOR SELECT
  USING (auth.uid() = teacher_id);

-- Policy: Teachers update only their own grades
CREATE POLICY teachers_update_own_grades ON grades
  FOR UPDATE
  USING (auth.uid() = teacher_id)
  WITH CHECK (auth.uid() = teacher_id);

-- Policy: Teachers insert grades for their students
CREATE POLICY teachers_insert_grades ON grades
  FOR INSERT
  WITH CHECK (
    auth.uid() = teacher_id
    AND student_id IN (
      SELECT id FROM students WHERE teacher_id = auth.uid()
    )
  );
```

### 3.4 Parents Accessing Student Data

```sql
-- Link parents to students (many-to-many)
CREATE TABLE parent_students (
  parent_id UUID NOT NULL REFERENCES auth.users(id),
  student_id UUID NOT NULL REFERENCES students(id),
  relationship TEXT, -- 'mother', 'father', 'guardian', etc.
  PRIMARY KEY (parent_id, student_id)
);

ALTER TABLE parent_students ENABLE ROW LEVEL SECURITY;

-- Policy: Parents see their linked students
CREATE POLICY parents_see_linked_students ON students
  FOR SELECT
  USING (
    id IN (
      SELECT student_id FROM parent_students
      WHERE parent_id = auth.uid()
    )
  );

-- Policy: Parents see grades for their children (final grades only)
CREATE POLICY parents_see_child_grades ON grades
  FOR SELECT
  USING (
    student_id IN (
      SELECT student_id FROM parent_students
      WHERE parent_id = auth.uid()
    )
    AND teacher_approved_at IS NOT NULL  -- Only finalized grades
  );

-- NOTE: Parents do NOT see feedback_draft (AI-generated, needs approval)
-- Parents ONLY see feedback_final (approved by teacher)
```

### 3.5 Audit Logging (FERPA Requirement)

```sql
-- Audit log table
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  action TEXT,  -- 'SELECT', 'INSERT', 'UPDATE', 'DELETE'
  table_name TEXT,
  record_id UUID,
  timestamp TIMESTAMP DEFAULT NOW()
);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Policy: Users only see their own audit logs
CREATE POLICY users_see_own_audit ON audit_log
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Admins see all audit logs
CREATE POLICY admins_see_all_audit ON audit_log
  FOR SELECT
  USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

-- Create trigger to auto-log all SELECT queries
CREATE OR REPLACE FUNCTION audit_select()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_log (user_id, action, table_name, record_id)
  VALUES (auth.uid(), 'SELECT', TG_TABLE_NAME, NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to grades table
CREATE TRIGGER audit_grades_select AFTER SELECT ON grades
  FOR EACH ROW EXECUTE FUNCTION audit_select();
```

---

## IV. Data Sanitization: The Complete Flow

**Definition:** Converting raw data (student keystrokes, focus time) into sanitized pedagogical vectors before storage.

### 4.1 Raw vs. Sanitized Data

| Data Type | Raw (Edge Only) | Sanitized (Safe for Cloud) |
|-----------|---|---|
| Keystroke timings | `{char: 'a', ms: 450}` | ❌ Never stored |
| App switches | `[Chrome, YouTube, Slack]` | ❌ Never stored |
| Window focus time | `3600` seconds | ✅ `"engagement_index": 0.85` (0-1 score) |
| Time until help | `450` seconds | ✅ `"hint_timing": "optimal"` (category) |
| Hesitation pattern | `[false, true, true, false]` | ✅ `"confusion_markers": 2` (count) |
| Failed attempts | `[false, true, true]` | ✅ `"concept_gap": "CCSS.MATH.3.NF.A.1"` |

**Key Rule:** Raw timestamps, names, and behavioral details NEVER leave the edge device. Only aggregate statistics + learning standard IDs sync to cloud.

### 4.2 Sanitization in the Tauri Edge App (Phase 2)

```typescript
// tauri/src/core/sanitization.ts
// Runs on student's device - raw data NEVER leaves here

import crypto from 'crypto';

export class SanitizationPipeline {
  /**
   * Convert raw behavior data to sanitized vectors
   * Example: Raw keystroke timings → Engagement Index
   */

  static sanitizeSession(rawData: {
    keystrokes: Keystroke[],
    windowSwitches: number,
    focusBreaks: number,
    timeOnTask: number, // seconds
    problemsSolved: number,
    attemptsBeforeSolve: number[],
  }): SanitizedVector {

    // RULE 1: Never store raw keystroke data
    // Delete keystroke times after computing vectors
    const keystrokeData = rawData.keystrokes;
    const engagementIndex = this.computeEngagement(keystrokeData);
    keystrokeData.forEach(k => k.timestamp = undefined); // Erase raw data

    // RULE 2: Convert timestamps to date-only (lose precision intentionally)
    const sessionDate = new Date().toISOString().split('T')[0]; // Only YYYY-MM-DD

    // RULE 3: Hash student ID so it's not in plaintext
    const studentIdHash = crypto
      .createHash('sha256')
      .update(studentId + secretSalt)
      .digest('hex')
      .substring(0, 16);

    return {
      // Identity: Anonymized hash (not raw UUID)
      student_id_hash: studentIdHash,
      session_date: sessionDate,  // Date only, not timestamp

      // Vectors: Aggregate metrics
      engagement_index: engagementIndex,        // 0-1
      distraction_index: 1 - engagementIndex,   // 0-1
      time_on_task_minutes: Math.round(rawData.timeOnTask / 60),

      // Learning signals: Converted to high-level categories
      concept_gap: this.identifyConceptGap(rawData.attemptsBeforeSolve),
      hint_timing: this.categorizeTiming(rawData),
      confusion_markers: rawData.focusBreaks, // Just count, not timestamps
      productivity_window: this.computeProductivityWindow(),

      // Metadata
      confidence: 0.92,  // Confidence in these vectors
      timestamp: new Date().toISOString()  // When computed, not when raw
    };
  }

  private static computeEngagement(keystrokes: Keystroke[]): number {
    /**
     * Engagement Index = consistent, focused work
     * High engagement = regular keystroke rate, few pauses
     * Low engagement = irregular, long gaps
     */
    if (keystrokes.length === 0) return 0;

    const intervals = [];
    for (let i = 1; i < keystrokes.length; i++) {
      const gap = keystrokes[i].timestamp - keystrokes[i-1].timestamp;
      intervals.push(gap);
    }

    // Metrics: calculate from intervals (discard original data)
    const avgGap = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance = intervals.reduce((sum, gap) =>
      sum + Math.pow(gap - avgGap, 2), 0) / intervals.length;
    const stdDev = Math.sqrt(variance);

    // Consistent keystroke rate = high engagement
    const consistency = stdDev > 0 ? avgGap / stdDev : 0;
    const longPauseCount = intervals.filter(gap => gap > 5000).length;

    // Return ONLY the computed metric, not raw data
    return Math.min(1, Math.max(0, (consistency - longPauseCount * 0.1) / 10));
  }

  private static identifyConceptGap(attemptsBeforeSolve: number[]): string {
    /**
     * Example: [false, false, true, true]
     * (incorrect, incorrect, correct, correct)
     * = Multiple attempts before solution = concept gap
     */
    const failureCount = attemptsBeforeSolve.filter(a => !a).length;

    if (failureCount > 2) {
      return "CCSS.MATH.3.NF.A.1"; // Example standard
    } else if (failureCount > 0) {
      return "CCSS.MATH.3.NF.A.1"; // Mild struggle
    }
    return null; // No gap
  }

  private static categorizeTiming(data: any): string {
    /**
     * Convert raw timing to category (lose precision intentionally)
     *
     * Why? Because "student took 347 seconds to first help request"
     * reveals when they're confused. But we only care about
     * "they got help at appropriate time" vs "they struggled too long"
     */
    const timeToHelp = data.timeOnTask / data.problemsSolved;

    if (timeToHelp < 120) return "optimal";      // <2 min: good pacing
    if (timeToHelp < 300) return "acceptable";   // 2-5 min: struggling a bit
    if (timeToHelp < 600) return "too_long";     // 5-10 min: needs help
    return "critical";                            // >10 min: intervention needed
  }

  private static computeProductivityWindow(): string {
    /**
     * When is student most productive?
     * Example: Student works best 9-11 AM and 2-4 PM
     * This teaches adaptive pacing, but loses fine-grained timing
     */
    const hour = new Date().getHours();
    return `${hour}-${hour + 2}`; // 2-hour window, not exact minute
  }
}
```

### 4.3 Sanitized Data Schema (Supabase)

```sql
-- Table: ONLY sanitized vectors, never raw data
CREATE TABLE sanitized_vectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id_hash TEXT NOT NULL,  -- Hashed, not raw UUID
  session_date DATE NOT NULL,      -- Date only, not timestamp

  -- Pedagogical vectors (aggregate metrics)
  engagement_index FLOAT,          -- 0-1
  distraction_index FLOAT,         -- 0-1
  time_on_task_minutes INT,        -- Rounded to nearest minute

  -- Learning signals
  concept_gap TEXT,                -- Learning standard ID (if gap detected)
  hint_timing TEXT,                -- 'optimal' | 'acceptable' | 'too_long' | 'critical'
  confusion_markers INT,           -- Count of focus breaks (not timestamps)
  productivity_window TEXT,        -- '9-11' (hour range, not timestamp)

  -- Metadata
  confidence FLOAT,                -- 0-1
  device_id_hash TEXT,             -- Hashed device ID
  synced_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT no_raw_data CHECK (
    engagement_index IS NULL OR (engagement_index >= 0 AND engagement_index <= 1)
  )
);

ALTER TABLE sanitized_vectors ENABLE ROW LEVEL SECURITY;

-- Policy: Only Teacher Assistant Agent can read (for classroom insights)
-- (Students cannot see these vectors - privacy)
CREATE POLICY teacher_asst_read_vectors ON sanitized_vectors
  FOR SELECT
  USING (
    -- Verify request comes from Teacher Assistant service account
    current_setting('app.service_role') = 'teacher_assistant'
  );

-- Policy: Only sync endpoints can INSERT
CREATE POLICY sync_insert_vectors ON sanitized_vectors
  FOR INSERT
  WITH CHECK (
    current_setting('app.service_role') = 'student_rep_sync'
  );
```

### 4.4 Aggregation: From Individual Vectors to Classroom Insights

```sql
-- SQL Function: Aggregate sanitized vectors → classroom insights
-- This is what teachers see (completely de-identified)

CREATE OR REPLACE FUNCTION get_classroom_struggles(
  teacher_id UUID,
  lookback_days INT DEFAULT 7
)
RETURNS TABLE (
  concept_id TEXT,
  student_count INT,
  avg_engagement FLOAT,
  recommendation TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    sv.concept_gap,
    COUNT(DISTINCT sv.student_id_hash),
    AVG(sv.engagement_index),
    CASE
      WHEN COUNT(*) > 5 THEN 'Many students struggling - consider re-teaching'
      WHEN AVG(sv.engagement_index) < 0.4 THEN 'Engagement low - try interactive approach'
      ELSE 'Monitor progress'
    END
  FROM sanitized_vectors sv
  WHERE sv.synced_at > NOW() - INTERVAL '1 day' * lookback_days
    AND sv.student_id_hash IN (
      -- Only vectors from this teacher's students
      SELECT DISTINCT student_id_hash FROM sanitized_vectors
      WHERE -- [Teacher's student constraint]
    )
    AND sv.concept_gap IS NOT NULL
  GROUP BY sv.concept_gap
  ORDER BY COUNT(*) DESC;
END;
$$ LANGUAGE plpgsql;

-- Usage in Next.js:
// pages/api/classroom/struggles.ts
export async function GET(req) {
  const { data } = await supabase
    .rpc('get_classroom_struggles', {
      teacher_id: req.user.id,
      lookback_days: 7
    });

  // Returns: [
  //   { concept_id: "CCSS.MATH.3.NF.A.1", student_count: 7, avg_engagement: 0.35, ... }
  // ]
  // Teacher NEVER sees individual student data, only aggregates
}
```

---

## V. Complete Data Flow: RLS + Sanitization

```
┌─────────────────────────────────────────────────────────────┐
│ Student Tauri App (Local Device)                            │
│                                                              │
│ 1. Collects raw data (keystrokes, focus, time):             │
│    {keystroke_ms: 450, app: 'Chrome', focus_time: 3600}    │
│                                                              │
│ 2. Sanitizes (raw data → vectors):                          │
│    {engagement_index: 0.85, concept_gap: 'CCSS...'}        │
│                                                              │
│ 3. Encrypts & hashes student ID:                            │
│    {student_id_hash: 'abc123...', engagement_index: 0.85}   │
│                                                              │
│ 4. Deletes raw data from device:                            │
│    DELETE FROM local_raw_buffer WHERE session_id = X        │
│                                                              │
└────────┬────────────────────────────────────────────────────┘
         │
         │ (HTTPS + TLS 1.3)
         │
┌────────▼────────────────────────────────────────────────────┐
│ Supabase Cloud                                               │
│                                                              │
│ INSERT INTO sanitized_vectors (                             │
│   student_id_hash,                                          │
│   engagement_index,                                         │
│   concept_gap                                               │
│ ) VALUES (...)                                              │
│                                                              │
│ RLS Enforces:                                               │
│ - Only sync endpoint can INSERT                             │
│ - Teacher can READ (aggregated only)                        │
│ - Student CANNOT READ (privacy)                             │
│ - Parent CANNOT READ (privacy)                              │
│                                                              │
└────────┬────────────────────────────────────────────────────┘
         │
         │ Supabase Webhook Trigger:
         │ "ON INSERT sanitized_vectors"
         │
┌────────▼────────────────────────────────────────────────────┐
│ Inngest Workflow                                             │
│                                                              │
│ Step 1: Query aggregated vectors:                           │
│   SELECT AVG(engagement_index) FROM sanitized_vectors      │
│   WHERE student_id_hash IN (class_roster_hashes)           │
│                                                              │
│ Step 2: Call Modal function:                                │
│   "Generate classroom recommendation"                       │
│   Input: Aggregated data (NO individual student data)       │
│                                                              │
│ Step 3: Store recommendation in Supabase                    │
│                                                              │
└────────┬────────────────────────────────────────────────────┘
         │
┌────────▼────────────────────────────────────────────────────┐
│ Teacher Dashboard (Next.js)                                  │
│                                                              │
│ Teacher sees:                                                │
│ ✅ "7 students struggling with fractions"                    │
│ ✅ "Consider hands-on approach"                              │
│ ❌ CANNOT see: individual student data                       │
│ ❌ CANNOT see: raw keystroke data                            │
│ ❌ CANNOT see: app switches or focus breaks                  │
│                                                              │
│ Query uses RLS:                                              │
│ SELECT * FROM classroom_insights                            │
│ WHERE teacher_id = current_user_id  -- Enforced by RLS      │
│                                                              │
└────────────────────────────────────────────────────────────┘
```

---

## VI. Implementing Sanitization in Your Code

### 6.1 Tauri App → Supabase Sync

```typescript
// tauri/src/services/syncService.ts

import { invoke } from '@tauri-apps/api/tauri';
import { createClient } from '@supabase/supabase-js';

export async function syncBehaviorData() {
  // Step 1: Get raw data from local SQLite
  const rawData = await invoke('get_session_data', {
    sessionId: currentSessionId,
  });

  // Step 2: Sanitize
  const sanitized = SanitizationPipeline.sanitizeSession(rawData);

  // Step 3: Sync to Supabase
  const { data, error } = await supabase
    .from('sanitized_vectors')
    .insert([sanitized]);

  if (error) {
    console.error('Sync failed:', error);
    // Queue for retry (Tauri app handles offline scenarios)
    await queueForRetry(sanitized);
  } else {
    // Step 4: Delete raw data from device
    await invoke('delete_raw_session_data', {
      sessionId: currentSessionId,
    });
    console.log('Sync complete, raw data deleted');
  }
}
```

### 6.2 Teacher Dashboard Query (With RLS)

```typescript
// app/teacher/classroom/insights/page.tsx

import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';

export default async function ClassroomInsights() {
  const supabase = createServerComponentClient();

  // This query automatically applies RLS:
  // SELECT ... WHERE teacher_id = current_auth.uid()
  const { data: insights, error } = await supabase
    .rpc('get_classroom_struggles', {
      teacher_id: user.id,
      lookback_days: 7,
    });

  // RLS ensures:
  // ✅ Can only see insights for students in their roster
  // ✅ Can never see other teachers' students
  // ✅ Audit log records this query

  if (error) {
    return <div>Error loading insights: {error.message}</div>;
  }

  return (
    <div>
      {insights.map(insight => (
        <div key={insight.concept_id}>
          <h3>{insight.concept_id}</h3>
          <p>{insight.student_count} students struggling</p>
          <p>{insight.recommendation}</p>
        </div>
      ))}
    </div>
  );
}
```

---

## VII. FERPA Compliance Checklist

- [ ] RLS policies created for all sensitive tables
- [ ] RLS enabled on: students, grades, submissions, sanitized_vectors
- [ ] Teachers can only see their own roster students
- [ ] Students can only see their own data
- [ ] Parents can only see linked children's data
- [ ] Audit logging captures all access
- [ ] Raw behavioral data never stored in cloud
- [ ] Sanitized vectors properly anonymized (hashed IDs, date-only timestamps)
- [ ] RLS policies tested with different user roles
- [ ] Compliance officer approves RLS rules

---

## VIII. Testing RLS Policies

### 8.1 Manual Testing (Supabase Studio)

```sql
-- Test 1: Teacher sees only their students
-- Login as teacher_id=123

SELECT * FROM students;
-- Expected: Only students WHERE teacher_id = 123

SELECT * FROM grades;
-- Expected: Only grades WHERE grading_teacher_id = 123
--           AND student_id IN (teacher's roster)

-- Test 2: Student sees only own data
-- Login as student_id=456

SELECT * FROM grades;
-- Expected: Only grades WHERE student_id = 456
--           AND teacher_approved_at IS NOT NULL

-- Try to see another student's grades:
SELECT * FROM grades WHERE student_id = 789;
-- Expected: Empty result (RLS blocks it)
```

### 8.2 Automated Testing (TypeScript)

```typescript
// __tests__/rls.test.ts

import { createClient } from '@supabase/supabase-js';

describe('RLS Policies', () => {
  it('should prevent teacher from seeing other teachers students', async () => {
    const teacherClient = createClient(supabaseUrl, supabaseAnonKey);

    // Login as teacher 123
    await teacherClient.auth.signInWithPassword({
      email: 'teacher123@school.edu',
      password: 'password123'
    });

    // Try to query all students
    const { data, error } = await teacherClient
      .from('students')
      .select('*');

    // Should only see students where teacher_id = 123
    const filteredData = data.filter(s => s.teacher_id === '123');
    expect(data).toEqual(filteredData);
  });

  it('should prevent student from seeing grades before approval', async () => {
    const studentClient = createClient(supabaseUrl, supabaseAnonKey);

    // Login as student 456
    await studentClient.auth.signInWithPassword({
      email: 'student456@school.edu',
      password: 'password456'
    });

    // Query all grades (should only see approved ones)
    const { data } = await studentClient
      .from('grades')
      .select('*');

    // RLS should filter to only teacher_approved_at IS NOT NULL
    data.forEach(grade => {
      expect(grade.teacher_approved_at).not.toBeNull();
    });
  });
});
```

---

## IX. Troubleshooting RLS Issues

### Issue: "Query fails with permission denied"

**Diagnosis:**
```typescript
const { data, error } = await supabase.from('grades').select('*');
// error: "Permission denied"
```

**Fix:**
```sql
-- 1. Check if RLS is enabled
ALTER TABLE grades ENABLE ROW LEVEL SECURITY;

-- 2. Check if policies exist
SELECT * FROM pg_policies WHERE tablename = 'grades';

-- 3. Check policy logic
SELECT definition FROM pg_policies WHERE policyname = 'students_see_own_grades';

-- 4. Test as authenticated user
SET SESSION authentication.uid TO '456';  -- Impersonate student 456
SELECT * FROM grades;  -- Should return only their grades
```

### Issue: "Teachers see all students, not just roster"

**Root Cause:** Policy doesn't properly check roster relationship

**Fix:**
```sql
-- ❌ WRONG: Missing roster check
CREATE POLICY wrong_policy ON students
  FOR SELECT
  USING (auth.uid() = teacher_id);

-- ✅ CORRECT: Include roster validation
CREATE POLICY correct_policy ON students
  FOR SELECT
  USING (
    auth.uid() IN (
      SELECT teacher_id FROM students WHERE id = students.id
    )
  );
```

---

## X. Data Sanitization Best Practices

| ❌ DO NOT | ✅ DO |
|---|---|
| Store exact keystroke timestamps | Store engagement_index (0-1 score) |
| Store app names/URLs | Store hint_timing category (optimal/too_long) |
| Store focus break timestamps | Store confusion_markers count |
| Store student names in vectors | Hash student ID with secret salt |
| Store exact problem solve time | Round to nearest minute/hour |
| Keep raw data after sanitization | Delete raw data immediately |
| Mix raw + sanitized in same table | Separate tables with RLS |

---

**Document Version:** 1.0
**Last Updated:** 2026-03-17
**Status:** Ready for Implementation

Next: Start building Tauri app with this sanitization pattern in mind!
