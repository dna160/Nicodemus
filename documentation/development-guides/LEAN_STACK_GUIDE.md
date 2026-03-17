# LEAN STACK GUIDE: Solo Developer Setup
**Supabase + Modal + Inngest + Next.js + Tauri**

---

## I. Why This Stack? (Decision Matrix)

| Decision | Option A (Enterprise) | Option B (Solo) | Winner |
|----------|---|---|---|
| Database | AWS RDS + manage | Supabase (managed) | ✅ Supabase |
| Message Queue | Kafka (ops nightmare) | Supabase Webhooks + Inngest | ✅ Supabase + Inngest |
| AI Compute | ECS + GPU instances | Modal serverless | ✅ Modal |
| Backend | Custom Node.js | Next.js API routes | ✅ Next.js |
| Frontend | React SPA | Next.js + React | ✅ Next.js |
| Deployment | GitHub → CI/CD → K8s | GitHub → Vercel | ✅ Vercel |
| Monitoring | Datadog + custom | Built-in (Vercel + Supabase) | ✅ Built-in |
| **Total Monthly Cost** | **$5,000-10,000** | **$80-150** | ✅ **Lean wins** |
| **DevOps Overhead** | **40h/month** | **2-5h/month** | ✅ **Lean wins** |

---

## II. Getting Started (First Day)

### Step 1: Create Accounts (30 minutes)

1. **Supabase** (https://supabase.com)
   - Sign up with GitHub
   - Create new project (region: closest to pilot school)
   - Note: `SUPABASE_URL` and `SUPABASE_ANON_KEY`

2. **Vercel** (https://vercel.com)
   - Sign up with GitHub
   - Authorize GitHub integration
   - Create new project (we'll set up GitHub connection next)

3. **Modal** (https://modal.com)
   - Sign up
   - Install CLI: `pip install modal`
   - Create API token in dashboard
   - Note: `MODAL_TOKEN_ID` and `MODAL_TOKEN_SECRET`

4. **Inngest** (https://inngest.com)
   - Sign up with GitHub
   - Create new app
   - Note: `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY`

---

### Step 2: Initialize GitHub Repository (30 minutes)

```bash
# Create GitHub repo: "nicodemus"

# Clone locally
git clone https://github.com/your-org/nicodemus.git
cd nicodemus

# Create directory structure
mkdir -p apps/{web,api} \
         packages/{core,modal} \
         edge/{student-rep-tauri}

# Initialize pnpm monorepo
cat > pnpm-workspace.yaml << 'EOF'
packages:
  - 'apps/*'
  - 'packages/*'
  - 'edge/*'
EOF

# Install pnpm
npm install -g pnpm

# Create root package.json
cat > package.json << 'EOF'
{
  "name": "nicodemus",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "pnpm -r --parallel run dev",
    "build": "pnpm -r run build",
    "test": "pnpm -r run test"
  }
}
EOF

# Create .env.example (for team reference)
cat > .env.example << 'EOF'
# Supabase
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Modal
MODAL_TOKEN_ID=...
MODAL_TOKEN_SECRET=...

# Inngest
INNGEST_EVENT_KEY=...
INNGEST_SIGNING_KEY=...

# Claude API
CLAUDE_API_KEY=sk-...

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
EOF

# Add to .gitignore
echo ".env.local" >> .gitignore

# First commit
git add .
git commit -m "feat: init monorepo structure"
git push origin main
```

---

## III. Supabase Setup (First Week)

### 3.1 Database Schema

```bash
# In Supabase Studio Dashboard:
# SQL Editor → create schema.sql

# Phase 1: Teacher Assistant schema
```

Save as `supabase/migrations/001_initial_schema.sql`:

```sql
-- Auth + Users
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT,
  role TEXT CHECK (role IN ('teacher', 'student', 'parent', 'admin')),
  school_id UUID,
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_select_own ON public.users
  FOR SELECT USING (auth.uid() = id);

-- Teachers
CREATE TABLE public.teachers (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  school_id UUID,
  subject_areas TEXT[],
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;

CREATE POLICY teachers_select_own ON public.teachers
  FOR SELECT USING (auth.uid() = id);

-- Students
CREATE TABLE public.students (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  teacher_id UUID REFERENCES teachers(id),
  school_id UUID,
  grade_level INT,
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

CREATE POLICY students_select_own ON public.students
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY teachers_see_roster ON public.students
  FOR SELECT USING (teacher_id = auth.uid());

-- Curricula
CREATE TABLE public.curricula (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID REFERENCES teachers(id),
  grade_level INT,
  subject TEXT,
  standards TEXT[],
  lessons JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  published_at TIMESTAMP
);

ALTER TABLE public.curricula ENABLE ROW LEVEL SECURITY;

CREATE POLICY curricula_insert ON public.curricula
  FOR INSERT WITH CHECK (auth.uid() = teacher_id);

CREATE POLICY curricula_select ON public.curricula
  FOR SELECT USING (teacher_id = auth.uid());

-- Submissions
CREATE TABLE public.submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id),
  assignment_id UUID,
  content TEXT,
  submitted_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY submissions_own ON public.submissions
  FOR SELECT USING (auth.uid() = student_id);

CREATE POLICY submissions_teacher ON public.submissions
  FOR SELECT USING (student_id IN (
    SELECT id FROM students WHERE teacher_id = auth.uid()
  ));

-- Grades
CREATE TABLE public.grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID REFERENCES submissions(id),
  student_id UUID REFERENCES students(id),
  teacher_id UUID REFERENCES teachers(id),
  score FLOAT,
  feedback_draft TEXT,
  feedback_final TEXT,
  teacher_approved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE public.grades ENABLE ROW LEVEL SECURITY;

CREATE POLICY grades_student_view ON public.grades
  FOR SELECT USING (
    auth.uid() = student_id AND teacher_approved_at IS NOT NULL
  );

CREATE POLICY grades_teacher_create ON public.grades
  FOR INSERT WITH CHECK (auth.uid() = teacher_id);

CREATE POLICY grades_teacher_view ON public.grades
  FOR SELECT USING (auth.uid() = teacher_id);

-- Audit log
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  action TEXT,
  table_name TEXT,
  record_id UUID,
  accessed_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_own ON public.audit_log
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY audit_admin ON public.audit_log
  FOR SELECT USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );
```

### 3.2 Run Migrations

```bash
# Install Supabase CLI
npm install -g supabase

# Link to project
supabase link --project-ref xxxx

# Create migration
supabase migration new initial_schema

# Apply migration
supabase db push

# Verify
supabase db remote show
```

### 3.3 Set Up Webhooks (For Inngest)

**In Supabase Dashboard:**
1. Go to Database → Webhooks
2. Create new webhook on `INSERT submissions`
   - URL: `https://api.inngest.com/events`
   - Headers: `Authorization: Bearer YOUR_INNGEST_KEY`
   - Body: `{"name": "submission/created", "data": "record"}`
3. Create webhook on `INSERT grades`
   - URL: `https://api.inngest.com/events`
   - Body: `{"name": "grade/drafted", "data": "record"}`

---

## IV. Next.js Setup (Week 1-2)

### 4.1 Create Next.js App

```bash
cd apps
npx create-next-app@latest web --typescript --tailwind --src-dir

cd web
npm install @supabase/supabase-js @supabase/auth-helpers-nextjs inngest
```

### 4.2 Supabase Client Setup

```typescript
// lib/supabase.ts
import { createBrowserClient } from '@supabase/auth-helpers-nextjs';

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
```

### 4.3 Inngest Setup

```typescript
// lib/inngest.ts
import { Inngest } from 'inngest';

export const inngest = new Inngest({
  id: 'nicodemus',
  eventKey: process.env.INNGEST_EVENT_KEY,
});
```

### 4.4 First API Route (Curriculum Generation)

```typescript
// app/api/curriculum/generate/route.ts
import { inngest } from '@/lib/inngest';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
  const { grade_level, subject, standards } = await req.json();
  const user = await getServerUser(); // Your auth function

  // Trigger Inngest workflow
  const result = await inngest.send({
    name: 'teacher/curriculum.requested',
    data: {
      grade_level,
      subject,
      standards,
      teacher_id: user.id,
    },
  });

  return Response.json({
    workflow_id: result[0].ids[0],
    status: 'processing',
  });
}
```

---

## V. Modal Setup (Week 2)

### 5.1 Install & Authenticate

```bash
# Install Modal
pip install modal

# Authenticate
modal token new

# Test
modal run -q --help
```

### 5.2 First Modal Function

```python
# modal_app.py
import modal
import os
from anthropic import Anthropic

app = modal.App("nicodemus-teacher-assistant")

@app.function(
    image=modal.Image.debian_slim().pip_install("anthropic"),
    secrets=[modal.Secret.from_name("claude-api")],
)
def generate_curriculum(grade_level: int, subject: str, standards: list[str]) -> str:
    """Generate a lesson plan using Claude API."""
    client = Anthropic()

    prompt = f"""
    Create a detailed lesson plan for {grade_level} grade {subject}.

    Learning standards to cover:
    {', '.join(standards)}

    Include:
    - Learning objectives
    - Materials needed
    - 3 activity variants (basic, intermediate, advanced)
    - Assessment rubric (JSON format)

    Format as JSON.
    """

    message = client.messages.create(
        model="claude-3-5-sonnet-20241022",
        max_tokens=4096,
        messages=[{"role": "user", "content": prompt}],
    )

    return message.content[0].text

@app.function()
def grade_essay(essay: str, rubric: dict) -> dict:
    """Draft rubric-based feedback for essay."""
    client = Anthropic()

    prompt = f"""
    Grade this essay using the rubric.

    Essay: {essay}
    Rubric: {rubric}

    Respond with JSON: {{"score": 0-100, "feedback": "..."}}
    """

    message = client.messages.create(
        model="claude-3-5-haiku-20241022",  # Cheaper model for grading
        max_tokens=500,
        messages=[{"role": "user", "content": prompt}],
    )

    import json
    return json.loads(message.content[0].text)

@app.local_entrypoint()
def main():
    # Test locally
    result = generate_curriculum.local(3, "math", ["CCSS.MATH.3.NF.A.1"])
    print(result)
```

### 5.3 Call from Inngest

```typescript
// lib/inngest/workflows/curriculum.ts
import { inngest } from '@/lib/inngest';
import { modalClient } from '@/lib/modal-client';

export const curriculumWorkflow = inngest.createFunction(
  { id: 'teacher.curriculum-workflow' },
  { event: 'teacher/curriculum.requested' },
  async ({ event, step }) => {
    const { grade_level, subject, standards, teacher_id } = event.data;

    // Call Modal function
    const lessonPlan = await step.run('generate-lesson-plan', async () => {
      return await modalClient.post('/functions/generate_curriculum', {
        grade_level,
        subject,
        standards,
      });
    });

    // Store in Supabase
    const { data } = await step.run('store-curriculum', async () => {
      return await supabase
        .from('curricula')
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

    return { curriculum_id: data[0].id };
  }
);
```

---

## VI. Inngest Setup (Week 2-3)

### 6.1 Create Workflows

```typescript
// lib/inngest/workflows/approval.ts
import { inngest } from '@/lib/inngest';

export const gradeApprovalWorkflow = inngest.createFunction(
  { id: 'grade.approval-workflow' },
  { event: 'grade/drafted' },
  async ({ event, step }) => {
    const { submission_id, feedback_draft } = event.data;

    // Wait for teacher approval (from webhook)
    const approval = await step.waitForEvent('grade/approved', {
      timeout: '7d',
      match: `data.submission_id == '${submission_id}'`,
    });

    if (!approval) {
      // Auto-escalate
      await step.sendEvent('escalate', {
        name: 'admin/grade.pending',
        data: { submission_id, days: 7 },
      });
      return { status: 'escalated' };
    }

    // Finalize grade
    await step.run('finalize-grade', async () => {
      await supabase
        .from('grades')
        .update({ status: 'finalized' })
        .eq('submission_id', submission_id);
    });

    return { status: 'approved' };
  }
);
```

### 6.2 Webhook Handler (For Teacher Approval)

```typescript
// app/api/grades/[submissionId]/approve/route.ts
import { inngest } from '@/lib/inngest';

export async function POST(req, { params }) {
  const { feedback_final } = await req.json();

  // Update Supabase
  await supabase
    .from('grades')
    .update({ feedback_final, teacher_approved_at: new Date() })
    .eq('submission_id', params.submissionId);

  // Resume Inngest workflow
  await inngest.send({
    name: 'grade/approved',
    data: { submission_id: params.submissionId, feedback_final },
  });

  return Response.json({ ok: true });
}
```

---

## VII. Development Workflow

### Local Development

```bash
# Terminal 1: Next.js
cd apps/web
pnpm dev
# http://localhost:3000

# Terminal 2: Inngest (optional, for local testing)
inngest run

# Terminal 3: Modal (for testing functions)
modal serve modal_app.py
```

### Deploy to Production

```bash
# Push to GitHub
git add .
git commit -m "feat: add curriculum generation"
git push origin main

# Vercel auto-deploys (watch in dashboard)
# Supabase migrations auto-apply (watch in Studio)
# Modal functions auto-deploy (modal deploy modal_app.py)
```

---

## VIII. Cost Monitoring

### Monthly Costs (Phase 1)

| Service | Usage | Cost |
|---------|-------|------|
| **Supabase** | 10GB storage, 100k API calls | $25 (Pro) |
| **Vercel** | 100GB bandwidth, serverless | $20 (Pro) |
| **Modal** | ~10 GPU hours/month | $10-20 |
| **Inngest** | 5k invocations/month | $0 (free tier) |
| **Claude API** | ~1M tokens/month | $15-30 |
| **Total** | | **~$70-100/month** |

### Cost Optimization Tips

1. **Batch API calls** (reduce Modal invocations)
2. **Cache curriculum** (don't regenerate for same standards)
3. **Use cheaper models** for grading (Haiku instead of Sonnet)
4. **Set Inngest timeouts** (don't wait forever for approvals)

---

## IX. Troubleshooting

### Issue: Vercel deployment fails

```bash
# Check build logs
vercel logs

# Common causes:
# - Missing env vars: add in Vercel dashboard
# - TypeScript error: npm run type-check
# - Module not found: npm install
```

### Issue: Modal function timeout

```python
# Add timeout parameter
@app.function(timeout=600)  # 10 minutes
def long_running_task():
    ...
```

### Issue: Supabase webhook not firing

```bash
# Check in Studio:
# Database → Webhooks → see logs
# Common issues:
# - Auth header incorrect
# - Webhook URL unreachable
# - Event table has RLS preventing update
```

---

## X. Monitoring & Observability

### Free Tools You Get

| Tool | Provider | What It Shows |
|------|----------|---|
| Vercel Analytics | Vercel | Page load times, core web vitals |
| Supabase Monitoring | Supabase | Database queries, connections |
| Inngest Dashboard | Inngest | Workflow executions, errors |
| Modal Logs | Modal | Function invocations, errors |

---

## XI. Next: Build Phase 1

Once setup is complete:

1. ✅ Build Teacher Dashboard (Next.js)
2. ✅ Implement Curriculum Generation (Modal)
3. ✅ Grading Workflow (Inngest)
4. ✅ Classroom Insights (Supabase SQL functions)
5. ⏭️ Launch with pilot teacher

---

**Document Version:** 1.0
**Last Updated:** 2026-03-17
**Status:** Ready for Implementation

---

## Quick Command Reference

```bash
# Supabase
supabase link --project-ref xxxx
supabase db push
supabase db pull

# Modal
modal serve modal_app.py
modal deploy modal_app.py

# Vercel
vercel deploy
vercel env add SUPABASE_URL
vercel logs

# Inngest
inngest run
inngest describe

# Debugging
curl -X POST http://localhost:3000/api/test
modal run modal_app.py::generate_curriculum
```
