import { useState } from "react";
import { simulateStudySession } from "./engine";
import { SimulationConfig, SimulationResult, SCENARIO_PRESETS } from "./types";
import "./index.css";

export default function StudySessionSimulator() {
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
  const [isRunning, setIsRunning] = useState(false);

  const handleScenarioChange = (scenario: string) => {
    const preset = SCENARIO_PRESETS[scenario as keyof typeof SCENARIO_PRESETS];
    setConfig({
      ...config,
      scenario: scenario as any,
      activity_mix: preset?.activity_mix || config.activity_mix
    });
  };

  const handleStartSimulation = () => {
    setIsRunning(true);
    // Simulate processing delay
    setTimeout(() => {
      const simResult = simulateStudySession(config);
      setResult(simResult);
      setIsRunning(false);
    }, 1000);
  };

  const handleDownloadJSON = () => {
    if (!result) return;
    const json = JSON.stringify(result, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `study-session-${Date.now()}.json`;
    a.click();
  };

  const handleSendToSupabase = async () => {
    if (!result) return;
    console.log("Sending to Supabase...", result);
    // TODO: Implement actual Supabase submission
    alert("Simulation data ready to send (implement Supabase endpoint)");
  };

  return (
    <div className="simulator-container">
      <div className="simulator-card">
        <h1>📚 Study Session Simulator</h1>
        <p className="subtitle">Generate realistic study behavior data for testing</p>

        {/* Configuration Panel */}
        <div className="config-section">
          <h2>Configuration</h2>

          {/* Scenario Selection */}
          <div className="control-group">
            <label>📊 Study Scenario</label>
            <div className="scenario-buttons">
              {(
                [
                  { id: "high_focus", label: "High Focus", color: "green" },
                  { id: "normal_study", label: "Normal Study", color: "blue" },
                  { id: "struggling", label: "Struggling", color: "orange" },
                  { id: "distracted", label: "Distracted", color: "red" }
                ] as const
              ).map((s) => (
                <button
                  key={s.id}
                  className={`scenario-btn ${s.color} ${config.scenario === s.id ? "active" : ""}`}
                  onClick={() => handleScenarioChange(s.id)}
                  disabled={isRunning}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Duration */}
          <div className="control-group">
            <label>⏱ Duration</label>
            <div className="duration-input">
              <input
                type="range"
                min="5"
                max="120"
                step="5"
                value={config.duration_minutes}
                onChange={(e) =>
                  setConfig({ ...config, duration_minutes: parseInt(e.target.value) })
                }
                disabled={isRunning}
              />
              <span>{config.duration_minutes} minutes</span>
            </div>
          </div>

          {/* Activity Mix */}
          <div className="control-group">
            <label>🎯 Activity Mix</label>
            <div className="activity-mix">
              <div className="mix-item">
                <label>
                  📄 Docs{" "}
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
                    disabled={isRunning}
                  />
                  %
                </label>
              </div>
              <div className="mix-item">
                <label>
                  💻 Coding{" "}
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
                    disabled={isRunning}
                  />
                  %
                </label>
              </div>
              <div className="mix-item">
                <label>
                  🔍 Research{" "}
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
                    disabled={isRunning}
                  />
                  %
                </label>
              </div>
              <div className="mix-item">
                <label>
                  🎮 Other{" "}
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
                    disabled={isRunning}
                  />
                  %
                </label>
              </div>
            </div>
          </div>

          {/* Run Button */}
          <button
            className="run-button"
            onClick={handleStartSimulation}
            disabled={isRunning}
          >
            {isRunning ? "⏳ Simulating..." : "▶ Start Simulation"}
          </button>
        </div>

        {/* Results Panel */}
        {result && (
          <div className="results-section">
            <h2>📈 Results</h2>

            {/* Summary */}
            <div className="summary-box">
              <div className="summary-stat">
                <span className="stat-label">Duration</span>
                <span className="stat-value">{result.summary.total_time_minutes} min</span>
              </div>
              <div className="summary-stat">
                <span className="stat-label">Focus Quality</span>
                <span className={`stat-value ${result.summary.focus_quality}`}>
                  {result.summary.focus_quality.toUpperCase()}
                </span>
              </div>
              <div className="summary-stat">
                <span className="stat-label">Productivity</span>
                <span className="stat-value">{result.summary.estimated_productivity}%</span>
              </div>
            </div>

            {/* Metrics */}
            <div className="metrics-grid">
              <div className="metric-card">
                <div className="metric-label">Focus Score</div>
                <div className="metric-value">{result.metric.focus_score}/100</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Avg Idle Time</div>
                <div className="metric-value">{result.metric.avg_idle_seconds}s</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Avg Keystroke Rate</div>
                <div className="metric-value">{result.metric.avg_keystrokes_per_minute} kpm</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Tab Switches</div>
                <div className="metric-value">{result.metric.total_tab_switches}</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Struggle Events</div>
                <div className="metric-value">{result.metric.struggle_events_count}</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Dominant Activity</div>
                <div className="metric-value">{result.metric.dominant_tab_category}</div>
              </div>
            </div>

            {/* Recommendations */}
            <div className="recommendations-box">
              <h3>💡 Recommendations</h3>
              <ul>
                {result.summary.recommendations.map((rec, i) => (
                  <li key={i}>{rec}</li>
                ))}
              </ul>
            </div>

            {/* Events Details (Optional) */}
            {config.show_details && (
              <details className="events-details">
                <summary>Show Activity Events ({result.events.length})</summary>
                <div className="events-list">
                  {result.events.slice(0, 10).map((event, i) => (
                    <div key={i} className="event-item">
                      <span className="event-time">
                        {new Date(event.timestamp).toLocaleTimeString()}
                      </span>
                      <span className="event-category">{event.tab_category}</span>
                      <span className="event-idle">{event.idle_seconds}s idle</span>
                      <span className="event-kpm">{event.keystrokes_per_minute} kpm</span>
                    </div>
                  ))}
                  <p className="events-footer">... and {result.events.length - 10} more events</p>
                </div>
              </details>
            )}

            {/* Action Buttons */}
            <div className="action-buttons">
              <button className="btn btn-primary" onClick={handleDownloadJSON}>
                ⬇ Download JSON
              </button>
              <button className="btn btn-success" onClick={handleSendToSupabase}>
                📤 Send to Supabase
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
