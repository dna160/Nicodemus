# Phase 2 Integration: Student Rep → PRM/ERP

**Goal:** Connect Student Rep edge data to PRM (parent notifications) and ERP (teacher HITL) agents
**Stack:** Supabase Edge Functions (Deno) + Modal summarization + Inngest workflows
**Cost Model:** Webhook-driven (zero polling), batched sync (1 call/hour per student)

---

## Architecture

```
┌─ Student Rep Extension (Browser) ─────────────────────────────────┐
│                                                                    │
│  ┌─ Study Session Simulator (NEW)                               │
│  │  - Mock student typing, tab switches, idle time             │
│  │  - Generate realistic ActivityEvent[] + BehaviorMetric[]    │
│  │                                                              │
│  └─ Activity Monitor (existing)                                │
│     - Real activity tracking (or mock in dev)                  │
│     - IndexedDB batch storage (offline support)                │
│                                                                 │
│  Every 1 hour:                                                 │
│  - Encrypt batch of BehaviorMetric[]                           │
│  - POST to Supabase Edge Function                              │
└────────────────────┬──────────────────────────────────────────┘
                     │
                     ↓ POST /api/student-metrics/ingest
        ┌────────────────────────────────────┐
        │ Supabase Edge Function (Deno)     │
        │                                    │
        │ 1. Decrypt payload                 │
        │ 2. Validate schema                 │
        │ 3. Call Modal for summarization   │
        │ 4. Insert to student_metrics      │
        │ 5. Trigger webhook events         │
        └────────────┬───────────────────────┘
                     │
        ┌────────────┴──────────────────────┐
        │ Supabase Webhooks (to Inngest)   │
        └────────────┬──────────────────────┘
                     │
        ┌────────────┴─────────────────────────┐
        │                                      │
        ↓ student:metrics:created              ↓ student:metrics:created
   ┌──────────────────┐                   ┌──────────────────┐
   │ ERP Agent        │                   │ PRM Agent        │
   │ (Inngest)        │                   │ (Inngest)        │
   │                  │                   │                  │
   │ 1. Get teacher   │                   │ 1. Aggregate     │
   │ 2. Create HITL   │                   │    metrics       │
   │ 3. Notify        │                   │ 2. Generate      │
   │    teacher       │                   │    summary       │
   │ 4. Button:       │                   │ 3. Queue parent  │
   │    Send to PRM   │                   │    email         │
   └──────────────────┘                   └──────────────────┘
```

---

## Components to Build

### 1. Study Session Simulator (Extension UI) ✅ Priority 1
**File:** `apps/edge/student-rep/src/simulator/index.tsx`

```
┌─────────────────────────────────┐
│ Student Rep - Study Simulator   │
├─────────────────────────────────┤
│ ⏱ Duration: [15 minutes    ]   │
│ 📊 Focus Type:                  │
│    ○ High Focus (95-100)        │
│    ○ Normal Focus (70-85)       │
│    ○ Struggling (40-60)         │
│ 📌 Activity Mix:                │
│    ☑ Docs (50%)                 │
│    ☑ Coding (30%)               │
│    ☑ Research (20%)             │
│                                 │
│ [▶ Start Simulation]            │
│ [⬇ Download as JSON]            │
│ [📤 Send to Supabase]           │
└─────────────────────────────────┘
```

**Features:**
- Pre-configured scenarios: "High Focus", "Normal Study", "Struggling"
- Generates realistic ActivityEvent[] based on scenario
- Exports JSON for testing
- Direct upload to Supabase or IndexedDB

### 2. Supabase Edge Function (Deno) ✅ Priority 2
**File:** `supabase/functions/student-metrics-ingest/index.ts`

```typescript
// Endpoint: POST /api/student-metrics/ingest
interface IngestPayload {
  device_hash: string;
  encrypted_metrics: string; // base64
  timestamp: number;
}

// Function flow:
// 1. Decrypt payload with server-side key
// 2. Validate BehaviorMetric[] schema
// 3. Call Modal for summarization
// 4. Insert to student_metrics table
// 5. Emit webhook: student:metrics:created
// 6. Return: { success: true, metric_ids: [] }
```

**Responsibilities:**
- Privacy gatekeeper (decrypt + validate)
- Modal orchestrator (call summarize function)
- Database writer (insert sanitized metrics)
- Event emitter (trigger Inngest via webhook)

### 3. Modal Summarization Function ✅ Priority 3
**File:** `modal_app.py` (add new function)

```python
@app.function()
async def summarize_study_session(metrics: dict):
    """
    Input: {
        "avg_idle_seconds": 15,
        "avg_kpm": 45,
        "struggle_events": 2,
        "focus_score": 78,
        "session_duration_minutes": 30
    }

    Output: {
        "summary": "Good focus with minor struggles",
        "focus_level": "high",
        "fatigue_indicator": "mild",
        "recommendations": ["Take a 5-min break", "Try a different subject"]
    }
    """
    # Use Claude to generate pedagogical insight
```

**Lightweight:** ~100ms execution time, ~$0.01 per call

### 4. ERP Agent Integration ✅ Priority 4
**File:** `apps/workflows/src/erp-student-metrics.ts` (new)

```typescript
// Inngest workflow: student:metrics:created

interface StudentMetricsEvent {
  student_id: string;
  study_date: string;
  focus_score: number;
  summary: string;
}

// Workflow steps:
// 1. Get enrollments for student
// 2. Find teacher + curriculum
// 3. Create HITL task:
//    "Review [StudentName]'s study progress (Focus: 78%)"
// 4. HITL waits for teacher action
// 5. On approval: send update to PRM
```

**HITL Integration:**
```
Teacher sees in dashboard:
┌─────────────────────────────────┐
│ 📝 Student Study Review         │
│ Student: John Doe               │
│ Date: 2026-03-18                │
│ Focus Score: 78/100             │
│ Summary: Good focus with minor  │
│ struggles during math session   │
│                                 │
│ [✓ Approve] [Send to Parents]  │
└─────────────────────────────────┘
```

### 5. PRM Agent Integration ✅ Priority 5
**File:** `apps/workflows/src/prm-daily-summary.ts` (new)

```typescript
// Inngest workflow: student:metrics:created (triggered daily at 6pm)

// Daily aggregation:
// - Fetch all student metrics for day
// - Calculate: focus_trend, engagement, struggles
// - Generate 3-5 bullet points for parent email
// - Queue email via Inngest

// Example output:
// "📚 [StudentName]'s Daily Study Summary
//  • Focus Time: 2.5 hours
//  • Peak Focus: 85% (2:00 PM - Math)
//  • Struggle Events: 2 (minor)
//  • Recommendation: Encourage 5-min breaks between subjects"
```

---

## Database Schema Updates

### 1. New Tables

```sql
-- Store summarized student metrics
CREATE TABLE student_metrics (
  id UUID PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES schools(id),
  student_id UUID NOT NULL REFERENCES students(id),
  device_hash TEXT NOT NULL,
  metric_window_start TIMESTAMPTZ,
  metric_window_end TIMESTAMPTZ,
  focus_score INTEGER,           -- 0-100
  struggle_events_count INTEGER,
  avg_idle_seconds REAL,
  dominant_activity TEXT,        -- "docs", "coding", "research"
  summary TEXT,                  -- Claude-generated insight
  focus_level TEXT,              -- "high", "normal", "low"
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Track HITL teacher review
CREATE TABLE student_metrics_reviews (
  id UUID PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES schools(id),
  teacher_id UUID NOT NULL REFERENCES teachers(id),
  student_id UUID NOT NULL REFERENCES students(id),
  metric_id UUID NOT NULL REFERENCES student_metrics(id),
  reviewed_at TIMESTAMPTZ,
  notes TEXT,
  sent_to_parents BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2. RLS Policies

```sql
-- Teachers can only see their students' metrics
CREATE POLICY "teachers_read_students_metrics" ON student_metrics
  FOR SELECT
  USING (
    student_id IN (
      SELECT DISTINCT student_id FROM enrollments
      WHERE class_id IN (SELECT id FROM classes WHERE teacher_id = auth.uid())
    )
  );

-- Students can see their own metrics
CREATE POLICY "students_read_own_metrics" ON student_metrics
  FOR SELECT
  USING (student_id = auth.uid());
```

### 3. Webhooks (Supabase Dashboard)

```
Event: INSERT on student_metrics
Target: https://inngest.com/events
Headers: { "Authorization": "Bearer YOUR_KEY" }
Body: {
  "name": "student/metrics/created",
  "data": "record"
}
```

---

## Implementation Sequence

### Phase 1: Simulator + Edge Function (Day 1)
- [ ] Build study session simulator UI
- [ ] Create Supabase Edge Function skeleton
- [ ] Test local deployment

### Phase 2: Modal Integration (Day 2)
- [ ] Write Modal summarization function
- [ ] Test Edge Function → Modal → DB flow
- [ ] Verify data sanitization

### Phase 3: ERP Integration (Day 3)
- [ ] Add ERP workflow for HITL review
- [ ] Build teacher HITL UI in dashboard
- [ ] Test teacher approval flow

### Phase 4: PRM Integration (Day 4)
- [ ] Add PRM workflow for daily summaries
- [ ] Test daily digest generation
- [ ] Verify parent notification queue

### Phase 5: End-to-End Testing (Day 5)
- [ ] Simulator → Edge Function → Modal → ERP/PRM
- [ ] Verify webhooks fire correctly
- [ ] Load test (multiple students)

---

## Cost Breakdown (Monthly)

| Component | Cost | Notes |
|-----------|------|-------|
| Supabase (new tables + webhooks) | $25-50 | Included in existing bill |
| Modal (summarization) | $0.01 per call × 30 students × 30 days = $9 | Very cheap |
| Inngest (workflows) | $0 | Free tier covers this |
| **Total Incremental** | **~$10/month** | Very efficient |

**Compare to polling:** If we polled every hour instead of webhook, cost would be 10x higher.

---

## Testing Strategy

### Manual Testing (Local)
1. Open study simulator
2. Run 15-min "High Focus" scenario
3. Download JSON
4. POST to Edge Function (local testing)
5. Verify student_metrics table gets updated
6. Check Inngest dashboard for workflow triggers
7. View HITL review in teacher dashboard
8. Click "Send to Parents"
9. Verify PRM generates daily summary

### Automated Testing
```bash
# Test Edge Function
curl -X POST http://localhost:54321/api/student-metrics/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "device_hash": "test-hash",
    "encrypted_metrics": "...",
    "timestamp": 1710768000
  }'

# Check Inngest events
inngest event list --filter "name=student/metrics/created"

# Verify metrics in DB
select * from student_metrics where created_at > now() - interval 1 hour;
```

---

## Next Steps

1. ✅ Confirm architecture (done)
2. ⏳ Build study session simulator
3. ⏳ Create Supabase Edge Function
4. ⏳ Write Modal summarization function
5. ⏳ Update ERP agent workflow
6. ⏳ Update PRM agent workflow
7. ⏳ End-to-end testing

**Ready to start Phase 1?** 🚀
