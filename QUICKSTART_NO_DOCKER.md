# Quick Start - No Docker Required

You don't have Docker. That's fine. This is your 10-minute quick start.

---

## Prerequisites

You already have these:
- ✅ Node.js (≥18)
- ✅ pnpm
- ✅ `.env` file with Supabase credentials
- ✅ GitHub repo cloned

You **don't need** Docker. Everything else works the same.

---

## 5-Minute Setup

### 1. Install dependencies (2 min)
```bash
cd /path/to/nicodemus
pnpm install
```

### 2. Link your Supabase project (1 min)
```bash
supabase link --project-ref cjxfuoudlrvpdbnjuqqy
```

When prompted: **Type `y` to confirm**

### 3. Apply database migrations (1 min)
```bash
supabase db push
```

Your cloud database is now set up. Tables created. RLS policies applied.

### 4. Build shared package (1 min)
```bash
pnpm -F shared build
```

---

## Verify Everything Works (5 min)

### Start Next.js
```bash
pnpm -F web dev
```

Open: `http://localhost:3000` in your browser. You should see a page load (blank is fine, no UI built yet).

**That's it.** You're ready to develop.

---

## What You Have Right Now

✅ Monorepo set up
✅ Database schema in cloud
✅ All dependencies installed
✅ Next.js dev server running
✅ Ready to build features

---

## No Docker Needed For

- ✅ Developing Next.js frontend
- ✅ Calling Modal AI functions
- ✅ Running Inngest workflows
- ✅ Querying Supabase from code
- ✅ Deploying to production

Everything works without Docker.

---

## Next: Build Your First Feature

See `COMPLETION_SUMMARY.md` for what to build next.

Spoiler: Build a teacher curriculum dashboard in 3-4 days.

---

## Useful Commands

```bash
# Development
pnpm -F web dev          # Start Next.js
pnpm -F workflows dev    # Start Inngest listener
pnpm run type-check      # Check for TypeScript errors

# Database
supabase db push         # Apply migrations
supabase db list tables  # Verify tables exist

# Deployment
modal deploy modal_app.py  # Deploy AI functions to serverless

# Git
git push origin main     # Push to GitHub
```

---

**You're done with setup. Go build something cool.** 🚀
