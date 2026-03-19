/**
 * Activity Monitor - Tracks browser tab focus, switches, and idle time
 */

import { ActivityEvent, getCategoryFromUrl } from "~/types";
import * as crypto from "~/lib/crypto";

interface MonitorState {
  last_active_tab_id: number | null;
  last_interaction_time: number; // Unix timestamp ms
  keystrokes_since_last_check: number;
  tab_switches_in_period: number;
  active_events: Map<number, ActivityEvent>; // tab_id -> event
}

let state: MonitorState = {
  last_active_tab_id: null,
  last_interaction_time: Date.now(),
  keystrokes_since_last_check: 0,
  tab_switches_in_period: 0,
  active_events: new Map()
};

/**
 * Initialize activity monitor
 * Attach global listeners for keyboard and focus
 */
export function initializeActivityMonitor(): void {
  // Listen for keyboard events (counts keystrokes)
  document.addEventListener("keydown", handleKeydown, true);

  // Listen for tab focus changes
  chrome.tabs.onActivated.addListener(handleTabActivated);
  chrome.tabs.onUpdated.addListener(handleTabUpdated);
  chrome.windows.onFocusChanged.addListener(handleWindowFocusChanged);

  // Listen for page visibility (browser window focus)
  document.addEventListener("visibilitychange", handleVisibilityChange);
}

/**
 * Count keystrokes (used for KPM calculation)
 */
function handleKeydown(event: KeyboardEvent): void {
  // Don't count modifier keys or navigation keys
  if (["Control", "Shift", "Alt", "Meta", "Tab", "Enter", "Escape"].includes(event.key)) {
    return;
  }
  state.keystrokes_since_last_check += 1;
  state.last_interaction_time = Date.now();
}

/**
 * Handle tab switch events
 */
function handleTabActivated(activeInfo: chrome.tabs.TabActiveInfo): void {
  if (state.last_active_tab_id !== activeInfo.tabId) {
    state.tab_switches_in_period += 1;
  }
  state.last_active_tab_id = activeInfo.tabId;
  state.last_interaction_time = Date.now();

  // Trigger immediate capture of new active tab
  captureCurrentTab();
}

/**
 * Handle tab content updates
 */
function handleTabUpdated(
  tabId: number,
  changeInfo: chrome.tabs.TabChangeInfo,
  tab: chrome.tabs.Tab
): void {
  if (changeInfo.status === "complete" && tabId === state.last_active_tab_id) {
    // Tab finished loading
    captureCurrentTab();
  }
}

/**
 * Handle window focus changes
 */
function handleWindowFocusChanged(windowId: number): void {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    // Browser lost focus
    state.last_interaction_time = Date.now();
  }
}

/**
 * Handle page visibility change (browser window minimize/restore)
 */
function handleVisibilityChange(): void {
  state.last_interaction_time = Date.now();
}

/**
 * Capture current active tab
 */
async function captureCurrentTab(): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) return;

  const now = Date.now();
  const event: ActivityEvent = {
    id: crypto.generateId(),
    timestamp: now,
    active_tab_title: tab.title || "",
    active_tab_url: tab.url || "",
    tab_category: getCategoryFromUrl(tab.url || ""),
    idle_seconds: Math.floor((now - state.last_interaction_time) / 1000),
    keystrokes_per_minute: calculateKPM(now),
    tab_switches_in_period: state.tab_switches_in_period,
    is_focused: !document.hidden,
    struggle_score: calculateStruggleScore(now),
    synced: false,
    created_at: now
  };

  state.active_events.set(tab.id, event);
}

/**
 * Calculate keystrokes per minute
 */
function calculateKPM(now: number): number {
  const elapsed_ms = now - (state.last_interaction_time - 60000); // Last minute
  if (elapsed_ms <= 0) return 0;

  const elapsed_minutes = elapsed_ms / 60000;
  return Math.floor(state.keystrokes_since_last_check / elapsed_minutes);
}

/**
 * Calculate struggle score based on idle time and keystroke rate
 * Struggle indicates: long pauses + low typing = potentially stuck
 */
export function calculateStruggleScore(
  now: number,
  idle_seconds?: number,
  kpm?: number
): number {
  const idle = idle_seconds ?? Math.floor((now - state.last_interaction_time) / 1000);
  const keystrokes = kpm ?? calculateKPM(now);

  let score = 0;

  // Idle time factor: high idle = struggling (30s baseline)
  if (idle > 30) {
    score += Math.min(0.6, (idle - 30) / 120); // Cap at 0.6
  }

  // Low keystroke rate factor: low typing = struggling (5 kpm baseline)
  if (keystrokes < 5) {
    score += Math.min(0.4, (5 - keystrokes) / 10); // Cap at 0.4
  }

  return Math.min(1.0, score);
}

/**
 * Get all collected events since last flush
 */
export function getCollectedEvents(): ActivityEvent[] {
  return Array.from(state.active_events.values());
}

/**
 * Flush collected events and reset counters
 */
export function flushEvents(): ActivityEvent[] {
  const events = getCollectedEvents();

  // Reset state for next period
  state.active_events.clear();
  state.keystrokes_since_last_check = 0;
  state.tab_switches_in_period = 0;
  state.last_interaction_time = Date.now();

  return events;
}

/**
 * Get current monitor state (for diagnostics)
 */
export function getMonitorState(): Readonly<MonitorState> {
  return { ...state };
}

/**
 * Reset monitor state (for testing)
 */
export function resetMonitor(): void {
  state = {
    last_active_tab_id: null,
    last_interaction_time: Date.now(),
    keystrokes_since_last_check: 0,
    tab_switches_in_period: 0,
    active_events: new Map()
  };
}
