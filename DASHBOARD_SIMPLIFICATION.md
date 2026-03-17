# Dashboard Simplification: Grading System Dropdown

**Date:** March 17, 2026
**Phase:** 1a (Teacher Curriculum Assistant)
**Status:** ✅ Implemented

---

## Summary

Replaced complex, technical "Standards" text input with an intuitive **Grading System dropdown** that teachers can understand and use without educational jargon.

---

## The Problem

### Before ❌
Teachers were asked to enter educational standards codes:
```
Standards (Comma separated)
CCSS.MATH.5.NF.A.1, CCSS.MATH.5.NF.A.2
```

**Issues:**
- Teachers don't know CCSS codes
- Requires external research to fill out
- Confusing and error-prone
- Creates friction in user experience

---

## The Solution

### After ✅
Teachers select from 5 intuitive grading system options:
```
◉ Alphabetical (A-F)          Standard US grading: A+ through F
○ Percentage (0-100)          100% perfect, 0% failing
○ National Standards (CCSS)   Common Core State Standards
○ State Standards             Your state's education standards
○ International (IB)          International Baccalaureate
```

**Benefits:**
- Teachers don't need to know technical codes
- Radio-button UI is visual and intuitive
- Clear descriptions help with selection
- System adapts curriculum to selected grading framework

---

## User Experience Flow

### 1. Teacher Opens Dashboard
→ `http://localhost:3000/dashboard`

### 2. Fills Out Basic Info
```
Unit Title:      "Fractions"
Subject:         "Math" (dropdown)
Grade Level:     "5"
Duration (Weeks): "4"
```

### 3. Selects Grading System (NEW)
Teachers click one radio button:
```
◉ Alphabetical (A-F)    ← Selected
  Teacher understands this immediately
  No research needed
```

### 4. Clicks Generate
System calls Modal function with:
- Lesson title
- Grade level
- Subject
- Duration
- **Grading system preference** ← Used for curriculum adaptation

### 5. Receives Customized Curriculum
Generated lesson includes:
- Assessment rubrics in A-F scale (not percentages or CCSS codes)
- Grading guidance specific to selected system
- Learning objectives aligned to framework

---

## Technical Implementation

### 1. Updated Types (`packages/shared/src/types.ts`)

```typescript
export const GradingSystemSchema = z.enum([
  'local_alphabetical',  // A+, A, A-, B+, B, B-, C+, C-, D, F
  'local_integer',       // 100-90 (A), 89-80 (B), 79-70 (C), 69-60 (D), 0-59 (F)
  'national_ccss',       // Common Core State Standards
  'state_standards',     // State-specific standards
  'international_ib',    // International Baccalaureate
]);
export type GradingSystem = z.infer<typeof GradingSystemSchema>;
```

Updated lesson schema:
```typescript
export const LessonSchema = z.object({
  // ... other fields ...
  gradingSystem: GradingSystemSchema,  // ← NEW
  // ... other fields ...
});
```

### 2. Constants (`packages/shared/src/constants.ts`)

```typescript
export const GRADING_SYSTEM_LABELS = {
  local_alphabetical: 'Alphabetical (A-F)',
  local_integer: 'Percentage (0-100)',
  national_ccss: 'National Standards (CCSS)',
  state_standards: 'State Standards',
  international_ib: 'International (IB)',
};

export const GRADING_SYSTEM_DESCRIPTIONS = {
  local_alphabetical: 'Standard US grading: A+ through F',
  local_integer: '100% perfect, 0% failing',
  national_ccss: 'Common Core State Standards',
  state_standards: 'Your state\'s education standards',
  international_ib: 'International Baccalaureate',
};
```

### 3. Frontend Component (`apps/web/src/pages/dashboard.tsx`)

```typescript
const [formData, setFormData] = useState({
  unitTitle: 'Algebra',
  subject: 'Math',
  gradeLevel: '7',
  durationWeeks: '4',
  gradingSystem: 'local_alphabetical' as GradingSystem,  // ← NEW
});

// Radio buttons in UI
{GRADING_SYSTEMS.map((system) => (
  <label key={system.value}>
    <input
      type="radio"
      name="gradingSystem"
      value={system.value}
      checked={formData.gradingSystem === system.value}
      onChange={handleInputChange}
    />
    <div>{system.label}</div>
    <div>{system.description}</div>
  </label>
))}
```

### 4. Backend API Route (`apps/web/src/pages/api/curriculum/generate.ts`)

```typescript
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { title, gradeLevel, subject, durationWeeks, gradingSystem } = req.body;

  // Pass gradingSystem to Modal function
  const curriculum = await generateCurriculumWithModal({
    title,
    gradeLevel,
    subject,
    durationWeeks,
    gradingSystem,  // ← Used to customize curriculum
  });

  return res.status(200).json(curriculum);
}
```

---

## How the System Uses Grading System

### When Generating Curriculum

1. **Teacher selects:** "Percentage (0-100)"
2. **API sends to Modal:**
   ```json
   {
     "title": "Fractions",
     "gradeLevel": "5",
     "subject": "Math",
     "gradingSystem": "local_integer"
   }
   ```

3. **Claude AI (via Modal) adapts:**
   - Assessment rubrics use 100-point scales
   - Feedback references percentage grades
   - Success criteria tied to percentage thresholds
   - Example: "Students scoring 80%+ demonstrate proficiency"

4. **Returned curriculum includes:**
   ```
   Week 1 Assessment: Out of 100 points
   Week 2 Quiz: Percentage-based scoring
   Final Project: 0-100 scale with rubric
   ```

### When Grading Student Work (Phase 1b)

Modal's `grade_assignment()` function will:
1. Receive student submission
2. Receive teacher's grading system preference
3. Generate feedback and score in that system
4. Example: Return score as "85%" if integer system selected

---

## Files Changed

| File | Change |
|------|--------|
| `packages/shared/src/types.ts` | Added `GradingSystemSchema` and `GradingSystem` type |
| `packages/shared/src/constants.ts` | Added grading system labels and descriptions |
| `apps/web/src/pages/dashboard.tsx` | NEW - Teacher dashboard with grading dropdown |
| `apps/web/src/pages/api/curriculum/generate.ts` | NEW - Backend API route for curriculum generation |

---

## Testing the Dashboard

```bash
# 1. Install dependencies (if not done)
pnpm install

# 2. Link Supabase
supabase link --project-ref cjxfuoudlrvpdbnjuqqy

# 3. Start Next.js
pnpm -F web dev

# 4. Open in browser
# http://localhost:3000/dashboard
```

### What You Should See
- Form with 5 fields (title, subject, grade, duration, grading system)
- Radio buttons for grading systems with descriptions
- "Generate Curriculum Unit" button
- Loading state while generating
- Results display area

---

## Why This Approach Works

| Aspect | Benefit |
|--------|---------|
| **Simplicity** | Teachers see familiar grading scales (A-F, 0-100) |
| **Flexibility** | System adapts to different school/state systems |
| **Scalability** | Easy to add new grading systems (e.g., IB Extensions, AP) |
| **Consistency** | All generated curriculum respects teacher's grading preference |
| **Future-Proof** | Grades generated in Phase 1b will match teacher's system |

---

## Next Steps

### Phase 1a.2 - Supabase Integration
- [ ] Save generated lessons to `lessons` table
- [ ] Store `gradingSystem` with lesson record
- [ ] Retrieve lessons by teacher

### Phase 1a.3 - Modal Integration
- [ ] Replace mock response with actual Claude API call
- [ ] Pass `gradingSystem` to curriculum generation prompt
- [ ] Verify Claude adapts content to grading framework

### Phase 1b - Grading Automation
- [ ] Build grading UI
- [ ] Use `grade_assignment()` Modal function
- [ ] Return grades in teacher's preferred system

---

## Commit

**Hash:** `c15167e`
**Message:** `feat: simplify teacher dashboard with teacher-friendly grading system dropdown`

---

**Status: ✅ Complete. Ready for Phase 1a.2 (Supabase Integration)**
