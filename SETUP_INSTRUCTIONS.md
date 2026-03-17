# Nicodemus - Lean Stack Setup Guide

Welcome! This guide walks you through initializing the Nicodemus monorepo with the lean, solo-developer tech stack.

---

## Prerequisites

Before starting, ensure you have:

- **Node.js** ≥ 18.0.0 ([download](https://nodejs.org/))
- **pnpm** ≥ 8.0.0 (faster than npm for monorepos):
  ```bash
  npm install -g pnpm
  ```
- **Supabase CLI** ([install](https://supabase.com/docs/guides/cli/getting-started)):
  ```bash
  npm install -g supabase
  ```
- **Rust** (for Tauri/edge app later):
  ```bash
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
  ```
- **Modal CLI** (for serverless compute):
  ```bash
  pip install modal
  ```

---

## Step 1: Clone & Install Dependencies

```bash
cd /path/to/nicodemus
pnpm install
```

This installs all packages across all workspaces (apps, packages, edge).

---

## Step 2: Configure Environment Variables

Your `.env` file should already be created with credentials for:
- Supabase (URL, Anon Key, Service Role Key)
- Modal (Token ID, Secret)
- Inngest (Event Key, Signing Key)
- Claude API Key
- App URL & Node environment

**⚠️ CRITICAL: Never commit `.env` to git. It contains secrets.**

Verify `.env` is in `.gitignore`:
```bash
cat .gitignore | grep .env
```

---

## Step 3: Initialize Supabase Locally

Supabase allows you to develop locally without hitting production:

```bash
# Start local Supabase stack (Docker required)
supabase start

# Initialize migrations (creates schema)
supabase db push

# Verify the schema
supabase status
```

This spins up a local PostgreSQL database with all tables from `supabase/migrations/`.

**Output will show:**
- Local Supabase URL: `http://localhost:54321`
- Local API URL: `http://localhost:54321`
- Anon Key & Service Role Key (for local development)

---

## Step 4: Update `.env` for Local Development (Optional)

If you want to test locally before deploying:

```bash
# After running `supabase start`, it prints local credentials
# Update .env with local Supabase URL and keys (optional)

NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<local-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<local-service-role-key>
```

To switch back to production, revert to your original `.env`.

---

## Step 5: Build Shared Package

The shared package contains types and utilities used by all workspaces:

```bash
pnpm -F shared build
```

This compiles TypeScript in `packages/shared/` to JavaScript in `packages/shared/dist/`.

---

## Step 6: Deploy Modal Functions

Modal functions run heavy AI workloads serverlessly:

```bash
# Authenticate with Modal (first time only)
modal token new

# Deploy the Modal app
modal deploy modal_app.py
```

This uploads `modal_app.py` to Modal's cloud and makes functions available.

**Verify deployment:**
```bash
modal app list
```

---

## Step 7: Start Development Servers

You can now start all dev servers in parallel:

```bash
pnpm dev
```

This runs:
- **Next.js frontend** (web): `http://localhost:3000`
- **Inngest workflows** (workflows): Listening for events

Or run them individually:

```bash
# Terminal 1: Frontend
pnpm -F web dev

# Terminal 2: Workflow server
pnpm -F workflows dev

# Terminal 3: Supabase (if local)
supabase start
```

---

## Step 8: Verify Everything Works

### Test Supabase Connection

```bash
# Check that tables exist
supabase status
```

### Test Modal Functions

```bash
modal run modal_app.py
```

You should see:
```
✓ Modal app is ready for deployment!
```

### Test Next.js Frontend

Navigate to `http://localhost:3000` in your browser. You should see a blank page (we haven't built the UI yet).

---

## Step 9: Pushing to Production

When ready to go live:

### Supabase (Database)
```bash
# This syncs your local migrations to production
supabase link --project-ref <project-ref>
supabase db push --linked
```

### Modal (AI Compute)
```bash
# Already deployed via `modal deploy modal_app.py`
# Check dashboard: https://modal.com/apps
```

### Next.js (Frontend)
```bash
# Deploy to Vercel (automatic from GitHub)
# Or manually:
pnpm run build
# Then deploy the `dist/` directory to your hosting (Vercel, AWS, etc.)
```

---

## Project Structure

```
nicodemus/
├── apps/
│   ├── web/              # Next.js frontend (Teacher/Admin/Parent UI)
│   └── workflows/        # Inngest event orchestration
├── packages/
│   └── shared/           # Shared types, constants, database client
├── edge/
│   └── student-rep/      # Tauri desktop app (Phase 2)
├── supabase/
│   └── migrations/       # Database schema
├── modal_app.py          # Modal serverless functions
├── .env                  # Environment secrets
├── package.json          # Root monorepo config
└── documentation/        # PRD, architecture, guides
```

---

## Quick Reference: Common Commands

| Command | Purpose |
|---------|---------|
| `pnpm install` | Install all dependencies |
| `pnpm dev` | Start all dev servers |
| `pnpm build` | Build all packages |
| `pnpm run type-check` | Type-check all TypeScript |
| `pnpm run lint` | Lint all code |
| `supabase start` | Start local database |
| `supabase db push` | Apply migrations |
| `modal deploy modal_app.py` | Deploy AI functions |

---

## Troubleshooting

### "Command not found: pnpm"
Install pnpm globally:
```bash
npm install -g pnpm
```

### "ENOMEM: Cannot allocate memory" on `pnpm install`
Monorepos can be memory-intensive. Try:
```bash
pnpm install --no-prefer-frozen-lockfile
```

### Supabase won't start (Docker error)
Ensure Docker is running:
```bash
docker ps
```

If you don't have Docker, install [Docker Desktop](https://www.docker.com/products/docker-desktop/).

### Modal auth fails
Generate a new token:
```bash
modal token delete
modal token new
```

### TypeScript errors after pulling new code
Rebuild shared:
```bash
pnpm -F shared build
```

---

## Next Steps

1. **Build the Teacher Assistant Agent** (Phase 1a)
   - See `documentation/IMPLEMENTATION.md` for the roadmap
   - Start with curriculum generation (Modal + Next.js API route)

2. **Create the first UI** (Teacher Dashboard)
   - Next.js app with Supabase auth & Tailwind CSS
   - Forms for lesson planning

3. **Connect Inngest workflows**
   - Wire up event publishing from Next.js
   - Test end-to-end: UI → Inngest → Modal → Supabase

---

## Questions?

Refer to:
- **Architecture**: `documentation/ARCHITECTURE.md`
- **PRD**: `documentation/PRD.md`
- **Lean Stack Guide**: `documentation/LEAN_STACK_GUIDE.md`

Good luck! 🚀
