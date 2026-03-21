# Nicodemus Student Edge - Implementation Details

Complete browser extension for tracking student focus and productivity. Production-ready TypeScript code, fully copy-pasteable.

## Overview

This is a Plasmo-based Chrome extension that:

1. **Tracks tab activity** - Monitors which sites students visit and for how long
2. **Categorizes domains** - Classifies sites as productive (Khan Academy, Docs), distraction (YouTube, TikTok), or neutral
3. **Detects idle time** - Uses Chrome's idle detection API to pause tracking when user is away
4. **Shows nudges** - After 15 minutes on distraction sites, injects an overlay encouraging focus
5. **Opens helper panel** - When student is stuck on productive site, shows study tips in side panel
6. **Syncs data hourly** - Aggregates anonymous metrics and sends to Supabase Edge Function

## Key Design Decisions

### No URLs in Cloud Data
Only domain hostnames are extracted from URLs and sent to the server. Full URLs are never transmitted, protecting user privacy.

```typescript
// Before: "https://www.youtube.com/watch?v=..."
const domain = extractDomain(url); // After: "youtube.com"
```

### Device Fingerprinting (not PII)
A SHA-256 hash of browser fingerprint (user agent, language, canvas fingerprint) serves as a persistent device identifier. This is NOT personally identifiable information.

```typescript
deviceHash: "a3f8c2e9..." // Hash of browser fingerprint
```

### Aggregated Metrics Only
Raw sessions are converted to aggregated metrics before transmission. The server never sees individual session details, only hourly summaries.

```typescript
// Raw: [Session 1, Session 2, Session 3] → Aggregated
{
  focus_score: 75,
  avg_keystrokes_per_minute: 42.5,
  struggle_events_count: 1,
  // No raw session details
}
```

### Local Persistence
All raw sessions are stored in `chrome.storage.local` (not synced across devices). Only aggregated metrics are sent to cloud.

## File Structure

```
apps/extension/
├── manifest.json              # Manifest V3 configuration
├── background.ts              # Service worker (tab tracking, alarms)
├── popup.tsx                  # Extension popup dashboard
├── options.tsx                # Settings page (Student ID, hours)
├── sidepanel.tsx              # Chrome side panel (study tips)
├── contents/nudge.tsx         # Content script (distraction nudge)
├── lib/
│   ├── domainCategories.ts   # Domain classification
│   ├── storage.ts            # Typed storage wrapper
│   ├── sanitizer.ts          # Sessions → metrics
│   └── sync.ts               # Supabase API calls
├── components/
│   ├── FocusRing.tsx         # SVG progress ring
│   ├── TimeBar.tsx           # Time breakdown chart
│   ├── StatCard.tsx          # Metric cards
│   ├── NudgeCard.tsx         # Nudge content
│   └── HelperCard.tsx        # Study tip cards
├── types.ts                   # TypeScript interfaces
├── tsconfig.json             # Strict TypeScript config
├── tailwind.config.js        # CSS design tokens
├── package.json              # Dependencies
└── README.md                 # Setup guide
```

## Architecture

### Background Service Worker

The background service worker (`background.ts`) is the heart of the extension. It:

1. **Tracks tabs** - Listens to `chrome.tabs.onActivated` and `chrome.tabs.onUpdated`
2. **Creates sessions** - When user switches domains, closes old session and opens new one
3. **Detects idle** - Uses `chrome.idle.onStateChanged` to pause tracking
4. **Sets timers** - 15-minute nudge timer for distraction, 10-minute helper timer for stuck
5. **Receives activity** - Content scripts send keypress/scroll events via `chrome.runtime.sendMessage`
6. **Syncs hourly** - `chrome.alarms` trigger `syncToSupabase()` every hour

```typescript
// Simplified flow:
chrome.tabs.onActivated
  → extract domain and category
  → close previous session, add to storage
  → create new session
  → set nudge and helper timers

chrome.idle.onStateChanged (idle)
  → close current session
  → clear timers

chrome.alarms.onAlarm (hourly-sync)
  → aggregate sessions to metrics
  → POST to Supabase
  → clear raw sessions on success
```

### Content Script (nudge.tsx)

The content script is injected into all web pages. It:

1. **Listens for messages** - Background sends `SHOW_NUDGE` / `HIDE_NUDGE` messages
2. **Renders overlay** - Creates a scoped DOM element with nudge UI
3. **Handles interactions** - Snooze or dismiss buttons send messages back
4. **Tracks activity** - Keydowns and scrolls trigger messages to background
5. **Cleans up** - Auto-dismisses after 60 seconds if no interaction

```typescript
// User spends 15 min on youtube.com
background.setupNudgeTimer() // Wait 15 minutes
background.sendMessage({type: "SHOW_NUDGE", domain: "youtube.com"})
content.showNudge() // Render overlay
user.clicks("Snooze")
content.sendMessage({type: "SNOOZE_NUDGE"})
background.snoozedUntil.set(tabId, Date.now() + 10*60*1000)
```

### UI Components

All UI is built with React + Tailwind CSS. Components are scoped to prevent CSS conflicts:

- **FocusRing.tsx** - SVG circle showing focus score 0-100 with color gradient
- **TimeBar.tsx** - Stacked horizontal bar chart of time by category
- **StatCard.tsx** - Metric card with icon, label, and value
- **NudgeCard.tsx** - Intervention message with snooze/dismiss buttons
- **HelperCard.tsx** - Study tip with icon, title, and description

### Type System

All data structures are TypeScript interfaces with JSDoc:

```typescript
interface RawSession {
  sessionId: string;      // Unique ID
  domain: string;         // Hostname only (youtube.com, not URL)
  category: DomainCategory;
  startTime: number;      // Unix ms
  endTime?: number;       // Undefined if still active
  keystrokes: number;
  scrollEvents: number;
  tabSwitches: number;
}

interface ExtensionState {
  studentId: string | null;
  studyHoursStart: number;
  studyHoursEnd: number;
  rawSessions: RawSession[];
  currentSession: RawSession | null;
  lastSyncTime: number;
  deviceHash: string;
}

interface IngestPayload {
  device_hash: string;
  student_id?: string;
  metrics: MetricPeriod[];
  timestamp: number;
}

interface MetricPeriod {
  metric_period_start: string;
  metric_period_end: string;
  avg_idle_seconds: number;
  avg_keystrokes_per_minute: number;
  total_tab_switches: number;
  struggle_events_count: number;
  focus_score: number;
  dominant_tab_category: DomainCategory;
}
```

## Data Flow

### 1. Session Creation

```
User switches to youtube.com
↓
chrome.tabs.onActivated fires
↓
background.ts extracts domain and category
↓
closes previous session: state.currentSession.endTime = Date.now()
↓
adds to storage: await addRawSession(previousSession)
↓
creates new session:
  sessionId: "1234567890-xyz..."
  domain: "youtube.com"
  category: "distraction"
  startTime: Date.now()
↓
saves to storage: await setCurrentSession(newSession)
↓
sets nudge timer: setTimeout(showNudge, 15 * 60 * 1000)
```

### 2. Activity Recording

```
User presses key
↓
content script fires: keydown event
↓
content.tsx sends: chrome.runtime.sendMessage({type: "KEYPRESS"})
↓
background.ts receives message
↓
increments: state.currentSession.keystrokes++
↓
updates storage: await setState(updatedState)
```

### 3. Hourly Sync

```
chrome.alarms fires "hourly-sync" (every 60 minutes)
↓
background.ts calls: syncToSupabase(state, periodStart, periodEnd)
↓
lib/sync.ts aggregates:
  - productiveMs, distractionMs, neutralMs (time by category)
  - total keystrokes, scrolls, tab switches
  - struggle events (productive site, >10min, no interaction)
  - focus_score = (productiveMs / totalActiveMs) * 100
↓
creates IngestPayload:
  {
    device_hash: "a3f8c2e9...",
    student_id: "NIC-JD2026-ABCD",
    metrics: [{focus_score: 75, ...}],
    timestamp: Date.now()
  }
↓
POST to Supabase Edge Function:
  curl -X POST https://xxx.supabase.co/functions/v1/student-metrics-ingest \
    -H "Content-Type: application/json" \
    -H "apikey: xxx" \
    -d <payload>
↓
on 200 OK:
  - clear rawSessions: await clearRawSessions()
  - update lastSyncTime: await setLastSyncTime(Date.now())
↓
on error:
  - retain sessions (retry next hour)
  - return SyncResult with error message
```

## Security & Privacy

### No URL Storage
```typescript
// ✗ NEVER DO THIS
const sessions = [
  { url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" } // BAD!
];

// ✓ ALWAYS DO THIS
const sessions = [
  { domain: extractDomain(url) } // youtube.com (hostname only)
];
```

### Device Hash (not PII)
```typescript
// Generated once from browser fingerprint
const fingerprint = JSON.stringify({
  userAgent: navigator.userAgent,
  language: navigator.language,
  hardwareConcurrency: navigator.hardwareConcurrency,
  canvasData: canvasFingerprint,
});
const deviceHash = await sha256Hash(fingerprint);
// Result: "a3f8c2e9d1b4f6..." (not linked to identity)
```

### Aggregated Metrics Only
```typescript
// ✗ NEVER SEND
{
  sessions: [
    { domain: "youtube.com", startTime: 1234567890, endTime: 1234568890 },
    { domain: "docs.google.com", startTime: 1234568890, endTime: 1234569890 }
  ]
}

// ✓ ALWAYS SEND
{
  metrics: [{
    metric_period_start: "2026-03-21T12:00:00Z",
    metric_period_end: "2026-03-21T13:00:00Z",
    focus_score: 75,
    avg_keystrokes_per_minute: 42.5
  }]
}
```

### Local-Only Storage
- Raw sessions stored in `chrome.storage.local` (not synced)
- Only aggregated metrics sent to cloud
- Metrics contain no timestamps for individual sessions
- Device hash cannot be reverse-engineered to identity

## Intervention Timing

### Nudge (Distraction Timer)

```
User lands on youtube.com during 8am-10pm (study hours)
↓
background.ts sets 15-minute timer
↓
User is still on youtube.com after 15 minutes
↓
background.ts sends: chrome.tabs.sendMessage({type: "SHOW_NUDGE"})
↓
content script renders nudge overlay
↓
User clicks "Snooze 10 min"
↓
background.ts records: snoozedUntil.set(tabId, Date.now() + 10*60*1000)
↓
Next nudge timer won't fire for 10 minutes
```

### Helper (Stuck Student Timer)

```
User lands on docs.google.com (productive)
↓
background.ts sets 10-minute helper timer
↓
User is still on docs, but NO keystrokes or scrolls for 10 minutes
↓
background.ts opens side panel: chrome.sidePanel.open({tabId})
↓
sidepanel.tsx renders with study tips
↓
User clicks "I'm Good, Close This"
↓
background.ts notes helper dismissed
```

## Testing Strategy

Each module has:
- **Input validation** - Reject invalid domains, timestamps
- **Error handling** - Graceful failures, no silent crashes
- **Type safety** - Strict TypeScript, no implicit any
- **Edge cases** - Midnight hour transitions, tab switches, idle detection

Example test case:

```typescript
// domainCategories.test.ts
describe("categorizeDomain", () => {
  it("classifies youtube.com as distraction", () => {
    expect(categorizeDomain("https://www.youtube.com/watch?v=xyz")).toBe("distraction");
  });

  it("classifies docs.google.com as productive", () => {
    expect(categorizeDomain("https://docs.google.com/document/d/xyz")).toBe("productive");
  });

  it("handles subdomains", () => {
    expect(categorizeDomain("https://music.youtube.com")).toBe("distraction");
  });

  it("extracts domain from complex URL", () => {
    expect(extractDomain("https://user:pass@example.com:8080/path")).toBe("example.com");
  });
});
```

## Performance Considerations

### Bundle Size
- Plasmo handles code splitting automatically
- Content script is separate from popup (lazy-loaded)
- Tailwind CSS purges unused styles in build

### Memory
- Nudge/helper timers cleared on tab close
- Sessions cleared hourly after sync
- Max 1000 raw sessions stored locally (rolling window)

### Network
- Single HTTP POST per hour (sync)
- Payload ~500 bytes (one metric period)
- Retry logic for failed syncs (next hour)

### CPU
- Activity tracking is passive (event listeners only)
- Idle detection interval: 3 minutes (Chrome default)
- Focus score calculation: O(n) where n = sessions in period

## Deployment

### Build

```bash
cd apps/extension
pnpm install
pnpm build
```

Creates `/build` directory with:
- `manifest.json`
- `background.js` (service worker)
- `popup.html`, `popup.js` (UI)
- `options.html`, `options.js` (settings)
- `sidepanel.html`, `sidepanel.js` (side panel)
- `contents/nudge.js` (content script)

### Load in Chrome (Development)

1. Go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select `/build` directory

### Publish to Chrome Web Store

1. Create `.zip` of `/build` directory
2. Upload to Chrome Web Store dashboard
3. Add description, screenshots, privacy policy
4. Submit for review (24-48 hours)

## Environment Variables

Create `.env.local`:

```
PLASMO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
PLASMO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

These are embedded in the extension at build time.

## Troubleshooting

### Extension not loading
- Check TypeScript errors: `pnpm dev`
- Check browser console in DevTools
- Verify `.env.local` has correct keys

### Nudge not appearing
- Verify domain is in `DISTRACTION_DOMAINS`
- Check if within study hours
- Ensure 15 minutes elapsed on same domain

### Sync failing
- Check Supabase Edge Function is deployed
- Verify `PLASMO_PUBLIC_SUPABASE_URL` is correct
- Check network tab in DevTools for 401/403 errors

### Memory leak
- Ensure timers are cleared: `clearNudgeTimer()`, `clearHelperTimer()`
- Verify nudge container is removed from DOM

## Future Enhancements

1. **Per-domain whitelisting** - Override distraction classification
2. **Focus sessions** - Dedicated study mode with no interruptions
3. **Streak tracking** - Days without visiting distraction sites
4. **Analytics dashboard** - Detailed focus reports by subject
5. **Teacher integration** - Class-level insights for educators
6. **Offline support** - Queue sync when network unavailable
7. **Custom intervention messages** - School-specific nudges
8. **Mobile app** - Companion iOS/Android app
