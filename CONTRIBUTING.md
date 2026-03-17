# Contributing to Nicodemus

This is a **solo-developer project** in active development. Below are guidelines for maintaining code quality and documentation.

---

## Development Setup

See [documentation/development-guides/LEAN_STACK_GUIDE.md](./documentation/development-guides/LEAN_STACK_GUIDE.md)

---

## Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Type:** feat, fix, docs, style, refactor, test, chore
**Scope:** Feature area (e.g., curriculum, grading, sync)
**Subject:** Imperative mood, lowercase, no period

### Examples

```
feat(curriculum): implement lesson generation via Modal

- Added curriculum generation Modal function
- Integrated Inngest workflow for long-running tasks
- Added support for multiple difficulty variants

Closes #123
```

```
fix(auth): ensure RLS policies block unauthorized access

- Fixed teacher roster filtering bug
- Added test for RLS violations
- Verified FERPA compliance

Related: #456
```

---

## Code Quality

### TypeScript
- Enable strict mode
- Use types, don't use `any`
- Document complex functions

### Python (Modal)
- Type hints for function signatures
- Docstrings for modules/functions
- Follow PEP 8

### SQL
- Use snake_case for table/column names
- Document RLS policies with comments
- Test policies before deploying

---

## Before Committing

```bash
# Type check
pnpm type-check

# Lint
pnpm lint

# Test (if applicable)
pnpm test

# Build
pnpm build
```

---

## Documentation

### Update These When:
- **implementation.md:** Adding/changing Phase 1 scope
- **ARCHITECTURE.md:** Changing system design
- **RLS_DATA_SANITIZATION.md:** Changing privacy/RLS patterns
- **LEAN_STACK_GUIDE.md:** Changing setup instructions
- **SECURITY.md:** New compliance requirements

### Format
- Use clear headings
- Include code examples where relevant
- Add section numbers for cross-referencing

---

## Deployment

### Vercel (Next.js)
```bash
git push origin main
# Auto-deploys to https://nicodemus.vercel.app
```

### Modal
```bash
modal deploy modal_app.py
```

### Supabase
```bash
supabase db push
```

---

## Testing

### Requirements
- Unit tests for utilities
- Integration tests for API routes
- E2E tests for critical workflows (grading, approval)

### Run Tests
```bash
pnpm test

# With coverage
pnpm test:coverage
```

---

## Privacy & Security

Every change touching student data requires:
- [ ] FERPA compliance review
- [ ] RLS policy check (if database change)
- [ ] Data sanitization check (if handling raw data)
- [ ] Audit logging verification

See [SECURITY.md](./documentation/security-compliance/SECURITY.md)

---

## Questions?

Refer to:
- **Setup:** [LEAN_STACK_GUIDE.md](./documentation/development-guides/LEAN_STACK_GUIDE.md)
- **Architecture:** [ARCHITECTURE.md](./documentation/architecture/ARCHITECTURE.md)
- **Privacy:** [SECURITY.md](./documentation/security-compliance/SECURITY.md)
- **RLS:** [RLS_DATA_SANITIZATION.md](./documentation/development-guides/RLS_DATA_SANITIZATION.md)
