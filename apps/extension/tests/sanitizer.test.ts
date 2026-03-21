import { describe, it, expect, beforeEach } from "vitest";
import { sanitizeRawSessions, validateMetricPeriodSafety } from "~/lib/sanitizer";
import type { RawSession, MetricPeriod } from "~/types";

/**
 * Helper to create test RawSession objects.
 */
function makeSession(overrides: Partial<RawSession> = {}): RawSession {
  return {
    sessionId: "test-session-" + Math.random().toString(36).slice(2),
    domain: "khanacademy.org",
    category: "productive" as const,
    startTime: Date.now() - 30 * 60 * 1000, // 30 min ago
    endTime: Date.now(),
    keystrokes: 100,
    scrollEvents: 50,
    tabSwitches: 2,
    ...overrides,
  };
}

describe("sanitizer.ts - sanitizeRawSessions & validateMetricPeriodSafety", () => {
  let now: number;
  let periodStart: Date;
  let periodEnd: Date;

  beforeEach(() => {
    now = Date.now();
    periodStart = new Date(now - 60 * 60 * 1000); // 1 hour ago
    periodEnd = new Date(now);
  });

  describe("Focus score calculation", () => {
    it("should calculate focus_score = 100 for single productive session (all time productive)", () => {
      const sessions: RawSession[] = [
        makeSession({
          category: "productive",
          startTime: periodStart.getTime(),
          endTime: periodEnd.getTime(),
        }),
      ];

      const metric = sanitizeRawSessions(sessions, periodStart, periodEnd);

      expect(metric.focus_score).toBe(100);
    });

    it("should calculate focus_score = 0 for single distraction session (all time distraction)", () => {
      const sessions: RawSession[] = [
        makeSession({
          category: "distraction",
          startTime: periodStart.getTime(),
          endTime: periodEnd.getTime(),
        }),
      ];

      const metric = sanitizeRawSessions(sessions, periodStart, periodEnd);

      expect(metric.focus_score).toBe(0);
    });

    it("should calculate focus_score ≈ 75 for 45min productive + 15min distraction", () => {
      const hourStart = periodStart.getTime();
      const sessions: RawSession[] = [
        makeSession({
          category: "productive",
          startTime: hourStart,
          endTime: hourStart + 45 * 60 * 1000,
        }),
        makeSession({
          category: "distraction",
          startTime: hourStart + 45 * 60 * 1000,
          endTime: hourStart + 60 * 60 * 1000,
        }),
      ];

      const metric = sanitizeRawSessions(sessions, periodStart, periodEnd);

      expect(metric.focus_score).toBeCloseTo(75, 1);
    });

    it("should return focus_score = 0 for empty sessions array (no division by zero)", () => {
      const sessions: RawSession[] = [];

      const metric = sanitizeRawSessions(sessions, periodStart, periodEnd);

      expect(metric.focus_score).toBe(0);
      expect(Number.isNaN(metric.focus_score)).toBe(false);
    });
  });

  describe("Dominant tab category", () => {
    it("should set dominant_tab_category = 'productive' when most time is productive", () => {
      const hourStart = periodStart.getTime();
      const sessions: RawSession[] = [
        makeSession({
          category: "productive",
          startTime: hourStart,
          endTime: hourStart + 40 * 60 * 1000,
        }),
        makeSession({
          category: "distraction",
          startTime: hourStart + 40 * 60 * 1000,
          endTime: hourStart + 60 * 60 * 1000,
        }),
      ];

      const metric = sanitizeRawSessions(sessions, periodStart, periodEnd);

      expect(metric.dominant_tab_category).toBe("productive");
    });

    it("should set dominant_tab_category = 'distraction' when most time is distraction", () => {
      const hourStart = periodStart.getTime();
      const sessions: RawSession[] = [
        makeSession({
          category: "productive",
          startTime: hourStart,
          endTime: hourStart + 15 * 60 * 1000,
        }),
        makeSession({
          category: "distraction",
          startTime: hourStart + 15 * 60 * 1000,
          endTime: hourStart + 60 * 60 * 1000,
        }),
      ];

      const metric = sanitizeRawSessions(sessions, periodStart, periodEnd);

      expect(metric.dominant_tab_category).toBe("distraction");
    });

    it("should set dominant_tab_category = 'neutral' when most time is neutral", () => {
      const hourStart = periodStart.getTime();
      const sessions: RawSession[] = [
        makeSession({
          category: "neutral",
          startTime: hourStart,
          endTime: hourStart + 45 * 60 * 1000,
        }),
        makeSession({
          category: "distraction",
          startTime: hourStart + 45 * 60 * 1000,
          endTime: hourStart + 60 * 60 * 1000,
        }),
      ];

      const metric = sanitizeRawSessions(sessions, periodStart, periodEnd);

      expect(metric.dominant_tab_category).toBe("neutral");
    });
  });

  describe("Struggle events detection", () => {
    it("should count struggle_events_count = 0 for productive session with keystrokes", () => {
      const sessions: RawSession[] = [
        makeSession({
          category: "productive",
          startTime: periodStart.getTime(),
          endTime: periodStart.getTime() + 15 * 60 * 1000,
          keystrokes: 150,
          scrollEvents: 60,
        }),
      ];

      const metric = sanitizeRawSessions(sessions, periodStart, periodEnd);

      expect(metric.struggle_events_count).toBe(0);
    });

    it("should count struggle_events_count = 1 for productive session >10min with zero keystrokes AND zero scrolls", () => {
      const sessions: RawSession[] = [
        makeSession({
          category: "productive",
          startTime: periodStart.getTime(),
          endTime: periodStart.getTime() + 15 * 60 * 1000, // 15 min
          keystrokes: 0,
          scrollEvents: 0,
        }),
      ];

      const metric = sanitizeRawSessions(sessions, periodStart, periodEnd);

      expect(metric.struggle_events_count).toBe(1);
    });

    it("should count struggle_events_count = 0 for productive session >10min with keystrokes (not a struggle)", () => {
      const sessions: RawSession[] = [
        makeSession({
          category: "productive",
          startTime: periodStart.getTime(),
          endTime: periodStart.getTime() + 15 * 60 * 1000, // 15 min
          keystrokes: 10,
          scrollEvents: 0,
        }),
      ];

      const metric = sanitizeRawSessions(sessions, periodStart, periodEnd);

      expect(metric.struggle_events_count).toBe(0);
    });
  });

  describe("Keystroke and switch metrics", () => {
    it("should calculate avg_keystrokes_per_minute correctly", () => {
      const sessions: RawSession[] = [
        makeSession({
          startTime: periodStart.getTime(),
          endTime: periodStart.getTime() + 10 * 60 * 1000, // 10 min
          keystrokes: 100,
        }),
      ];

      const metric = sanitizeRawSessions(sessions, periodStart, periodEnd);

      // 100 keystrokes / 10 min = 10 keystrokes per minute
      expect(metric.avg_keystrokes_per_minute).toBe(10);
    });

    it("should sum total_tab_switches from all sessions", () => {
      const sessions: RawSession[] = [
        makeSession({
          tabSwitches: 5,
        }),
        makeSession({
          tabSwitches: 3,
        }),
        makeSession({
          tabSwitches: 2,
        }),
      ];

      const metric = sanitizeRawSessions(sessions, periodStart, periodEnd);

      expect(metric.total_tab_switches).toBe(10);
    });
  });

  describe("Timestamp formatting", () => {
    it("should set metric_period_start to match periodStart.toISOString()", () => {
      const sessions: RawSession[] = [makeSession()];

      const metric = sanitizeRawSessions(sessions, periodStart, periodEnd);

      expect(metric.metric_period_start).toBe(periodStart.toISOString());
    });

    it("should set metric_period_end to match periodEnd.toISOString()", () => {
      const sessions: RawSession[] = [makeSession()];

      const metric = sanitizeRawSessions(sessions, periodStart, periodEnd);

      expect(metric.metric_period_end).toBe(periodEnd.toISOString());
    });
  });

  describe("Privacy & security", () => {
    it("should not include raw URLs in output (no http://)", () => {
      const sessions: RawSession[] = [
        makeSession({
          domain: "khanacademy.org",
        }),
      ];

      const metric = sanitizeRawSessions(sessions, periodStart, periodEnd);
      const stringified = JSON.stringify(metric);

      expect(stringified).not.toContain("http://");
    });

    it("should not include raw URLs in output (no https://)", () => {
      const sessions: RawSession[] = [
        makeSession({
          domain: "youtube.com",
        }),
      ];

      const metric = sanitizeRawSessions(sessions, periodStart, periodEnd);
      const stringified = JSON.stringify(metric);

      expect(stringified).not.toContain("https://");
    });
  });

  describe("Idle time calculation", () => {
    it("should ensure avg_idle_seconds >= 0", () => {
      const sessions: RawSession[] = [makeSession()];

      const metric = sanitizeRawSessions(sessions, periodStart, periodEnd);

      expect(metric.avg_idle_seconds).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Edge cases", () => {
    it("should not crash when session endTime is undefined", () => {
      const sessions: RawSession[] = [
        makeSession({
          endTime: undefined,
        }),
      ];

      expect(() => {
        sanitizeRawSessions(sessions, periodStart, periodEnd);
      }).not.toThrow();
    });
  });

  describe("validateMetricPeriodSafety", () => {
    it("should return true for valid metric", () => {
      const sessions: RawSession[] = [makeSession()];
      const metric = sanitizeRawSessions(sessions, periodStart, periodEnd);

      const isValid = validateMetricPeriodSafety(metric);

      expect(isValid).toBe(true);
    });

    it("should return false when focus_score < 0", () => {
      const sessions: RawSession[] = [makeSession()];
      const metric = sanitizeRawSessions(sessions, periodStart, periodEnd);
      metric.focus_score = -1;

      const isValid = validateMetricPeriodSafety(metric);

      expect(isValid).toBe(false);
    });

    it("should return false when focus_score > 100", () => {
      const sessions: RawSession[] = [makeSession()];
      const metric = sanitizeRawSessions(sessions, periodStart, periodEnd);
      metric.focus_score = 101;

      const isValid = validateMetricPeriodSafety(metric);

      expect(isValid).toBe(false);
    });

    it("should return false when metric contains http:// (privacy violation)", () => {
      const sessions: RawSession[] = [makeSession()];
      const metric = sanitizeRawSessions(sessions, periodStart, periodEnd);
      // Inject a privacy violation
      (metric as any).compromised_field = "http://leak.com";

      const isValid = validateMetricPeriodSafety(metric);

      expect(isValid).toBe(false);
    });
  });
});
