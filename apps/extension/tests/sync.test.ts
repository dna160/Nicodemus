import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ExtensionState, RawSession, MetricPeriod } from "~/types";

/**
 * Mock @plasmohq/storage before importing sync
 */
vi.mock("@plasmohq/storage", () => ({
  Storage: vi.fn().mockImplementation(() => ({
    get: vi.fn(),
    set: vi.fn(),
  })),
}));

/**
 * Mock lib/storage functions
 */
vi.mock("~/lib/storage", () => ({
  clearRawSessions: vi.fn().mockResolvedValue(undefined),
  getDeviceHash: vi.fn().mockResolvedValue("test-device-hash-abc123"),
  getStudentId: vi.fn().mockResolvedValue("NIC-TEST2026-XXXX"),
  setLastSyncTime: vi.fn().mockResolvedValue(undefined),
}));

/**
 * Import after mocks are defined
 */
import { syncToSupabase, shouldSync, getSyncPeriod } from "~/lib/sync";
import * as storageLib from "~/lib/storage";

describe("sync.ts - syncToSupabase, shouldSync, getSyncPeriod", () => {
  let mockFetch: any;

  beforeEach(() => {
    // Clear all mocks before setup
    vi.clearAllMocks();

    // Re-setup storage mocks cleared by clearAllMocks
    vi.mocked(storageLib.getDeviceHash).mockResolvedValue("test-device-hash-abc123");
    vi.mocked(storageLib.getStudentId).mockResolvedValue("NIC-TEST2026-XXXX");
    vi.mocked(storageLib.clearRawSessions).mockResolvedValue(undefined);
    vi.mocked(storageLib.setLastSyncTime).mockResolvedValue(undefined);

    // Set required environment variables
    process.env.PLASMO_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.PLASMO_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

    // Setup global fetch mock
    mockFetch = vi.fn();
    global.fetch = mockFetch as any;

    // Default successful response
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        metric_ids: ["uuid-1", "uuid-2"],
        summary: {
          focus_level: "normal",
          fatigue: "none",
          recommendations: ["Good work!"],
        },
        message: "Metrics ingested successfully",
      }),
      text: async () => "",
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("syncToSupabase", () => {
    it("should call fetch once with correct Edge Function URL", async () => {
      const state: ExtensionState = {
        studentId: "NIC-TEST2026-XXXX",
        studyHoursStart: 8,
        studyHoursEnd: 22,
        rawSessions: [
          {
            sessionId: "test-1",
            domain: "khanacademy.org",
            category: "productive",
            startTime: Date.now() - 60 * 60 * 1000,
            endTime: Date.now(),
            keystrokes: 100,
            scrollEvents: 50,
            tabSwitches: 2,
          },
        ],
        currentSession: null,
        lastSyncTime: 0,
        deviceHash: "test-device-hash",
      };

      const periodStart = new Date(Date.now() - 60 * 60 * 1000);
      const periodEnd = new Date();

      await syncToSupabase(state, periodStart, periodEnd);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const callUrl = mockFetch.mock.calls[0][0];
      expect(callUrl).toContain("/functions/v1/student-metrics-ingest");
    });

    it("should call fetch with POST method", async () => {
      const state: ExtensionState = {
        studentId: "NIC-TEST2026-XXXX",
        studyHoursStart: 8,
        studyHoursEnd: 22,
        rawSessions: [
          {
            sessionId: "test-1",
            domain: "youtube.com",
            category: "distraction",
            startTime: Date.now() - 60 * 60 * 1000,
            endTime: Date.now(),
            keystrokes: 50,
            scrollEvents: 30,
            tabSwitches: 5,
          },
        ],
        currentSession: null,
        lastSyncTime: 0,
        deviceHash: "test-device-hash",
      };

      const periodStart = new Date(Date.now() - 60 * 60 * 1000);
      const periodEnd = new Date();

      await syncToSupabase(state, periodStart, periodEnd);

      expect(mockFetch.mock.calls[0][1].method).toBe("POST");
    });

    it("should include Content-Type header", async () => {
      const state: ExtensionState = {
        studentId: "NIC-TEST2026-XXXX",
        studyHoursStart: 8,
        studyHoursEnd: 22,
        rawSessions: [
          {
            sessionId: "test-1",
            domain: "khanacademy.org",
            category: "productive",
            startTime: Date.now() - 60 * 60 * 1000,
            endTime: Date.now(),
            keystrokes: 100,
            scrollEvents: 50,
            tabSwitches: 2,
          },
        ],
        currentSession: null,
        lastSyncTime: 0,
        deviceHash: "test-device-hash",
      };

      const periodStart = new Date(Date.now() - 60 * 60 * 1000);
      const periodEnd = new Date();

      await syncToSupabase(state, periodStart, periodEnd);

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers["Content-Type"]).toBe("application/json");
    });

    it("should include apikey header", async () => {
      const state: ExtensionState = {
        studentId: "NIC-TEST2026-XXXX",
        studyHoursStart: 8,
        studyHoursEnd: 22,
        rawSessions: [
          {
            sessionId: "test-1",
            domain: "khanacademy.org",
            category: "productive",
            startTime: Date.now() - 60 * 60 * 1000,
            endTime: Date.now(),
            keystrokes: 100,
            scrollEvents: 50,
            tabSwitches: 2,
          },
        ],
        currentSession: null,
        lastSyncTime: 0,
        deviceHash: "test-device-hash",
      };

      const periodStart = new Date(Date.now() - 60 * 60 * 1000);
      const periodEnd = new Date();

      await syncToSupabase(state, periodStart, periodEnd);

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers.apikey).toBeDefined();
      expect(typeof headers.apikey).toBe("string");
    });

    it("should send payload with device_hash, metrics, and timestamp fields", async () => {
      const state: ExtensionState = {
        studentId: "NIC-TEST2026-XXXX",
        studyHoursStart: 8,
        studyHoursEnd: 22,
        rawSessions: [
          {
            sessionId: "test-1",
            domain: "github.com",
            category: "productive",
            startTime: Date.now() - 60 * 60 * 1000,
            endTime: Date.now(),
            keystrokes: 200,
            scrollEvents: 100,
            tabSwitches: 3,
          },
        ],
        currentSession: null,
        lastSyncTime: 0,
        deviceHash: "test-device-hash",
      };

      const periodStart = new Date(Date.now() - 60 * 60 * 1000);
      const periodEnd = new Date();

      await syncToSupabase(state, periodStart, periodEnd);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body).toHaveProperty("device_hash");
      expect(body).toHaveProperty("metrics");
      expect(body).toHaveProperty("timestamp");
    });

    it("should not include http:// in payload (privacy check)", async () => {
      const state: ExtensionState = {
        studentId: "NIC-TEST2026-XXXX",
        studyHoursStart: 8,
        studyHoursEnd: 22,
        rawSessions: [
          {
            sessionId: "test-1",
            domain: "khanacademy.org",
            category: "productive",
            startTime: Date.now() - 60 * 60 * 1000,
            endTime: Date.now(),
            keystrokes: 100,
            scrollEvents: 50,
            tabSwitches: 2,
          },
        ],
        currentSession: null,
        lastSyncTime: 0,
        deviceHash: "test-device-hash",
      };

      const periodStart = new Date(Date.now() - 60 * 60 * 1000);
      const periodEnd = new Date();

      await syncToSupabase(state, periodStart, periodEnd);

      const body = mockFetch.mock.calls[0][1].body;
      expect(body).not.toContain("http://");
    });

    it("should not include https:// in payload (privacy check)", async () => {
      const state: ExtensionState = {
        studentId: "NIC-TEST2026-XXXX",
        studyHoursStart: 8,
        studyHoursEnd: 22,
        rawSessions: [
          {
            sessionId: "test-1",
            domain: "youtube.com",
            category: "distraction",
            startTime: Date.now() - 60 * 60 * 1000,
            endTime: Date.now(),
            keystrokes: 50,
            scrollEvents: 30,
            tabSwitches: 5,
          },
        ],
        currentSession: null,
        lastSyncTime: 0,
        deviceHash: "test-device-hash",
      };

      const periodStart = new Date(Date.now() - 60 * 60 * 1000);
      const periodEnd = new Date();

      await syncToSupabase(state, periodStart, periodEnd);

      const body = mockFetch.mock.calls[0][1].body;
      expect(body).not.toContain("https://");
    });

    it("should not include url field in metrics array", async () => {
      const state: ExtensionState = {
        studentId: "NIC-TEST2026-XXXX",
        studyHoursStart: 8,
        studyHoursEnd: 22,
        rawSessions: [
          {
            sessionId: "test-1",
            domain: "khanacademy.org",
            category: "productive",
            startTime: Date.now() - 60 * 60 * 1000,
            endTime: Date.now(),
            keystrokes: 100,
            scrollEvents: 50,
            tabSwitches: 2,
          },
        ],
        currentSession: null,
        lastSyncTime: 0,
        deviceHash: "test-device-hash",
      };

      const periodStart = new Date(Date.now() - 60 * 60 * 1000);
      const periodEnd = new Date();

      await syncToSupabase(state, periodStart, periodEnd);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      if (body.metrics && body.metrics.length > 0) {
        expect(body.metrics[0]).not.toHaveProperty("url");
      }
    });

    it("should call clearRawSessions on 200 response", async () => {
      const state: ExtensionState = {
        studentId: "NIC-TEST2026-XXXX",
        studyHoursStart: 8,
        studyHoursEnd: 22,
        rawSessions: [
          {
            sessionId: "test-1",
            domain: "khanacademy.org",
            category: "productive",
            startTime: Date.now() - 60 * 60 * 1000,
            endTime: Date.now(),
            keystrokes: 100,
            scrollEvents: 50,
            tabSwitches: 2,
          },
        ],
        currentSession: null,
        lastSyncTime: 0,
        deviceHash: "test-device-hash",
      };

      const periodStart = new Date(Date.now() - 60 * 60 * 1000);
      const periodEnd = new Date();

      await syncToSupabase(state, periodStart, periodEnd);

      expect(storageLib.clearRawSessions).toHaveBeenCalled();
    });

    it("should not call clearRawSessions on 500 error response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ success: false, error: "Internal Server Error" }),
        text: async () => "Internal Server Error",
      });

      const state: ExtensionState = {
        studentId: "NIC-TEST2026-XXXX",
        studyHoursStart: 8,
        studyHoursEnd: 22,
        rawSessions: [
          {
            sessionId: "test-1",
            domain: "khanacademy.org",
            category: "productive",
            startTime: Date.now() - 60 * 60 * 1000,
            endTime: Date.now(),
            keystrokes: 100,
            scrollEvents: 50,
            tabSwitches: 2,
          },
        ],
        currentSession: null,
        lastSyncTime: 0,
        deviceHash: "test-device-hash",
      };

      const periodStart = new Date(Date.now() - 60 * 60 * 1000);
      const periodEnd = new Date();

      vi.mocked(storageLib.clearRawSessions).mockClear();
      await syncToSupabase(state, periodStart, periodEnd);

      expect(storageLib.clearRawSessions).not.toHaveBeenCalled();
    });

    it("should return error object on 500 response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ success: false, error: "Internal Server Error" }),
        text: async () => "Internal Server Error",
      });

      const state: ExtensionState = {
        studentId: "NIC-TEST2026-XXXX",
        studyHoursStart: 8,
        studyHoursEnd: 22,
        rawSessions: [
          {
            sessionId: "test-1",
            domain: "khanacademy.org",
            category: "productive",
            startTime: Date.now() - 60 * 60 * 1000,
            endTime: Date.now(),
            keystrokes: 100,
            scrollEvents: 50,
            tabSwitches: 2,
          },
        ],
        currentSession: null,
        lastSyncTime: 0,
        deviceHash: "test-device-hash",
      };

      const periodStart = new Date(Date.now() - 60 * 60 * 1000);
      const periodEnd = new Date();

      const result = await syncToSupabase(state, periodStart, periodEnd);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should not call clearRawSessions on network error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network timeout"));

      const state: ExtensionState = {
        studentId: "NIC-TEST2026-XXXX",
        studyHoursStart: 8,
        studyHoursEnd: 22,
        rawSessions: [
          {
            sessionId: "test-1",
            domain: "khanacademy.org",
            category: "productive",
            startTime: Date.now() - 60 * 60 * 1000,
            endTime: Date.now(),
            keystrokes: 100,
            scrollEvents: 50,
            tabSwitches: 2,
          },
        ],
        currentSession: null,
        lastSyncTime: 0,
        deviceHash: "test-device-hash",
      };

      const periodStart = new Date(Date.now() - 60 * 60 * 1000);
      const periodEnd = new Date();

      vi.mocked(storageLib.clearRawSessions).mockClear();
      await syncToSupabase(state, periodStart, periodEnd);

      expect(storageLib.clearRawSessions).not.toHaveBeenCalled();
    });

    it("should return error object on network error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network timeout"));

      const state: ExtensionState = {
        studentId: "NIC-TEST2026-XXXX",
        studyHoursStart: 8,
        studyHoursEnd: 22,
        rawSessions: [
          {
            sessionId: "test-1",
            domain: "khanacademy.org",
            category: "productive",
            startTime: Date.now() - 60 * 60 * 1000,
            endTime: Date.now(),
            keystrokes: 100,
            scrollEvents: 50,
            tabSwitches: 2,
          },
        ],
        currentSession: null,
        lastSyncTime: 0,
        deviceHash: "test-device-hash",
      };

      const periodStart = new Date(Date.now() - 60 * 60 * 1000);
      const periodEnd = new Date();

      const result = await syncToSupabase(state, periodStart, periodEnd);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should skip sync and return success for empty sessions array", async () => {
      const state: ExtensionState = {
        studentId: "NIC-TEST2026-XXXX",
        studyHoursStart: 8,
        studyHoursEnd: 22,
        rawSessions: [],
        currentSession: null,
        lastSyncTime: 0,
        deviceHash: "test-device-hash",
      };

      const periodStart = new Date(Date.now() - 60 * 60 * 1000);
      const periodEnd = new Date();

      const result = await syncToSupabase(state, periodStart, periodEnd);

      expect(result.success).toBe(true);
      // Should not call fetch when there are no sessions
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should return success with metricIds from server response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          metric_ids: ["uuid-1", "uuid-2", "uuid-3"],
          summary: {
            focus_level: "normal",
            fatigue: "low",
            recommendations: ["Great focus!"],
          },
        }),
        text: async () => "",
      });

      const state: ExtensionState = {
        studentId: "NIC-TEST2026-XXXX",
        studyHoursStart: 8,
        studyHoursEnd: 22,
        rawSessions: [
          {
            sessionId: "test-1",
            domain: "khanacademy.org",
            category: "productive",
            startTime: Date.now() - 60 * 60 * 1000,
            endTime: Date.now(),
            keystrokes: 100,
            scrollEvents: 50,
            tabSwitches: 2,
          },
        ],
        currentSession: null,
        lastSyncTime: 0,
        deviceHash: "test-device-hash",
      };

      const periodStart = new Date(Date.now() - 60 * 60 * 1000);
      const periodEnd = new Date();

      const result = await syncToSupabase(state, periodStart, periodEnd);

      expect(result.success).toBe(true);
      expect(result.metricIds).toEqual(["uuid-1", "uuid-2", "uuid-3"]);
    });
  });

  describe("shouldSync", () => {
    it("should return false when called right after a sync (< 60min ago)", () => {
      const lastSyncTime = Date.now() - 30 * 60 * 1000; // 30 min ago
      const result = shouldSync(lastSyncTime);

      expect(result).toBe(false);
    });

    it("should return true when lastSyncTime is 0 (never synced)", () => {
      const result = shouldSync(0);

      expect(result).toBe(true);
    });

    it("should respect custom minIntervalMs parameter", () => {
      const lastSyncTime = Date.now() - 15 * 60 * 1000; // 15 min ago
      const result = shouldSync(lastSyncTime, 10 * 60 * 1000); // 10 min min interval

      expect(result).toBe(true);
    });

    it("should return false when last sync is recent and within minIntervalMs", () => {
      const lastSyncTime = Date.now() - 5 * 60 * 1000; // 5 min ago
      const result = shouldSync(lastSyncTime, 10 * 60 * 1000); // 10 min min interval

      expect(result).toBe(false);
    });
  });

  describe("getSyncPeriod", () => {
    it("should return [start, end] where duration is approximately 1 hour (default)", () => {
      const [start, end] = getSyncPeriod();

      const durationMs = end.getTime() - start.getTime();
      const oneHourMs = 60 * 60 * 1000;

      // Allow 5% tolerance for timing differences
      expect(Math.abs(durationMs - oneHourMs)).toBeLessThan(oneHourMs * 0.05);
    });

    it("should return [start, end] with custom interval", () => {
      const intervalMinutes = 30;
      const [start, end] = getSyncPeriod(intervalMinutes);

      const durationMs = end.getTime() - start.getTime();
      const expectedMs = intervalMinutes * 60 * 1000;

      // Allow 5% tolerance
      expect(Math.abs(durationMs - expectedMs)).toBeLessThan(expectedMs * 0.05);
    });

    it("should return dates in correct order (start before end)", () => {
      const [start, end] = getSyncPeriod();

      expect(start.getTime()).toBeLessThan(end.getTime());
    });
  });
});
