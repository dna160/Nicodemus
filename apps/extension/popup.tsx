/**
 * Popup Component
 * Main extension popup (400×500px)
 * Shows daily focus summary and quick access to settings
 */

import { useEffect, useState } from "react";
import { Settings } from "lucide-react";

import type { ExtensionState } from "~/types";
import { getState } from "~/lib/storage";
import { sanitizeRawSessions } from "~/lib/sanitizer";
import { FocusRing } from "~/components/FocusRing";
import { TimeBar } from "~/components/TimeBar";
import { StatCard } from "~/components/StatCard";

export default function Popup() {
  const [state, setState] = useState<ExtensionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [focusScore, setFocusScore] = useState(0);
  const [timeMs, setTimeMs] = useState({ productive: 0, distraction: 0, neutral: 0 });
  const [keystrokesPerMin, setKeystrokesPerMin] = useState(0);
  const [lastSync, setLastSync] = useState<string>("Never");

  useEffect(() => {
    loadState();
  }, []);

  async function loadState() {
    try {
      const extensionState = await getState();
      setState(extensionState);

      // Calculate metrics for today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const metric = sanitizeRawSessions(
        extensionState.rawSessions,
        today,
        tomorrow
      );

      setFocusScore(metric.focus_score);
      setKeystrokesPerMin(metric.avg_keystrokes_per_minute);

      // Calculate time by category
      const totalMs = extensionState.rawSessions
        .filter((s) => s.startTime >= today.getTime() && s.startTime < tomorrow.getTime())
        .reduce((acc, session) => {
          const end = session.endTime || Date.now();
          const duration = Math.min(end, tomorrow.getTime()) - Math.max(session.startTime, today.getTime());
          acc[session.category] += duration;
          return acc;
        }, { productive: 0, distraction: 0, neutral: 0 });

      setTimeMs(totalMs);

      // Format last sync time
      if (extensionState.lastSyncTime > 0) {
        const syncDate = new Date(extensionState.lastSyncTime);
        const now = new Date();
        const diffMs = now.getTime() - syncDate.getTime();
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) {
          setLastSync("Just now");
        } else if (diffMins < 60) {
          setLastSync(`${diffMins}m ago`);
        } else {
          const diffHours = Math.floor(diffMins / 60);
          setLastSync(`${diffHours}h ago`);
        }
      }

      setLoading(false);
    } catch (error) {
      console.error("Error loading state:", error);
      setLoading(false);
    }
  }

  function handleOpenSettings() {
    chrome.runtime.openOptionsPage();
  }

  if (loading || !state) {
    return (
      <div className="w-96 bg-background text-foreground p-6 flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-96 bg-background text-foreground min-h-[500px] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-muted">
        <h1 className="text-lg font-bold">Today's Focus</h1>
        <button
          onClick={handleOpenSettings}
          className="p-2 hover:bg-muted rounded-lg transition-colors"
          title="Settings"
        >
          <Settings className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Focus Ring */}
        <div className="flex justify-center">
          <FocusRing score={focusScore} size={140} />
        </div>

        {/* Time Breakdown */}
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-foreground">Time Breakdown</h2>
          <TimeBar
            productiveMs={timeMs.productive}
            distractionMs={timeMs.distraction}
            neutralMs={timeMs.neutral}
          />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-2">
          <StatCard
            icon={
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            }
            label="Keystrokes/Min"
            value={keystrokesPerMin.toFixed(1)}
          />
          <StatCard
            icon={
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            }
            label="Sessions"
            value={state.rawSessions.length}
          />
        </div>

        {/* Student ID Status */}
        {state.studentId ? (
          <div className="text-xs text-center text-muted-foreground bg-muted/50 rounded p-2">
            <p>Connected as {state.studentId}</p>
          </div>
        ) : (
          <div className="text-xs text-center text-destructive bg-destructive/10 rounded p-2">
            <p>Configure your Student ID in settings</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-muted px-4 py-3 bg-muted/30 text-xs text-muted-foreground">
        <p>Last synced: {lastSync}</p>
      </div>
    </div>
  );
}
