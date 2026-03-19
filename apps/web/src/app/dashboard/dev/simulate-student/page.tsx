/**
 * Developer Testing Hub: Student Behavior Simulator
 *
 * Purpose: Test the complete pipeline:
 * Simulator → Edge Function → student_metrics → ERP/PRM workflows
 *
 * This page is only visible in development mode
 */

"use client";

import { useState } from "react";
import { simulateStudySession } from "@/lib/simulator/engine";
import type { SimulationConfig, SimulationResult } from "@/lib/simulator/types";
import "./page.css";

interface SubmissionResult {
  success: boolean;
  metric_ids?: string[];
  summary?: any;
  error?: string;
  response_time_ms?: number;
}

export default function StudentSimulatorPage() {
  const [studentSelect, setStudentSelect] = useState<"create_mock" | "select_real">("create_mock");
  const [mockStudentName, setMockStudentName] = useState("John Doe");
  const [realStudentId, setRealStudentId] = useState("");

  const [config, setConfig] = useState<SimulationConfig>({
    scenario: "normal_study",
    duration_minutes: 15,
    activity_mix: {
      docs_percentage: 35,
      coding_percentage: 35,
      research_percentage: 20,
      other_percentage: 10
    },
    show_details: false
  });

  const [result, setResult] = useState<SimulationResult | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<SubmissionResult | null>(null);
  const [workflowStatus, setWorkflowStatus] = useState<string>("");

  const handleSimulate = async () => {
    setIsSimulating(true);
    setResult(null);
    setSubmissionResult(null);
    setWorkflowStatus("");

    // Simulate processing
    setTimeout(() => {
      const simResult = simulateStudySession(config);
      setResult(simResult);
      setIsSimulating(false);
    }, 1000);
  };

  const handleSubmit = async () => {
    if (!result) return;

    setIsSubmitting(true);
    setWorkflowStatus("📤 Submitting to Edge Function...");

    try {
      const startTime = Date.now();

      // Prepare payload
      const payload = {
        device_hash: `dev-test-${Date.now()}`,
        school_id: "dev-school",
        student_id: studentSelect === "create_mock" ? `mock-${Date.now()}` : realStudentId,
        student_name: mockStudentName,
        metrics: result.metric ? [result.metric] : [],
        timestamp: Date.now()
      };

      console.log("[Dev] Submitting payload:", payload);

      // Call Edge Function
      const response = await fetch("/api/dev/submit-student-metrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const responseTime = Date.now() - startTime;

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`API Error: ${response.status} - ${error}`);
      }

      const data = await response.json();

      setSubmissionResult({
        success: true,
        metric_ids: data.metric_ids,
        summary: data.summary,
        response_time_ms: responseTime
      });

      setWorkflowStatus("✅ Submitted successfully! Workflows triggered.");
    } catch (error) {
      console.error("[Dev] Submission error:", error);
      setSubmissionResult({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      });
      setWorkflowStatus("❌ Submission failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCheckStatus = async () => {
    if (!submissionResult?.metric_ids?.[0]) return;

    setWorkflowStatus("🔍 Checking workflow status...");

    try {
      const response = await fetch(`/api/dev/workflow-status?metric_id=${submissionResult.metric_ids[0]}`);
      const data = await response.json();

      if (data.erp_status) {
        setWorkflowStatus(`
📋 ERP Status: ${data.erp_status}
${data.erp_message ? `   ${data.erp_message}` : ""}
📧 PRM Status: ${data.prm_status}
${data.prm_message ? `   ${data.prm_message}` : ""}
        `);
      }
    } catch (error) {
      setWorkflowStatus("⚠️ Could not fetch workflow status");
    }
  };

  return (
    <div className="dev-simulator">
      <div className="dev-header">
        <h1>🧪 Developer Testing Hub</h1>
        <p>Simulate student study behavior and test the complete pipeline</p>
        <div className="warning-banner">
          ⚠️ This page is for development testing only. Not visible in production.
        </div>
      </div>

      <div className="dev-container">
        {/* Step 1: Student Selection */}
        <section className="dev-section">
          <h2>Step 1: Select Student</h2>

          <div className="form-group">
            <label>
              <input
                type="radio"
                value="create_mock"
                checked={studentSelect === "create_mock"}
                onChange={(e) => setStudentSelect(e.target.value as any)}
              />
              Create Mock Student
            </label>
            {studentSelect === "create_mock" && (
              <input
                type="text"
                placeholder="Student Name"
                value={mockStudentName}
                onChange={(e) => setMockStudentName(e.target.value)}
                className="text-input"
              />
            )}
          </div>

          <div className="form-group">
            <label>
              <input
                type="radio"
                value="select_real"
                checked={studentSelect === "select_real"}
                onChange={(e) => setStudentSelect(e.target.value as any)}
              />
              Use Real Student
            </label>
            {studentSelect === "select_real" && (
              <input
                type="text"
                placeholder="Student ID (UUID)"
                value={realStudentId}
                onChange={(e) => setRealStudentId(e.target.value)}
                className="text-input"
              />
            )}
          </div>
        </section>

        {/* Step 2: Configure Simulation */}
        <section className="dev-section">
          <h2>Step 2: Configure Simulation</h2>

          <div className="config-grid">
            <div className="form-group">
              <label>Scenario</label>
              <select
                value={config.scenario}
                onChange={(e) => setConfig({ ...config, scenario: e.target.value as any })}
              >
                <option value="high_focus">High Focus (95-100 score)</option>
                <option value="normal_study">Normal Study (70-85 score)</option>
                <option value="struggling">Struggling (40-60 score)</option>
                <option value="distracted">Distracted (30-50 score)</option>
              </select>
            </div>

            <div className="form-group">
              <label>Duration</label>
              <div className="range-input">
                <input
                  type="range"
                  min="5"
                  max="120"
                  step="5"
                  value={config.duration_minutes}
                  onChange={(e) => setConfig({ ...config, duration_minutes: parseInt(e.target.value) })}
                />
                <span>{config.duration_minutes} min</span>
              </div>
            </div>
          </div>

          <div className="form-group">
            <label>Activity Mix</label>
            <div className="activity-mix-grid">
              <div className="mix-item">
                <label>📄 Docs</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={config.activity_mix.docs_percentage}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      activity_mix: {
                        ...config.activity_mix,
                        docs_percentage: parseInt(e.target.value)
                      }
                    })
                  }
                />
                %
              </div>
              <div className="mix-item">
                <label>💻 Coding</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={config.activity_mix.coding_percentage}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      activity_mix: {
                        ...config.activity_mix,
                        coding_percentage: parseInt(e.target.value)
                      }
                    })
                  }
                />
                %
              </div>
              <div className="mix-item">
                <label>🔍 Research</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={config.activity_mix.research_percentage}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      activity_mix: {
                        ...config.activity_mix,
                        research_percentage: parseInt(e.target.value)
                      }
                    })
                  }
                />
                %
              </div>
              <div className="mix-item">
                <label>🎮 Other</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={config.activity_mix.other_percentage}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      activity_mix: {
                        ...config.activity_mix,
                        other_percentage: parseInt(e.target.value)
                      }
                    })
                  }
                />
                %
              </div>
            </div>
          </div>

          <button
            className="btn btn-primary"
            onClick={handleSimulate}
            disabled={isSimulating || isSubmitting}
          >
            {isSimulating ? "⏳ Simulating..." : "▶ Generate Simulation"}
          </button>
        </section>

        {/* Step 3: View Results */}
        {result && (
          <section className="dev-section">
            <h2>Step 3: Simulation Results</h2>

            <div className="results-grid">
              <div className="result-card">
                <div className="result-label">Focus Score</div>
                <div className="result-value">{result.metric.focus_score}/100</div>
              </div>
              <div className="result-card">
                <div className="result-label">Avg Idle</div>
                <div className="result-value">{result.metric.avg_idle_seconds}s</div>
              </div>
              <div className="result-card">
                <div className="result-label">Keystrokes</div>
                <div className="result-value">{result.metric.avg_keystrokes_per_minute} kpm</div>
              </div>
              <div className="result-card">
                <div className="result-label">Struggles</div>
                <div className="result-value">{result.metric.struggle_events_count}</div>
              </div>
              <div className="result-card">
                <div className="result-label">Tab Switches</div>
                <div className="result-value">{result.metric.total_tab_switches}</div>
              </div>
              <div className="result-card">
                <div className="result-label">Activity</div>
                <div className="result-value">{result.metric.dominant_tab_category}</div>
              </div>
            </div>

            <div className="summary-box">
              <h3>📊 Summary</h3>
              <p>
                <strong>Quality:</strong> {result.summary.focus_quality.toUpperCase()}
              </p>
              <p>
                <strong>Productivity:</strong> {result.summary.estimated_productivity}%
              </p>
              <p>
                <strong>Recommendations:</strong>
              </p>
              <ul>
                {result.summary.recommendations.map((rec: string, i: number) => (
                  <li key={i}>{rec}</li>
                ))}
              </ul>
            </div>

            <button
              className="btn btn-success"
              onClick={handleSubmit}
              disabled={isSubmitting || !result}
            >
              {isSubmitting ? "📤 Submitting..." : "📤 Submit to Pipeline"}
            </button>
          </section>
        )}

        {/* Step 4: Submission Result */}
        {submissionResult && (
          <section className="dev-section">
            <h2>Step 4: Submission Result</h2>

            {submissionResult.success ? (
              <div className="success-box">
                <h3>✅ Success!</h3>
                <p>
                  <strong>Response Time:</strong> {submissionResult.response_time_ms}ms
                </p>
                <p>
                  <strong>Metric IDs:</strong>
                </p>
                <ul>
                  {submissionResult.metric_ids?.map((id) => (
                    <li key={id} className="metric-id">
                      {id}
                    </li>
                  ))}
                </ul>

                {submissionResult.summary && (
                  <div className="summary-details">
                    <p>
                      <strong>Focus Level:</strong> {submissionResult.summary.focus_level}
                    </p>
                    <p>
                      <strong>Fatigue:</strong> {submissionResult.summary.fatigue_indicator}
                    </p>
                    <p>
                      <strong>Recommendations:</strong>
                    </p>
                    <ul>
                      {submissionResult.summary.recommendations?.map((rec: string, i: number) => (
                        <li key={i}>{rec}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <button className="btn btn-secondary" onClick={handleCheckStatus}>
                  🔍 Check Workflow Status
                </button>
              </div>
            ) : (
              <div className="error-box">
                <h3>❌ Submission Failed</h3>
                <p>{submissionResult.error}</p>
              </div>
            )}
          </section>
        )}

        {/* Workflow Status */}
        {workflowStatus && (
          <section className="dev-section">
            <h2>📋 Workflow Status</h2>
            <div className="status-box">
              <pre>{workflowStatus}</pre>
            </div>
          </section>
        )}

        {/* Debug Info */}
        <section className="dev-section">
          <h2>🔧 Debug Info</h2>
          <div className="debug-box">
            <p>
              <strong>Environment:</strong> {process.env.NODE_ENV}
            </p>
            <p>
              <strong>API Endpoint:</strong> /api/dev/submit-student-metrics
            </p>
            <p>
              <strong>Timestamp:</strong> {new Date().toISOString()}
            </p>
            <details>
              <summary>View Raw Simulation Result</summary>
              {result && <pre>{JSON.stringify(result, null, 2)}</pre>}
            </details>
          </div>
        </section>
      </div>
    </div>
  );
}
