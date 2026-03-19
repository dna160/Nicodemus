/**
 * Study Session Simulator - Type definitions
 */

export type SimulationScenario = "high_focus" | "normal_study" | "struggling" | "distracted";

export interface SimulationConfig {
  scenario: SimulationScenario;
  duration_minutes: number;
  activity_mix: {
    docs_percentage: number;
    coding_percentage: number;
    research_percentage: number;
    other_percentage: number;
  };
  show_details: boolean;
}

export interface SimulatedActivityEvent {
  id: string;
  timestamp: number;
  active_tab_title: string;
  active_tab_url: string;
  tab_category: string;
  idle_seconds: number;
  keystrokes_per_minute: number;
  tab_switches_in_period: number;
  is_focused: boolean;
  struggle_score: number;
  synced: boolean;
  created_at: number;
}

export interface SimulationResult {
  events: SimulatedActivityEvent[];
  metric: {
    id: string;
    avg_idle_seconds: number;
    avg_keystrokes_per_minute: number;
    total_tab_switches: number;
    struggle_events_count: number;
    focus_score: number;
    dominant_tab_category: string;
  };
  summary: {
    total_time_minutes: number;
    focus_quality: "excellent" | "good" | "moderate" | "poor";
    estimated_productivity: number; // 0-100
    recommendations: string[];
  };
}

export const SCENARIO_PRESETS: Record<SimulationScenario, Partial<SimulationConfig>> = {
  high_focus: {
    activity_mix: {
      docs_percentage: 40,
      coding_percentage: 40,
      research_percentage: 15,
      other_percentage: 5
    }
  },
  normal_study: {
    activity_mix: {
      docs_percentage: 35,
      coding_percentage: 35,
      research_percentage: 20,
      other_percentage: 10
    }
  },
  struggling: {
    activity_mix: {
      docs_percentage: 25,
      coding_percentage: 20,
      research_percentage: 30,
      other_percentage: 25
    }
  },
  distracted: {
    activity_mix: {
      docs_percentage: 15,
      coding_percentage: 15,
      research_percentage: 20,
      other_percentage: 50
    }
  }
};
