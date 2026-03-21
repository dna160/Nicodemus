/**
 * Nicodemus Student Edge - Type Definitions
 * Core interfaces for extension state, sessions, and API contracts
 */

/**
 * Category of website based on domain classification
 */
export type DomainCategory = "productive" | "distraction" | "neutral";

/**
 * Raw telemetry session recorded by background worker
 * One session = continuous time on a single domain
 */
export interface RawSession {
  /** Unique session identifier */
  sessionId: string;

  /** Hostname only (extracted from URL) — never includes protocol or path */
  domain: string;

  /** Productivity category: productive site, distraction, or neutral */
  category: DomainCategory;

  /** Unix timestamp in milliseconds when session started */
  startTime: number;

  /** Unix timestamp in milliseconds when session ended (undefined if active) */
  endTime?: number;

  /** Total keystrokes recorded during this session */
  keystrokes: number;

  /** Total scroll events recorded during this session */
  scrollEvents: number;

  /** Total tab switches that occurred during this session */
  tabSwitches: number;
}

/**
 * Complete extension state persisted in chrome.storage.local
 */
export interface ExtensionState {
  /** Student ID in format "NIC-XX0000-XXXX" (null if not configured) */
  studentId: string | null;

  /** Hour of day when study tracking starts (0-23, default 8) */
  studyHoursStart: number;

  /** Hour of day when study tracking ends (0-23, default 22) */
  studyHoursEnd: number;

  /** All raw sessions not yet synced to server */
  rawSessions: RawSession[];

  /** Currently active session (null if idle or no active tab) */
  currentSession: RawSession | null;

  /** Unix timestamp of last successful sync to Supabase */
  lastSyncTime: number;

  /** SHA-256 hash of browser fingerprint (device identifier) */
  deviceHash: string;
}

/**
 * Single metric aggregated from raw sessions over a time period
 * Matches Supabase Edge Function schema exactly
 */
export interface MetricPeriod {
  /** ISO 8601 timestamp for period start */
  metric_period_start: string;

  /** ISO 8601 timestamp for period end */
  metric_period_end: string;

  /** Average idle time in seconds during this period */
  avg_idle_seconds: number;

  /** Average keystrokes per minute across active time */
  avg_keystrokes_per_minute: number;

  /** Total tab switches during period */
  total_tab_switches: number;

  /** Count of "stuck" events (productive site + 10min+ no interaction) */
  struggle_events_count: number;

  /** Focus score: (productive_time / total_active_time) * 100 */
  focus_score: number;

  /** Dominant tab category: "productive", "distraction", or "neutral" */
  dominant_tab_category: DomainCategory;
}

/**
 * Payload sent to Supabase Edge Function for ingestion
 * Matches student-metrics-ingest endpoint schema
 */
export interface IngestPayload {
  /** SHA-256 device hash (identifies browser instance) */
  device_hash: string;

  /** Optional school identifier */
  school_id?: string;

  /** Student ID if configured */
  student_id?: string;

  /** Array of metric periods for this sync cycle */
  metrics: MetricPeriod[];

  /** Unix timestamp when payload was created */
  timestamp: number;
}

/**
 * Result of sync operation to Supabase
 */
export interface SyncResult {
  /** True if sync succeeded and sessions were cleared */
  success: boolean;

  /** Array of metric IDs returned by server (if successful) */
  metricIds?: string[];

  /** Error message if sync failed */
  error?: string;
}

/**
 * Message types sent between background and content scripts
 */
export interface ContentScriptMessage {
  type:
    | "SHOW_NUDGE"
    | "HIDE_NUDGE"
    | "SNOOZE_NUDGE"
    | "DISMISS_HELPER"
    | "PING";
  payload?: {
    domain?: string;
    duration?: number;
  };
}

/**
 * Message types sent from content scripts back to background
 */
export interface BackgroundMessage {
  type: "KEYPRESS" | "SCROLL" | "TAB_SWITCH" | "SNOOZE_NUDGE" | "DISMISS_HELPER";
  sessionId?: string;
  data?: Record<string, unknown>;
}
