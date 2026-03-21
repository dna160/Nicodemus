/**
 * Options Page
 * Student ID and study hours configuration
 */

import { useEffect, useState } from "react";
import { Check, AlertCircle } from "lucide-react";

import {
  getStudentId,
  getStudyHours,
  setStudentId,
  setStudyHours,
  getLastSyncTime,
} from "~/lib/storage";

export default function Options() {
  const [studentId, setStudentIdLocal] = useState("");
  const [startHour, setStartHour] = useState(8);
  const [endHour, setEndHour] = useState(22);
  const [lastSync, setLastSync] = useState<string>("Never");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "success" | "error">(
    "idle"
  );
  const [saveMessage, setSaveMessage] = useState("");

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const id = await getStudentId();
      if (id) {
        setStudentIdLocal(id);
      }

      const [start, end] = await getStudyHours();
      setStartHour(start);
      setEndHour(end);

      const lastSyncTime = await getLastSyncTime();
      if (lastSyncTime > 0) {
        const date = new Date(lastSyncTime);
        setLastSync(date.toLocaleString());
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  }

  async function handleSaveStudentId() {
    const pattern = /^NIC-[A-Z]{2,3}[0-9]{4}-[A-Z0-9]{4}$/;

    if (!studentId) {
      setSaveStatus("error");
      setSaveMessage("Student ID cannot be empty");
      return;
    }

    if (!pattern.test(studentId)) {
      setSaveStatus("error");
      setSaveMessage("Invalid format. Use: NIC-XX0000-XXXX");
      return;
    }

    try {
      setSaveStatus("saving");
      await setStudentId(studentId);
      setSaveStatus("success");
      setSaveMessage("Student ID saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch (error) {
      setSaveStatus("error");
      setSaveMessage("Failed to save Student ID");
    }
  }

  async function handleSaveStudyHours() {
    if (startHour >= endHour) {
      setSaveStatus("error");
      setSaveMessage("Start hour must be before end hour");
      return;
    }

    try {
      setSaveStatus("saving");
      await setStudyHours(startHour, endHour);
      setSaveStatus("success");
      setSaveMessage("Study hours saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch (error) {
      setSaveStatus("error");
      setSaveMessage("Failed to save study hours");
    }
  }

  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Nicodemus Student Edge</h1>
          <p className="text-sm text-muted-foreground mt-1">Configure your settings</p>
        </div>

        {/* Student ID Section */}
        <div className="bg-muted/50 rounded-lg border border-muted p-6 space-y-4">
          <h2 className="text-lg font-semibold">Student ID</h2>

          <div className="space-y-2">
            <label className="block text-sm font-medium">
              Nicodemus Student ID
              <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              placeholder="NIC-JD2026-ABCD"
              value={studentId}
              onChange={(e) => setStudentIdLocal(e.target.value.toUpperCase())}
              className="w-full px-3 py-2 border border-muted rounded-lg bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary"
            />
            <p className="text-xs text-muted-foreground">
              Format: NIC-XX0000-XXXX (get from your school dashboard)
            </p>
          </div>

          <button
            onClick={handleSaveStudentId}
            disabled={saveStatus === "saving"}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {saveStatus === "saving" ? "Saving..." : "Save Student ID"}
          </button>
        </div>

        {/* Study Hours Section */}
        <div className="bg-muted/50 rounded-lg border border-muted p-6 space-y-4">
          <h2 className="text-lg font-semibold">Study Hours</h2>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium">Start Hour</label>
              <select
                value={startHour}
                onChange={(e) => setStartHour(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-muted rounded-lg bg-background text-foreground focus:outline-none focus:border-primary"
              >
                {hours.map((h) => (
                  <option key={h} value={h}>
                    {h.toString().padStart(2, "0")}:00
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium">End Hour</label>
              <select
                value={endHour}
                onChange={(e) => setEndHour(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-muted rounded-lg bg-background text-foreground focus:outline-none focus:border-primary"
              >
                {hours.map((h) => (
                  <option key={h} value={h}>
                    {h.toString().padStart(2, "0")}:00
                  </option>
                ))}
              </select>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Extension tracks activity only during these hours
          </p>

          <button
            onClick={handleSaveStudyHours}
            disabled={saveStatus === "saving"}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {saveStatus === "saving" ? "Saving..." : "Save Study Hours"}
          </button>
        </div>

        {/* Status Message */}
        {saveStatus !== "idle" && (
          <div
            className={`flex items-center gap-2 p-3 rounded-lg border ${
              saveStatus === "success"
                ? "bg-success/10 border-success text-success"
                : saveStatus === "error"
                  ? "bg-destructive/10 border-destructive text-destructive"
                  : "bg-primary/10 border-primary text-primary"
            }`}
          >
            {saveStatus === "success" ? (
              <Check className="w-4 h-4 flex-shrink-0" />
            ) : saveStatus === "error" ? (
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
            ) : (
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin flex-shrink-0" />
            )}
            <p className="text-sm">{saveMessage}</p>
          </div>
        )}

        {/* Sync Status */}
        <div className="bg-muted/50 rounded-lg border border-muted p-6 space-y-2">
          <h3 className="text-sm font-semibold">Sync Status</h3>
          <p className="text-xs text-muted-foreground">
            Last synced: {lastSync}
          </p>
          <p className="text-xs text-muted-foreground">
            Data syncs automatically every hour during study time.
          </p>
        </div>

        {/* Info */}
        <div className="bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800 p-4 space-y-2">
          <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100">
            About Nicodemus Student Edge
          </h3>
          <p className="text-xs text-blue-800 dark:text-blue-200">
            This extension anonymously tracks your browsing patterns to help
            identify when you might be struggling with focus. All data is
            encrypted and sent only to your school's Nicodemus instance.
          </p>
        </div>
      </div>
    </div>
  );
}
