# Nicodemus Setup - Cloud-First (No Docker Required)

Since you don't have Docker, we'll skip local Supabase and develop directly against your cloud database. This is actually **faster** and **simpler**.

---

## Why Cloud-First is Better for Solo Dev

| Local Supabase | Cloud Supabase |
|---|---|
| Requires Docker | No Docker needed ✅ |
| Slow startup (~30s) | Instant access ✅ |
| Parity issues (local vs prod) | Same schema everywhere ✅ |
| Must sync migrations both ways | One source of truth ✅ |
| Takes RAM/disk | Zero local overhead ✅ |

---

## Step 1: Verify Your Credentials

You should already have a `.env` file with Supabase credentials:

```bash
cat .env | grep SUPABASE
```

You should see:
```
NEXT_PUBLIC_SUPABASE_URL=https://cjxfuoudlrvpdbnjuqqy.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

If missing, get them from: https://supabase.com/dashboard

---

## Step 2: Install Dependencies (No Docker)

```bash
cd /path/to/nicodemus
pnpm install
```

This installs Node dependencies only. No Docker involved.

---

## Step 3: Apply Database Migrations

Instead of `supabase start`, we'll push migrations directly to your cloud database:

```bash
# Link your Supabase project
supabase link --project-ref cjxfuoudlrvpdbnjuqqy

# Apply migrations to cloud database
supabase db push
```

You'll be asked to confirm (type `y` to proceed).

**Output should show:**
```
✓ Migrations applied successfully
  - 20260101000001_init.sql ✓
```

---

## Step 4: Verify Database Schema

Check that tables were created in your cloud database:

```bash
# Option A: Via CLI
supabase db list tables

# Option B: Log into Supabase Dashboard
# Go to: https://supabase.com/dashboard
# Select your project
# Check "SQL Editor" or "Tables" to see: users, students, teachers, etc.
```

---

## Step 5: Build Shared Package

```bash
pnpm -F shared build
```

This compiles TypeScript in `packages/shared/` to JavaScript.

---

## Step 6: Deploy Modal Functions

```bash
modal deploy modal_app.py
```

This uploads your AI functions to Modal's cloud.

---

## Step 7: Start Dev Servers

```bash
# Terminal 1: Next.js frontend
pnpm -F web dev

# Terminal 2: Inngest workflows (in another terminal)
pnpm -F workflows dev
```

---

## Step 8: Test the Connection

### Test Supabase Connection

```bash
# Create a test file
cat > test-supabase.js << 'EOF'
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const { data, error } = await supabase.from('users').select('*').limit(1);
console.log('✅ Supabase connected!', data);
if (error) console.error('❌ Error:', error);
EOF

# Run it
node test-supabase.js
```

Should output:
```
✅ Supabase connected! []
```

---

## Step 9: Check Next.js Works

Navigate to: `http://localhost:3000`

You should see a blank page (UI not built yet). That's fine—the server is working.

---

## Workflow: Developing Without Docker

### Daily Development Loop

1. **Make schema changes:**
   ```bash
   # Edit supabase/migrations/20260101000001_init.sql
   supabase db push
   ```

2. **Start dev servers:**
   ```bash
   pnpm -F web dev      # Terminal 1
   pnpm -F workflows dev # Terminal 2
   ```

3. **Build features:**
   - Create Next.js pages in `apps/web/`
   - Create API routes in `apps/web/api/`
   - Call Modal functions from API routes
   - Data persists in Supabase cloud

4. **Push to GitHub:**
   ```bash
   git add -A
   git commit -m "feat: add teacher curriculum dashboard"
   git push origin main
   ```

---

## Important: Protecting Your Cloud Database

⚠️ **Never share these credentials:**
- `SUPABASE_SERVICE_ROLE_KEY` (full access)
- `CLAUDE_API_KEY`
- `MODAL_TOKEN_ID` / `MODAL_TOKEN_SECRET`

✅ **These are safe to share:**
- `NEXT_PUBLIC_SUPABASE_URL` (it's public)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (restricted by RLS)

✅ **Keep secrets in `.env` only**
- Never commit `.env` to Git
- Never paste `.env` values in Slack/Discord
- Never hardcode keys in code

---

## Schema Changes During Development

If you need to modify the database schema:

1. **Edit the migration file:**
   ```bash
   nano supabase/migrations/20260101000001_init.sql
   ```

2. **Apply changes:**
   ```bash
   supabase db push
   ```

3. **Verify in dashboard:**
   ```
   https://supabase.com/dashboard → SQL Editor → Check new tables
   ```

---

## Deployment to Production

When you're ready to go live, it's simple:

1. **Database is already in production** (you're using production Supabase)
2. **Modal functions are already deployed** (`modal deploy modal_app.py`)
3. **Deploy Next.js frontend:**
   ```bash
   # Connect to Vercel (free)
   npm i -g vercel
   vercel

   # Or push to GitHub, Vercel auto-deploys on push
   git push origin main
   ```

That's it. No additional production setup needed.

---

## Troubleshooting

### "Error: Project ref not found"
Make sure you linked the correct project:
```bash
supabase link --project-ref cjxfuoudlrvpdbnjuqqy
```

Check your project ref: https://supabase.com/dashboard

### "Migrations failed: syntax error"
Your SQL migration has an error. Check:
```bash
cat supabase/migrations/20260101000001_init.sql | head -50
```

Fix the SQL, then reapply:
```bash
supabase db push
```

### "Cannot find tables in dashboard"
Wait a few seconds, then refresh the page. Or check via CLI:
```bash
supabase db list tables
```

### "Supabase API is slow"
This is normal for free tier. Add caching to your API routes:
```typescript
// In Next.js API route
res.setHeader('Cache-Control', 'max-age=60');
```

---

## What's Different From Local Setup?

| Step | Local (Docker) | Cloud (No Docker) |
|------|---|---|
| Database | `supabase start` | Already running ✅ |
| Migrations | `supabase db push` | `supabase db push` (same) |
| Data persistence | Local DB | Cloud DB |
| Dev server | `pnpm dev` | `pnpm dev` (same) |
| Cost | $0 | $0 (free tier) |
| **Complexity** | **Higher** | **Lower** ✅ |

Everything else is identical. You're just using cloud database instead of local.

---

## You're Ready

Run this now:

```bash
cd /path/to/nicodemus
pnpm install
supabase link --project-ref cjxfuoudlrvpdbnjuqqy
supabase db push
pnpm -F web dev
```

Then navigate to `http://localhost:3000`.

**That's all you need.** No Docker. No complexity. Just code. 🚀
