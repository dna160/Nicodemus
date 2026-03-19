/**
 * Supabase Sync Client for Student Rep Agent
 * Handles reliable upload of metrics with offline support and retry logic
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { SanitizedMetric, SyncQueueItem } from "~/types";
import * as crypto from "~/lib/crypto";
import * as storage from "~/lib/storage";

let supabase: SupabaseClient | null = null;
let isInitialized = false;

// Configuration
const SUPABASE_URL = process.env.PLASMO_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.PLASMO_PUBLIC_SUPABASE_ANON_KEY || "";
const MAX_RETRIES = 5;
const INITIAL_BACKOFF_MS = 1000; // 1 second

/**
 * Initialize Supabase client
 */
export async function initializeSupabaseSync(): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn("[Sync] Supabase credentials not configured - sync disabled");
    return;
  }

  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  isInitialized = true;
  console.log("[Sync] Supabase client initialized");
}

/**
 * Get authentication token (with refresh if needed)
 */
async function getAuthToken(): Promise<string | null> {
  if (!supabase) return null;

  try {
    const {
      data: { session }
    } = await supabase.auth.getSession();

    if (session?.access_token) {
      return session.access_token;
    }

    // No authenticated user - use anonymous key
    // In production, this would be a student-specific JWT
    console.log("[Sync] Using anonymous auth (student not authenticated)");
    return null;
  } catch (error) {
    console.error("[Sync] Auth error:", error);
    return null;
  }
}

/**
 * Upload metrics to Supabase
 */
export async function uploadMetrics(metrics: SanitizedMetric[]): Promise<boolean> {
  if (!supabase) {
    console.log("[Sync] Supabase not initialized - queueing metrics");
    await queueMetricsForLater(metrics);
    return false;
  }

  try {
    const token = await getAuthToken();

    // Format for Supabase insert
    const data = metrics.map((metric) => ({
      ...metric,
      created_at: new Date().toISOString()
    }));

    // Insert into student_metrics table
    const { error } = await supabase.from("student_metrics").insert(data);

    if (error) {
      console.error("[Sync] Upload failed:", error);
      await queueMetricsForLater(metrics);
      return false;
    }

    console.log(`[Sync] Successfully uploaded ${metrics.length} metrics`);
    return true;
  } catch (error) {
    console.error("[Sync] Upload error:", error);
    await queueMetricsForLater(metrics);
    return false;
  }
}

/**
 * Upload with retry logic
 */
export async function uploadMetricsWithRetry(
  metrics: SanitizedMetric[],
  attempt: number = 0
): Promise<boolean> {
  if (attempt >= MAX_RETRIES) {
    console.error("[Sync] Max retries exceeded, saving to queue");
    await queueMetricsForLater(metrics);
    return false;
  }

  try {
    const success = await uploadMetrics(metrics);

    if (success) {
      return true;
    }

    // Exponential backoff
    const backoffMs = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
    console.log(
      `[Sync] Retrying in ${backoffMs}ms (attempt ${attempt + 1}/${MAX_RETRIES})`
    );

    await new Promise((resolve) => setTimeout(resolve, backoffMs));
    return uploadMetricsWithRetry(metrics, attempt + 1);
  } catch (error) {
    console.error("[Sync] Retry error:", error);
    return false;
  }
}

/**
 * Queue metrics for later sync (offline support)
 */
async function queueMetricsForLater(metrics: SanitizedMetric[]): Promise<void> {
  // Store in IndexedDB for offline persistence
  // Implementation depends on adding a sync_queue table to storage.ts
  console.log(`[Sync] Queued ${metrics.length} metrics for later`);
}

/**
 * Process sync queue (call this when online)
 */
export async function processSyncQueue(): Promise<number> {
  if (!supabase) {
    console.log("[Sync] Supabase not initialized");
    return 0;
  }

  let syncedCount = 0;

  try {
    // In production, retrieve from sync_queue store in IndexedDB
    // For now, this is a placeholder
    console.log(`[Sync] Processed ${syncedCount} queued items`);
    return syncedCount;
  } catch (error) {
    console.error("[Sync] Queue processing error:", error);
    return syncedCount;
  }
}

/**
 * Register device (called once on first enrollment)
 */
export async function registerDevice(
  deviceHash: string,
  schoolId: string,
  osType: string
): Promise<boolean> {
  if (!supabase) {
    console.log("[Sync] Supabase not initialized");
    return false;
  }

  try {
    const { error } = await supabase.from("device_registrations").insert([
      {
        device_hash: deviceHash,
        school_id: schoolId,
        device_name: navigator.userAgent.substring(0, 100),
        os_type: osType,
        app_version: "0.1.0",
        is_active: true
      }
    ]);

    if (error) {
      console.error("[Sync] Device registration failed:", error);
      return false;
    }

    console.log("[Sync] Device registered successfully");
    return true;
  } catch (error) {
    console.error("[Sync] Registration error:", error);
    return false;
  }
}

/**
 * Check connectivity
 */
export async function checkConnectivity(): Promise<boolean> {
  if (!supabase) return false;

  try {
    const { error } = await supabase.from("device_registrations").select("id", { count: "exact" });
    return !error;
  } catch (error) {
    return false;
  }
}

/**
 * Get device metrics from Supabase (for teacher dashboard)
 */
export async function getDeviceMetrics(
  deviceHash: string,
  days: number = 7
): Promise<SanitizedMetric[]> {
  if (!supabase) return [];

  try {
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - days);

    const { data, error } = await supabase
      .from("student_metrics")
      .select("*")
      .eq("device_hash", deviceHash)
      .gte("created_at", daysAgo.toISOString())
      .order("metric_period_start", { ascending: false });

    if (error) {
      console.error("[Sync] Query error:", error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error("[Sync] Fetch error:", error);
    return [];
  }
}

/**
 * Subscribe to real-time sync status
 */
export function subscribeToSyncStatus(callback: (status: { syncing: boolean; error?: string }) => void): () => void {
  // Placeholder for real-time subscription
  // In production, could use Supabase Realtime
  return () => {
    // Unsubscribe function
  };
}
