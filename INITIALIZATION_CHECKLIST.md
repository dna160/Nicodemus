# Nicodemus Lean Stack - Initialization Checklist

Complete this checklist to ensure your development environment is fully configured.

---

## Prerequisites (Do These Once)

### System Setup
- [ ] Node.js ≥ 18.0.0 installed
  ```bash
  node --version  # Should be v18.0.0 or higher
  ```
- [ ] pnpm ≥ 8.0.0 installed
  ```bash
  pnpm --version  # Should be v8.0.0 or higher
  ```
- [ ] Git installed and configured
  ```bash
  git config user.name && git config user.email
  ```

### Global Tools
- [ ] Supabase CLI installed
  ```bash
  supabase --version
  ```
- [ ] Modal CLI installed
  ```bash
  modal --version
  ```
- [ ] Docker installed (for local Supabase)
  ```bash
  docker --version
  ```
- [ ] (Optional) Rust installed (for Tauri Phase 2)
  ```bash
  rustc --version
  ```

---

## Repository Setup

### Clone & Credentials
- [ ] Repository cloned from `https://github.com/dna160/Nicodemus`
  ```bash
  git clone https://github.com/dna160/Nicodemus
  cd Nicodemus
  ```
- [ ] `.env` file created with all credentials
  ```bash
  # Should contain:
  # - NEXT_PUBLIC_SUPABASE_URL
  # - NEXT_PUBLIC_SUPABASE_ANON_KEY
  # - SUPABASE_SERVICE_ROLE_KEY
  # - MODAL_TOKEN_ID & MODAL_TOKEN_SECRET
  # - INNGEST_EVENT_KEY & INNGEST_SIGNING_KEY
  # - CLAUDE_API_KEY
  ```
- [ ] `.env` is in `.gitignore` (never committed)
  ```bash
  grep "\.env" .gitignore
  ```

### Monorepo Structure
- [ ] Directory structure created:
  ```
  apps/web              ✓
  apps/workflows        ✓
  packages/shared       ✓
  edge/student-rep      ✓
  supabase/migrations   ✓
  ```
- [ ] Root `package.json` has workspace definitions
  ```bash
  grep -A 5 '"workspaces"' package.json
  ```

---

## Dependency Installation

### Core Dependencies
- [ ] All dependencies installed
  ```bash
  pnpm install
  ```
  Expected output: `added XX packages in X.Xs`

- [ ] Shared package builds without errors
  ```bash
  pnpm -F shared build
  # Should show: ✓ dist/index.js and dist/index.d.ts created
  ```

- [ ] No TypeScript errors
  ```bash
  pnpm run type-check
  # Should show: ✓ No errors
  ```

### Workspace Dependencies Verified
- [ ] Web app dependencies
  ```bash
  ls apps/web/node_modules | grep next
  ```
- [ ] Workflows dependencies
  ```bash
  ls apps/workflows/node_modules | grep inngest
  ```

---

## Supabase Configuration

### Local Development Database
- [ ] Docker is running
  ```bash
  docker ps
  ```

- [ ] Supabase local initialized
  ```bash
  supabase start
  # Output should show local URL, API Key, Service Role Key
  ```

- [ ] Database migrations applied
  ```bash
  supabase db push
  # Should show: ✓ Schema applied successfully
  ```

- [ ] Schema verification
  ```bash
  supabase db list tables
  # Should show: users, students, teachers, parents, classes, lessons, etc.
  ```

- [ ] Local Supabase credentials captured
  ```
  Save these for local development:
  - SUPABASE_LOCAL_URL (from supabase start output)
  - SUPABASE_LOCAL_ANON_KEY
  - SUPABASE_LOCAL_SERVICE_ROLE_KEY
  ```

### Production Supabase Linked (Optional)
- [ ] Production Supabase project created (supabase.com)
- [ ] Project ref noted: `_________`
- [ ] Supabase CLI linked (optional for Phase 1):
  ```bash
  supabase link --project-ref <your-project-ref>
  ```

---

## Modal Configuration

### Authentication
- [ ] Modal CLI authenticated
  ```bash
  modal token new
  # Creates ~/.modal/config.toml with credentials
  ```
- [ ] Modal token verified
  ```bash
  modal token verify
  # Should show: ✓ Token is valid
  ```

### Function Deployment
- [ ] Modal app deployed
  ```bash
  modal deploy modal_app.py
  # Should show: ✓ App deployed as 'nicodemus-ai'
  ```

- [ ] Modal functions verified
  ```bash
  modal app list
  # Should list: nicodemus-ai
  ```

- [ ] Test Modal function locally
  ```bash
  modal run modal_app.py
  # Should show: ✓ Modal app is ready for deployment!
  ```

---

## Inngest Configuration

### Event Key Verification
- [ ] Inngest event key in `.env`
  ```bash
  grep INNGEST_EVENT_KEY .env
  ```

- [ ] Inngest signing key in `.env`
  ```bash
  grep INNGEST_SIGNING_KEY .env
  ```

### Workflow Development Setup
- [ ] Inngest CLI installed (optional but recommended)
  ```bash
  npm install -g inngest
  ```

---

## Development Server Setup

### Start Services
- [ ] Supabase running (Terminal 1)
  ```bash
  supabase start
  # Output: ✓ Supabase local started
  ```

- [ ] Next.js dev server running (Terminal 2)
  ```bash
  pnpm -F web dev
  # Output: ✓ Ready in X.Xs
  ```

- [ ] Workflows server running (Terminal 3)
  ```bash
  pnpm -F workflows dev
  # Output: ✓ Server listening on...
  ```

### Verify Services Are Accessible
- [ ] Next.js frontend: `http://localhost:3000` loads
- [ ] Supabase API: `http://localhost:54321` responds
- [ ] Workflow server: Listening for requests

---

## TypeScript & Tooling

### Type Checking
- [ ] All TypeScript compiles
  ```bash
  pnpm run type-check
  # 0 errors
  ```

- [ ] Shared types available in all workspaces
  ```bash
  # In apps/web or apps/workflows:
  grep "import.*from 'shared'" src/**/*.ts
  ```

### Linting
- [ ] ESLint configuration exists
  ```bash
  test -f apps/web/.eslintrc.json && echo "✓ ESLint configured"
  ```

- [ ] Code lints without errors
  ```bash
  pnpm run lint
  # 0 errors
  ```

---

## Git & Version Control

### Repository Configuration
- [ ] Remote `origin` points to correct repo
  ```bash
  git remote -v | grep origin
  # Should show: https://github.com/dna160/Nicodemus.git
  ```

- [ ] Main branch is default
  ```bash
  git branch | grep "\*"
  # Should show: * main
  ```

### Initial Commit
- [ ] All files staged
  ```bash
  git add -A
  git status
  # Should show all new files
  ```

- [ ] Initial commit created
  ```bash
  git commit -m "feat: initialize lean stack monorepo with Phase 1 scaffolding"
  ```

- [ ] Changes pushed to GitHub
  ```bash
  git push origin main
  # Verify at https://github.com/dna160/Nicodemus
  ```

---

## Documentation Review

### Core Docs Read
- [ ] `SETUP_INSTRUCTIONS.md` reviewed
- [ ] `LEAN_STACK_GUIDE.md` reviewed
- [ ] `documentation/ARCHITECTURE.md` reviewed
- [ ] `documentation/PRD.md` reviewed

### Team Onboarding
- [ ] All team members (even if just you) have:
  - [ ] Node.js & pnpm installed
  - [ ] `.env` file with credentials
  - [ ] Supabase local running
  - [ ] Next.js dev server running

---

## Environment Verification

### Quick Test: End-to-End
Run this command to verify all systems:

```bash
#!/bin/bash

echo "=== Nicodemus System Check ==="
echo ""

echo "✓ Node.js: $(node --version)"
echo "✓ pnpm: $(pnpm --version)"
echo "✓ Git: $(git --version)"

echo ""
echo "Checking monorepo..."
pnpm -F shared build > /dev/null && echo "✓ Shared package builds"
pnpm run type-check > /dev/null && echo "✓ TypeScript clean"

echo ""
echo "Checking services..."
docker ps | grep -q supabase_db && echo "✓ Supabase running" || echo "✗ Supabase NOT running"
modal app list > /dev/null 2>&1 && echo "✓ Modal authenticated" || echo "✗ Modal NOT authenticated"

echo ""
echo "Checking credentials..."
test -f .env && echo "✓ .env exists" || echo "✗ .env missing"
grep -q "NEXT_PUBLIC_SUPABASE_URL" .env && echo "✓ Supabase URL configured"
grep -q "MODAL_TOKEN_ID" .env && echo "✓ Modal token configured"
grep -q "CLAUDE_API_KEY" .env && echo "✓ Claude API key configured"

echo ""
echo "=== All systems ready! ==="
```

Save this as `scripts/verify.sh`, run `chmod +x scripts/verify.sh`, then:
```bash
./scripts/verify.sh
```

---

## Next Steps After Initialization

1. **Create your first feature branch**
   ```bash
   git checkout -b feat/teacher-dashboard
   ```

2. **Follow the Phase 1 roadmap** in `IMPLEMENTATION.md`
   - Week 1-2: Teacher dashboard UI scaffolding
   - Week 3-4: Curriculum generation (Next.js + Modal)
   - Week 5-8: Grading automation + class insights

3. **Document your decisions** in `documentation/`
   - API routes you create
   - Database schema changes
   - Workflow designs

4. **Test in local Supabase** before deploying
   - All changes to schema: `supabase db push`
   - All changes to functions: test in Next.js locally

5. **Deploy when ready** (Phase 2)
   - Supabase: `supabase link && supabase db push --linked`
   - Modal: `modal deploy modal_app.py`
   - Next.js: Push to GitHub, auto-deploy via Vercel

---

## Troubleshooting

### Issue: `pnpm install` hangs
**Solution:** Run with `--no-prefer-frozen-lockfile`
```bash
pnpm install --no-prefer-frozen-lockfile
```

### Issue: Supabase won't start (Docker error)
**Solution:** Ensure Docker Desktop is running
```bash
docker ps  # Should list running containers
```

### Issue: Modal deploy fails
**Solution:** Re-authenticate
```bash
modal token delete
modal token new
modal deploy modal_app.py
```

### Issue: TypeScript errors after pulling
**Solution:** Rebuild shared package
```bash
pnpm -F shared build
pnpm install
```

### Issue: Ports 3000, 54321, 5432 already in use
**Solution:** Find and stop conflicting processes
```bash
# Kill Next.js on port 3000
lsof -i :3000 | grep LISTEN | awk '{print $2}' | xargs kill -9

# Kill Supabase
supabase stop
```

---

## Final Verification

- [ ] All items above checked
- [ ] No lingering TypeScript errors
- [ ] Local dev environment working
- [ ] Ready to start Phase 1a (Teacher Dashboard)
- [ ] Credentials secure (`.env` in `.gitignore`)

**Congratulations! Your development environment is ready.** 🎉

Ship the first feature. You got this. 🚀
