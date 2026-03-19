import { useEffect, useState } from "react";
import "./index.css";
import { PopupStats } from "~/types";

export default function StudentRepPopup() {
  const [stats, setStats] = useState<PopupStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEnrolled, setIsEnrolled] = useState(false);

  useEffect(() => {
    // Request stats from background worker
    chrome.runtime.sendMessage({ type: "get_stats" }, (response) => {
      setStats(response);
      setLoading(false);
    });

    // Poll every 30 seconds
    const interval = setInterval(() => {
      chrome.runtime.sendMessage({ type: "get_stats" }, (response) => {
        setStats(response);
      });
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const handleEnroll = () => {
    // In real implementation, this would open an enrollment flow
    chrome.runtime.sendMessage({
      type: "enable_enrollment",
      school_id: "demo-school"
    });
    setIsEnrolled(true);
  };

  return (
    <div className="popup">
      <div className="popup-header">
        <div className="logo">📚 Student Rep</div>
        <button className="settings-btn" title="Settings">
          ⚙️
        </button>
      </div>

      {loading ? (
        <div className="loading">Loading...</div>
      ) : stats ? (
        <div className="stats-container">
          {!isEnrolled && (
            <div className="enrollment-banner">
              <p>Not yet enrolled</p>
              <button onClick={handleEnroll} className="enroll-btn">
                Enroll
              </button>
            </div>
          )}

          <div className="stat-card">
            <div className="stat-label">Focus Time Today</div>
            <div className="stat-value">{stats.today_focus_time_minutes} min</div>
          </div>

          <div className="stat-card">
            <div className="stat-label">Struggle Events</div>
            <div className="stat-value">{stats.today_struggle_events}</div>
          </div>

          <div className="stat-card">
            <div className="stat-label">Offline Events</div>
            <div className="stat-value">{stats.offline_events_pending}</div>
          </div>

          <div className="actions">
            <button className="action-btn">View Full Report</button>
            <button className="action-btn secondary">Privacy Settings</button>
          </div>

          <div className="footer">
            <small>Data stays on your device • Auto-syncs when enrolled</small>
          </div>
        </div>
      ) : (
        <div className="error">Failed to load stats</div>
      )}
    </div>
  );
}
