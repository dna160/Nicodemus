/**
 * Typed storage wrapper for chrome.storage.local
 * All operations are async and type-safe
 */

import { Storage } from "@plasmohq/storage";

import type {
  ExtensionState,
  RawSession,
} from "~/types";

// Create storage instance
const storage = new Storage({
  area: "local",
});

const STATE_KEY = "extension_state";
const DEFAULT_STATE: ExtensionState = {
  studentId: null,
  studyHoursStart: 8,
  studyHoursEnd: 22,
  rawSessions: [],
  currentSession: null,
  lastSyncTime: 0,
  deviceHash: "",
};

/**
 * Get complete extension state from storage
 * Returns default state if nothing stored yet
 */
export async function getState(): Promise<ExtensionState> {
  const state = await storage.get(STATE_KEY);

  if (!state) {
    return { ...DEFAULT_STATE };
  }

  // Validate and merge with defaults to handle schema evolution
  return {
    ...DEFAULT_STATE,
    ...(state as Partial<ExtensionState>),
  };
}

/**
 * Set complete extension state
 */
export async function setState(state: ExtensionState): Promise<void> {
  await storage.set(STATE_KEY, state);
}

/**
 * Add a new raw session to the queue
 */
export async function addRawSession(session: RawSession): Promise<void> {
  const state = await getState();
  state.rawSessions.push(session);
  await setState(state);
}

/**
 * Update the current active session
 */
export async function setCurrentSession(
  session: RawSession | null
): Promise<void> {
  const state = await getState();
  state.currentSession = session;
  await setState(state);
}

/**
 * Clear all raw sessions from storage (called after successful sync)
 */
export async function clearRawSessions(): Promise<void> {
  const state = await getState();
  state.rawSessions = [];
  state.lastSyncTime = Date.now();
  await setState(state);
}

/**
 * Get student ID
 */
export async function getStudentId(): Promise<string | null> {
  const state = await getState();
  return state.studentId;
}

/**
 * Set student ID
 * Validates format: NIC-XX0000-XXXX
 */
export async function setStudentId(studentId: string): Promise<void> {
  const state = await getState();
  state.studentId = studentId;
  await setState(state);
}

/**
 * Get study hours configuration
 */
export async function getStudyHours(): Promise<[number, number]> {
  const state = await getState();
  return [state.studyHoursStart, state.studyHoursEnd];
}

/**
 * Set study hours configuration
 */
export async function setStudyHours(
  startHour: number,
  endHour: number
): Promise<void> {
  const state = await getState();
  state.studyHoursStart = Math.max(0, Math.min(23, startHour));
  state.studyHoursEnd = Math.max(0, Math.min(23, endHour));
  await setState(state);
}

/**
 * Get device hash (creates one if needed)
 * Uses crypto.randomUUID() to generate a persistent device identifier
 */
export async function getDeviceHash(): Promise<string> {
  const state = await getState();

  if (state.deviceHash) {
    return state.deviceHash;
  }

  // Generate a UUID-based device ID
  const deviceId = await generateDeviceId();
  state.deviceHash = deviceId;
  await setState(state);

  return deviceId;
}

/**
 * Generate a unique device ID using crypto.randomUUID()
 * Available in both service workers and content scripts
 * Persisted in storage so same ID is used across sessions
 */
async function generateDeviceId(): Promise<string> {
  return crypto.randomUUID();
}

/**
 * Get last sync time
 */
export async function getLastSyncTime(): Promise<number> {
  const state = await getState();
  return state.lastSyncTime;
}

/**
 * Update last sync time
 */
export async function setLastSyncTime(timestamp: number): Promise<void> {
  const state = await getState();
  state.lastSyncTime = timestamp;
  await setState(state);
}

/**
 * Get all raw sessions for syncing
 */
export async function getRawSessions(): Promise<RawSession[]> {
  const state = await getState();
  return state.rawSessions;
}
