# Nicodemus Student Edge - Browser Extension

Privacy-first Chrome extension that tracks student focus and productivity. Only anonymized metrics are sent to the cloud — full URLs and browsing history never leave your device.

## Quick Start

### Prerequisites
- Node.js ≥ 18.0
- pnpm ≥ 8.0
- Chrome browser (latest)

### Development

```bash
cd apps/extension
pnpm install
cp .env.example .env.local
# Edit .env.local with Supabase credentials
pnpm dev
```

Then load in Chrome:
1. Open `chrome://extensions`
2. Enable "Developer mode" (top-right)
3. Click "Load unpacked" → Select `.plasmo/chrome-mv3-dev`

### Production Build

```bash
pnpm build    # Creates optimized extension
pnpm package  # Creates extension.zip for Chrome Web Store
```

## Core Features

### 1. Tab Tracking
- Monitors active tab and URL changes
- Creates sessions for each domain visited
- Records timestamps, keystrokes, scrolls, tab switches

### 2. Domain Classification
- **Productive**: docs.google.com, khanacademy.org, github.com, etc.
- **Distraction**: youtube.com, tiktok.com, reddit.com, etc.
- **Neutral**: Everything else

### 3. Smart Interventions
- **Nudge**: After 15 min on distraction site → shows overlay with snooze option
- **Helper**: After 10 min on productive site with no activity → opens side panel with study tips

### 4. Hourly Sync
- Aggregates raw sessions into metrics (focus_score, keystrokes/min, etc.)
- POSTs anonymized payload to Supabase Edge Function
- Clears local sessions on success

### 5. Privacy Protection
- **No URLs stored**: Only domain hostnames extracted
- **No PII**: Device hash is SHA-256 of browser fingerprint
- **Aggregated metrics only**: Individual sessions never sent to cloud
- **Local first**: Raw sessions stored in `chrome.storage.local`

## File Structure

```
apps/extension/
├── manifest.json              # Manifest V3 config
├── background.ts              # Service worker (tab tracking, alarms)
├── popup.tsx                  # Dashboard popup
├── options.tsx                # Settings (Student ID, study hours)
├── sidepanel.tsx              # Study tips side panel
├── contents/nudge.tsx         # Content script (distraction nudge)
├── lib/
│   ├── domainCategories.ts   # Domain classification
│   ├── storage.ts            # Typed storage wrapper
│   ├── sanitizer.ts          # Raw sessions → metrics
│   └── sync.ts               # Supabase API
├── components/
│   ├── FocusRing.tsx         # SVG progress ring
│   ├── TimeBar.tsx           # Time breakdown bar
│   ├── StatCard.tsx          # Metric cards
│   ├── NudgeCard.tsx         # Nudge content
│   └── HelperCard.tsx        # Study tip cards
├── types.ts                   # TypeScript interfaces
└── tailwind.config.js        # CSS tokens
```

## Configuration

### Environment Variables

Create `.env.local`:

```
PLASMO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
PLASMO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

### Student Settings

1. Click extension icon → Settings (gear icon)
2. Enter Student ID: `NIC-XX0000-XXXX` (get from school dashboard)
3. Configure study hours (default: 8am-10pm)
4. Click "Save"

## Data Schema

### Raw Session (local storage only)
```typescript
{
  sessionId: "1234567890-xyz...",
  domain: "youtube.com",
  category: "distraction",
  startTime: 1711000000000,
  endTime: 1711000600000,
  keystrokes: 15,
  scrollEvents: 8,
  tabSwitches: 1
}
```

### Aggregated Metric (sent to Supabase)
```typescript
{
  device_hash: "a3f8c2e9...",
  student_id: "NIC-JD2026-ABCD",
  metrics: [{
    metric_period_start: "2026-03-21T12:00:00Z",
    metric_period_end: "2026-03-21T13:00:00Z",
    focus_score: 75,
    avg_keystrokes_per_minute: 42.5,
    total_tab_switches: 3,
    struggle_events_count: 1,
    dominant_tab_category: "productive"
  }],
  timestamp: 1711000000000
}
```

## API Integration

### Supabase Edge Function

**Endpoint**: `POST /functions/v1/student-metrics-ingest`

**Headers**:
```
Content-Type: application/json
apikey: PLASMO_PUBLIC_SUPABASE_ANON_KEY
```

**Payload**: `IngestPayload` (see types.ts)

**Response**:
```json
{
  "metric_ids": ["metric_uuid_1", "metric_uuid_2"],
  "status": "success"
}
```

## Chrome Permissions

- `tabs` - Monitor active tab and URL changes
- `storage` - Persist state locally
- `idle` - Detect user idle/active state
- `alarms` - Schedule hourly sync
- `sidePanel` - Open Chrome side panel
- `<all_urls>` - Content script injection

## Troubleshooting

### Extension Not Loading
```bash
# Check for TypeScript errors
pnpm dev

# Rebuild
pnpm build

# Reload in Chrome (chrome://extensions → refresh)
```

### Nudge Not Appearing
- Verify domain is in distraction list: `lib/domainCategories.ts`
- Check if within study hours (default 8am-10pm)
- Ensure 15 minutes elapsed on same domain

### Sync Failing
- Check Supabase Edge Function deployment
- Verify credentials in `.env.local`
- Check network tab in DevTools for request/response

### Memory Issues
- Extension clears old sessions hourly
- Timers are cleaned up on tab close
- Local storage limited to rolling window

## Performance

- **Bundle size**: ~180KB (compressed)
- **Memory usage**: ~5-10MB
- **Network**: 1 request per hour (~500 bytes)
- **CPU**: Passive event listeners only

## Security Notes

**What we track:**
- Domain hostname (youtube.com, not full URL)
- Time spent
- Keystrokes and scroll events
- Tab switches

**What we NEVER track:**
- Search queries
- URLs with paths or query parameters
- Passwords or login credentials
- Personal information
- Content of web pages

**Device Hash:**
- SHA-256 of browser fingerprint (user agent, language, etc.)
- NOT personally identifiable
- Never linked to identity
- Can be reset by clearing cache + reinstalling

## Development Notes

### TypeScript
- Strict mode enabled
- All types in `types.ts`
- No implicit `any`

### Testing
```bash
pnpm test              # Run tests
pnpm test:watch       # Watch mode
pnpm test:coverage    # Coverage report
```

### Linting
```bash
pnpm lint             # Run linter
pnpm type-check       # Type checking
```

## Contributing

Follow established patterns:
- Use `@plasmohq/storage` for state management
- Extract domains with `extractDomain()`, never store raw URLs
- Type all messaging with interfaces from `types.ts`
- Add JSDoc comments to exported functions
- Handle errors gracefully (no silent failures)

## License

Part of Nicodemus Learning Analytics platform.

## Support

For issues or questions:
1. Check browser console and service worker logs
2. Verify `.env.local` credentials
3. Rebuild and reload extension
4. Open an issue with error details and logs
