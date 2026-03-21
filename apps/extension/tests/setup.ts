import { vi } from "vitest";

/**
 * Global test setup for Chrome extension tests.
 * Mocks all Chrome API surfaces and utilities.
 */

// Mock chrome.storage.local
const mockStorageLocal = {
  get: vi.fn(async (keys) => {
    if (keys === null || (typeof keys === "object" && Object.keys(keys).length === 0)) {
      return {};
    }
    if (typeof keys === "string") {
      return { [keys]: null };
    }
    if (Array.isArray(keys)) {
      const result: Record<string, null> = {};
      keys.forEach((key: string) => {
        result[key] = null;
      });
      return result;
    }
    return {};
  }),
  set: vi.fn(async (obj) => {}),
  remove: vi.fn(async (keys) => {}),
  clear: vi.fn(async () => {}),
};

// Mock chrome.storage.session
const mockStorageSession = {
  get: vi.fn(async (keys) => {
    if (keys === null || (typeof keys === "object" && Object.keys(keys).length === 0)) {
      return {};
    }
    if (typeof keys === "string") {
      return { [keys]: null };
    }
    if (Array.isArray(keys)) {
      const result: Record<string, null> = {};
      keys.forEach((key: string) => {
        result[key] = null;
      });
      return result;
    }
    return {};
  }),
  set: vi.fn(async (obj) => {}),
  remove: vi.fn(async (keys) => {}),
};

// Mock chrome.tabs
const mockTabs = {
  get: vi.fn(async (tabId) => ({
    id: tabId,
    url: "https://example.com",
    active: true,
  })),
  sendMessage: vi.fn(async (tabId, message) => ({})),
  query: vi.fn(async (queryInfo) => []),
};

// Mock chrome.runtime
const mockRuntime = {
  onMessage: {
    addListener: vi.fn(),
    removeListener: vi.fn(),
  },
  sendMessage: vi.fn(async (message) => ({})),
  openOptionsPage: vi.fn(async () => {}),
  id: "test-extension-id-xyz",
  getManifest: vi.fn(() => ({
    manifest_version: 3,
    version: "1.0.0",
  })),
};

// Mock chrome.alarms
const mockAlarms = {
  create: vi.fn((name, alarmInfo) => {}),
  onAlarm: {
    addListener: vi.fn(),
    removeListener: vi.fn(),
  },
  get: vi.fn(async (name) => null),
  clearAll: vi.fn(async () => {}),
};

// Mock chrome.idle
const mockIdle = {
  setDetectionInterval: vi.fn((intervalInSeconds) => {}),
  onStateChanged: {
    addListener: vi.fn(),
    removeListener: vi.fn(),
  },
};

// Mock chrome.sidePanel
const mockSidePanel = {
  open: vi.fn(async (options) => {}),
  setPanelBehavior: vi.fn(async (behavior) => {}),
};

// Global chrome object
global.chrome = {
  storage: {
    local: mockStorageLocal,
    session: mockStorageSession,
  } as any,
  tabs: mockTabs as any,
  runtime: mockRuntime as any,
  alarms: mockAlarms as any,
  idle: mockIdle as any,
  sidePanel: mockSidePanel as any,
} as any;

// Mock crypto.randomUUID if not available in test environment
if (typeof global.crypto === "undefined") {
  global.crypto = {} as any;
}

if (typeof global.crypto.randomUUID === "undefined") {
  global.crypto.randomUUID = vi.fn(() =>
    "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    })
  ) as unknown as () => `${string}-${string}-${string}-${string}-${string}`;
}

// Utility to get and reset mocks
export const getChromeApiMocks = () => ({
  storageLocal: mockStorageLocal,
  storageSession: mockStorageSession,
  tabs: mockTabs,
  runtime: mockRuntime,
  alarms: mockAlarms,
  idle: mockIdle,
  sidePanel: mockSidePanel,
});

// Utility to reset all mocks
export const resetAllMocks = () => {
  mockStorageLocal.get.mockClear();
  mockStorageLocal.set.mockClear();
  mockStorageLocal.remove.mockClear();
  mockStorageLocal.clear.mockClear();
  mockStorageSession.get.mockClear();
  mockStorageSession.set.mockClear();
  mockStorageSession.remove.mockClear();
  mockTabs.get.mockClear();
  mockTabs.sendMessage.mockClear();
  mockTabs.query.mockClear();
  mockRuntime.onMessage.addListener.mockClear();
  mockRuntime.sendMessage.mockClear();
  mockRuntime.openOptionsPage.mockClear();
  mockAlarms.create.mockClear();
  mockAlarms.onAlarm.addListener.mockClear();
  mockAlarms.get.mockClear();
  mockAlarms.clearAll.mockClear();
  mockIdle.setDetectionInterval.mockClear();
  mockIdle.onStateChanged.addListener.mockClear();
  mockSidePanel.open.mockClear();
  mockSidePanel.setPanelBehavior.mockClear();
};
