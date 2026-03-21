/**
 * Background Service Worker (Manifest V3)
 * Handles tab tracking, idle detection, nudge/helper timers, and hourly sync
 */

import type { BackgroundMessage, RawSession } from "~/types";
import {
  addRawSession,
  clearRawSessions,
  getDeviceHash,
  getState,
  setCurrentSession,
  setState,
} from "./lib/storage";
import {
  categorizeDomain,
  extractDomain,
  isWithinStudyHours,
} from "./lib/domainCategories";
import { getSyncPeriod, syncToSupabase } from "./lib/sync";

// Track which tab is currently active
let activeTabId: number | null = null;

// Track nudge and helper timeouts per tab
const nudgeTimeouts = new Map<number, ReturnType<typeof setTimeout>>();
const helperTimeouts = new Map<number, ReturnType<typeof setTimeout>>();

// Constants for intervention timing
const NUDGE_DELAY_MS = 15 * 60 * 1000; // 15 minutes
const HELPER_DELAY_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Initialize extension on install/update
 */
chrome.runtime.onInstalled.addListener(async () => {
  console.log("Nicodemus Student Edge installed");

  // Initialize device hash
  await getDeviceHash();

  // Create hourly sync alarm
  await chrome.alarms.create("hourly-sync", {
    periodInMinutes: 60,
  });

  // Open options page on first install
  const state = await getState();
  if (!state.studentId) {
    chrome.runtime.openOptionsPage();
  }
});

/**
 * Set idle detection interval to 3 minutes
 */
chrome.idle.setDetectionInterval(180);

/**
 * Track tab activation
 */
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  activeTabId = activeInfo.tabId;

  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);

    if (tab.url) {
      const domain = extractDomain(tab.url);
      const category = categorizeDomain(tab.url);

      const state = await getState();
      const inStudyHours = isWithinStudyHours(
        state.studyHoursStart,
        state.studyHoursEnd
      );

      // Create new session only if in study hours
      if (inStudyHours) {
        // Close previous session if exists
        if (state.currentSession) {
          state.currentSession.endTime = Date.now();
          await addRawSession(state.currentSession);
        }

        // Create new session
        const newSession: RawSession = {
          sessionId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          domain,
          category,
          startTime: Date.now(),
          keystrokes: 0,
          scrollEvents: 0,
          tabSwitches: state.currentSession ? 1 : 0,
        };

        await setCurrentSession(newSession);

        // Set up nudge and helper timers
        setupNudgeTimer(activeInfo.tabId, category, domain);
        setupHelperTimer(activeInfo.tabId, category);
      }
    }
  } catch (error) {
    console.error("Error handling tab activation:", error);
  }
});

/**
 * Track tab updates (URL changes)
 */
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.url && tabId === activeTabId) {
    try {
      const domain = extractDomain(changeInfo.url);
      const category = categorizeDomain(changeInfo.url);

      const state = await getState();
      const inStudyHours = isWithinStudyHours(
        state.studyHoursStart,
        state.studyHoursEnd
      );

      if (inStudyHours) {
        // Close current session
        if (state.currentSession) {
          state.currentSession.endTime = Date.now();
          await addRawSession(state.currentSession);
        }

        // Create new session for new URL
        const newSession: RawSession = {
          sessionId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          domain,
          category,
          startTime: Date.now(),
          keystrokes: 0,
          scrollEvents: 0,
          tabSwitches: (state.currentSession?.tabSwitches ?? 0) + 1,
        };

        await setCurrentSession(newSession);

        // Clear old timers and set up new ones
        clearNudgeTimer(tabId);
        clearHelperTimer(tabId);
        setupNudgeTimer(tabId, category, domain);
        setupHelperTimer(tabId, category);
      }
    } catch (error) {
      console.error("Error handling tab update:", error);
    }
  }
});

/**
 * Track idle state
 */
chrome.idle.onStateChanged.addListener(async (newState) => {
  const state = await getState();

  if (newState === "idle" && state.currentSession) {
    // End current session when user goes idle
    state.currentSession.endTime = Date.now();
    await addRawSession(state.currentSession);
    await setCurrentSession(null);

    // Clear timers
    if (activeTabId) {
      clearNudgeTimer(activeTabId);
      clearHelperTimer(activeTabId);
    }

    console.log("User idle - session ended");
  } else if (newState === "active" && !state.currentSession) {
    // Resume tracking when user returns
    console.log("User active - resuming session");
  }
});

/**
 * Handle hourly sync alarm
 */
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "hourly-sync") {
    console.log("Hourly sync triggered");

    try {
      const state = await getState();

      // Only sync if we have raw sessions to send
      if (state.rawSessions.length > 0) {
        const [periodStart, periodEnd] = getSyncPeriod(60);
        const result = await syncToSupabase(state, periodStart, periodEnd);

        if (result.success) {
          console.log("Sync successful, metrics IDs:", result.metricIds);
        } else {
          console.error("Sync failed:", result.error);
        }
      }
    } catch (error) {
      console.error("Error during hourly sync:", error);
    }
  }
});

/**
 * Handle messages from content scripts and UI
 * Single consolidated listener for all message types
 */
chrome.runtime.onMessage.addListener((message: BackgroundMessage) => {
  handleMessage(message).catch(console.error);
  return false; // No async response needed
});

/**
 * Process incoming messages from content scripts
 */
async function handleMessage(message: BackgroundMessage): Promise<void> {
  try {
    const state = await getState();

    switch (message.type) {
      case "KEYPRESS":
        if (state.currentSession && message.sessionId === state.currentSession.sessionId) {
          state.currentSession.keystrokes++;
          const updatedState = await getState();
          updatedState.currentSession = state.currentSession;
          await setState(updatedState);
        }
        break;

      case "SCROLL":
        if (state.currentSession && message.sessionId === state.currentSession.sessionId) {
          state.currentSession.scrollEvents++;
          const updatedState = await getState();
          updatedState.currentSession = state.currentSession;
          await setState(updatedState);
        }
        break;

      case "TAB_SWITCH":
        if (state.currentSession) {
          state.currentSession.tabSwitches++;
          const updatedState = await getState();
          updatedState.currentSession = state.currentSession;
          await setState(updatedState);
        }
        break;

      case "SNOOZE_NUDGE":
        if (activeTabId) {
          await setSnoozed(activeTabId, Date.now() + 10 * 60 * 1000);
        }
        break;

      case "DISMISS_HELPER":
        if (activeTabId) {
          clearHelperTimer(activeTabId);
        }
        break;

      default:
        console.warn("Unknown message type:", message.type);
    }
  } catch (error) {
    console.error("Error handling message:", error);
  }
}

/**
 * Persist snooze state to chrome.storage.session
 * Survives service worker restarts within a browser session
 */
async function setSnoozed(tabId: number, until: number): Promise<void> {
  await chrome.storage.session.set({ [`snooze_${tabId}`]: until });
}

/**
 * Check if a tab is currently snoozed
 */
async function isSnoozed(tabId: number): Promise<boolean> {
  const result = await chrome.storage.session.get(`snooze_${tabId}`);
  const snoozeTime = result[`snooze_${tabId}`] as number | undefined;
  return (snoozeTime || 0) > Date.now();
}

/**
 * Set up nudge timer for distraction site
 * Shows overlay after 15 minutes of continuous use
 */
function setupNudgeTimer(tabId: number, category: string, domain: string) {
  // Clear existing timer
  clearNudgeTimer(tabId);

  // Only set nudge timer for distraction sites during study hours
  if (category === "distraction") {
    const state = getState().catch(() => null);
    state?.then(async (s) => {
      if (s && isWithinStudyHours(s.studyHoursStart, s.studyHoursEnd)) {
        // Check if snoozed
        const snoozeEnd = await isSnoozed(tabId);
        if (snoozeEnd) {
          return;
        }

        const timeout = setTimeout(async () => {
          console.log(`Nudge timer expired for tab ${tabId}, domain: ${domain}`);

          // Check if still on same domain
          const tab = await chrome.tabs.get(tabId).catch(() => null);
          if (tab && extractDomain(tab.url || "") === domain) {
            // Send message to content script to show nudge
            chrome.tabs.sendMessage(tabId, {
              type: "SHOW_NUDGE",
              payload: { domain, duration: 15 },
            });
          }
        }, NUDGE_DELAY_MS);

        nudgeTimeouts.set(tabId, timeout);
      }
    });
  }
}

/**
 * Set up helper timer for stuck student on productive site
 * Shows side panel after 10 minutes with no interaction
 */
function setupHelperTimer(tabId: number, category: string) {
  // Clear existing timer
  clearHelperTimer(tabId);

  // Only set helper timer for productive sites
  if (category === "productive") {
    const timeout = setTimeout(async () => {
      const state = await getState();

      // Check if still no activity (keystrokes or scrolls)
      if (
        state.currentSession &&
        state.currentSession.keystrokes === 0 &&
        state.currentSession.scrollEvents === 0
      ) {
        console.log(
          `Helper timer expired for tab ${tabId} - opening side panel`
        );

        // Open side panel
        await chrome.sidePanel.open({ tabId });

        // Send message to side panel
        chrome.runtime.sendMessage({
          type: "OPEN_HELPER",
          payload: {
            domain: state.currentSession.domain,
            duration: 10,
          },
        });
      }
    }, HELPER_DELAY_MS);

    helperTimeouts.set(tabId, timeout);
  }
}

/**
 * Clear nudge timer for a tab
 */
function clearNudgeTimer(tabId: number) {
  const timeout = nudgeTimeouts.get(tabId);
  if (timeout) {
    clearTimeout(timeout);
    nudgeTimeouts.delete(tabId);
  }
}

/**
 * Clear helper timer for a tab
 */
function clearHelperTimer(tabId: number) {
  const timeout = helperTimeouts.get(tabId);
  if (timeout) {
    clearTimeout(timeout);
    helperTimeouts.delete(tabId);
  }
}

console.log("Background service worker loaded");
