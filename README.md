# Nicodemus
**Enterprise Educational AI Suite - Privacy-First Multi-Agent System for Schools**

---

## 🚀 Quick Start

**New to this project?** Start here:

→ **[📖 Documentation](./documentation/README.md)** - Complete guides and specifications

---

## 📋 What is Nicodemus?

Nicodemus is a **lean, solo-developer-optimized AI suite** for schools using:
- **Supabase** for database + auth + realtime
- **Modal** for serverless AI compute (Claude API)
- **Inngest** for durable workflows
- **Next.js** for the teacher/admin dashboard
- **Tauri** for the student edge app (Phase 2)

**Result:** Privacy-first, FERPA-compliant, $80-150/month, 8 weeks to MVP.

---

## 📂 Repository Structure

```
nicodemus/
├── README.md (this file)
├── .gitignore
├── package.json
│
├── documentation/          ← Read this first!
│   ├── README.md
│   ├── project-overview/
│   ├── architecture/
│   ├── security-compliance/
│   ├── implementation/
│   └── development-guides/
│
├── apps/                   ← Your code will go here
│   ├── web/               (Next.js dashboard)
│   └── api/               (API routes)
│
├── packages/              ← Shared libraries
│   ├── core/             (Shared utilities)
│   └── modal/            (Modal functions)
│
└── edge/                  ← Student app (Phase 2)
    └── student-rep-tauri/ (Tauri desktop app)
```

---

## 🏃 Getting Started (Solo Developer)

### Prerequisites
- Node.js 18+
- Python 3.11+
- pnpm
- Git

### Step 1: Read the Documentation
👉 Start with **[documentation/development-guides/LEAN_STACK_GUIDE.md](./documentation/development-guides/LEAN_STACK_GUIDE.md)**

This guide walks you through:
1. Creating accounts (Supabase, Vercel, Modal, Inngest)
2. Initializing the monorepo
3. Setting up the database schema
4. Building the first API endpoint

### Step 2: Set Up (30 minutes)
```bash
# 1. Create accounts (see guide above)

# 2. Clone & set up
git clone https://github.com/your-org/nicodemus.git
cd nicodemus

# 3. Create .env.local (copy from documentation guide)
cp .env.example .env.local
# Fill in your keys

# 4. Install dependencies
pnpm install

# 5. Start development
pnpm dev
```

### Step 3: Follow the Roadmap
→ **[documentation/implementation/implementation.md](./documentation/implementation/implementation.md)** - Phase 1 timeline (8 weeks)

---

## 📚 Documentation Map

| Document | Purpose | Read Time |
|----------|---------|-----------|
| **[project-overview/README.md](./documentation/project-overview/README.md)** | Project vision & features | 5 min |
| **[LEAN_STACK_GUIDE.md](./documentation/development-guides/LEAN_STACK_GUIDE.md)** | Hands-on setup & development | 30 min |
| **[ARCHITECTURE.md](./documentation/architecture/ARCHITECTURE.md)** | System design (serverless) | 45 min |
| **[RLS_DATA_SANITIZATION.md](./documentation/development-guides/RLS_DATA_SANITIZATION.md)** | FERPA compliance via RLS | 60 min |
| **[implementation.md](./documentation/implementation/implementation.md)** | 8-week sprint roadmap | 45 min |
| **[SECURITY.md](./documentation/security-compliance/SECURITY.md)** | Privacy & compliance (FERPA/COPPA/GDPR) | 90 min |
| **[CLAUDE.md](./documentation/development-guides/CLAUDE.md)** | Development patterns | 20 min |
| **[INDEX.md](./documentation/development-guides/INDEX.md)** | Navigation by role | 15 min |

---

## 🎯 Key Decision: Lean Stack

**Why this approach?**
- ✅ No Kubernetes to maintain
- ✅ No Kafka brokers to monitor
- ✅ No DevOps overhead
- ✅ Instant scaling (serverless)
- ✅ $80-150/month (vs. $5,000-10,000)
- ✅ 8 weeks to MVP (vs. 24 weeks)

**Trade-offs?** None. This is genuinely better for solo development.

---

## 🔐 Privacy & Security Built-In

All documentation includes FERPA/COPPA/GDPR compliance from day one:
- **RLS (Row Level Security):** Teachers only see roster students
- **Data Sanitization:** Raw behavioral data never leaves student device
- **Audit Logging:** All access tracked automatically
- **Encryption:** AES-256 at rest, TLS 1.3 in transit

**Start here:** [RLS_DATA_SANITIZATION.md](./documentation/development-guides/RLS_DATA_SANITIZATION.md)

---

## 💰 Cost Breakdown (Phase 1)

| Service | Monthly | Why |
|---------|---------|-----|
| Supabase | $25 | Database, auth, webhooks |
| Vercel | $20 | Hosting, serverless functions |
| Modal | $10-20 | GPU/CPU for AI tasks |
| Claude API | $15-30 | LLM calls (usage-based) |
| **Total** | **$70-100** | All-inclusive |

**Year 1:** ~$1,200-1,500

Compare to enterprise stack: $60,000+/year

---

## 📈 Timeline to MVP

| Weeks | Phase | Status |
|-------|-------|--------|
| 1-8 | **Phase 1: Teacher Assistant** | Implementation starts |
| 9-12 | Phase 1b: PRM Agent | Planned |
| 13-16 | Phase 1c: ERP Agent | Planned |
| 17-24 | Phase 2: Student Rep (Edge) | Planned |

---

## 🚢 Deployment

### Local Development
```bash
pnpm dev
# Opens http://localhost:3000
```

### Production (Vercel)
```bash
git push origin main
# Vercel auto-deploys (watch dashboard)
```

### Database Migrations (Supabase)
```bash
supabase db push
# Applies schema changes
```

---

## 🐛 Need Help?

### Documentation
- **Setup questions?** → [LEAN_STACK_GUIDE.md](./documentation/development-guides/LEAN_STACK_GUIDE.md)
- **Architecture questions?** → [ARCHITECTURE.md](./documentation/architecture/ARCHITECTURE.md)
- **FERPA compliance?** → [SECURITY.md](./documentation/security-compliance/SECURITY.md)
- **RLS implementation?** → [RLS_DATA_SANITIZATION.md](./documentation/development-guides/RLS_DATA_SANITIZATION.md)

### Common Issues
See troubleshooting sections in:
- LEAN_STACK_GUIDE.md (Section IX)
- RLS_DATA_SANITIZATION.md (Section IX)

---

## 📋 Pre-Implementation Checklist

Before you start coding:

- [ ] Read documentation/development-guides/LEAN_STACK_GUIDE.md
- [ ] Create accounts (Supabase, Vercel, Modal, Inngest)
- [ ] Set up GitHub repo + monorepo structure
- [ ] Review FERPA/COPPA compliance (SECURITY.md)
- [ ] Understand RLS + data sanitization (RLS_DATA_SANITIZATION.md)
- [ ] Identify pilot school/teacher
- [ ] Get legal approval of privacy notice

---

## 📄 License

**Proprietary.** All rights reserved. This project is under active development for authorized school districts only.

---

## 🙏 Next Steps

1. **Read:** [documentation/README.md](./documentation/README.md) (2 min overview)
2. **Follow:** [LEAN_STACK_GUIDE.md](./documentation/development-guides/LEAN_STACK_GUIDE.md) (hands-on setup)
3. **Understand:** [RLS_DATA_SANITIZATION.md](./documentation/development-guides/RLS_DATA_SANITIZATION.md) (privacy design)
4. **Build:** Follow [implementation.md](./documentation/implementation/implementation.md) (Phase 1 roadmap)

---

**Status:** ✅ Ready for Development
**Updated:** 2026-03-17
**Version:** 1.0 (Lean Solo-Dev Edition)

**Start building:** [→ Go to documentation](./documentation/README.md)
