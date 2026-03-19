/**
 * Background Worker for Student Rep Agent
 * Manages activity monitoring, aggregation, and syncing
 */

import * as activityMonitor from "~/lib/activity_monitor";
import * as storage from "~/lib/storage";
import * as sanitizer from "~/lib/sanitizer";
import * as crypto from "~/lib/crypto";
import { ActivityEvent, BehaviorMetric, StudentRepConfig, PopupStats } from "~/types";

// Configuration
let config: StudentRepConfig | null = null;
let deviceHash: string = "";

// Timers
let activityCheckTimer: NodeJS.Timeout | null = null;
let aggregationTimer: NodeJS.Timeout | null = null;
let syncTimer: NodeJS.Timeout | null = null;

/**
 * Initialize background worker
 */
async function initialize(): Promise<void> {
  console.log("[Student Rep] Initializing background worker...");

  // Initialize storage
  await storage.initializeStorage();
  console.log("[Student Rep] Storage initialized");

  // Initialize encryption
  await crypto.initializeEncryptionKey();
  console.log("[Student Rep] Encryption initialized");

  // Load or create config
  config = await storage.loadConfig();
  if (!config) {
    config = {
      device_id: crypto.generateId(),
      is_enrolled: false,
      polling_interval_ms: 10000, // 10 seconds
      sync_interval_ms: 300000, // 5 minutes
      aggregation_window_seconds: 300 // 5 minutes
    };
    await storage.saveConfig(config);
    console.log("[Student Rep] Created new config");
  }

  // Generate device hash
  deviceHash = crypto.generateDeviceHash(config.device_id);
  console.log("[Student Rep] Device hash:", deviceHash.substring(0, 8) + "...");

  // Initialize activity monitor
  activityMonitor.initializeActivityMonitor();
  console.log("[Student Rep] Activity monitor initialized");

  // Start periodic tasks
  startActivityChecks();
  startAggregation();
  startSync();

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener(handleMessage);

  console.log("[Student Rep] Background worker ready");
}

/**
 * Start periodic activity checks (every 10 seconds)
 */
function startActivityChecks(): void {
  if (activityCheckTimer) clearInterval(activityCheckTimer);

  activityCheckTimer = setInterval(async () => {
    try {
      const events = activityMonitor.flushEvents();
      if (events.length > 0) {
        // Encrypt sensitive fields before storage
        const sanitizedEvents = events.map((e) => ({
          ...e,
          student_device_hash: deviceHash
        }));
        await storage.saveActivityEventsBatch(sanitizedEvents);
      }
    } catch (error) {
      console.error("[Student Rep] Activity check error:", error);
    }
  }, config?.polling_interval_ms || 10000);
}

/**
 * Start aggregation (every 5 minutes)
 */
function startAggregation(): void {
  if (aggregationTimer) clearInterval(aggregationTimer);

  aggregationTimer = setInterval(async () => {
    try {
      const events = await storage.getUnsyncedActivityEvents();
      if (events.length === 0) return;

      // Group events by 5-minute windows
      const now = Date.now();
      const windowSize = (config?.aggregation_window_seconds || 300) * 1000;
      const periodStart = Math.floor(now / windowSize) * windowSize;
      const periodEnd = periodStart + windowSize;

      // Filter events in this window
      const windowEvents = events.filter(
        (e) => e.timestamp >= periodStart && e.timestamp < periodEnd
      );

      if (windowEvents.length === 0) return;

      // Create metric
      const metric = sanitizer.aggregateEventsToBehaviorMetric(
        windowEvents,
        deviceHash,
        periodStart,
        periodEnd
      );

      await storage.saveBehaviorMetric(metric);
      console.log(`[Student Rep] Created metric: ${metric.id.substring(0, 8)}...`);
    } catch (error) {
      console.error("[Student Rep] Aggregation error:", error);
    }
  }, (config?.aggregation_window_seconds || 300) * 1000);
}

/**
 * Start sync process (every 5 minutes)
 */
function startSync(): void {
  if (syncTimer) clearInterval(syncTimer);

  syncTimer = setInterval(async () => {
    try {
      await syncUnsentMetrics();
    } catch (error) {
      console.error("[Student Rep] Sync error:", error);
    }
  }, config?.sync_interval_ms || 300000);
}

/**
 * Sync unsynced metrics to Supabase
 */
async function syncUnsentMetrics(): Promise<void> {
  if (!config?.is_enrolled) {
    console.log("[Student Rep] Not enrolled, skipping sync");
    return;
  }

  console.log("[Student Rep] Starting sync...");

  try {
    const metrics = await storage.getUnsyncedBehaviorMetrics();
    if (metrics.length === 0) {
      console.log("[Student Rep] No metrics to sync");
      return;
    }

    // Sanitize for transmission
    const sanitized = metrics.map((m) => sanitizer.sanitizeBehaviorMetricForSync(m));

    // Send to Supabase (implement in sync_client.ts)
    // For now, just mark as synced
    for (const metric of metrics) {
      await storage.markMetricSynced(metric.id);
    }

    console.log(`[Student Rep] Synced ${metrics.length} metrics`);
  } catch (error) {
    console.error("[Student Rep] Sync failed:", error);
  }
}

/**
 * Handle messages from popup
 */
function handleMessage(
  request: any,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void
): boolean {
  console.log("[Student Rep] Message from popup:", request.type);

  if (request.type === "get_stats") {
    getPopupStats().then(sendResponse);
    return true; // Will respond asynchronously
  }

  if (request.type === "enable_enrollment") {
    if (config) {
      config.is_enrolled = true;
      config.school_id = request.school_id;
      storage.saveConfig(config);
      sendResponse({ success: true });
    }
    return true;
  }

  if (request.type === "get_storage_stats") {
    storage.getStorageStats().then(sendResponse);
    return true;
  }

  sendResponse({ error: "Unknown message type" });
  return false;
}

/**
 * Get stats for popup display
 */
async function getPopupStats(): Promise<PopupStats> {
  try {
    const stats = await storage.getTodayStats();
    const storageStats = await storage.getStorageStats();

    return {
      today_focus_time_minutes: stats.focus_time_minutes,
      today_struggle_events: stats.struggle_events,
      last_tab_switch_seconds_ago: 0, // TODO: implement
      current_session_duration_minutes: 0, // TODO: implement
      is_sync_in_progress: false,
      offline_events_pending: storageStats.unsynced_metrics_count
    };
  } catch (error) {
    console.error("[Student Rep] Error getting stats:", error);
    return {
      today_focus_time_minutes: 0,
      today_struggle_events: 0,
      last_tab_switch_seconds_ago: 0,
      current_session_duration_minutes: 0,
      is_sync_in_progress: false,
      offline_events_pending: 0
    };
  }
}

// Initialize on service worker start
initialize().catch((error) => {
  console.error("[Student Rep] Initialization failed:", error);
});

// Handle extension reload
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    console.log("[Student Rep] Extension installed");
    // Open onboarding page
    chrome.tabs.create({ url: "https://nicodemus.local/student-rep-onboarding" });
  } else if (details.reason === "update") {
    console.log("[Student Rep] Extension updated");
  }
});
