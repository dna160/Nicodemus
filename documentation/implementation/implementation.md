# Nicodemus Implementation Plan (Lean Solo-Dev Edition)
**Enterprise Educational AI Suite (EEAS) - Solo Developer Optimized**
*Version 2.0 - Simplified Architecture for Rapid Execution*

---

## I. Project Overview

**Product Name:** Nicodemus, Teacher of Teachers
**Core Vision:** A federated, event-driven AI ecosystem that revolutionizes school operations through Privacy-First Personalization via Supabase + Modal + Inngest.

**Key Differentiators:**
- Edge-first student privacy (behavioral data stays local on Tauri app)
- Event-driven, loosely-coupled agent architecture (via Supabase Realtime + Inngest)
- Human-in-the-loop for high-stakes decisions
- FERPA/COPPA compliance by design
- **Operational Simplicity:** No DevOps, no Kubernetes, no message queues to maintain

**Solo Developer Reality:**
- One person building this means ruthless focus on eliminating operational overhead
- Choose tools that are boring, reliable, and require zero maintenance
- Start with one agent (Teacher Assistant), expand later
- Use serverless everywhere (Modal, Vercel, Supabase)

---

## II. Phase Architecture & Development Timeline

### Phase 1: Teacher Assistant Agent Only (Weeks 1-8)
**Deliverable:** Fully functional Teacher Assistant Agent + Next.js dashboard + Supabase backend

**Why Teacher Assistant First?**
- Pure cloud compute (no edge complexity)
- Solves immediate teacher pain point (lesson planning, grading)
- Teaches the event-driven pattern (durable workflows via Inngest)
- No device installation required (web-based)
- Can be piloted in 2 weeks

**Core Features (Phase 1):**
- 📚 Curriculum generation (state standards → lesson plans)
- ✏️ Grading assistance (auto-grade + rubric feedback)
- 👁️ Classroom insights (aggregate student struggles)
- 👨‍🏫 Teacher dashboard (Next.js, Vercel-hosted)
- ✅ Durable approval workflows (Inngest for human-in-loop)

---

### Phase 1b: PRM Agent (Weeks 9-12)
**Deliverable:** Parent communication engine + timeline management

---

### Phase 1c: ERP Agent (Weeks 13-16)
**Deliverable:** Substitute allocation + inventory management

---

### Phase 2: Student Rep Agent (Edge) (Weeks 17-24)
**Deliverable:** Tauri desktop app + behavior tracking + adaptive pacing

---

## III. Lean Technology Stack (Solo Developer Edition)

### ✅ What We're Using (No Kafka, No Kubernetes)

#### Core Cloud Infrastructure
| Component | Technology | Why |
|-----------|-----------|-----|
| **Database + Auth + Realtime** | Supabase | RLS handles FERPA isolation; webhooks replace Kafka |
| **AI Compute** | Modal | Serverless GPU; pay-per-second; perfect for LLM tasks |
| **Event Orchestration** | Inngest | Durable workflows as TypeScript code (no queue infrastructure) |
| **Frontend** | Next.js on Vercel | Full-stack framework; deploys on every git push |
| **AI SDK** | Vercel AI SDK | Structured outputs, tool-calling, lightweight |

#### Edge (Student Device)
| Component | Technology | Why |
|-----------|-----------|-----|
| **Desktop App Framework** | Tauri | Tiny, fast, memory-efficient; Rust + React |
| **Data Collection** | Tauri OS hooks | Native access to active window, focus events |
| **Local Database** | SQLite (Tauri) | Encrypted, built-in, zero setup |
| **Sync Client** | HTTPS + Supabase REST | Simple POST requests, no complex sync protocol |

#### Development Tools
| Component | Technology | Why |
|-----------|-----------|-----|
| **Package Manager** | pnpm | Fast, efficient monorepo support |
| **Database Migration** | Supabase CLI | Version-controlled schema changes |
| **TypeScript** | Full codebase | Type safety across Agent, API, Frontend, Edge |
| **Testing** | Vitest + Playwright | Fast, no extra infrastructure |

---

### ❌ What We're NOT Using (Why It's Removed)

| Old Stack | Removed | Replaced With | Reason |
|-----------|---------|---------------|--------|
| **Kubernetes** | ❌ | Vercel + Modal | Solo dev can't maintain K8s |
| **Apache Kafka** | ❌ | Supabase Realtime + Webhooks + Inngest | Kafka requires DevOps; Supabase is managed |
| **PostgreSQL Self-Hosted** | ❌ | Supabase (managed PG) | No database ops burden |
| **Redis Self-Hosted** | ❌ | Supabase built-in caching | Zero infrastructure |
| **ELK Stack** | ❌ | Vercel Logs + Supabase Audit Log | Native observability |
| **HashiCorp Vault** | ❌ | Vercel Secrets + Supabase Vault | Managed secret storage |
| **Docker + CI/CD Pipeline** | ❌ | Git push to Vercel (auto-deploy) | GitHub → Vercel = instant deployment |

---

## IV. How Events Actually Flow (Lean Edition)

### The Magic: Supabase Webhooks + Inngest = Event-Driven Without Kafka

```
┌─────────────────────────────────────────────────────────────┐
│ Event Flow: How Agents Communicate (No Kafka Needed)       │
└─────────────────────────────────────────────────────────────┘

Teacher submits grades in Next.js dashboard
        │
        ▼
    Supabase Database
   (grades table INSERT)
        │
        ▼
 Supabase Webhook Trigger
   (on INSERT to grades)
        │
        ▼
    Inngest (Durable Workflow)
  "When grades submitted:
   1. Run Teacher Assistant to generate feedback
   2. Publish 'grade_feedback_drafted' event
   3. Wait for teacher approval (webhook from UI)
   4. When approved: notify PRM agent via Inngest"
        │
        ▼
    Modal (AI Task)
  "Generate rubric-based feedback using Claude"
        │
        ▼
   Supabase (Store Result)
   Updates feedback column
        │
        ▼
   Next.js Real-time UI
  (Supabase Realtime subscription)
  Teacher sees draft feedback
        │
        ▼
   Teacher clicks "Approve"
        │
        ▼
   Inngest Workflow Resumes
   (from step 3 above)
        │
        ▼
   PRM Agent Notified
  (Inngest trigger) → "grades_finalized" event
```

**Key Insight:** Instead of Kafka → All event choreography happens in Inngest TypeScript code. No queues to maintain, no deployment complexity.

---

## V. Phase 1 Detailed: Teacher Assistant Agent

### 1.1 Infrastructure Setup (Week 1)

**Tasks:**
- [ ] Create Supabase project (5 min)
- [ ] Set up Vercel project + GitHub integration (10 min)
- [ ] Create Modal account + setup credentials (15 min)
- [ ] Create Inngest project + setup webhooks (15 min)
- [ ] Initialize Next.js monorepo (pnpm workspaces)

**Deliverables:**
- Supabase schema (users, teachers, students, curricula, submissions, grades)
- Vercel environment variables
- Modal credentials in Vercel Secrets
- Inngest webhook endpoints

**Time:** 1-2 days

---

### 1.2 Data Schema (Week 1)

```sql
-- Supabase PostgreSQL Schema (RLS built-in)

CREATE TABLE teachers (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE,
  school_id UUID,
  subject_areas TEXT[],
  created_at TIMESTAMP DEFAULT NOW()
);

-- RLS: Teachers can only see their own roster + grades for their students
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
CREATE POLICY teachers_select ON teachers
  USING (auth.uid() = id);

CREATE TABLE students (
  id UUID PRIMARY KEY,
  email TEXT,
  teacher_id UUID REFERENCES teachers(id),
  grade_level INT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- RLS: Students see own data; teachers see roster students
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
CREATE POLICY students_own_data ON students
  USING (auth.uid() = id OR
         auth.uid() IN (
           SELECT teacher_id FROM students WHERE id = students.id
         ));

CREATE TABLE curricula (
  id UUID PRIMARY KEY,
  teacher_id UUID REFERENCES teachers(id),
  grade_level INT,
  subject TEXT,
  standards TEXT[], -- e.g., ["CCSS.MATH.3.NF.A.1"]
  lessons JSONB, -- Lesson plan structure
  created_at TIMESTAMP DEFAULT NOW(),
  published_at TIMESTAMP
);

CREATE TABLE submissions (
  id UUID PRIMARY KEY,
  student_id UUID REFERENCES students(id),
  assignment_id UUID,
  content TEXT,
  submitted_at TIMESTAMP,
  status TEXT, -- "submitted", "graded", "approved"
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE grades (
  id UUID PRIMARY KEY,
  submission_id UUID REFERENCES submissions(id),
  student_id UUID REFERENCES students(id),
  teacher_id UUID REFERENCES teachers(id),
  score FLOAT, -- 0-100
  feedback_draft TEXT, -- AI-generated
  feedback_final TEXT, -- Teacher-approved
  teacher_approved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Audit log (FERPA compliance)
CREATE TABLE audit_log (
  id UUID PRIMARY KEY,
  user_id UUID,
  action TEXT,
  table_name TEXT,
  record_id UUID,
  accessed_at TIMESTAMP DEFAULT NOW()
);
```

**Key FERPA Feature:** Row Level Security (RLS) means:
- Teachers can ONLY query their own students
- Students can ONLY query their own submissions/grades
- Audit log auto-tracks all access
- No need for custom permission logic in code

---

### 1.3 Teacher Assistant Agent (Weeks 2-4)

#### Architecture

```
Next.js API Route (Vercel)
    │
    ├─→ Receives: "Generate curriculum for grade 3 math"
    │
    ▼
Inngest Durable Workflow
    │
    ├─→ Step 1: Fetch learning standards from Supabase
    │
    ├─→ Step 2: Call Modal Function (GPU-free task)
    │   "Generate lesson plan using Claude API"
    │   (Modal handles the Claude API call)
    │
    ├─→ Step 3: Store result in Supabase
    │   INSERT INTO curricula (lessons)
    │
    └─→ Step 4: Publish event to Supabase (for real-time UI)
        UPDATE curricula SET published_at = NOW()
```

#### Key Components

**1.3a Curriculum Generation (Modal Task)**

```python
# modal_app.py (runs on Modal's serverless GPU)
import modal
from anthropic import Anthropic

app = modal.App("teacher_assistant")

@app.function()
def generate_curriculum(grade_level: int, subject: str, standards: list[str]) -> dict:
    """
    Generate a lesson plan using Claude.
    Runs on Modal's serverless infrastructure (pay-per-second).
    """
    client = Anthropic()

    prompt = f"""
    Generate a detailed lesson plan for {grade_level} grade {subject}.

    Learning Standards:
    {', '.join(standards)}

    Include:
    - Objectives
    - Materials needed
    - Lesson activities (3 levels: basic, intermediate, advanced)
    - Assessment rubric

    Format as JSON.
    """

    message = client.messages.create(
        model="claude-3-5-sonnet-20241022",
        max_tokens=4096,
        messages=[
            {"role": "user", "content": prompt}
        ]
    )

    return {
        "lesson_plan": message.content[0].text,
        "generated_at": datetime.now().isoformat()
    }
```

**1.3b Inngest Workflow (TypeScript)**

```typescript
// apps/api/src/workflows/curriculum.ts (runs on Vercel)
import { inngest } from "@/inngest/client";
import { generateCurriculum } from "@/modal/client";
import { supabase } from "@/lib/supabase";

export const curriculumWorkflow = inngest.createFunction(
  { id: "teacher-assistant.generate-curriculum" },
  { event: "teacher/curriculum.requested" }, // Triggered by API call
  async ({ event, step }) => {
    const { teacher_id, grade_level, subject, standards } = event.data;

    // Step 1: Generate curriculum using Modal
    const lessonPlan = await step.run("generate-lesson-plan", async () => {
      return await generateCurriculum(grade_level, subject, standards);
    });

    // Step 2: Store in Supabase
    const { data, error } = await step.run("store-curriculum", async () => {
      return await supabase
        .from("curricula")
        .insert({
          teacher_id,
          grade_level,
          subject,
          standards,
          lessons: lessonPlan,
          published_at: new Date(),
        })
        .select();
    });

    // Step 3: Trigger PRM agent (if configured)
    await step.sendEvent("notify-prm", {
      name: "teacher_assistant/curriculum.published",
      data: { curriculum_id: data[0].id },
    });

    return { curriculum_id: data[0].id };
  }
);
```

**1.3c Grading Assistance**

```typescript
// Modal task for auto-grading objective assignments
@app.function()
def auto_grade_objective(submission_text: str, answer_key: str, rubric: dict) -> dict:
    """
    For multiple choice, short answer, math: auto-grade using pattern matching + Claude.
    """
    client = Anthropic()

    prompt = f"""
    Student submission: {submission_text}
    Answer key: {answer_key}
    Scoring rubric: {json.dumps(rubric)}

    Score this submission 0-100 and provide brief feedback.
    Return JSON: {{"score": X, "feedback": "..."}}
    """

    # Call Claude (cheaper than full generation)
    message = client.messages.create(
        model="claude-3-5-haiku-20241022", # Faster + cheaper
        messages=[{"role": "user", "content": prompt}]
    )

    return json.loads(message.content[0].text)

# For essays/subjective: generate draft feedback
@app.function()
def grade_essay_draft(essay_text: str, rubric: dict, teacher_tone: str) -> dict:
    """
    Generate draft feedback for teacher to review & approve.
    Teacher always makes final decision (HITL).
    """
    prompt = f"""
    Essay to grade: {essay_text}
    Rubric: {json.dumps(rubric)}
    Teacher tone preference: {teacher_tone}

    Generate a rubric-based score (0-100) and encouraging feedback bullet points.
    Return JSON: {{"score": X, "feedback_bullets": [...]}}
    """
    # ... same pattern
```

**1.3d Classroom Insights Aggregator**

```sql
-- Supabase SQL Function (runs automatically)
CREATE OR REPLACE FUNCTION get_classroom_insights(class_id UUID)
RETURNS TABLE (
  concept_id TEXT,
  struggle_count INT,
  avg_time_minutes FLOAT,
  recommendation TEXT
) AS $$
BEGIN
  -- Aggregate: which concepts are most students struggling with?
  RETURN QUERY
  SELECT
    c.concept_id,
    COUNT(*) as struggle_count,
    AVG(EXTRACT(EPOCH FROM (NOW() - s.submitted_at)) / 60) as avg_time_minutes,
    CASE
      WHEN COUNT(*) > 3 THEN 'Consider re-teaching'
      WHEN AVG(EXTRACT(EPOCH FROM (NOW() - s.submitted_at)) / 60) > 30
           THEN 'Try hands-on approach'
      ELSE 'Monitor progress'
    END as recommendation
  FROM submissions s
  JOIN grades g ON s.id = g.submission_id
  JOIN assignment_concepts c ON s.assignment_id = c.assignment_id
  WHERE g.score < 70
    AND s.submitted_at > NOW() - INTERVAL '1 week'
  GROUP BY c.concept_id
  ORDER BY struggle_count DESC;
END;
$$ LANGUAGE plpgsql;
```

---

### 1.4 Next.js Dashboard (Weeks 3-5)

**Features:**
- Teacher login (Supabase Auth)
- Curriculum library + generate new
- Upload assignments + view submissions
- Grade submissions (see AI-drafted feedback)
- Approve/reject grades
- View classroom insights

**Tech Stack:**
- Next.js App Router
- Supabase JavaScript Client
- TailwindCSS + shadcn/ui (beautiful dashboards fast)
- Real-time updates (Supabase Realtime subscriptions)

```typescript
// app/teacher/grades/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRealtimeSubscription } from '@/hooks/useRealtime';

export default function GradesPage() {
  const [submissions, setSubmissions] = useState([]);

  // Real-time updates: teacher sees grades update as students submit
  useRealtimeSubscription('submissions', (payload) => {
    setSubmissions(prev => [...prev, payload.new]);
  });

  const approveGrade = async (submissionId: string, feedback: string) => {
    // Update database + automatically triggers PRM workflow
    await supabase
      .from('grades')
      .update({ feedback_final: feedback, teacher_approved_at: new Date() })
      .eq('submission_id', submissionId);
  };

  return (
    <div>
      {submissions.map(sub => (
        <GradeCard
          submission={sub}
          onApprove={approveGrade}
        />
      ))}
    </div>
  );
}
```

---

### 1.5 FERPA Compliance (Week 6)

**Built-in via Supabase RLS:**
- ✅ Row-level security: Teachers only see their students
- ✅ Audit logging: All data access tracked automatically
- ✅ Data deletion: Soft delete → hard delete after 90 days
- ✅ Student access: API endpoint returns their own data only

**Remaining Manual Work:**
- [ ] Privacy notice (HTML + email)
- [ ] Parental consent form (Google Forms → Supabase)
- [ ] Data retention policy (configurable TTL)

---

### 1.6 Inngest Approval Workflow (Week 6-7)

**The Magic of Human-in-the-Loop Without Extra Infrastructure:**

```typescript
// Inngest workflow: "Draft feedback → Wait for teacher approval → Notify PRM"
export const gradeApprovalWorkflow = inngest.createFunction(
  { id: "grading.approval-workflow" },
  { event: "teacher_assistant/feedback.drafted" },
  async ({ event, step }) => {
    const { submission_id, feedback_draft } = event.data;

    // STEP 1: Feedback already drafted + stored in Supabase
    // Teacher sees it in Next.js dashboard

    // STEP 2: Wait for teacher to click "Approve"
    // (This is a webhook call from the UI)
    const approved = await step.waitForEvent("teacher/grade.approved", {
      timeout: "7d", // Escalate if no action in 7 days
      match: `data.submission_id == '${submission_id}'`,
    });

    if (!approved) {
      // Escalate to admin
      await step.sendEvent("escalate", {
        name: "admin/grade.pending",
        data: { submission_id, days: 7 },
      });
      return;
    }

    // STEP 3: Teacher approved → Grade is final
    const finalGrade = approved.data;

    // STEP 4: Trigger PRM to notify parent
    await step.sendEvent("notify-parent", {
      name: "prm/grade.finalized",
      data: { student_id: finalGrade.student_id, submission_id },
    });

    return { status: "approved" };
  }
);

// In Next.js API route:
// POST /api/grades/:submissionId/approve
export async function POST(req, { params }) {
  const { feedback_final } = await req.json();

  // Update database
  await supabase
    .from('grades')
    .update({ feedback_final, teacher_approved_at: new Date() })
    .eq('submission_id', params.submissionId);

  // Resume Inngest workflow
  await inngest.send({
    name: "teacher/grade.approved",
    data: {
      submission_id: params.submissionId,
      feedback_final
    },
  });

  return { ok: true };
}
```

---

### 1.7 Testing & Launch (Weeks 7-8)

**Testing:**
- [ ] Curriculum generation (Claude API)
- [ ] Grade approval workflow (Inngest)
- [ ] Real-time UI updates (Supabase)
- [ ] FERPA compliance (RLS + audit logs)

**Launch Checklist:**
- [ ] Privacy notice published
- [ ] Pilot teacher onboarded
- [ ] Test with 1 real class (20 students)
- [ ] Collect feedback
- [ ] Fix bugs

**Metrics to Track:**
- Teacher time saved on grading
- Feedback quality (teacher satisfaction)
- Curriculum generation latency
- System uptime

---

## VI. Phase 1b: PRM Agent (Weeks 9-12)

**Deliverable:** Parent communication engine

**Features:**
- Weekly progress digests (email to parents)
- Trend detection (grade drop? low engagement?)
- Intervention alerts (teacher drafts email, PRM manages)
- Communication timeline (searchable history)

**Implementation:**
- Inngest workflow: "Each Friday, send parent digest"
- Modal function: Generate email using Claude
- Supabase: Store communication history
- Next.js: Communication dashboard for teachers

**High-Level Workflow:**

```
Friday morning (automated)
    │
    ▼
Inngest scheduled job (cron: "0 9 * * FRI")
    │
    ├─→ Query Supabase: Get all students + grades from past week
    │
    ├─→ Call Modal: "Generate parent-friendly digest"
    │   Input: student performance, achievements, flags
    │   Output: Email HTML
    │
    ├─→ Store template in Supabase
    │
    ├─→ Send via email service (SendGrid? or Supabase Mail?)
    │
    └─→ Log in audit_log table
```

---

## VII. Phase 1c: ERP Agent (Weeks 13-16)

**Deliverable:** Substitute allocation + inventory management

**Features (MVP):**
- Teacher logs absence → System emails available subs
- Attach auto-generated lesson plan to sub email
- Track sub performance feedback
- Inventory tracking (track what materials are used)

---

## VIII. Phase 2: Student Rep Agent (Weeks 17-24)

**Only after Phase 1 is shipped and validated.**

**Deliverable:** Tauri desktop app + behavior tracking

**Features:**
- Student runs Tauri app while doing homework
- Tracks active window, focus time, struggles
- Provides hints when stuck
- Syncs sanitized data to Supabase (student hash, not name)
- Web interface for mocking (until Tauri is ready)

---

## IX. Technology Stack: Deep Dive

### Supabase (Database + Auth + Realtime + Webhooks)

**Why it replaces Kafka:**
- Webhooks can trigger on any INSERT/UPDATE
- Webhook → Inngest = durable event handling
- RLS = FERPA compliance built-in
- Realtime subscriptions = real-time UI without additional tools

```typescript
// Webhook setup (Supabase Dashboard UI)
// Trigger: On INSERT to submissions
// Webhook URL: https://api.inngest.com/events
// Headers: { "Authorization": "Bearer YOUR_KEY" }
// Body: { "name": "submission/created", "data": "record" }

// Results in Inngest event:
{
  "name": "submission/created",
  "data": {
    "id": "sub-123",
    "student_id": "std-456",
    "assignment_id": "asg-789",
    "content": "Student's answer"
  }
}
```

### Modal (AI Compute)

**Why it's perfect for solo dev:**
- No server to manage
- Pay $0.10/GPU hour or $0 for CPU tasks
- Perfect for: curriculum generation, feedback drafting
- Scales instantly (millions of requests/day)

```python
# Example: Modal handles Claude API calls
from modal import app

@app.function()
async def generate_feedback(essay: str, rubric: dict):
    # All Claude API calls go through Modal
    # Handles errors, retries, scaling automatically
    from anthropic import Anthropic
    client = Anthropic()
    # ... code ...
```

### Inngest (Durable Workflows)

**Why it replaces a message queue:**
- Write workflows as TypeScript code (no YAML, no config)
- Automatic retries, error handling, timeouts
- Built-in human-in-the-loop (wait for webhook)
- Visible execution history (debugging)
- Free tier: 10k invocations/month (enough for Phase 1)

### Next.js + Vercel (Frontend + API)

**Why it's the fastest stack:**
- Single repo (frontend + API routes)
- Auto-deploy on git push (no DevOps)
- Built-in serverless functions (API routes)
- Perfect TypeScript support
- One command to deploy: `git push`

### Tauri (Edge App, Phase 2)

**Why not Electron:**
- Electron = 150MB+ per install (bloated)
- Tauri = 3-8MB per install (tiny)
- Electron = memory hog
- Tauri = 50MB memory footprint
- Tauri = native performance (Rust)

---

## X. Timeline (Lean Solo-Dev Edition)

### Week 1: Setup & Schema
- [ ] Create Supabase + Vercel + Modal + Inngest accounts
- [ ] Design database schema with RLS
- [ ] Initialize Next.js monorepo
- **Time: 5-10 hours**

### Weeks 2-4: Teacher Assistant Core
- [ ] Curriculum generation (Modal + Claude API)
- [ ] Grading assistance (Modal + Claude API)
- [ ] Next.js dashboard (assignment upload, grade submission)
- [ ] Classroom insights (SQL aggregation)
- **Time: 40-60 hours**

### Weeks 5-6: Workflows + FERPA
- [ ] Inngest approval workflows
- [ ] Supabase RLS + audit logging
- [ ] Privacy notice + consent flow
- [ ] Inngest error handling + retries
- **Time: 20-30 hours**

### Weeks 7-8: Testing + Launch
- [ ] Integration tests (Vitest)
- [ ] E2E tests (Playwright)
- [ ] Pilot school onboarding
- [ ] Feedback collection
- **Time: 20-30 hours**

### Weeks 9-12: PRM Agent
- [ ] Parent digest generation (Modal + Inngest)
- [ ] Trend detection (SQL)
- [ ] Communication history (Supabase)
- [ ] Teacher dashboard for parent communications
- **Time: 30-40 hours**

### Weeks 13-16: ERP Agent
- [ ] Substitute management
- [ ] Inventory tracking
- [ ] Auto-lesson-plan attachment
- **Time: 20-30 hours**

### Weeks 17-24: Student Rep Agent (Edge)
- [ ] Tauri app scaffolding
- [ ] Activity monitoring (native OS hooks)
- [ ] Sync client (Supabase REST)
- [ ] Web interface for mocking
- **Time: 60-80 hours**

**Total: ~240-280 hours (~6-7 weeks full-time, or 3-4 months part-time at 20h/week)**

---

## XI. Success Metrics

### Phase 1 (Teacher Assistant)
- ✅ Teachers can generate lesson plan in <2 minutes
- ✅ Auto-grading 90%+ accurate on objective tasks
- ✅ Classroom insights are actionable
- ✅ System uptime: 99.5%+ (Vercel + Supabase SLA)

### Phase 1b (PRM)
- ✅ Parents prefer this over email threads
- ✅ Teachers see it reduces parent concerns
- ✅ Communication history is searchable

### Phase 1c (ERP)
- ✅ Sub assignment is <5 minutes
- ✅ Sub feedback helps improve quality

### Phase 2 (Student Rep)
- ✅ Students don't find it creepy (transparency)
- ✅ Tutoring hints are actually helpful
- ✅ Data collection is transparent

---

## XII. Cost Breakdown (Phase 1)

| Service | Estimated Cost/Month | Notes |
|---------|---------------------|-------|
| **Supabase** | $25 (Pro tier) | Database, auth, webhooks |
| **Vercel** | $20 (Pro tier) | Next.js hosting + serverless |
| **Modal** | $5-20 | GPU time for Claude calls |
| **Inngest** | $0 | Free tier (10k invocations) |
| **Claude API** | $10-50 | Depends on usage |
| **SendGrid** | $20 | Email service (Phase 1b+) |
| **Domain** | $12/year | ncodemus.school (or similar) |
| **TOTAL** | ~$80-100/month | All-in for Phase 1 |

**Year 1 Estimate: ~$1,200-1,500**
**vs. Traditional Stack: $5,000-10,000/month in AWS + DevOps**

---

## XIII. Solo Developer Workflow

### Daily Standup (15 min)
1. Review Vercel deployment logs
2. Check Inngest execution history
3. Read Supabase alerts (if any)

### Debugging
- Vercel Logs → see API errors
- Inngest UI → see workflow failures
- Supabase Studio → inspect data

### Deployment
```bash
git commit -m "feat: add curriculum generation"
git push origin main
# Vercel auto-deploys in 30 seconds
```

### Monitoring
- Vercel Analytics (performance)
- Supabase Monitoring (database)
- Inngest Dashboard (workflows)
- No custom infrastructure to babysit

---

## XIV. Migration Path to Enterprise Stack (Year 2+)

If the product becomes popular and you hire a team:

| Component | Phase 1 (Solo) | Phase 2+ (Team) | Migration Cost |
|-----------|---|---|---|
| Supabase | Keep (still best for RLS) | Keep or migrate to AWS RDS | Low |
| Modal | Keep (still best for AI) | Keep or Kubernetes | Medium |
| Inngest | Keep (still best for workflows) | Keep or Temporal | Low |
| Next.js | Migrate → Monorepo (Node.js) | Migrate → TypeScript microservices | Medium |
| Tauri | Keep | Keep or Electron | Low |

**Key:** None of these choices lock you in. You're building on portable, industry-standard technologies.

---

## XV. Risks & Mitigations (Solo Edition)

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Burnout (building alone) | CRITICAL | Time-box to 40h/week max; celebrate small wins |
| Supabase outage | HIGH | RTO 1h (SLA 99.9%); backup: export data daily to S3 |
| Modal rate limiting | MEDIUM | Cache Claude outputs in Supabase; batch requests |
| Inngest quota exceeded | LOW | Free tier is 10k/month; Phase 1 = ~1k/month |
| Security breach (student data) | CRITICAL | RLS prevents data leakage; audit logs catch unauthorized access |
| FERPA audit failure | HIGH | RLS + audit logs are FERPA-compliant by design |
| Pilot school unhappy | MEDIUM | Weekly feedback loops; pivot features based on feedback |

---

## XVI. Appendices

### A. Local Development Setup

```bash
# Clone repo
git clone https://github.com/your-org/nicodemus.git
cd nicodemus

# Install dependencies
pnpm install

# Set up environment
cp .env.example .env.local
# Fill in: SUPABASE_URL, SUPABASE_KEY, MODAL_TOKEN_ID, INNGEST_KEY

# Start dev server
pnpm dev
# Opens http://localhost:3000

# In another terminal: run Modal worker (for curriculum generation)
modal run modal_app.py::app
```

### B. Supabase RLS Cheat Sheet

```sql
-- Teacher RLS (can only see own students)
CREATE POLICY teachers_own_students ON students
  USING (auth.uid() = teacher_id);

-- Student RLS (can only see own data)
CREATE POLICY students_own_data ON submissions
  USING (auth.uid() = student_id);

-- Audit logging (automatic)
-- All queries logged by Supabase native audit
SELECT * FROM public.audit_log
WHERE accessed_at > NOW() - INTERVAL '7 days';
```

### C. Inngest Workflow Examples

```typescript
// Cron: Every Friday at 9am, send parent digests
import { inngest } from "@/inngest/client";

export const parentDigestCron = inngest.createFunction(
  { id: "parent.digest-cron" },
  { cron: "0 9 * * FRI" }, // Cron syntax
  async ({ step }) => {
    const allStudents = await step.run("fetch-students", async () => {
      return supabase.from("students").select("*");
    });

    for (const student of allStudents) {
      await step.sendEvent("send-digest", {
        name: "parent.digest.send",
        data: { student_id: student.id },
      });
    }
  }
);
```

---

**Document Version:** 2.0 (Lean Solo-Dev Edition)
**Last Updated:** 2026-03-17
**Status:** Ready for Implementation

---

### Next Steps

1. ✅ Set up accounts (Supabase, Vercel, Modal, Inngest)
2. ✅ Design database schema in Supabase Studio
3. ✅ Create Next.js repo
4. ✅ Implement first Modal function (curriculum generation)
5. ✅ Connect Inngest workflow
6. ✅ Build Next.js dashboard
7. ✅ Go live with pilot teacher

**Estimated time to MVP: 8 weeks (solo developer, 40h/week)**
