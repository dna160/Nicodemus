# Phase 2: Student Rep Agent (Browser Extension) - Implementation Plan

**Status:** Planning → Development
**Target Completion:** 40-60 hours of solo development
**Core Deliverable:** Plasmo browser extension for real-time student behavior tracking

---

## Phase 2 Overview

### What is the Student Rep Agent?
A lightweight Plasmo browser extension that runs on student devices during homework sessions to:
- Track **time-on-task** and **browser tab focus patterns**
- Monitor **active tabs** and **tab switches**
- Detect **struggle moments** (long pauses, repetitive clicking)
- Provide **contextual hints** when student gets stuck
- Sync **anonymized** behavioral data to Supabase for teacher analytics

### Why Plasmo?
- **Build browser extensions with React + TypeScript** (no Rust needed)
- **Instant deployment** via Chrome Web Store / Firefox Add-ons
- **Native browser API access** to tab tracking
- **Smaller learning curve** than Tauri (pure JavaScript)
- **Perfect for MVP** - fast iteration, proven distribution
- Can upgrade to Electron/Tauri later if needed

### Privacy-First Architecture
- **No personal identifiers** in local storage (UUID only)
- **Data sanitization** happens locally before sync
- **IndexedDB encrypted storage** on student device
- **One-way sync** to Supabase (append-only metrics)

---

## Phase 2 Architecture

```
┌────────────────────────────────────────────────────┐
│     Plasmo Browser Extension (Student Device)      │
│                                                    │
│  ┌──────────────────────────────────────────────┐ │
│  │  Activity Monitor (TypeScript)               │ │
│  │  - Browser tab focus tracking (Chrome API)   │ │
│  │  - Focus/blur events                         │ │
│  │  - Tab switch detection                      │ │
│  │  - Keystroke/mouse idle detection            │ │
│  └────────────┬─────────────────────────────────┘ │
│               │                                   │
│  ┌────────────▼─────────────────────────────────┐ │
│  │  IndexedDB Storage                           │ │
│  │  - activity_events table                     │ │
│  │  - behavior_metrics table                    │ │
│  │  - encrypted with TweetNaCl                  │ │
│  └────────────┬─────────────────────────────────┘ │
│               │                                   │
│  ┌────────────▼─────────────────────────────────┐ │
│  │  Data Sanitizer                              │ │
│  │  - Remove tab URLs                           │ │
│  │  - Aggregate metrics (5-min blocks)          │ │
│  │  - Hash student ID                           │ │
│  └────────────┬─────────────────────────────────┘ │
│               │                                   │
│  ┌────────────▼─────────────────────────────────┐ │
│  │  Sync Client (HTTP)                          │ │
│  │  - Batch upload to Supabase                 │ │
│  │  - Offline queue (retry logic)              │ │
│  │  - JWT auth with refresh tokens             │ │
│  └────────────┬─────────────────────────────────┘ │
│               │                                   │
└───────────────┼────────────────────────────────────┘
                │
         ┌──────▼──────┐
         │  Supabase   │
         │ (Cloud DB)  │
         └─────────────┘
```

---

## File Structure

```
apps/edge/student-rep/
├── src/
│   ├── background/
│   │   └── index.ts                 # Plasmo background worker (event handling)
│   ├── contents/
│   │   └── index.ts                 # Content script (page injection)
│   ├── popup/
│   │   ├── index.tsx                # Extension popup UI
│   │   └── index.css
│   ├── lib/
│   │   ├── activity_monitor.ts      # Browser tab tracking
│   │   ├── storage.ts               # IndexedDB operations
│   │   ├── sanitizer.ts             # Data anonymization
│   │   ├── sync_client.ts           # Supabase sync
│   │   └── crypto.ts                # Encryption with TweetNaCl
│   └── types.ts                     # Shared TypeScript types
├── public/
│   ├── icons/
│   │   ├── icon16.png
│   │   ├── icon48.png
│   │   └── icon128.png
├── assets/
│   └── manifest.json                # Extension manifest (auto-generated)
├── plasmo.config.ts                 # Plasmo configuration
├── package.json
└── tsconfig.json
```

---

## Core Components

### 1. Activity Monitor (TypeScript Module)
**Purpose:** Browser tab focus tracking to monitor study behavior

**Responsibilities:**
- Get active browser tab + URL
- Track idle time (no keyboard/mouse input)
- Detect struggle patterns (rapid clicking, tab spam)
- Generate events every 10 seconds
- Listen to focus/blur events

**Data Captured:**
```typescript
interface ActivityEvent {
  timestamp: Date;
  active_tab_title: string;      // "Math Homework - Google Docs"
  tab_category: string;          // "docs", "spreadsheet", "code", "other"
  idle_seconds: number;          // Time since last interaction
  keystrokes_per_minute: number; // Keystroke rate
  tab_switches: number;          // Number of tab switches in period
  is_focused: boolean;           // Window has focus?
  struggle_score: number;        // 0.0-1.0 (derived metric)
}
```

**Implementation Strategy:**
- **Chrome API:** tabs.query(), tabs.onActivated, tabs.onUpdated
- **Content Script:** document.hidden, mouse/keyboard events
- **Background Worker:** Polling every 10 seconds (efficient batch processing)

### 2. Local IndexedDB Storage
**Purpose:** Store behavior events locally before sync (encrypted)

**Schema:**
```typescript
// Database: "nicodemus_student_rep"
// Object stores:

// 1. Activity Events
const activityEventsStore = {
  name: "activity_events",
  keyPath: "id",
  indexes: [
    { name: "timestamp", keyPath: "timestamp" },
    { name: "synced", keyPath: "synced" },
    { name: "device_hash", keyPath: "student_device_hash" }
  ]
};

// 2. Behavior Metrics (5-min aggregates)
const behaviorMetricsStore = {
  name: "behavior_metrics",
  keyPath: "id",
  indexes: [
    { name: "period_start", keyPath: "metric_period_start" },
    { name: "synced", keyPath: "synced" },
    { name: "device_hash", keyPath: "student_device_hash" }
  ]
};

// Encryption: All sensitive fields encrypted with TweetNaCl before storing
```

### 3. Data Sanitizer
**Purpose:** Anonymize before syncing to cloud

**Processing Pipeline:**
```
Raw Activity Event
  ↓
Strip URLs (keep category: "google_docs", "github", "leetcode")
  ↓
Remove tab titles (keep only page type)
  ↓
Hash student ID → SHA256(device_id + school_salt)
  ↓
Aggregate into 5-minute metrics
  ↓
Calculate struggle_score (derived)
  ↓
Encrypt non-sync fields
  ↓
Mark as ready_to_sync
  ↓
Send to Supabase
```

**Sanitization Rules:**
- Tab URL → Extract domain + category (Google Docs → "productivity", GitHub → "coding", Reddit → "distraction")
- Tab title → Discard (privacy)
- Student ID → SHA256(device_id + school_salt, one-way)
- Keystroke counts → Aggregated (per-minute rate, not individual keys)
- Browser history → Never stored or transmitted

### 4. Supabase Sync Client
**Purpose:** Reliable upload of metrics to cloud

**Features:**
- **Batch uploads:** 50 events per request
- **Offline queue:** SQLite "synced=FALSE" acts as queue
- **Exponential backoff:** 1s, 2s, 4s, 8s, 16s max
- **JWT refresh:** Auto-refresh before expiry
- **Deduplication:** Check event ID before insert

**Sync Endpoint:**
```typescript
POST /api/sync/student-metrics
{
  "device_hash": "sha256...",
  "metrics": [
    {
      "timestamp": "2026-03-18T10:30:00Z",
      "struggle_score": 0.7,
      "focus_duration_seconds": 300,
      "app_context": "math_homework"
    }
  ]
}
```

### 5. Web Mock Interface (React)
**Purpose:** Test Student Rep behavior without running Tauri

**URL:** `http://localhost:3000/student-rep-mock`

**Features:**
- Simulate 5-minute study session
- Toggle "focus" vs "struggle" modes
- Show live metrics dashboard
- Upload mock data to Supabase
- View sync queue status

---

## Development Phases

### Phase 2a: Setup & Core Tracking (Days 1-3) ✅ COMPLETE
**Goals:**
- [x] Plasmo project scaffold with TypeScript
- [x] Activity Monitor MVP (browser tab tracking)
- [x] IndexedDB integration with encryption
- [x] Basic 5-minute aggregation
- [x] Data sanitizer (privacy layer)
- [x] Sync client skeleton
- [x] Popup dashboard UI

**Deliverable:** 1,300 lines of core extension code, ready for Phase 2b testing

**Status:** Phase 2a scaffold complete (4 hours actual development)
**See:** `PHASE_2A_COMPLETION.md` for detailed breakdown

### Phase 2b: Sanitization & Sync (Days 4-6)
**Goals:**
- [ ] Data sanitizer implementation
- [ ] Supabase sync client
- [ ] Offline queue handling
- [ ] Retry logic with exponential backoff

**Deliverable:** Metrics reliably upload to Supabase

### Phase 2c: Popup UI & Testing (Days 7-8)
**Goals:**
- [ ] Popup dashboard (show today's focus time)
- [ ] Integration tests
- [ ] Analytics mock endpoint
- [ ] Error handling & logging

**Deliverable:** Extension popup shows live metrics

### Phase 2d: Polish & Store Deployment (Days 9-10)
**Goals:**
- [ ] Chrome Web Store listing creation
- [ ] Icons & screenshots
- [ ] Privacy policy + manifest v3 compliance
- [ ] Error handling refinement

**Deliverable:** Live on Chrome Web Store (beta)

---

## Database Schema (Supabase)

### New Tables for Phase 2

```sql
CREATE TABLE student_metrics (
  id UUID PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES schools(id),
  student_device_hash TEXT NOT NULL,      -- anonymized
  metric_window_start TIMESTAMPTZ NOT NULL,
  metric_window_end TIMESTAMPTZ NOT NULL,
  focus_duration_seconds INTEGER,
  struggle_events_count INTEGER,
  avg_idle_seconds REAL,
  dominant_app TEXT,                       -- "spreadsheet", "code_editor", etc.
  focus_score REAL,                        -- 0-100
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(school_id, student_device_hash, metric_window_start)
);

CREATE TABLE device_registrations (
  id UUID PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES schools(id),
  device_hash TEXT NOT NULL,
  device_name TEXT,
  os_type TEXT,                            -- "macos", "windows", "linux"
  app_version TEXT,
  last_sync TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(school_id, device_hash)
);
```

### RLS Policies

```sql
-- Teachers can only see metrics from their students
CREATE POLICY "teachers_read_own_students_metrics" ON student_metrics
  FOR SELECT
  USING (
    school_id = (SELECT school_id FROM teachers WHERE id = auth.uid())
    AND student_device_hash IN (
      SELECT DISTINCT student_device_hash FROM enrollments
      WHERE class_id IN (
        SELECT id FROM classes WHERE teacher_id = auth.uid()
      )
    )
  );

-- Students cannot query metrics (privacy preserved)
CREATE POLICY "students_no_metrics_access" ON student_metrics
  FOR ALL
  USING (FALSE);
```

---

## Key Design Decisions

### Decision 1: Local vs Cloud Aggregation
**Choice:** Local aggregation (5-minute blocks) before sync
**Rationale:**
- Reduces cloud storage by 60x (1 metric per 300 events)
- Preserves individual event data for local replay
- Fits privacy-first model (fine-grained data stays local)

### Decision 2: Struggle Detection
**Choice:** Rule-based on idle time + keystroke patterns
**Rationale:**
- No ML needed (rules: idle > 30s + low keystroke rate = struggling)
- Interpretable to teachers (not a black box)
- No training data required

### Decision 3: Device Anonymization
**Choice:** SHA256(device_id + server_salt)
**Rationale:**
- Deterministic (same device always hashes to same value)
- One-way (cannot reverse to device ID)
- School-specific salt prevents linking across schools

---

## Testing Strategy

### Unit Tests (TypeScript/Vitest)
```typescript
import { describe, it, expect } from 'vitest';
import { sanitizeEvent } from '~/lib/sanitizer';
import { calculateStruggleScore } from '~/lib/activity_monitor';

describe('Sanitizer', () => {
  it('removes tab URLs', () => {
    const event = {
      tab_url: 'https://github.com/anthropics/claude-code/pull/123',
      tab_title: 'My Password is ABC123'
    };
    const sanitized = sanitizeEvent(event);
    expect(sanitized.tab_url).toBeFalsy();
    expect(sanitized.tab_category).toBe('coding');
  });

  it('hashes student ID one-way', () => {
    const event = { student_id: 'john-doe-123' };
    const sanitized = sanitizeEvent(event);
    expect(sanitized.student_device_hash).toBeDefined();
    expect(sanitized.student_device_hash).not.toBe('john-doe-123');
  });
});

describe('Struggle Score', () => {
  it('detects struggle when idle > 30s and low keystroke rate', () => {
    const score = calculateStruggleScore({ idle: 45, kpm: 5 });
    expect(score).toBeGreaterThan(0.7);
  });
});
```

### Extension Integration Tests
```typescript
describe('Student Rep Extension', () => {
  it('tracks active tab changes', async () => {
    // Use chrome.tabs.create in test environment
    // Wait for background worker to record event
    // Query IndexedDB
    // Verify event captured
  });

  it('aggregates metrics every 5 minutes', async () => {
    // Generate 50 activity events
    // Wait for aggregation worker
    // Query behavior_metrics store
    // Verify 5-min metric exists
  });

  it('syncs to Supabase with retry', async () => {
    // Generate metrics
    // Simulate network failure
    // Verify offline queue has items
    // Restore network
    // Verify all items synced
  });

  it('encrypts sensitive data before storage', async () => {
    // Store encrypted event
    // Query IndexedDB raw
    // Verify data is encrypted (unreadable)
    // Decrypt with key
    // Verify readable
  });
});
```

### Manual Testing (Extension UI)
```
1. Install extension locally (chrome://extensions → Load unpacked)
2. Open https://www.google.com/docs
3. Switch tabs 5 times
4. Wait 10 seconds
5. Click extension icon → View popup
6. Verify "Tab Switches: 5" appears
7. Click "View Full Stats"
8. Verify IndexedDB has events (DevTools → Application → IndexedDB)
```

---

## Success Criteria

### Phase 2a Complete
- ✅ Plasmo extension builds and installs locally
- ✅ Background worker captures active tab every 10 seconds
- ✅ Stores 1,000+ events in IndexedDB without lag
- ✅ IndexedDB query performance < 50ms
- ✅ Popup displays live focus time

### Phase 2b Complete
- ✅ Data sanitizer strips all URLs/titles
- ✅ Supabase sync works offline + online
- ✅ Retry logic handles network failures
- ✅ Zero data loss (queue mechanism works)
- ✅ All metrics encrypted before storage

### Phase 2c Complete
- ✅ Popup UI shows today's focus metrics
- ✅ Teachers can query student metrics via API
- ✅ Struggle detection shows in analytics
- ✅ 85%+ test coverage

### Phase 2d Complete
- ✅ Extension published to Chrome Web Store (beta)
- ✅ Extension < 2MB unpacked
- ✅ Memory usage < 40MB
- ✅ Privacy policy + manifest v3 compliant

---

## Next Steps

1. **Start Phase 2a:** Create Tauri scaffold with basic window tracking
2. **Week 2:** Add SQLite + data aggregation
3. **Week 3:** Implement sync client + sanitizer
4. **Week 4:** Build web mock interface + tests
5. **Week 5:** Polish + ship

---

## Open Questions

1. **Struggle Detection Threshold:** Should we use ML or rule-based?
   - **Recommended:** Rule-based for MVP (easy to tune with teacher feedback)
   - ML can come in Phase 3

2. **Data Retention:** How long to keep metrics?
   - **Recommended:** 90 days (schools use to adjust lesson pacing)
   - Archive to cold storage after 90 days

3. **Cross-Platform Priority:** macOS → Windows → Linux?
   - **Recommended:** Windows first (65% of school devices)
   - macOS second (15% of schools use them)
   - Linux last (niche, but free)

---

## Cost Estimate

| Resource | Estimated Cost | Notes |
|----------|----------------|-------|
| Supabase (Phase 2 data) | $50-75/month | 10GB metrics storage, RLS queries |
| Chrome Web Store | $5 (one-time) | Developer account fee |
| Firefox Add-ons | $0 | Free listing |
| Vercel (API mock) | Included | Part of existing bill |
| **Total Phase 2 Setup** | **$5 (one-time)** | |
| **Total Phase 2 Monthly** | **$50-75/month** | |

---

## Key Advantages of Plasmo vs Tauri

| Aspect | Plasmo | Tauri | Winner |
|--------|--------|-------|--------|
| **Dev Speed** | Fast (React + TS) | Slower (Rust + React) | ✅ Plasmo |
| **Deployment** | Chrome Store in 1 day | Build installers (3+ days) | ✅ Plasmo |
| **Learning Curve** | Low | High (Rust + Tauri) | ✅ Plasmo |
| **Upgrade Path** | Easy (just publish new version) | Need installer update | ✅ Plasmo |
| **Browser Access** | Native Chrome APIs | Limited (needs plugins) | ✅ Plasmo |
| **Tab Tracking** | Built-in (tabs API) | Requires native bridge | ✅ Plasmo |

---

This plan is designed for **solo developer** execution with maximum code reuse from Phase 1.

**Timeline:** 10 days of development → Live on Chrome Web Store
