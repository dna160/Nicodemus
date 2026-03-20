# Nicodemus Troubleshooting & Testing Guide

## Step-by-Step Testing Process

Follow this guide to generate a curriculum and fix any errors that arise.

---

## Phase 1: Setup & Deployment

### Step 1: Open Terminal (Command Prompt or PowerShell)

```bash
cd "D:\Claude Home\Nicodemus"
```

### Step 2: Create Python Virtual Environment

**Command Prompt:**
```bash
python -m venv .venv
.venv\Scripts\activate.bat
pip install modal
```

**PowerShell:**
```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install modal
```

### Step 3: Authenticate Modal

```bash
modal token set --token-id "ak-vVywpNbP14lsgnicIY600l" --token-secret "as-zoD8rPXrx8ufuwfx99ptsG"
```

### Step 4: Deploy Modal App

```bash
modal deploy modal_app.py
```

**Expected Output:**
```
[✓] Deploying modal_app.py
[✓] Building Docker image
[✓] Creating FastAPI endpoints
[✓] Deployed to: https://leonardijohnson0--nicodemus-ai-api.modal.run
```

⏰ **Wait 1-2 minutes for deployment to complete.**

---

## Phase 2: Start Dev Server

### Step 5: Open NEW Terminal

**Keep the first terminal open for Modal logs!**

```bash
cd "D:\Claude Home\Nicodemus"
pnpm dev
```

**Expected Output:**
```
> next dev
  ▲ Next.js 15.x
  - Local:        http://localhost:3000
  ✓ Ready in 2.3s
```

---

## Phase 3: Test Curriculum Generation

### Step 6: Open Browser

Navigate to: **http://localhost:3000/dashboard**

### Step 7: Fill Out Form

```
Unit Title:     Fractions & Decimals
Subject:        Math
Grade Level:    5
Grading System: Alphabetical (A-F)
Duration:       4 weeks
```

### Step 8: Click Generate

**"Generate Curriculum Unit"** button

⏰ **Wait 30-60 seconds**

---

## Error Handling

### If Error: "Generation failed: MODAL_API_URL not found"

**Cause:** Modal app not deployed yet

**Fix:**
1. Check if Modal deployment completed: `modal status`
2. Re-deploy: `modal deploy --force modal_app.py`

---

### If Error: "Generation failed: Invalid API key"

**Cause:** CLAUDE_API_KEY not passed to Modal

**Debug Steps:**
1. Check .env has CLAUDE_API_KEY:
   ```bash
   findstr "CLAUDE_API_KEY" .env
   ```

2. Check Modal logs (in first terminal):
   ```bash
   modal logs modal_app.py
   ```

   Look for: `ValueError: CLAUDE_API_KEY is required`

3. Restart services:
   ```bash
   # Terminal 1: Ctrl+C, then
   modal deploy modal_app.py

   # Terminal 2: Ctrl+C, then
   pnpm dev
   ```

---

### If Error: "Generation failed: Modal function failed"

**Cause:** Various issues - check Modal logs

**Debug Steps:**
1. **Check Modal logs:**
   ```bash
   modal logs modal_app.py
   ```

2. **Look for common errors:**
   - `httpx.ConnectError` → Claude API unreachable
   - `JSONDecodeError` → Claude returned non-JSON
   - `TimeoutError` → Request took too long (increase timeout)

3. **Test Claude API directly:**
   ```bash
   curl -X POST https://api.anthropic.com/v1/messages \
     -H "x-api-key: YOUR_KEY" \
     -H "content-type: application/json" \
     -d '{
       "model": "claude-haiku-4-5-20251001",
       "max_tokens": 100,
       "messages": [{"role": "user", "content": "Say hello"}]
     }'
   ```

---

### If Error: "Generation failed: new row violates row-level security"

**Cause:** RLS policies not applied to Supabase

**Fix:**
```bash
pnpm run db:push
```

Verify migrations applied:
```sql
-- In Supabase SQL Editor
SELECT * FROM lessons LIMIT 1;  -- Should succeed
```

---

### If Error: "Generation failed: Cannot find module"

**Cause:** Dependencies not installed

**Fix:**
```bash
pnpm install
pnpm run build
```

---

## Monitoring & Logging

### Real-Time Modal Logs

In **Terminal 1**, watch deployment logs:

```bash
modal logs modal_app.py --follow
```

This shows:
- API key validation
- Claude API calls
- Response times
- Errors in real-time

### Next.js Console

In **Terminal 2**, watch Next.js output:

```
DEBUG: MODAL_API_URL is https://leonardijohnson0--nicodemus-ai-api.modal.run
Curriculum generation successful
Lesson saved with ID: xxxxx
```

### Browser Console

In browser, press **F12** → **Console** tab:

Look for:
- ✅ `success: true`
- ❌ Error messages with details

---

## Complete Success Flow

### ✅ Successful Generation

**Browser shows:**
```
Successfully Generated!

{
  "outline": "4-week unit on Fractions & Decimals",
  "objectives": [...],
  "activities": [...],
  ...
}

Saved to Supabase with ID: 550e8400-e29b-41d4-a716-446655440000
```

**Next.js logs:**
```
Curriculum generation successful
Lesson saved with ID: 550e8400-e29b-41d4-a716-446655440000
Inngest event triggered: CURRICULUM_PUBLISHED
```

**Supabase verification:**
```sql
SELECT id, title, grading_system, created_at
FROM lessons
ORDER BY created_at DESC
LIMIT 1;
```

Should show your new lesson with:
- `title: "Fractions & Decimals"`
- `grading_system: "local_alphabetical"`
- `created_at: <recent timestamp>`

---

## Checklist Before Testing

- [ ] `.env` file has all required keys (check with: `findstr "=" .env`)
- [ ] Modal deployed successfully (check with: `modal status`)
- [ ] Next.js dev server running
- [ ] Supabase migrations applied (check with: `pnpm run db:push`)
- [ ] No TypeScript errors in IDE

---

## If All Else Fails: Hard Reset

```bash
# Terminal 1: Stop Modal
Ctrl+C

# Terminal 2: Stop Next.js
Ctrl+C

# Clean install
pnpm install
pnpm run build

# Redeploy everything
modal deploy --force modal_app.py

# In new terminal
pnpm dev

# Check everything
modal logs modal_app.py --follow
```

---

## Performance Expectations

| Step | Expected Time | What's Happening |
|------|---------------|-----------------|
| Form submit | Immediate | Next.js validation |
| Modal call | 1-2 sec | Network to Modal |
| Claude API | 10-30 sec | LLM generating curriculum |
| Supabase insert | 1-2 sec | Database write |
| Total | 15-45 sec | Entire flow |

---

## Key Files for Debugging

1. **Modal logs**
   ```bash
   modal logs modal_app.py
   ```

2. **Next.js output**
   - Shows in Terminal 2
   - Press F12 in browser for console

3. **Supabase logs**
   - Go to https://supabase.com → Your project → Logs
   - Filter by table: `lessons`

4. **Environment**
   - `.env` file (verify all keys present)
   - Run: `echo %CLAUDE_API_KEY%` (should show key)

---

## Common Quick Fixes

| Issue | Quick Fix |
|-------|-----------|
| "MODAL_API_URL" error | Modal app not deployed: `modal deploy modal_app.py` |
| "Invalid API key" | CLAUDE_API_KEY not in .env or Modal environment |
| "Cannot find module" | Missing dependencies: `pnpm install` |
| "RLS violation" | Migrations not applied: `pnpm run db:push` |
| "Timeout" | Modal app still building - wait 2 minutes |
| Blank response | Check browser console (F12) for errors |

---

## Next Actions After Success

Once curriculum generates successfully:

1. **Verify in Supabase:**
   ```bash
   pnpm run db:reset  # View data (optional)
   ```

2. **Check Inngest workflow triggered:**
   - Go to https://app.inngest.com
   - Filter by: `CURRICULUM_PUBLISHED`

3. **Test multiple generations:**
   - Try different grading systems
   - Try different subjects/grades
   - Verify all save to Supabase

4. **Performance optimization** (if needed):
   - Reduce `max_tokens` in `modal_app.py`
   - Implement caching
   - Add rate limiting

---

## Support Resources

- **Modal Docs:** https://modal.com/docs
- **Supabase RLS:** https://supabase.com/docs/guides/auth/row-level-security
- **Inngest Docs:** https://www.inngest.com/docs
- **Claude API:** https://docs.anthropic.com/

Good luck! 🚀
