/**
 * IndexedDB storage for Student Rep Agent
 * - Activity events
 * - Behavior metrics
 * - Configuration
 */

import { ActivityEvent, BehaviorMetric, StudentRepConfig } from "~/types";
import * as crypto from "~/lib/crypto";

const DB_NAME = "nicodemus_student_rep";
const DB_VERSION = 1;

// Object stores
const ACTIVITY_EVENTS_STORE = "activity_events";
const BEHAVIOR_METRICS_STORE = "behavior_metrics";
const CONFIG_STORE = "config";
const SYNC_QUEUE_STORE = "sync_queue";

let db: IDBDatabase | null = null;

/**
 * Initialize IndexedDB
 */
export async function initializeStorage(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve();
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;

      // Create activity events store
      if (!database.objectStoreNames.contains(ACTIVITY_EVENTS_STORE)) {
        const store = database.createObjectStore(ACTIVITY_EVENTS_STORE, { keyPath: "id" });
        store.createIndex("timestamp", "timestamp");
        store.createIndex("synced", "synced");
        store.createIndex("device_hash", "student_device_hash");
      }

      // Create behavior metrics store
      if (!database.objectStoreNames.contains(BEHAVIOR_METRICS_STORE)) {
        const store = database.createObjectStore(BEHAVIOR_METRICS_STORE, { keyPath: "id" });
        store.createIndex("period_start", "metric_period_start");
        store.createIndex("synced", "synced");
        store.createIndex("device_hash", "student_device_hash");
      }

      // Create config store
      if (!database.objectStoreNames.contains(CONFIG_STORE)) {
        database.createObjectStore(CONFIG_STORE, { keyPath: "key" });
      }

      // Create sync queue store
      if (!database.objectStoreNames.contains(SYNC_QUEUE_STORE)) {
        database.createObjectStore(SYNC_QUEUE_STORE, { keyPath: "id" });
      }
    };
  });
}

/**
 * Save activity event
 */
export async function saveActivityEvent(event: ActivityEvent): Promise<void> {
  if (!db) throw new Error("Storage not initialized");

  return new Promise((resolve, reject) => {
    const store = db!.transaction(ACTIVITY_EVENTS_STORE, "readwrite").objectStore(ACTIVITY_EVENTS_STORE);
    const request = store.add(event);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

/**
 * Save multiple activity events (batch)
 */
export async function saveActivityEventsBatch(events: ActivityEvent[]): Promise<void> {
  if (!db) throw new Error("Storage not initialized");

  return new Promise((resolve, reject) => {
    const transaction = db!.transaction(ACTIVITY_EVENTS_STORE, "readwrite");
    const store = transaction.objectStore(ACTIVITY_EVENTS_STORE);

    for (const event of events) {
      store.add(event);
    }

    transaction.onerror = () => reject(transaction.error);
    transaction.oncomplete = () => resolve();
  });
}

/**
 * Save behavior metric
 */
export async function saveBehaviorMetric(metric: BehaviorMetric): Promise<void> {
  if (!db) throw new Error("Storage not initialized");

  return new Promise((resolve, reject) => {
    const store = db!.transaction(BEHAVIOR_METRICS_STORE, "readwrite").objectStore(BEHAVIOR_METRICS_STORE);
    const request = store.add(metric);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

/**
 * Get unsynced activity events
 */
export async function getUnsyncedActivityEvents(): Promise<ActivityEvent[]> {
  if (!db) throw new Error("Storage not initialized");

  return new Promise((resolve, reject) => {
    const transaction = db!.transaction(ACTIVITY_EVENTS_STORE, "readonly");
    const store = transaction.objectStore(ACTIVITY_EVENTS_STORE);
    const index = store.index("synced");
    const request = index.getAll(false);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

/**
 * Get unsynced behavior metrics
 */
export async function getUnsyncedBehaviorMetrics(): Promise<BehaviorMetric[]> {
  if (!db) throw new Error("Storage not initialized");

  return new Promise((resolve, reject) => {
    const transaction = db!.transaction(BEHAVIOR_METRICS_STORE, "readonly");
    const store = transaction.objectStore(BEHAVIOR_METRICS_STORE);
    const index = store.index("synced");
    const request = index.getAll(false);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

/**
 * Mark metric as synced
 */
export async function markMetricSynced(metricId: string): Promise<void> {
  if (!db) throw new Error("Storage not initialized");

  return new Promise((resolve, reject) => {
    const transaction = db!.transaction(BEHAVIOR_METRICS_STORE, "readwrite");
    const store = transaction.objectStore(BEHAVIOR_METRICS_STORE);
    const getRequest = store.get(metricId);

    getRequest.onsuccess = () => {
      const metric = getRequest.result;
      if (metric) {
        metric.synced = true;
        store.put(metric);
      }
    };

    transaction.onerror = () => reject(transaction.error);
    transaction.oncomplete = () => resolve();
  });
}

/**
 * Save configuration
 */
export async function saveConfig(config: StudentRepConfig): Promise<void> {
  if (!db) throw new Error("Storage not initialized");

  return new Promise((resolve, reject) => {
    const store = db!.transaction(CONFIG_STORE, "readwrite").objectStore(CONFIG_STORE);
    const request = store.put({ key: "student_rep_config", ...config });

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

/**
 * Load configuration
 */
export async function loadConfig(): Promise<StudentRepConfig | null> {
  if (!db) throw new Error("Storage not initialized");

  return new Promise((resolve, reject) => {
    const store = db!.transaction(CONFIG_STORE, "readonly").objectStore(CONFIG_STORE);
    const request = store.get("student_rep_config");

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const result = request.result;
      if (result) {
        const { key, ...config } = result;
        resolve(config as StudentRepConfig);
      } else {
        resolve(null);
      }
    };
  });
}

/**
 * Get stats for today
 */
export async function getTodayStats(): Promise<{
  focus_time_minutes: number;
  struggle_events: number;
  session_count: number;
}> {
  if (!db) throw new Error("Storage not initialized");

  return new Promise((resolve, reject) => {
    const transaction = db!.transaction(BEHAVIOR_METRICS_STORE, "readonly");
    const store = transaction.objectStore(BEHAVIOR_METRICS_STORE);
    const request = store.getAll();

    request.onsuccess = () => {
      const metrics = request.result;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStart = today.getTime();
      const todayEnd = todayStart + 24 * 60 * 60 * 1000;

      let focus_time_minutes = 0;
      let struggle_events = 0;

      for (const metric of metrics) {
        if (metric.metric_period_start >= todayStart && metric.metric_period_end <= todayEnd) {
          // Calculate focus time (inverse of idle time)
          const duration_seconds = (metric.metric_period_end - metric.metric_period_start) / 1000;
          const idle_seconds = metric.avg_idle_seconds * (duration_seconds / 60); // Rough estimate
          focus_time_minutes += (duration_seconds - idle_seconds) / 60;
          struggle_events += metric.struggle_events_count;
        }
      }

      resolve({
        focus_time_minutes: Math.round(focus_time_minutes),
        struggle_events,
        session_count: metrics.filter((m) => m.metric_period_start >= todayStart).length
      });
    };

    request.onerror = () => reject(request.error);
  });
}

/**
 * Clear all data (for testing/reset)
 */
export async function clearAllData(): Promise<void> {
  if (!db) throw new Error("Storage not initialized");

  return new Promise((resolve, reject) => {
    const transaction = db!.transaction(
      [ACTIVITY_EVENTS_STORE, BEHAVIOR_METRICS_STORE, CONFIG_STORE, SYNC_QUEUE_STORE],
      "readwrite"
    );

    transaction.objectStore(ACTIVITY_EVENTS_STORE).clear();
    transaction.objectStore(BEHAVIOR_METRICS_STORE).clear();
    transaction.objectStore(CONFIG_STORE).clear();
    transaction.objectStore(SYNC_QUEUE_STORE).clear();

    transaction.onerror = () => reject(transaction.error);
    transaction.oncomplete = () => resolve();
  });
}

/**
 * Get database statistics
 */
export async function getStorageStats(): Promise<{
  activity_events_count: number;
  behavior_metrics_count: number;
  unsynced_metrics_count: number;
}> {
  if (!db) throw new Error("Storage not initialized");

  return new Promise((resolve, reject) => {
    const transaction = db!.transaction([ACTIVITY_EVENTS_STORE, BEHAVIOR_METRICS_STORE], "readonly");

    let activity_count = 0;
    let metrics_count = 0;
    let unsynced_count = 0;

    const activityRequest = transaction.objectStore(ACTIVITY_EVENTS_STORE).count();
    const metricsRequest = transaction.objectStore(BEHAVIOR_METRICS_STORE).count();

    let completed = 0;

    activityRequest.onsuccess = () => {
      activity_count = activityRequest.result;
      completed++;
      if (completed === 2) resolveStats();
    };

    metricsRequest.onsuccess = () => {
      metrics_count = metricsRequest.result;
      completed++;
      if (completed === 2) resolveStats();
    };

    const unsyncedRequest = transaction
      .objectStore(BEHAVIOR_METRICS_STORE)
      .index("synced")
      .count(false);

    unsyncedRequest.onsuccess = () => {
      unsynced_count = unsyncedRequest.result;
      resolveStats();
    };

    function resolveStats() {
      resolve({
        activity_events_count: activity_count,
        behavior_metrics_count: metrics_count,
        unsynced_metrics_count: unsynced_count
      });
    }

    transaction.onerror = () => reject(transaction.error);
  });
}
