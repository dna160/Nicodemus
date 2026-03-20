# Nicodemus — Master Implementation Reference
**Enterprise Educational AI Suite (EEAS)**
*Last updated: 2026-03-20 | Version 4.0*

> **Purpose:** Single source of truth for the entire codebase. Use this to find where any feature lives, what API to call, which table to query, or which migration to reference.

---

## Table of Contents
1. [Project Overview](#1-project-overview)
2. [Technology Stack](#2-technology-stack)
3. [Phase Status](#3-phase-status)
4. [Monorepo Structure](#4-monorepo-structure)
5. [UI Pages](#5-ui-pages)
6. [Reusable Components](#6-reusable-components)
7. [API Surface — All Routes](#7-api-surface--all-routes)
8. [Database Schema — All Tables](#8-database-schema--all-tables)
9. [Supabase Migrations](#9-supabase-migrations)
10. [Supabase Storage Buckets](#10-supabase-storage-buckets)
11. [Modal AI Endpoints](#11-modal-ai-endpoints)
12. [Inngest Workflows](#12-inngest-workflows)
13. [Business Logic Reference](#13-business-logic-reference)
14. [Environment Variables](#14-environment-variables)
15. [Shared Packages & Libraries](#15-shared-packages--libraries)
16. [Design System](#16-design-system)

---

## 1. Project Overview

**Product:** Nicodemus, Teacher of Teachers
**Tagline:** A federated, event-driven AI ecosystem that revolutionizes school operations.
**Repository:** `github.com/dna160/Nicodemus`
**Deployment:** Next.js on Vercel + Supabase (database/auth/storage) + Modal (AI compute) + Inngest (workflows)

**Core pillars:**
- Edge-first student privacy (behavioral data stays local)
- Event-driven, loosely-coupled agent architecture
- Human-in-the-loop (HITL) for all high-stakes decisions
- FERPA/COPPA compliance by design
- No DevOps — serverless all the way

---

## 2. Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Database + Auth + Realtime | Supabase | RLS-enforced FERPA isolation |
| AI Compute | Modal | Serverless LLM endpoints (Claude) |
| Event Orchestration | Inngest | Durable async workflows |
| Frontend + API | Next.js 15 (App Router) | Full-stack, deployed on Vercel |
| File Storage | Supabase Storage | Profile pictures, onboarding documents |
| Payments | Stripe | Invoices, webhooks, customer management |
| Edge Client | Tauri (planned) | Rust + React desktop app for students |
| Styling | Tailwind CSS v3 | Dark-mode-aware design system |
| Type Safety | TypeScript (strict) | Zero-error policy enforced |
| Runtime | pnpm workspaces (monorepo) | `apps/web`, `apps/workflows`, `packages/shared` |

---

## 3. Phase Status

| Phase | Name | Status | Location |
|-------|------|--------|----------|
| 1a | Teacher Assistant Agent (Curriculum & Homework) | ✅ Complete | `apps/web/src/app/dashboard/` |
| 1b | PRM Agent (Parent Communications) | ✅ Complete | `apps/web/src/app/api/communications/` |
| 1c | ERP Agent (Student Review HITL) | ✅ Complete | `apps/web/src/app/api/erp/` |
| 2a | Admin Admissions CRM (Kanban Pipeline) | ✅ Complete | `apps/web/src/app/admin/dashboard/` |
| 2b | Financial Orchestration (Stripe Integration) | ✅ Schema + API | `apps/web/src/app/api/stripe/` |
| 2c | Enrollment & Onboarding Document Tracking | ✅ Schema + API | `apps/web/src/app/api/onboarding/` |
| 2d | Parent Portal | ✅ UI scaffolded | `apps/web/src/app/parent/dashboard/` |
| 2e | Unified Student Listing | ✅ Complete | `apps/web/src/app/students/unified-listing/` |
| 3 | Student Rep Agent (Tauri Desktop) | 🔵 Planned | — |

---

## 4. Monorepo Structure

```
Nicodemus/
├── apps/
│   ├── web/                        # Next.js 15 app (main product)
│   │   ├── src/
│   │   │   ├── app/                # App Router pages and API routes
│   │   │   │   ├── admin/          # Admin portal
│   │   │   │   ├── admissions/     # Public admissions pages
│   │   │   │   ├── api/            # All API route handlers
│   │   │   │   ├── dashboard/      # Teacher dashboard
│   │   │   │   ├── parent/         # Parent portal
│   │   │   │   ├── student/        # Student dashboard
│   │   │   │   └── students/       # Admin student management views
│   │   │   ├── components/         # Reusable UI components
│   │   │   └── lib/                # Utilities, clients, helpers
│   │   ├── next.config.js
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── workflows/                  # Inngest workflow definitions
│       └── src/
│           ├── index.ts            # Inngest client + function registry
│           ├── prm-daily-summary.ts
│           └── erp-student-study-review.ts
├── packages/
│   └── shared/                     # Shared TypeScript types and constants
│       └── src/
│           └── constants.ts
├── supabase/
│   └── migrations/                 # Ordered SQL migrations (applied via supabase db push)
├── documentation/                  # Architecture docs, setup guides, RLS reference
├── modal_app.py                    # Modal AI endpoint definitions (all LLM calls)
├── modal_student_metrics.py        # Modal student metrics processing
├── .env                            # Server-side env vars (gitignored)
├── .env.local                      # Local overrides (gitignored)
├── implementations.md              # ← You are here
└── pnpm-workspace.yaml
```

---

## 5. UI Pages

All pages live under `apps/web/src/app/`. Next.js App Router — each `page.tsx` is a route.

### Teacher Dashboard
| Route | File | Description |
|-------|------|-------------|
| `/dashboard` | `dashboard/page.tsx` | Teacher hub: curriculum list, classes, students, reviews, communications tabs |
| `/dashboard/dev/simulate-student` | `dashboard/dev/simulate-student/page.tsx` | Dev tool to simulate student homework + study sessions |

**Teacher Dashboard Tabs (all in `dashboard/page.tsx`):**
- **Overview** — class metrics, recent activity
- **Curriculum** — curriculum cards, generate new, navigate to detail
- **Classes** — class roster with student count
- **Students** — student list with quick-glance modal
- **Reviews** — HITL queue for pending homework and study session reviews
- **Communications** — PRM drafts awaiting approval

### Admin Dashboard
| Route | File | Description |
|-------|------|-------------|
| `/admin/dashboard` | `admin/dashboard/page.tsx` | Admin hub with Kanban pipeline, overview metrics, teacher management |

**Admin Dashboard Tabs:**
- **Overview** — school-level stats, enrollment numbers
- **Admissions / Pipeline** — 5-column Kanban (Inquiry → Tour Scheduled → Waitlist → Enrolled → Churned)
- **Teachers** — teacher roster management
- **Settings** — school configuration

**Kanban Board Components (inline in `admin/dashboard/page.tsx`):**
- `CreateStudentModal` — 9-field form (name, pipeline stage, DOB, location, parent info ×3, curriculum, profile picture)
- `PipelineCard` — student card with avatar, info, move arrows
- `AdmissionsTab` — 5-column board with badge counts

### Student Dashboard
| Route | File | Description |
|-------|------|-------------|
| `/student/dashboard` | `student/dashboard/page.tsx` | Student hub: homework list, grades, study sessions, notifications |

### Parent Portal
| Route | File | Description |
|-------|------|-------------|
| `/parent/dashboard` | `parent/dashboard/page.tsx` | Parent hub: child overview, document uploads, invoice tracking, communications |

### Admissions (Public-Facing)
| Route | File | Description |
|-------|------|-------------|
| `/admissions/inquiry-form` | `admissions/inquiry-form/page.tsx` | Public inquiry form for prospective families |
| `/admissions/pipeline` | `admissions/pipeline/page.tsx` | Admissions officer CRM view (authenticated) |

### Student Management (Admin)
| Route | File | Description |
|-------|------|-------------|
| `/students/unified-listing` | `students/unified-listing/page.tsx` | Master student data grid with timeline, filters, export |
| `/students/[id]/onboarding-checklist` | `students/[id]/onboarding-checklist/page.tsx` | Document submission tracker for newly enrolled student |
| `/students/[id]/onboarding-documents` | `students/[id]/onboarding-documents/page.tsx` | Admin document review dashboard (verify / reject uploads) |

### App Shell
| Route | File | Description |
|-------|------|-------------|
| `/` | `app/page.tsx` | Landing / root redirect |
| Layout | `app/layout.tsx` | Root layout: fonts, providers, Nicodemus AI modal |
| `error.tsx` | `app/error.tsx` | Segment-level error boundary with retry |
| `global-error.tsx` | `app/global-error.tsx` | Root-level error boundary |
| `not-found.tsx` | `app/not-found.tsx` | 404 with dashboard link |

---

## 6. Reusable Components

All components live under `apps/web/src/components/`.

| Component | File | Purpose |
|-----------|------|---------|
| `NicodemusAIModal` | `nicodemus-ai-modal.tsx` | Top-bar AI chat modal — single instance in layout, opens anywhere |
| `KanbanBoard` | `kanban-board.tsx` | Reusable 5-column Kanban with drag-to-move arrows |
| `CurriculumTab` | `curriculum-tab.tsx` | Teacher dashboard curriculum tab with card grid and generator |
| `CurriculumDetail` | `curriculum-detail.tsx` | Curriculum detail view with lessons, assignments, variants |
| `CurriculumBrowse` | `curriculum-browse.tsx` | Curriculum library browse/search view |
| `HomeworkReviewModal` | `homework-review-modal.tsx` | HITL review modal for homework submissions |
| `HomeworkQuestionEditor` | `homework-question-editor.tsx` | Per-question editing for draft assignments |
| `StudentDetailTimeline` | `student-detail-timeline.tsx` | Chronological event timeline for a student (enrollments, absences, grades) |
| `DocumentUploadForm` | `document-upload-form.tsx` | Drag-and-drop file upload with MIME validation and progress |
| `ScrollFade` | `scroll-fade.tsx` | Scroll indicator that fades in/out at scroll boundaries |

---

## 7. API Surface — All Routes

All routes live under `apps/web/src/app/api/`. All are Next.js Route Handlers.

### Curriculum
| Method | Route | File | Purpose |
|--------|-------|------|---------|
| GET | `/api/curriculum` | `curriculum/route.ts` | List teacher's curriculum units |
| POST | `/api/curriculum/generate` | `curriculum/generate/route.ts` | Generate new curriculum via Modal |
| GET | `/api/curriculum/[id]` | `curriculum/[id]/route.ts` | Get curriculum detail with all lessons |

### Homework
| Method | Route | File | Purpose |
|--------|-------|------|---------|
| GET | `/api/homework` | `homework/route.ts` | List assignments (filter by `lessonId`) |
| GET | `/api/homework/[id]` | `homework/[id]/route.ts` | Get single assignment detail |
| POST | `/api/homework/generate` | `homework/generate/route.ts` | AI-generate homework from lesson context |
| POST | `/api/homework/custom-generate` | `homework/custom-generate/route.ts` | Generate from teacher topic prompt |
| PATCH | `/api/homework/draft-update` | `homework/draft-update/route.ts` | Edit draft questions/due date |
| POST | `/api/homework/publish` | `homework/publish/route.ts` | Publish draft assignment(s) to students |

### Student Homework
| Method | Route | File | Purpose |
|--------|-------|------|---------|
| GET | `/api/student/homework` | `student/homework/route.ts` | Student's assignments + submission status |
| GET | `/api/student/homework/[id]` | `student/homework/[id]/route.ts` | Assignment detail + student submission |
| POST | `/api/student/homework/[id]/submit` | `student/homework/[id]/submit/route.ts` | Submit answers (triggers AI pre-grading) |

### Student Profile & Notifications
| Method | Route | File | Purpose |
|--------|-------|------|---------|
| GET/PATCH | `/api/student/profile` | `student/profile/route.ts` | Get or update student profile |
| GET | `/api/student/notifications` | `student/notifications/route.ts` | Fetch student notification feed |

### ERP / Teacher Review (HITL)
| Method | Route | File | Purpose |
|--------|-------|------|---------|
| GET | `/api/erp/review-tasks` | `erp/review-tasks/route.ts` | List pending review tasks for teacher |
| POST | `/api/erp/review-tasks/[id]/complete-review` | `erp/review-tasks/[id]/complete-review/route.ts` | Submit grades + trigger AI synthesis |
| POST | `/api/erp/review-tasks/[id]/approve` | `erp/review-tasks/[id]/approve/route.ts` | Approve study session review |
| POST | `/api/erp/review-tasks/[id]/dismiss` | `erp/review-tasks/[id]/dismiss/route.ts` | Dismiss a review task |
| GET | `/api/erp/absences` | `erp/absences/route.ts` | Absence records for a class/student |
| GET | `/api/erp/feedback` | `erp/feedback/route.ts` | Historical feedback for a student |

### Communications (PRM)
| Method | Route | File | Purpose |
|--------|-------|------|---------|
| GET | `/api/communications` | `communications/route.ts` | List parent communication drafts |
| POST | `/api/communications/[id]/approve` | `communications/[id]/approve/route.ts` | Approve and send communication |
| POST | `/api/communications/[id]/reject` | `communications/[id]/reject/route.ts` | Reject communication draft |

### Admin — Students & Pipeline
| Method | Route | File | Purpose |
|--------|-------|------|---------|
| GET | `/api/admin/pipeline` | `admin/pipeline/route.ts` | Fetch all prospective students for school |
| GET | `/api/admin/students` | `admin/students/route.ts` | List students with filters |
| POST | `/api/admin/students/create` | `admin/students/create/route.ts` | Create prospective student with file upload |
| PATCH | `/api/admin/students/pipeline` | `admin/students/pipeline/route.ts` | Move student between pipeline stages |
| GET | `/api/admin/teachers` | `admin/teachers/route.ts` | List school teachers |
| GET | `/api/admin/overview` | `admin/overview/route.ts` | Admin dashboard summary metrics |

**`POST /api/admin/students/create` — Request:**
- Accepts `multipart/form-data`
- Fields: `childName`, `pipelineStage`, `dateOfBirth`, `location`, `parentName`, `parentEmail`, `parentPhone`, `curriculumId`, `profilePicture` (file)
- Returns: `{ success, student, studentId }` — `studentId` format: `NIC-{Initials}{Year}-{RandomAlphaNum}` e.g. `NIC-AJ2026-K3P7`

**`PATCH /api/admin/students/pipeline` — Request:**
- Body: `{ studentId: string, newStage: string }`
- Valid stages: `inquiry_received | tour_scheduled | waitlisted | enrolled | churned`

### Admissions
| Method | Route | File | Purpose |
|--------|-------|------|---------|
| GET | `/api/admissions/pipeline` | `admissions/pipeline/route.ts` | Fetch pipeline prospects (RLS scoped to school) |
| PATCH | `/api/admissions/pipeline/[id]/stage` | `admissions/pipeline/[id]/stage/route.ts` | Move prospect through pipeline |
| POST | `/api/admissions/[id]/generate-welcome-email` | `admissions/[id]/generate-welcome-email/route.ts` | AI-generate welcome email draft |
| GET | `/api/admissions/[id]/drafts` | `admissions/[id]/drafts/route.ts` | Fetch email drafts for approval |
| POST | `/api/admissions/[id]/approve-email` | `admissions/[id]/approve-email/route.ts` | Approve and send drafted email |

### Enrollment & Financial
| Method | Route | File | Purpose |
|--------|-------|------|---------|
| POST | `/api/students/[id]/enroll` | `students/[id]/enroll/route.ts` | Convert prospect to enrolled student + create Stripe invoice |
| GET | `/api/students/unified-listing` | `students/unified-listing/route.ts` | Aggregated student data with timeline events |
| GET | `/api/fee-schedule` | `fee-schedule/route.ts` | Fetch school fee configuration by grade |
| POST | `/api/stripe/webhooks` | `stripe/webhooks/route.ts` | Handle Stripe payment events (paid, failed, refunded) |

### Onboarding & Documents
| Method | Route | File | Purpose |
|--------|-------|------|---------|
| POST | `/api/onboarding/upload-document` | `onboarding/upload-document/route.ts` | Parent uploads document to Supabase Storage |
| GET | `/api/onboarding/checklist/[studentId]` | `onboarding/checklist/[studentId]/route.ts` | Document checklist status for student |
| POST | `/api/onboarding/reminder-missing-docs` | `onboarding/reminder-missing-docs/route.ts` | Cron: send reminders for missing documents (max 2 per student) |

### Public (No Auth)
| Method | Route | File | Purpose |
|--------|-------|------|---------|
| POST | `/api/public/inquiry-form` | `public/inquiry-form/route.ts` | Submit inquiry from public-facing form (rate-limited) |

### Teacher
| Method | Route | File | Purpose |
|--------|-------|------|---------|
| GET | `/api/teacher/classes` | `teacher/classes/route.ts` | Teacher's class list with student counts |
| GET | `/api/teacher/students/[id]/quick-glance` | `teacher/students/[id]/quick-glance/route.ts` | Quick student snapshot (attendance, recent grade, flags) |

### Dev Tools
| Method | Route | File | Purpose |
|--------|-------|------|---------|
| POST | `/api/dev/submit-student-metrics` | `dev/submit-student-metrics/route.ts` | Simulate student metric submission (dev only) |
| GET | `/api/dev/workflow-status` | `dev/workflow-status/route.ts` | Check Inngest workflow run status (dev only) |

---

## 8. Database Schema — All Tables

### Core Identity
| Table | Key Columns | Notes |
|-------|------------|-------|
| `users` | `id`, `email`, `created_at` | Managed by Supabase Auth |
| `schools` | `id`, `name`, `address`, `created_at` | Top-level tenant |
| `teachers` | `id`, `user_id`, `school_id`, `name`, `subject` | `user_id` → `auth.uid()` |
| `students` | `id`, `teacher_id`, `name`, `grade`, `parent_email` | Enrolled students |
| `global_admins` | `id`, `user_id`, `can_view_all_schools`, `managed_schools` | District-level oversight; `managed_schools` is UUID array |

### Curriculum & Instruction
| Table | Key Columns | Notes |
|-------|------------|-------|
| `curricula` | `id`, `teacher_id`, `subject`, `grade_level`, `title`, `content` | Generated by Modal |
| `lessons` | `id`, `curriculum_id`, `title`, `content`, `grading_system`, `order_index` | Lessons within a curriculum unit |
| `assignments` | `id`, `lesson_id`, `title`, `questions` (JSONB), `status`, `due_date`, `subject` | `status`: `draft` \| `active` |
| `submissions` | `id`, `assignment_id`, `student_id`, `answers` (JSONB), `submission_status`, `ai_grade`, `teacher_grade`, `final_grade`, `per_answer_feedback` (JSONB), `overall_feedback` (JSONB) | Grading lifecycle |

**Submission grading columns:**
- `ai_grade` — initial AI score (0–100)
- `teacher_grade` — per-answer sum from teacher review
- `final_grade` — authoritative score shown to student (`teacher_grade ?? ai_grade`)
- `per_answer_feedback` — JSONB array: `[{ question_id, teacher_feedback, ai_insight }]`
- `overall_feedback` — JSONB: `{ teacher_notes, ai_synthesis }`
- `submission_status` — `submitted | grading | pending_review | graded`

### Review & Monitoring
| Table | Key Columns | Notes |
|-------|------------|-------|
| `teacher_review_tasks` | `id`, `teacher_id`, `student_id`, `submission_id`, `session_id`, `task_type`, `status` | HITL queue; `task_type`: `homework_review` \| `study_session_review` |
| `study_sessions` | `id`, `student_id`, `focus_score`, `idle_time_seconds`, `keystroke_rate`, `tab_switch_count`, `ai_summary`, `struggle_events` (JSONB) | Behavioral metrics (Phase 2 edge) |
| `student_metrics` | `id`, `student_id`, `metric_type`, `value`, `recorded_at` | Time-series performance data |

### Communications
| Table | Key Columns | Notes |
|-------|------------|-------|
| `communication_log` | `id`, `teacher_id`, `student_id`, `parent_email`, `draft_content`, `status`, `sent_at` | PRM drafts; `status`: `pending` \| `approved` \| `rejected` \| `sent` |
| `parent_notifications` | `id`, `parent_email`, `student_id`, `message`, `type`, `sent_at` | Push/SMS notification log |

### Admissions CRM
| Table | Key Columns | Notes |
|-------|------------|-------|
| `prospective_students` | `id`, `school_id`, `parent_name`, `email`, `phone`, `child_name`, `grade_interested`, `current_stage`, `source`, `date_of_birth`, `location`, `student_id`, `profile_picture_url`, `curriculum_id`, `last_contact_at` | Pipeline management; `current_stage`: `inquiry_received \| tour_scheduled \| waitlisted \| enrolled \| churned` |
| `email_drafts` | `id`, `prospective_student_id`, `subject`, `body`, `status`, `approved_by`, `sent_at` | Admissions welcome email drafts |

**`prospective_students` stage values:**
```
inquiry_received → tour_scheduled → waitlisted → enrolled | churned
```

### Financial
| Table | Key Columns | Notes |
|-------|------------|-------|
| `fee_schedule` | `id`, `school_id`, `grade_level`, `registration_fee_cents`, `monthly_tuition_cents`, `activity_fee_cents`, `effective_from`, `effective_to` | School pricing config; `UNIQUE(school_id, grade_level, effective_from)` |
| `stripe_customers` | `id`, `student_id`, `stripe_customer_id`, `email` | One-to-one with enrolled students |
| `invoices` | `id`, `student_id`, `prospective_student_id`, `stripe_invoice_id`, `fee_breakdown` (JSONB), `total_amount_cents`, `status`, `due_date`, `paid_at` | Can belong to enrolled OR prospective student |
| `payment_receipts` | `id`, `invoice_id`, `stripe_payment_intent_id`, `amount_cents`, `status`, `metadata` (JSONB) | Full Stripe webhook payload for audit trail |

**Invoice `status` values:** `draft | sent | paid | overdue | cancelled | refunded`
**`fee_breakdown` JSONB shape:** `{ registration_fee_cents, monthly_tuition_cents, activity_fees_cents }`

### Onboarding
| Table | Key Columns | Notes |
|-------|------------|-------|
| `onboarding_checklist` | `id`, `student_id`, `document_type`, `status`, `submission_file_path`, `submission_date`, `verified_by`, `rejection_reason`, `reminder_count`, `reminder_last_sent_at` | `UNIQUE(student_id, document_type)` |

**`document_type` values:** `medical_records | emergency_contacts | proof_of_residency | immunization_records | birth_certificate`
**`status` values:** `pending | submitted | verified | rejected`
**Storage path pattern:** `student-onboarding-documents/{student_id}/{document_type}/{filename}`

---

## 9. Supabase Migrations

Applied in order via `supabase db push`. All files in `supabase/migrations/`.

| File | Date | Description |
|------|------|-------------|
| `20260101000001_init.sql` | 2026-01-01 | Base schema: schools, users, teachers, students, curricula, lessons |
| `20260317000001_add_grading_system_to_lessons.sql` | 2026-03-17 | Adds `grading_system` column to `lessons` |
| `20260317000002_add_lessons_rls_policies.sql` | 2026-03-17 | RLS policies for lessons table (teacher-scoped read/write) |
| `20260317000003_prm_rls_policies.sql` | 2026-03-17 | RLS for parent communications |
| `20260317000004_prm_nullable_parent_student.sql` | 2026-03-17 | Makes `parent_id`/`student_id` nullable in comms log |
| `20260317000005_prm_expand_status_enum.sql` | 2026-03-17 | Adds `sent` to communication status enum |
| `20260317000006_prm_update_communication_log.sql` | 2026-03-17 | Schema updates for communication log table |
| `20260317000007_erp_agent_schema.sql` | 2026-03-17 | ERP schema: review tasks, study sessions, student metrics |
| `20260317000008_erp_rls_policies.sql` | 2026-03-17 | RLS for ERP tables (teacher and student scoped) |
| `20260318000001_student_metrics.sql` | 2026-03-18 | Student metrics time-series table |
| `20260318000002_review_tasks_update.sql` | 2026-03-18 | Review tasks schema updates (type enum, indexes) |
| `20260318000003_homework_system.sql` | 2026-03-18 | Assignments and submissions tables |
| `20260318000004_assignments_subject.sql` | 2026-03-18 | Adds `subject` column to assignments |
| `20260318000005_submission_review.sql` | 2026-03-18 | Grading columns on submissions (`ai_grade`, `teacher_grade`, `final_grade`, `per_answer_feedback`, `overall_feedback`) |
| `20260318000006_homework_publishing.sql` | 2026-03-18 | Draft/active status workflow for assignments |
| `20260319000001_student_create_fields.sql` | 2026-03-19 | Adds `date_of_birth`, `location`, `student_id` (unique), `profile_picture_url`, `curriculum_id` to `prospective_students`; creates `student-profiles` storage bucket |
| `20260401000001_admissions_crm_schema.sql` | 2026-04-01 | Full admissions CRM: `global_admins`, `fee_schedule`, `prospective_students`, `email_drafts`, `parent_notifications` |
| `20260401000002_admissions_rls_policies.sql` | 2026-04-01 | RLS for admissions tables (school-scoped, global admin override) |
| `20260415000001_financial_schema.sql` | 2026-04-15 | Financial tables: `stripe_customers`, `invoices`, `payment_receipts` |
| `20260415000002_financial_rls_policies.sql` | 2026-04-15 | RLS for financial tables (parent sees own invoices; service role full access) |
| `20260419000001_fix_lessons_rls_service_role.sql` | 2026-04-19 | Adds service role bypass policy on `lessons` to allow AI curriculum generation |
| `20260420000001_onboarding_checklist_schema.sql` | 2026-04-20 | Onboarding checklist table + indexes for cron job queries |
| `20260420000002_onboarding_checklist_rls.sql` | 2026-04-20 | RLS: parents see own child's checklist; admins see all; service role full access |

---

## 10. Supabase Storage Buckets

| Bucket | Access | Max Size | MIME Types | Path Pattern |
|--------|--------|----------|-----------|--------------|
| `student-profiles` | Public read, service role write | 5MB | image/jpeg, image/png, image/webp, image/gif | `{studentId}/{timestamp}.{ext}` |
| `student-onboarding-documents` | Private (parent + admin read), service role write | 10MB | application/pdf, image/* | `{studentId}/{documentType}/{filename}` |

---

## 11. Modal AI Endpoints

All LLM computation runs on Modal. Base URL configured via `MODAL_API_URL` env var.
Endpoint definitions live in `modal_app.py`.

| Endpoint | Method | Purpose | Caller |
|----------|--------|---------|--------|
| `/generate_curriculum` | POST | Generate multi-week curriculum with grade context | `POST /api/curriculum/generate` |
| `/generate_lesson_variants` | POST | Teaching style adaptation variants for a lesson | Teacher dashboard |
| `/generate_homework` | POST | Auto-generate homework from lesson content | `POST /api/homework/generate` |
| `/generate_custom_homework` | POST | Generate homework from teacher topic prompt | `POST /api/homework/custom-generate` |
| `/grade_assignment` | POST | Pre-grade student submission with rubric | `POST /api/student/homework/[id]/submit` |
| `/generate_parent_email` | POST | Draft parent communication | `POST /api/communications` (via Inngest) |
| `/generate_sub_lesson_plan` | POST | Substitute teacher lesson plan | Teacher dashboard |
| `/generate_welcome_email` | POST | Draft admissions welcome email | `POST /api/admissions/[id]/generate-welcome-email` |
| `/synthesize_review_feedback` | POST | Combine teacher notes with AI analysis after HITL review | `POST /api/erp/review-tasks/[id]/complete-review` |

**All endpoints receive:**
- `grade_context` — K–12 developmental guidance string (from `getGradeContext()` in `lib/modal.ts`)
- `school_id` — for multi-tenant isolation

---

## 12. Inngest Workflows

Workflow definitions in `apps/workflows/src/`.

| Function | File | Trigger Event | Purpose |
|----------|------|---------------|---------|
| `prm-daily-summary` | `prm-daily-summary.ts` | `prm/daily-summary` (cron) | Fetch at-risk students, generate parent email drafts via Modal |
| `erp-student-study-review` | `erp-student-study-review.ts` | `erp/study-session-completed` | Process study session data, AI analyze, create teacher review task |
| Enrollment pipeline | `index.ts` | `enrollment/student-enrolled` | Create Stripe customer, send invoice, initialize onboarding checklist |
| Document reminder | `index.ts` | `onboarding/reminder-check` (cron) | Find students with missing docs, send reminders (max 2 per student) |

**Inngest config:**
- Client initialized in `apps/web/src/lib/inngest.ts`
- Events fire via `inngest.send()` from API routes
- Wrapped in try-catch — gracefully skipped if `INNGEST_EVENT_KEY` not set
- Webhook endpoint: `/api/inngest` (auto-registered by `@inngest/next`)

---

## 13. Business Logic Reference

### Student ID Generation
**Location:** `apps/web/src/app/api/admin/students/create/route.ts`
**Format:** `NIC-{Initials}{Year}-{RandomAlphaNum}`
**Example:** `NIC-AJ2026-K3P7`
- Initials = first letter of first name + first letter of last name (uppercased)
- Year = current calendar year
- Random = 4 alphanumeric chars (A-Z0-9)
- Collision handling: if ID exists in DB, regenerates with timestamp suffix and retries once

### DOB to Grade Calculation
**Location:** `apps/web/src/app/admin/dashboard/page.tsx` (inline in `CreateStudentModal`)
**Logic:** Calculates age from DOB → maps to recommended grade level
```
Age 3-4  → Pre-K
Age 5    → Kindergarten
Age 6    → Grade 1
Age 7    → Grade 2
...
Age 17   → Grade 12
Age 18+  → Adult Education
```
Displayed below DOB field as advisory text; teacher can override the grade dropdown.

### Pipeline Stage Flow
**Stages (in order):** `inquiry_received → tour_scheduled → waitlisted → enrolled | churned`
- Movement via arrow buttons on `PipelineCard` (← prev, → next)
- Buttons disabled at boundary stages
- `enrolled` and `churned` are terminal stages (no forward/back between them)
- Stage change updates `current_stage` and `last_contact_at` in `prospective_students`

### Grading Pipeline
1. Student submits answers → `POST /api/student/homework/[id]/submit`
2. Modal grades automatically → sets `ai_grade`, `submission_status: pending_review`
3. `teacher_review_tasks` record created for HITL queue
4. Teacher reviews in dashboard → sets per-answer scores, notes
5. `POST /api/erp/review-tasks/[id]/complete-review` → calculates `teacher_grade`, triggers Modal synthesis
6. Modal synthesizes teacher notes + original AI analysis → stores `overall_feedback.ai_synthesis`
7. `final_grade = teacher_grade ?? ai_grade`, `submission_status: graded`
8. Student sees final grade with teacher notes and AI feedback per question

### Grade Context (Modal)
**Location:** `apps/web/src/lib/modal.ts` — `getGradeContext(gradeLevel: string)`
Returns developmental guidance string for the grade level (e.g., "Use simple language for K-2; focus on concrete examples"). Injected into every Modal prompt.

### Enrollment Flow
1. Admin clicks "Enroll" on a `prospective_student`
2. `POST /api/students/[id]/enroll`:
   - Creates record in `students` table
   - Looks up `fee_schedule` for the student's grade
   - Creates `stripe_customers` record
   - Creates draft `invoices` record with `fee_breakdown`
   - Fires `enrollment/student-enrolled` Inngest event
3. Inngest picks up event → sends Stripe invoice → initializes `onboarding_checklist` rows for all 5 document types

---

## 14. Environment Variables

| Variable | Required | Where Used | Purpose |
|----------|----------|-----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Client + Server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Client + Server | Public anon key for browser auth |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Server only | Admin access bypassing RLS (AI pipelines, file uploads) |
| `MODAL_API_URL` | ✅ | `lib/modal.ts` | Base URL for all Modal LLM endpoints |
| `CLAUDE_API_KEY` | ✅ | Passed to Modal | Anthropic API key for Claude calls |
| `STRIPE_SECRET_KEY` | ✅ | `lib/stripe.ts` | Stripe server-side API key |
| `STRIPE_WEBHOOK_SECRET` | ✅ | `api/stripe/webhooks` | Validates Stripe webhook signatures |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | ✅ | Client | Stripe publishable key for frontend |
| `INNGEST_EVENT_KEY` | Optional | `lib/inngest.ts` | Enables Inngest event emission |
| `INNGEST_SIGNING_KEY` | Optional | `/api/inngest` | Secures Inngest webhook endpoint |
| `RESEND_API_KEY` | Optional | Email sending | Transactional emails (welcome, reminders) |

> **RLS Note:** `SUPABASE_SERVICE_ROLE_KEY` is required for curriculum generation, profile picture uploads, AI grading, and any admin operation that touches multiple tenant rows. Without it, these features will throw RLS violation errors.

---

## 15. Shared Packages & Libraries

### `packages/shared/src/constants.ts`
Shared constants available to both `apps/web` and `apps/workflows`:
- Grade level definitions
- Pipeline stage labels and ordering
- Document type labels
- Status badge color mappings

### `apps/web/src/lib/`

| File | Purpose |
|------|---------|
| `supabase.ts` | Supabase client factory (browser client + server client with service role) |
| `modal.ts` | Modal API caller: `callModal(endpoint, body)` + `getGradeContext(gradeLevel)` |
| `inngest.ts` | Inngest client singleton + typed event definitions |
| `stripe.ts` | Stripe client singleton + helper functions (create customer, create invoice) |
| `curriculum-parser.ts` | Markdown-aware parser for Modal curriculum output (handles `##` headers, `**bold**`) |
| `simulator/engine.ts` | Dev tool: simulates student homework submission + study session data |
| `simulator/types.ts` | TypeScript types for simulator payloads |

---

## 16. Design System

### Color Palette (Tailwind)
All dashboards use a unified dark-mode-aware palette:

| Use | Light Mode | Dark Mode |
|-----|-----------|-----------|
| Page background | `bg-[#FDFDFD]` | `dark:bg-gray-950` |
| Card background | `bg-white` | `dark:bg-gray-900` |
| Secondary surface | `bg-gray-50` | `dark:bg-gray-800` |
| Primary text | `text-black` | `dark:text-white` |
| Secondary text | `text-black/60` | `dark:text-white/60` |
| Muted text | `text-black/40` | `dark:text-white/40` |
| Card border | `border-gray-100` | `dark:border-gray-700` |
| Divider | `border-gray-200` | `dark:border-gray-600` |
| Hover surface | `hover:bg-gray-50` | `dark:hover:bg-gray-800` |

### Status Badge Colors
Used consistently across homework, submissions, and pipeline:
| Status | Class |
|--------|-------|
| Active / Enrolled | `bg-green-100 text-green-700` |
| Draft / Pending | `bg-amber-100 text-amber-700` |
| Under Review | `bg-blue-100 text-blue-700` |
| Graded / Complete | `bg-purple-100 text-purple-700` |
| Churned / Rejected | `bg-red-100 text-red-700` |
| Waitlisted | `bg-orange-100 text-orange-700` |

### Pipeline Column Colors
| Stage | Border | Badge |
|-------|--------|-------|
| Inquiry | `border-blue-400` | `bg-blue-100 text-blue-700` |
| Tour Scheduled | `border-purple-400` | `bg-purple-100 text-purple-700` |
| Waitlist | `border-amber-400` | `bg-amber-100 text-amber-700` |
| Enrolled | `border-green-400` | `bg-green-100 text-green-700` |
| Churned | `border-red-400` | `bg-red-100 text-red-700` |

### Card Structure
Standard card wrapper used across all dashboards:
```html
<div class="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4">
```

### Nicodemus AI Button
Single instance in `app/layout.tsx` → opens `NicodemusAIModal` via `lib/modal.ts` event system.
**Do not add a second AI button to any page** — the top bar button is the only access point.

---

*This document is auto-maintained. Update whenever adding new routes, tables, migrations, or features.*
