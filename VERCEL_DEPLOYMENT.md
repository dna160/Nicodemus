# 🚀 Vercel Deployment Guide for Nicodemus

**Status:** Ready for Production Deployment
**Framework:** Next.js 15
**Build Time:** ~2-3 minutes
**Configuration:** Automatic (vercel.json included)

---

## ✅ What's Ready

- ✅ Production build: Zero TypeScript errors
- ✅ Vercel configuration: `vercel.json` (committed to GitHub)
- ✅ Environment variables: All configured in `.env`
- ✅ Database: 20 Supabase migrations applied
- ✅ API routes: 30+ endpoints compiled and tested
- ✅ GitHub integration: Push → Auto-deploy enabled

---

## 🎯 One-Click Deployment (Recommended)

### Step 1: Link Vercel to GitHub
```bash
# From terminal in Nicodemus folder:
cd "D:\Claude Home\Nicodemus"
vercel login
# This will open browser for authentication
```

### Step 2: Deploy
```bash
vercel --prod
```

**This will:**
1. ✓ Detect Next.js project automatically
2. ✓ Use `vercel.json` configuration
3. ✓ Prompt for environment variables
4. ✓ Build and deploy in 2-3 minutes
5. ✓ Give you a live URL: `https://nicodemus.vercel.app`

---

## 🔧 If Using Vercel Dashboard Instead

### Step 1: Go to Vercel Dashboard
- Visit: https://vercel.com/dashboard
- Click: "Add New" → "Project"

### Step 2: Import from GitHub
- Select: `dna160/Nicodemus`
- Click: "Import"

### Step 3: Add Environment Variables
Copy these from `.env` file and add to Vercel:

```
NEXT_PUBLIC_SUPABASE_URL=https://cjxfuoudlrvpdbnjuqqy.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
MODAL_API_URL=https://leonardijohnson0--nicodemus-ai-api.modal.run
CLAUDE_API_KEY=sk-ant-api03-...
INNGEST_EVENT_KEY=signkey-prod-...
INNGEST_SIGNING_KEY=signkey-prod-...
STRIPE_SECRET_KEY=sk_live_... (use production keys)
STRIPE_WEBHOOK_SECRET=whsec_... (use production secret)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

### Step 4: Deploy
- Click "Deploy"
- Wait for build to complete (2-3 minutes)
- Get your live URL

---

## 📦 Vercel Configuration Details

**File:** `vercel.json`

```json
{
  "buildCommand": "cd apps/web && pnpm run build",
  "outputDirectory": "apps/web/.next",
  "framework": "nextjs",
  "installCommand": "pnpm install",
  "regions": ["sfo1"],
  "functions": {
    "apps/web/src/app/api/**/*.ts": {
      "runtime": "nodejs20.x"
    }
  }
}
```

**Key settings:**
- ✓ Monorepo structure: Uses `pnpm`
- ✓ Build output: `.next` folder
- ✓ Framework: Auto-detected as Next.js
- ✓ API routes: Node.js 20.x runtime
- ✓ Region: San Francisco (sfo1)

---

## 🔐 Environment Variables (Production)

**IMPORTANT:** Use production keys for live deployment

| Variable | Source | Required | Notes |
|----------|--------|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard | ✅ | Public URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard | ✅ | Client-side key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard | ✅ | Server-side (keep private) |
| `MODAL_API_URL` | Modal Dashboard | ✅ | Your deployed Modal endpoint |
| `CLAUDE_API_KEY` | Anthropic Console | ✅ | API key for Claude calls |
| `INNGEST_EVENT_KEY` | Inngest Dashboard | ✅ | Event bus key |
| `INNGEST_SIGNING_KEY` | Inngest Dashboard | ✅ | Webhook signing key |
| `STRIPE_SECRET_KEY` | Stripe Dashboard | ✅ | **Use production key** |
| `STRIPE_WEBHOOK_SECRET` | Stripe Dashboard | ✅ | **Use production secret** |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe Dashboard | ✅ | Public Stripe key |

---

## ✅ Pre-Deployment Checklist

- [ ] `.env` file is configured with all keys
- [ ] Stripe keys are production (not test) keys
- [ ] Supabase service role key is correct
- [ ] Modal endpoint URL is deployed and live
- [ ] All 20 database migrations applied to Supabase
- [ ] GitHub repo is up-to-date (`git push`)
- [ ] Vercel account created and authenticated
- [ ] No TypeScript build errors (`pnpm run build`)

---

## 🧪 Post-Deployment Testing

After deployment to Vercel:

### Test 1: Dashboard Loads
```
https://nicodemus.vercel.app/dashboard
```
Should show teacher dashboard with tabs.

### Test 2: Generate Curriculum
1. Go to `/dashboard`
2. Click "Curriculum" tab
3. Click "Generate New Unit"
4. Fill form: Title, Subject, Grade, Grading System, Duration
5. Click "Generate"
6. Should see: "Successfully Generated!" after 30-60 seconds

### Test 3: Admin Pipeline
```
https://nicodemus.vercel.app/admin/dashboard
```
Should show admissions Kanban with 5 columns.

### Test 4: API Health Check
```
https://nicodemus.vercel.app/api/admin/overview
```
Should return 400 (expected - needs auth headers)

---

## 🚨 Troubleshooting

**Build fails with "Cannot find module":**
- Check `.env` file has all required keys
- Verify `pnpm install` succeeded locally
- Check GitHub has latest code: `git push origin main`

**Deployment succeeds but pages show 404:**
- Check Environment Variables in Vercel are set
- Verify `NEXT_PUBLIC_SUPABASE_URL` is correct
- Clear browser cache

**Curriculum generation times out:**
- Check Modal endpoint is responding: `MODAL_API_URL`
- Verify Modal app is deployed: `modal logs modal_app.py`
- Check `CLAUDE_API_KEY` is valid

**Stripe webhooks not firing:**
- Update Stripe webhook URL to: `https://your-vercel-url.vercel.app/api/stripe/webhooks`
- Verify `STRIPE_WEBHOOK_SECRET` in Vercel matches Stripe dashboard

---

## 📊 Vercel Pricing

| Plan | Price/mo | Bandwidth | Includes |
|------|----------|-----------|----------|
| Hobby (Free) | $0 | 100 GB | Good for testing |
| Pro | $20 | Unlimited | Production recommended |
| Enterprise | Custom | Custom | For $5M+ ARR |

**Recommended:** Pro plan for production use

---

## 🔄 Auto-Deployment

Once deployed, Vercel auto-deploys on every `git push`:

```bash
git commit -m "feat: add new feature"
git push origin main
# Vercel automatically deploys within 1-2 minutes
```

Monitor deployments at: https://vercel.com/dashboard/nicodemus

---

## 📞 Support

**Vercel Issues:**
- Docs: https://vercel.com/docs
- Support: https://vercel.com/support

**Your Status:**
- GitHub: https://github.com/dna160/Nicodemus
- Supabase: https://app.supabase.com
- Modal: https://modal.com/dashboard
- Stripe: https://dashboard.stripe.com
