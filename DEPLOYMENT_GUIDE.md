# 🚀 Nicodemus Modal Deployment Guide

## Overview

This guide walks you through deploying the Nicodemus AI backend to Modal (serverless compute) without Docker.

**What's happening:**
- Modal app uses **direct HTTP calls** to Claude API (no SDK initialization issues)
- Runs on Modal's cloud infrastructure (free tier available)
- Next.js dashboard calls Modal endpoints via HTTP
- Supabase stores curriculum data with grading_system support

---

## Prerequisites

✅ **Python 3.8+** installed and in PATH
   - Download from https://www.python.org/
   - **During installation, check "Add Python to PATH"**

✅ **Modal account** (free tier works)
   - Sign up at https://modal.com

✅ **.env file** configured (already done)
   - Contains `MODAL_TOKEN_ID` and `MODAL_TOKEN_SECRET`
   - Contains `CLAUDE_API_KEY`

---

## Deployment Steps

### Option 1: Automated (Recommended)

**For Command Prompt (Windows cmd):**
```bash
cd D:\Claude Home\Nicodemus
deploy.bat
```

**For PowerShell:**
```powershell
cd "D:\Claude Home\Nicodemus"
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
.\deploy.ps1
```

The script will:
1. ✓ Create Python virtual environment (.venv)
2. ✓ Install Modal CLI
3. ✓ Authenticate with your Modal token
4. ✓ Guide you to run `modal deploy modal_app.py`

### Option 2: Manual

**Terminal 1: Set up Python environment**
```bash
cd "D:\Claude Home\Nicodemus"
python -m venv .venv
.venv\Scripts\activate.bat
pip install modal
modal token set --token-id "ak-vVywpNbP14lsgnicIY600l" --token-secret "as-zoD8rPXrx8ufuwfx99ptsG"
```

**Terminal 1: Deploy to Modal**
```bash
modal deploy modal_app.py
```

This will:
- ✓ Upload modal_app.py to Modal's cloud
- ✓ Build the execution environment
- ✓ Deploy FastAPI web server
- ✓ Print your API URL (should match `MODAL_API_URL` in .env)

**Terminal 2: Start Next.js dashboard (while Modal deploys)**
```bash
cd "D:\Claude Home\Nicodemus"
pnpm dev
```

---

## Testing

Once deployment completes (1-2 minutes):

1. **Open browser:** http://localhost:3000/dashboard

2. **Fill in the form:**
   - Unit Title: `Fractions & Decimals`
   - Subject: `Math`
   - Grade Level: `5`
   - Grading System: Choose one (e.g., Alphabetical A-F)
   - Duration: `4` weeks

3. **Click "Generate Curriculum Unit"**

4. **Expected result:**
   - Status: "Generating with Claude..."
   - After 30-60 seconds: "Successfully Generated!"
   - JSON output shows curriculum structure
   - Supabase stores lesson with grading_system

---

## Troubleshooting

### "Python is not installed"
- Install Python from https://www.python.org/
- During installation, **check "Add Python to PATH"**
- Restart your terminal after installing
- Run `python --version` to verify

### "Modal command not found"
- Activate virtual environment: `.venv\Scripts\activate.bat`
- Make sure you're in the project directory: `cd "D:\Claude Home\Nicodemus"`
- Try reinstalling: `pip install --upgrade modal`

### "Generation failed: MODAL_API_URL"
- Check `.env` file has `MODAL_API_URL=https://leonardijohnson0--nicodemus-ai-api.modal.run`
- Ensure Modal deployment completed successfully
- Check Modal dashboard at https://modal.com for deployment status

### "Generation failed: Internal Server Error"
- Check Modal app logs:
  ```bash
  modal logs modal_app.py
  ```
- Verify `CLAUDE_API_KEY` is valid in `.env`
- Check Modal has internet access to `api.anthropic.com`

### "Supabase error: grading_system column not found"
- This was already fixed via migration
- Verify migration was applied: `pnpm run db:push`

---

## Architecture

```
Dashboard (Next.js)
    ↓ HTTP POST /api/curriculum/generate
API Route (Next.js)
    ↓ HTTP POST to Modal endpoint
Modal App (Python + FastAPI)
    ↓ HTTP POST to Claude API (direct, no SDK)
Claude Haiku LLM (Anthropic)
    ↓ Returns curriculum JSON
Modal App
    ↓ Returns to API Route
API Route
    ↓ Saves to Supabase
Supabase (Cloud Database)
    ↓ Stores lesson with grading_system
Dashboard
    ↓ Displays result
```

---

## What's Different This Time

**Previous Attempt:**
- Used Anthropic Python SDK
- Modal environment caused "proxies argument" error
- Blocking `.remote()` calls in async context

**Current Solution:**
- ✅ **Direct HTTP calls** via httpx library
- ✅ **No Anthropic SDK** = no initialization issues
- ✅ **Fully async** with `httpx.AsyncClient()`
- ✅ **Modal .remote.aio()** for proper async execution

---

## Environment Files Generated

- `.venv/` - Python virtual environment (created by script)
- `deploy.bat` - Automated deployment for Command Prompt
- `deploy.ps1` - Automated deployment for PowerShell

---

## Next Steps After Successful Deployment

1. Test curriculum generation (see Testing section above)
2. Verify Supabase has new lessons with `grading_system` column
3. Monitor Modal dashboard for function costs
4. Run `modal logs modal_app.py` to see function execution

---

## Support

If deployment fails:
1. Run `modal logs modal_app.py` to see server errors
2. Check `.env` file has all required keys
3. Verify Python virtual environment is activated
4. Try `modal deploy modal_app.py --force` to redeploy

---

**Ready? Start with:**
```bash
cd "D:\Claude Home\Nicodemus"
deploy.bat
```

Then run:
```bash
modal deploy modal_app.py
```
