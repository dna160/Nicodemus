# Nicodemus Lean Stack Guide

## Why This Stack for a Solo Developer?

Building a multi-agent educational AI system is ambitious. Without the right tooling, it becomes a DevOps nightmare. This guide explains how each technology in the lean stack eliminates operational overhead, letting you focus on building features.

---

## The Core Stack (Cloud & Orchestration)

### 1. **Supabase** (Database + Auth + Pub/Sub + RLS)

**What it does:**
- PostgreSQL database (fully managed)
- Built-in authentication (JWT-based)
- Real-time subscriptions (like a lightweight message queue)
- Row-Level Security (RLS) for FERPA compliance

**Why it's perfect for Nicodemus:**
- **No DevOps burden**: Supabase manages backups, replication, scaling
- **Privacy-first built-in**: RLS policies enforce data isolation at the database level
  - A teacher can ONLY see their own students
  - A parent can ONLY see their own child's data
  - This is enforced by the database, not your application code
- **Event-driven without Kafka**: Supabase webhooks + Realtime subscriptions replace complex message queues
  - When a student record updates → webhook fires → Inngest processes it
  - When a lesson is published → real-time notification to teachers
- **Cost**: Free tier supports 500MB database + 2GB bandwidth. Pay-as-you-go after

**Cost vs. Self-Hosting:**
- Self-hosting PostgreSQL + Redis + nginx = weeks of setup + ongoing maintenance
- Supabase = `npm install && supabase link` = 5 minutes

**Lean Hack: Webhook Chain**
Instead of Kafka topics:
```
Student submits assignment
  ↓
Supabase detects record insert
  ↓
Webhook fires → POST to Inngest
  ↓
Inngest runs grading workflow
  ↓
Updates parent_notifications table
  ↓
Supabase Realtime notifies parent UI
```

---

### 2. **Modal** (Serverless AI Compute)

**What it does:**
- Run Python functions on serverless GPUs/CPUs
- Pay per second of compute, scale to zero
- Integrates with Anthropic API, Hugging Face, etc.

**Why it's perfect for Nicodemus:**
- **AI workloads are bursty**: Curriculum generation might take 30 seconds and happen once per week. You don't need a server running 24/7
- **GPU-friendly**: If you want to run open-source models locally (Llama 3, Mistral) for privacy, Modal gives you instant GPU access
- **Zero DevOps**: No container orchestration, no K8s, no auto-scaling config
- **Claude API is simple**: Just call `anthropic.messages.create()` from Modal functions
- **Cost**: ~$0.50-$2.00 per curriculum generation, ~$0.01 per grading task

**Example:**
```python
# This function runs on Modal, NOT on your laptop
@app.function()
def generate_curriculum(...):
    client = Anthropic()
    response = client.messages.create(...)
    return response
```

When you call `modal.run()` or a webhook triggers it, the function spins up, runs, and shuts down. You pay for those seconds only.

**Cost vs. Self-Hosting:**
- A persistent server (AWS EC2, Heroku) running 24/7 = $50-200/month
- Modal for bursty AI = $10-50/month (depending on usage)

---

### 3. **Inngest** (Event Orchestration & Workflow Engine)

**What it does:**
- Durable job scheduling and workflow orchestration
- Human-in-the-loop approvals (critical for education)
- Retry logic, error handling, and state management
- TypeScript-first (write workflows as functions)

**Why it's perfect for Nicodemus:**
- **Multi-step workflows**: "When student struggles → flag class → draft email → wait for teacher approval → send"
  - This is hard with raw webhooks
  - Inngest handles retries, state, and waiting
- **Human approval loops**: Teacher must approve before a parent email is sent
  - Inngest can wait for a human signal (UI button click) before proceeding
- **No queue management**: Unlike RabbitMQ/Kafka, you don't manage brokers or partitions
- **Cost**: Free tier includes 100K runs/month. That's millions of operations for a school

**Workflow Example:**
```typescript
// Runs durable workflow: automatically retries if steps fail
export const handleMilestoneAchieved = inngest.createFunction(
  { id: 'milestone-achieved' },
  { event: 'student/milestone_achieved' },
  async ({ event, step }) => {
    // Step 1: Fetch student data
    const student = await step.run('fetch-student', async () => {
      return supabase.from('students').select('*').single();
    });

    // Step 2: Draft email
    const draftId = await step.run('draft-email', async () => {
      return supabase.from('parent_notifications').insert({...});
    });

    // Step 3: Inngest waits for teacher to approve in UI
    // (No special code needed—just a button click updates DB)

    // Step 4: Send email
    await step.run('send-email', async () => {
      return sendgrid.send({...});
    });
  }
);
```

**Cost vs. Self-Hosting:**
- Queue system (RabbitMQ/Redis) = setup + monitoring + on-call
- Inngest = managed service, automatic scaling, built-in dashboards

---

## The Frontend (Teacher/Admin/Parent UI)

### 4. **Next.js** (Full-Stack Framework)

**What it does:**
- React framework for building web UIs
- Built-in API routes (replace Express, FastAPI, etc.)
- Automatic code splitting and optimization
- File-based routing

**Why it's perfect for Nicodemus:**
- **One language, full stack**: TypeScript everywhere (frontend + backend)
- **API routes are instant**: Need an endpoint that calls Modal? Add a file:
  ```typescript
  // pages/api/curriculum/generate.ts
  export default async function handler(req, res) {
    const result = await modal.invoke('generate_curriculum', ...);
    res.json(result);
  }
  ```
- **Seamless Supabase integration**: Auth, real-time, RLS all work out-of-the-box
- **Cost**: Next.js itself is free (open-source). Deploy to Vercel (free tier) or any host

**Alternative to Alternatives:**
- Django? Requires Python expertise, separate frontend framework
- Rails? Ruby, not TypeScript, slower iteration
- Express + React? More boilerplate, separate codebases to manage

---

### 5. **shadcn/ui** (Component Library)

**What it does:**
- Pre-built, accessible React components (buttons, forms, tables, modals)
- Tailwind CSS for styling
- Copy-paste components into your codebase (not a package)

**Why it's perfect for Nicodemus:**
- **Fast UI building**: Don't reinvent the wheel on tables, forms, and dropdowns
- **Accessibility for free**: Built-in ARIA labels and keyboard navigation (important for education)
- **Fully customizable**: Components live in your codebase, tweak at will
- **Cost**: Free (open-source)

---

## The Edge (Student Rep Agent)

### 6. **Tauri** (Lightweight Desktop App)

**What it does:**
- Build desktop apps (Windows, macOS, Linux) with Rust + React
- ~3-10MB binary (vs. Electron's ~150MB)
- Access to native OS (file system, window focus, keyboard)

**Why it's perfect for Nicodemus:**
- **Privacy at the edge**: The Student Rep Agent lives on the student's device
  - Keystrokes, app-switching, time-on-task is processed locally
  - Only sanitized insights are sent to the cloud (via Supabase)
- **Tiny footprint**: Tauri apps are <10MB; Electron is 150MB. For school IT, this is a big deal
- **React frontend**: You already know Next.js; Tauri uses the same React patterns
- **Cost**: Free (open-source). One-time build per platform

**Phase 1 Shortcut:**
Don't build the Tauri app immediately. In Phase 1, mock it:
```typescript
// Just a Next.js form that simulates study session data
// Teacher enters: "Student was stuck on fractions for 5 minutes"
// → POST to /api/student-metrics → Supabase
```

In Phase 2, replace with actual Tauri app that tracks keystroke patterns locally.

---

## The AI (Claude & Open-Source Models)

### 7. **Claude API** (Anthropic)

**What it does:**
- State-of-the-art LLM for instruction-following, reasoning
- Text analysis, generation, summarization

**Why it's perfect for Nicodemus:**
- **Teacher Assistant Agent**: Claude excels at curriculum generation (structured, creative, standards-aware)
- **Grading & Feedback**: Strong at rubric-based evaluation and personalized feedback
- **Cost**: ~$0.01 per curriculum, ~$0.001 per grading task (using Claude 3.5 Haiku)

**Optional: Open-Source Models on Modal**
If you want 100% privacy (no data to Anthropic), run Llama 3 on Modal:
```python
@app.function(gpu='A10G')  # Request GPU
def grade_assignment_locally(...):
    from transformers import AutoModelForCausalLM
    model = AutoModelForCausalLM.from_pretrained('meta-llama/Llama-3-8B-Instruct')
    # Grade locally, return result
```

Cost: ~$0.50 per GPU-hour on Modal (vs. $0.001 per API call with Claude).

**Recommendation for Phase 1:** Use Claude API. Switch to Llama 3 on Modal in Phase 2 if privacy is a hard requirement.

---

## Data Flow Architecture (Lean Version)

```
┌─────────────────────────────────────────────────────────────┐
│                     NICODEMUS DATA FLOW                      │
└─────────────────────────────────────────────────────────────┘

┌──────────────┐
│  Teacher UI  │ (Next.js)
│ (Tailwind)   │
└──────┬───────┘
       │ "Generate curriculum"
       ↓
┌─────────────────────────────────────────┐
│   Next.js API Route                     │
│   /api/curriculum/generate              │
│   - Validates input (Zod)               │
│   - Calls Modal function                │
└──────┬──────────────────────────────────┘
       │ HTTP call
       ↓
┌──────────────────────────────────────────────────────────────┐
│   Modal (Serverless)                                         │
│   - Calls Claude API                                         │
│   - Generates structured curriculum JSON                     │
│   - Returns result                                           │
└──────┬───────────────────────────────────────────────────────┘
       │ JSON response
       ↓
┌─────────────────────────────────────────┐
│   Next.js API Route                     │
│   - Saves to Supabase.lessons table     │
│   - Publishes Inngest event             │
└──────┬──────────────────────────────────┘
       │ INSERT + EVENT
       ↓
┌──────────────────────────────────────┐
│   Supabase                           │
│   - Stores lesson record             │
│   - Triggers webhook on insert       │
└──────┬───────────────────────────────┘
       │ Webhook POST
       ↓
┌──────────────────────────────────────┐
│   Inngest                            │
│   - Triggers "curriculum/published"  │
│   - Runs workflow: check resources   │
│   - Draft parent notifications       │
└──────┬───────────────────────────────┘
       │ INSERT parent_notifications
       ↓
┌──────────────────────────────────────┐
│   Supabase                           │
│   - Saves notification draft         │
│   - Realtime notifies teacher UI     │
└──────┬───────────────────────────────┘
       │ Realtime event
       ↓
┌──────────────────────────────────────┐
│   Teacher UI                         │
│   - Shows draft email                │
│   - Teacher clicks "Approve" (HITL)  │
└──────────────────────────────────────┘
```

**No Kafka. No Redis. No separate workers.**

---

## Cost Breakdown (Per Month)

| Service | Phase 1 Cost | Notes |
|---------|--------------|-------|
| **Supabase** | $0-25 | Free tier + pay-as-you-go |
| **Modal** | $10-50 | AI workloads (curriculum, grading) |
| **Inngest** | $0 | Free tier: 100K/month |
| **Next.js/Vercel** | $0-20 | Free tier or $20 Pro |
| **Claude API** | $5-20 | ~0.001-0.01 per request |
| **Domain + Email** | $10-20 | Domain registrar + SendGrid/Mailgun |
| **TOTAL** | **$25-135/month** | Scales with 10,000+ students |

**Compare to Enterprise Stack:**
- Kafka + RabbitMQ hosting: $500+/month
- Kubernetes cluster: $200+/month
- Dedicated DevOps person: $100K+/year
- **Lean stack saves: $500K+/year for a solo dev**

---

## Phase 1 vs. Phase 2 Roadmap

### Phase 1 (Weeks 1-12): Teacher Assistant
- [ ] Next.js frontend (teacher dashboard)
- [ ] Supabase schema (lessons, classes, assignments)
- [ ] Modal functions (curriculum generation, grading)
- [ ] Inngest workflows (curriculum published → check resources)
- [ ] Basic RLS policies (teacher sees own students)
- **Cost**: $0-50/month

### Phase 1b (Weeks 13-20): Parent Communication
- [ ] Parent Relationship Management (PRM) Agent
- [ ] Parent notifications (draft, approve, send)
- [ ] Communication timeline
- [ ] Inngest workflows (milestone achieved → draft email → teacher approval)
- **Cost**: $25-75/month

### Phase 1c (Weeks 21-28): School Operations
- [ ] School ERP Agent (staff, assets, scheduling)
- [ ] Inventory tracking
- [ ] Absence management workflows
- **Cost**: $50-100/month

### Phase 2 (Months 4-6): Student Edge
- [ ] Tauri desktop app (Student Rep Agent)
- [ ] Habit tracking (keystrokes, app-switching)
- [ ] Sanitization pipeline (raw → synthesized metrics)
- [ ] Supabase Realtime sync
- **Cost**: $100-200/month

---

## Key Principles: Stay Lean

1. **Don't build infrastructure**, use managed services
2. **Don't optimize prematurely**, monoliths are fine for Phase 1
3. **Don't over-engineer**, skip the message queue until you have 100K events/day
4. **Delegate ops to platforms**, Vercel, Supabase, Modal handle scale

---

## Getting Started Checklist

- [ ] Read this guide
- [ ] Clone repo: `git clone https://github.com/dna160/Nicodemus`
- [ ] Install dependencies: `pnpm install`
- [ ] Follow `SETUP_INSTRUCTIONS.md`
- [ ] Start local Supabase: `supabase start`
- [ ] Deploy Modal functions: `modal deploy modal_app.py`
- [ ] Start Next.js: `pnpm -F web dev`
- [ ] Build first feature: Teacher curriculum generation

You're ready. Ship it. 🚀
