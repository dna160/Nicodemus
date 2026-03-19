/**
 * Core type definitions for Student Rep Agent
 */

/**
 * Raw activity event captured by the background worker
 */
export interface ActivityEvent {
  id: string;
  timestamp: number; // Unix timestamp
  active_tab_title: string;
  active_tab_url: string;
  tab_category: string; // "docs", "spreadsheet", "coding", "media", "social", "other"
  idle_seconds: number;
  keystrokes_per_minute: number;
  tab_switches_in_period: number;
  is_focused: boolean;
  struggle_score: number; // 0.0-1.0
  synced: boolean;
  created_at: number; // Unix timestamp
}

/**
 * 5-minute aggregated behavior metric
 */
export interface BehaviorMetric {
  id: string;
  student_device_hash: string;
  metric_period_start: number; // Unix timestamp
  metric_period_end: number;
  avg_idle_seconds: number;
  avg_keystrokes_per_minute: number;
  total_tab_switches: number;
  struggle_events_count: number;
  focus_score: number; // 0-100
  dominant_tab_category: string;
  synced: boolean;
  created_at: number; // Unix timestamp
}

/**
 * Sanitized metric ready to sync to Supabase
 */
export interface SanitizedMetric {
  device_hash: string;
  metric_period_start: string; // ISO 8601
  metric_period_end: string;
  avg_idle_seconds: number;
  avg_keystrokes_per_minute: number;
  total_tab_switches: number;
  struggle_events_count: number;
  focus_score: number;
  dominant_tab_category: string;
}

/**
 * Configuration for the Student Rep Agent
 */
export interface StudentRepConfig {
  device_id: string; // UUID generated on first run
  school_id?: string; // Set when paired with school
  student_id?: string; // Optional - for direct linking
  is_enrolled: boolean;
  polling_interval_ms: number; // How often to check active tab (default: 10000)
  sync_interval_ms: number; // How often to sync to Supabase (default: 300000 = 5 min)
  aggregation_window_seconds: number; // Metrics window (default: 300)
}

/**
 * Popup dashboard data
 */
export interface PopupStats {
  today_focus_time_minutes: number;
  today_struggle_events: number;
  last_tab_switch_seconds_ago: number;
  current_session_duration_minutes: number;
  is_sync_in_progress: boolean;
  last_sync_time?: number;
  offline_events_pending: number;
}

/**
 * Sync queue item
 */
export interface SyncQueueItem {
  id: string;
  metric: SanitizedMetric;
  retry_count: number;
  last_error?: string;
  created_at: number;
}

/**
 * Tab category mapping
 */
export type TabCategory = "docs" | "spreadsheet" | "coding" | "media" | "social" | "other";

/**
 * Tab URL domain to category
 */
export const TAB_DOMAIN_MAPPING: Record<string, TabCategory> = {
  "docs.google.com": "docs",
  "microsoft.com": "docs",
  "notion.so": "docs",
  "github.com": "coding",
  "leetcode.com": "coding",
  "stackoverflow.com": "coding",
  "replit.com": "coding",
  "youtube.com": "media",
  "netflix.com": "media",
  "reddit.com": "social",
  "twitter.com": "social",
  "instagram.com": "social",
  "tiktok.com": "social"
};

/**
 * Get tab category from URL
 */
export function getCategoryFromUrl(url: string): TabCategory {
  try {
    const domain = new URL(url).hostname;
    for (const [key, category] of Object.entries(TAB_DOMAIN_MAPPING)) {
      if (domain.includes(key)) {
        return category;
      }
    }
  } catch (e) {
    // Invalid URL
  }
  return "other";
}

/**
 * Message types for background → popup communication
 */
export interface PopupMessage {
  type: "stats_update" | "sync_status" | "error";
  payload: unknown;
}
