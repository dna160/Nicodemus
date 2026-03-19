# Nicodemus Student Rep Agent

**Phase 2: Browser Extension for Study Behavior Tracking**

A privacy-first Plasmo browser extension that runs on student devices to track study behavior and provide personalized learning insights.

## Features

✅ **Activity Monitoring**
- Tracks active browser tabs in real-time
- Detects idle time and focus patterns
- Measures keystroke rate and tab switching frequency

✅ **Local Data Storage**
- IndexedDB encrypted storage on device
- No data sent until explicitly enrolled
- 5-minute aggregated metrics

✅ **Intelligent Struggle Detection**
- Rule-based algorithm (idle > 30s + low keystroke rate = struggling)
- Interprets data pedagogically, not invasively
- Generates focus score (0-100) for each session

✅ **Privacy-First Design**
- Removes all URLs and page titles before storage
- One-way hashing of device ID
- All data encrypted locally with TweetNaCl
- Zero personal identifiers in local storage

✅ **Popup Dashboard**
- Today's focus time in minutes
- Number of struggle events detected
- Offline event count
- Simple enrollment flow

## Architecture

```
background/index.ts         → Main orchestrator (activity monitoring, aggregation, sync)
lib/activity_monitor.ts     → Browser tab focus tracking
lib/storage.ts              → IndexedDB operations (encrypted)
lib/sanitizer.ts            → Data anonymization
lib/crypto.ts               → Encryption/hashing utilities
popup/index.tsx             → Popup UI dashboard
contents/index.ts           → Content script (keystroke detection)
```

## Development

### Prerequisites

```bash
cd apps/edge/student-rep
pnpm install
```

### Development Mode

```bash
pnpm dev
```

This starts Plasmo in development mode:
- Opens Chrome with extension loaded
- Auto-reloads on code changes
- Enables full DevTools debugging

### Testing

```bash
# Run unit tests
pnpm test

# Run with UI
pnpm test:ui
```

### Build for Production

```bash
# Build the extension
pnpm build

# Package for Chrome Web Store
pnpm package
```

## Data Flow

```
1. Activity Monitor (background/index.ts)
   ↓ Every 10 seconds
2. Capture active tab → Store in ActivityEvent[]
   ↓ Every 5 minutes (aggregation timer)
3. Aggregate 50 events → Create BehaviorMetric
   ↓ Store in IndexedDB (encrypted)
4. Every 5 minutes (sync timer, if enrolled)
   ↓ Sanitize metric (remove URLs, hash device ID)
5. Send to Supabase API → Mark as synced
```

## Privacy Guarantees

| Data | Treatment | Reason |
|------|-----------|--------|
| Tab URLs | Removed before storage | Can reveal personal browsing |
| Tab titles | Removed before storage | May contain sensitive content |
| Device ID | One-way hash | Prevents user tracking across sites |
| Keystrokes | Aggregated only (KPM) | Never store individual keys |
| Timestamps | Kept locally only | Shows focus patterns, not content |
| Tab categories | Kept anonymized | "docs", "coding", "social", etc. |

## Metrics Explained

- **Focus Score (0-100)**: Higher = better focus. Calculated from idle time and keystroke rate.
- **Struggle Events**: Count of 5-minute periods where student appears stuck (idle > 30s + low typing).
- **Tab Category**: Inferred from domain (Google Docs → "docs", GitHub → "coding", etc.)

## Configuration

### Polling Interval
- Default: 10 seconds (capture active tab)
- Can be tuned in `StudentRepConfig.polling_interval_ms`

### Aggregation Window
- Default: 5 minutes (300 seconds)
- Reduces 50 activity events → 1 metric
- 60x reduction in storage

### Sync Interval
- Default: 5 minutes (300,000 ms)
- Only syncs if student is enrolled
- Respects offline queue (retries on reconnect)

## Future Enhancements (Phase 3+)

- [ ] ML-based struggle detection
- [ ] Hint suggestions when stuck
- [ ] Integration with teacher dashboard
- [ ] Cross-device sync (phone + desktop)
- [ ] Adaptive break reminders
- [ ] Gamified focus challenges

## Testing the Extension Locally

1. Run `pnpm dev` to build and open Chrome
2. Navigate to `chrome://extensions`
3. Enable "Developer mode"
4. Open DevTools (F12) on any tab
5. Click "Student Rep" extension icon in toolbar
6. View popup dashboard with mock data

## Troubleshooting

**"Storage not initialized" error:**
- Ensure popup is opened after extension loads
- Check browser console (DevTools) for init logs

**No metrics appearing:**
- Open a new tab or switch between tabs to trigger activity capture
- Wait 10 seconds for first capture cycle
- Check IndexedDB: DevTools → Application → IndexedDB

**Sync not working:**
- Extension is not enrolled (click "Enroll" in popup)
- Network is disconnected (metrics queue locally)
- Check background console for errors

## Contributing

See `PHASE_2_PLAN.md` for detailed implementation roadmap and success criteria.

## License

Proprietary - Nicodemus Project
