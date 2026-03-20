# Developer Testing Guide: Student Behavior Simulator

**Location:** `/dashboard/dev/simulate-student`
**Status:** Development testing tool (visible in dev mode only)

---

## Quick Start

1. **Navigate to Dev Hub**
   - Go to Dashboard → Dev Section (bottom of sidebar)
   - Or direct URL: `/dashboard/dev/simulate-student`

2. **Create Test Data**
   - Select "Create Mock Student"
   - Give it a name (e.g., "Test Student #1")

3. **Configure Simulation**
   - Choose scenario (High Focus, Normal, Struggling, Distracted)
   - Adjust duration (default 15 min)
   - Set activity mix (default: 35% docs, 35% coding, 20% research, 10% other)

4. **Generate & Submit**
   - Click "Generate Simulation"
   - Review the metrics
   - Click "Submit to Pipeline"

5. **Check Results**
   - View submission response
   - Click "Check Workflow Status" to track ERP/PRM triggers

---

## Understanding the Scenarios

### High Focus
**What it simulates:** Student with excellent concentration
- Avg idle time: 5-15 seconds
- Keystrokes: 50-80 per minute
- Tab switches: 0-2
- Focus score: 85-100
- **Use case:** Test when everything works smoothly

### Normal Study
**What it simulates:** Typical student study session
- Avg idle time: 15-30 seconds
- Keystrokes: 35-60 per minute
- Tab switches: 1-4
- Focus score: 70-85
- **Use case:** Most common scenario; test baseline workflows

### Struggling
**What it simulates:** Student having difficulty
- Avg idle time: 40-70 seconds
- Keystrokes: 10-30 per minute
- Tab switches: 3-8
- Focus score: 40-60
- Struggle events: 2-5
- **Use case:** Test recommendations and intervention workflows

### Distracted
**What it simulates:** Student jumping between tasks
- Avg idle time: 30-70 seconds
- Keystrokes: 15-40 per minute
- Tab switches: 5-15 (frequent)
- Focus score: 30-50
- **Use case:** Test high-distraction scenarios

---

## Testing Workflows

### Test 1: Metrics Flow (5 minutes)
**Goal:** Verify data reaches student_metrics table

```
1. Select "Normal Study" scenario
2. Set duration to 5 minutes
3. Click "Generate Simulation"
4. Review metrics (should show focus_score ~70-85)
5. Click "Submit to Pipeline"
6. Check response (should show metric_ids)
7. Database check:
   SELECT * FROM student_metrics
   WHERE created_at > now() - interval 1 minute;
```

**Expected result:** Metrics appear in table within 5 seconds

---

### Test 2: ERP Workflow (HITL) (10 minutes)
**Goal:** Verify teacher review task is created

```
1. Generate "Struggling" scenario (15 minutes)
2. Submit to pipeline
3. Check workflow status (click button)
4. Look for:
   - erp_status: "ACTIVE"
   - hitl_task: Created with status "pending"
5. Go to database:
   SELECT * FROM teacher_review_tasks
   WHERE metric_id = '<your-metric-id>';
6. Check dashboard for teacher HITL notification
```

**Expected result:**
- HITL task created within 5 seconds
- Teacher sees notification
- Task status is "pending"

---

### Test 3: PRM Workflow (Parent Digest) (10 minutes)
**Goal:** Verify parent email is queued

```
1. Generate "Normal Study" scenario
2. Submit to pipeline
3. Assume teacher approved (simulate approval)
   UPDATE teacher_review_tasks
   SET status = 'approved', approved_at = now()
   WHERE id = '<task-id>';
4. Check workflow status
5. Look for:
   - prm_status: "QUEUED"
   - emails_queued: > 0
6. Database check:
   SELECT * FROM communications_log
   WHERE type = 'study_summary'
   AND created_at > now() - interval 5 minutes;
```

**Expected result:**
- Email queued within 10 seconds
- Subject: "📚 [Student]'s Daily Study Summary"
- Body contains focus time, recommendations

---

### Test 4: Edge Cases
Test error conditions:

**Test 4a: Invalid Input**
```
POST /api/dev/submit-student-metrics
Body: { invalid: "data" }

Expected: 400 error "Invalid payload structure"
```

**Test 4b: Missing Metrics**
```
POST /api/dev/submit-student-metrics
Body: {
  device_hash: "test",
  metrics: [],
  timestamp: 1234567890
}

Expected: Still processes (0 metrics submitted)
```

**Test 4c: High Volume**
```
1. Submit 10 simulations in quick succession
2. Check all appear in database
3. Verify no duplicates

Expected: All metrics stored correctly
```

---

## Interpreting Results

### Simulation Results

| Field | Meaning | Range |
|-------|---------|-------|
| **Focus Score** | Overall focus quality | 0-100 |
| **Avg Idle** | Average time between interactions | Seconds |
| **Keystrokes** | Typing rate | KPM (0-100+) |
| **Struggles** | Count of difficult moments | 0-10+ |
| **Tab Switches** | How many times student switched apps | 0-30+ |
| **Activity** | Primary task | docs, coding, research, other |

### Response Metrics

| Status | Meaning |
|--------|---------|
| **Success** | Data submitted, workflows triggered |
| **Metric IDs** | Unique IDs in database (for tracking) |
| **Response Time** | How long submission took (ms) |

### Workflow Status

| Component | Status Meaning |
|-----------|----------------|
| **ERP: ACTIVE** | Teacher review task created |
| **ERP: NOT_TRIGGERED** | Student not enrolled (expected for mock data) |
| **PRM: QUEUED** | Parent email queued for sending |
| **PRM: PENDING** | Waiting for teacher approval |

---

## Debugging Tips

### "Metric not found" error
- **Cause:** Supabase Edge Function failed
- **Fix:** Check Edge Function logs in Supabase Dashboard
- **Verify:** `SELECT * FROM student_metrics` (should be empty)

### "ERP task not created"
- **Cause:** Student not enrolled in any class
- **Expected:** Mock data won't create HITL tasks
- **Fix:** Use a real student_id or seed test data first

### "No PRM email queued"
- **Cause:** Teacher hasn't approved yet
- **Expected:** Only appears after HITL approval
- **Fix:** Manually approve the HITL task in database

### Slow response times
- **Expected:** First run: 1-2 seconds (cold start)
- **Expected:** Subsequent runs: 100-300ms
- **Check:** Are you hitting Modal API rate limits?

---

## Advanced Testing

### Test with Real Student

1. Get a real student_id from database:
   ```sql
   SELECT id, first_name FROM students LIMIT 1;
   ```

2. Select "Use Real Student" in simulator

3. Paste student_id and submit

4. This will:
   - Find the student's teacher
   - Create proper HITL task
   - Trigger full workflow

### Test with Real Teacher

1. Get teacher_id:
   ```sql
   SELECT id FROM teachers LIMIT 1;
   ```

2. Manually create HITL task:
   ```sql
   INSERT INTO teacher_review_tasks (
     teacher_id, student_id, metric_id, review_type, status
   ) VALUES (
     '<teacher-id>',
     '<student-id>',
     '<metric-id>',
     'study_progress',
     'pending'
   );
   ```

3. Approve it to trigger PRM:
   ```sql
   UPDATE teacher_review_tasks
   SET status = 'approved', approved_at = now()
   WHERE id = '<task-id>';
   ```

4. Check PRM workflow triggered

---

## Database Queries for Testing

### View Recent Metrics
```sql
SELECT
  id,
  student_id,
  focus_score,
  summary,
  created_at
FROM student_metrics
ORDER BY created_at DESC
LIMIT 10;
```

### View HITL Tasks
```sql
SELECT
  id,
  student_id,
  teacher_id,
  status,
  created_at
FROM teacher_review_tasks
ORDER BY created_at DESC
LIMIT 10;
```

### View Queued Emails
```sql
SELECT
  id,
  student_id,
  parent_id,
  subject,
  status,
  created_at
FROM communications_log
WHERE type = 'study_summary'
ORDER BY created_at DESC
LIMIT 10;
```

### Check Workflow Triggers
```sql
-- See all student_metrics created in last 10 minutes
SELECT COUNT(*), MAX(created_at)
FROM student_metrics
WHERE created_at > now() - interval '10 minutes';

-- See pending HITL tasks
SELECT COUNT(*), MAX(created_at)
FROM teacher_review_tasks
WHERE status = 'pending';

-- See queued parent emails
SELECT COUNT(*), MAX(created_at)
FROM communications_log
WHERE type = 'study_summary'
  AND status IN ('queued', 'draft');
```

---

## Common Testing Patterns

### Pattern 1: Full Pipeline Test
```
1. Generate "Normal Study" 15 min
2. Submit (should create metric)
3. Wait 2 seconds
4. Manually approve HITL task
5. Wait 2 seconds
6. Check PRM email queued
7. Verify all tables updated
```

**Success criteria:**
- ✅ Metric in student_metrics
- ✅ Task in teacher_review_tasks (status: pending)
- ✅ Email in communications_log (status: queued)
- ✅ All created_at timestamps within 5 seconds

### Pattern 2: Performance Test
```
1. Generate 10 simulations
2. Submit all in quick succession
3. Time how long database shows all
4. Check no duplicates
5. Verify all workflows triggered
```

**Success criteria:**
- ✅ All 10 metrics in database within 10 seconds
- ✅ No duplicate IDs
- ✅ All have unique device_hash values
- ✅ Response times: <500ms per submission

### Pattern 3: Error Handling Test
```
1. Submit invalid JSON
2. Submit empty metrics array
3. Submit with bad timestamp
4. Check error messages
5. Verify no data corruption
```

**Success criteria:**
- ✅ Clear error messages
- ✅ No partial data in database
- ✅ System recovers gracefully

---

## Performance Benchmarks

Expected timings for healthy system:

| Operation | Expected Time | Max Acceptable |
|-----------|---------------|-----------------|
| Simulator generation | 1-2 seconds | 5 seconds |
| Edge Function processing | 100-300ms | 1 second |
| Metric appears in DB | 1-3 seconds | 5 seconds |
| HITL task created | 1-2 seconds | 5 seconds |
| PRM email queued | 1-2 seconds | 5 seconds |
| **Full pipeline** | **5-10 seconds** | **30 seconds** |

---

## Troubleshooting Checklist

- [ ] Dev endpoint enabled (`ALLOW_DEV_ENDPOINTS=true`)
- [ ] Supabase Edge Function deployed
- [ ] Inngest workflows registered
- [ ] Database tables exist (student_metrics, teacher_review_tasks)
- [ ] RLS policies configured
- [ ] Webhooks configured
- [ ] Modal API keys configured (if using real summarization)

---

## Next Steps After Testing

1. ✅ Verify full pipeline works
2. ✅ Check teacher dashboard for HITL tasks
3. ✅ Check parent email format
4. ✅ Test with real students
5. ✅ Load test with 100+ simulations
6. ✅ Deploy to production
7. ✅ Monitor real-world usage

---

## Support

**Having issues?**
- Check `/dashboard/dev/simulate-student` for error messages
- Review API response in browser dev tools (F12)
- Check Supabase Edge Function logs
- Check Inngest workflow execution history
- Contact development team with:
  - Metric ID (from response)
  - Exact error message
  - Scenario used
  - Timestamp
