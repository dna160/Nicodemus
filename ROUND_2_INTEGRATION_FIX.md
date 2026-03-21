# Round 2 Integration Fix: P0 Critical Bug Resolution

## Summary
Fixed critical schema misalignment between the Edge Function's data ingestion and the database migration. The original Round 1 migration was missing 4 columns that the Edge Function attempts to insert.

---

## P0 Critical Bug: Missing Columns

### What Was Missing
The migration `20260321000001_student_metrics_extension.sql` did not include:
1. `device_hash TEXT` — SHA-256 hash linking pre-enrollment sessions
2. `dominant_activity TEXT` — Category of dominant tab activity (productive/distraction/neutral)
3. `summary TEXT` — AI-generated session summary
4. `struggle_events_count INTEGER` — Count of difficulty moments detected
5. **SCHEMA DESIGN ISSUE**: Conflicting `student_id` types (UUID in original table vs TEXT in Edge Function payload)

### Schema Design Resolution
The original `student_metrics` table has:
- `student_id UUID NOT NULL REFERENCES students(id)` — links to enrolled students

The browser extension sends:
- `student_id: "NIC-JD2026-ABCD"` (TEXT format, e.g., student Nicodemus ID)

**Solution Implemented:**
- Added new column `student_nicodemus_id TEXT` to store the extension's text identifier
- Kept original `student_id UUID` FK for enrolled students (populated by separate flow)
- Set `student_id` to NULL in inserts since metrics arrive before account creation
- Documents the two-phase flow: device_hash pre-enrollment → student_nicodemus_id + student_id post-enrollment

---

## Files Updated

### 1. Database Migration
**File:** `supabase/migrations/20260321000001_student_metrics_extension.sql`

**Changes:**
- Added all 4 missing columns to `ALTER TABLE student_metrics`
- Added `student_nicodemus_id TEXT` column with explanatory comment
- Created indexes for all new lookup columns:
  - `idx_student_metrics_device_hash`
  - `idx_student_metrics_student_nicodemus_id` (new)
  - `idx_student_metrics_metric_period_start` (renamed for clarity)
  - `idx_student_metrics_device_time` (composite index for common query pattern)
- Updated rollback section with complete DROP statements

### 2. Edge Function
**File:** `supabase/functions/student-metrics-ingest/index.ts`

**Changes:**

#### Header Documentation [REVISED]
Added schema design note explaining the dual student ID approach:
```typescript
/**
 * SCHEMA DESIGN NOTE:
 * - IngestPayload.student_id: TEXT format from extension (e.g., "NIC-JD2026-ABCD")
 * - Database column student_id: UUID FK to users.id (enrolled students only)
 * - Database column student_nicodemus_id: TEXT from extension payload
 */
```

#### InsertRecord Interface [REVISED]
```typescript
interface InsertRecord {
  device_hash: string;
  school_id: string | null;
  student_id: string | null;                    // UUID FK (null for pre-enrollment)
  student_nicodemus_id: string | null;          // TEXT ID from extension
  metric_period_start: string;
  metric_period_end: string;
  focus_score: number;
  struggle_events_count: number;                // [REVISED] was missing
  avg_idle_seconds: number;
  avg_keystrokes_per_minute: number;
  total_tab_switches: number;
  dominant_activity: string;                    // [REVISED] was missing
  summary: string;                              // [REVISED] was missing
  focus_level: "high" | "normal" | "low";
  fatigue_indicator: "none" | "mild" | "moderate" | "severe";
  recommendations: string[];
}
```

#### Records Mapping [REVISED]
```typescript
const records: InsertRecord[] = payload.metrics.map((metric) => ({
  device_hash: sanitizeString(payload.device_hash, 255),
  school_id: payload.school_id ? sanitizeString(payload.school_id, 255) : null,
  student_id: null, // UUID FK - populated by separate enrollment flow
  student_nicodemus_id: payload.student_id
    ? sanitizeString(payload.student_id, 255)
    : null, // TEXT from extension
  // ... rest of fields
}));
```

---

## Integration Points

### With Front-End Developer
- Extension payload (`sync.ts`) sends `student_id: "NIC-JD2026-ABCD"` (confirmed, no change needed)
- This value maps to `student_nicodemus_id` in the database

### With QA Engineer
- Test fixtures using `"NIC-TEST2026-XXXX"` format will now correctly map to `student_nicodemus_id`
- No breaking changes to test payload structure

### Data Flow Summary
```
Browser Extension
  ├─ device_hash: "abc123..." → student_metrics.device_hash
  └─ student_id: "NIC-JD2026-ABCD" → student_metrics.student_nicodemus_id

Post-Enrollment Sync (future)
  └─ Link student_nicodemus_id to UUID student_id when account created
```

---

## Testing Recommendations

1. **Database Migration**
   - Run migration on staging and verify all 4 new columns exist with correct types
   - Verify indexes are created successfully
   - Test rollback with commented-out DOWN migration

2. **Edge Function Payload Handling**
   - Mock insert with `student_nicodemus_id: "NIC-JD2026-ABCD"` → should succeed
   - Verify `student_id` (UUID FK) remains `null` for pre-enrollment sessions
   - Verify all 4 new columns are populated in insert response

3. **Integration**
   - E2E test: Extension sends metrics → Edge Function → Database → Verify row created with all columns
   - Confirm `dominant_activity`, `summary`, `struggle_events_count` are present in response

---

## P1 Follow-up: Student ID Validation (Low Urgency)
The `validateStudentId()` function currently queries only `prospective_students` table. After account enrollment, this should check the `students` table via join to `users.id`. Currently gracefully returns `true` on all queries, so no blocking issue. Mark as technical debt for future sprint.

---

## Backwards Compatibility
- Original `student_id` UUID FK remains unchanged
- All new columns are optional (`ADD COLUMN IF NOT EXISTS`) for safe re-migration
- Existing metrics without new columns will have NULL values
- No breaking changes to API contract
