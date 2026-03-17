---
description: Set up Nicodemus without Docker
---
// turbo-all
1. Install dependencies
```bash
pnpm.cmd install
```

2. Link Supabase project
```bash
pnpm.cmd exec supabase link --project-ref cjxfuoudlrvpdbnjuqqy
```

3. Apply database migrations
```bash
pnpm.cmd exec supabase db push
```

4. Build shared package
```bash
pnpm.cmd -F shared build
```

5. Start web development server
```bash
pnpm.cmd -F web dev
```
