/**
 * Study Session Simulator Engine
 * Generates realistic student activity data based on scenario
 */

import { SimulationConfig, SimulatedActivityEvent, SimulationResult, SimulationScenario } from "./types";
import * as crypto from "~/lib/crypto";

const TAB_DOMAINS = {
  docs: [
    { title: "Math Homework - Google Docs", url: "https://docs.google.com/document/..." },
    { title: "Essay Draft - Microsoft Word", url: "https://office.com/word/..." },
    { title: "Notes - Notion", url: "https://notion.so/..." }
  ],
  coding: [
    { title: "Problem Set - LeetCode", url: "https://leetcode.com/problems/..." },
    { title: "Repository - GitHub", url: "https://github.com/..." },
    { title: "Code Editor - Replit", url: "https://replit.com/..." }
  ],
  research: [
    { title: "Wikipedia - Physics", url: "https://wikipedia.org/wiki/..." },
    { title: "Article - Medium", url: "https://medium.com/..." },
    { title: "Documentation - MDN", url: "https://developer.mozilla.org/..." }
  ],
  other: [
    { title: "YouTube - Music", url: "https://youtube.com/watch?v=..." },
    { title: "Reddit", url: "https://reddit.com/..." },
    { title: "Social Media", url: "https://instagram.com/..." }
  ]
};

/**
 * Generate realistic study session simulation
 */
export function simulateStudySession(config: SimulationConfig): SimulationResult {
  const events: SimulatedActivityEvent[] = [];
  const now = Date.now();
  const sessionDurationMs = config.duration_minutes * 60 * 1000;
  const checkpointIntervalMs = 10 * 1000; // Every 10 seconds

  // Generate events at regular intervals
  for (let i = 0; i < config.duration_minutes * 6; i++) {
    const timestamp = now - sessionDurationMs + i * checkpointIntervalMs;
    const event = generateActivityEvent(timestamp, i, config);
    events.push(event);
  }

  // Calculate aggregate metric
  const metric = aggregateToMetric(events, now - sessionDurationMs, now);

  // Calculate summary insights
  const summary = generateSummary(events, metric, config.scenario);

  return {
    events,
    metric,
    summary
  };
}

/**
 * Generate single activity event based on scenario
 */
function generateActivityEvent(
  timestamp: number,
  eventIndex: number,
  config: SimulationConfig
): SimulatedActivityEvent {
  const eventPositionInSession = eventIndex / 6; // 0-1 (0% to 100% through session)

  // Select tab category based on activity mix
  const category = selectActivityCategory(config.activity_mix);

  // Get random tab in that category
  const tabInfo = getRandomTabInCategory(category);

  // Generate metrics based on scenario
  const metrics = generateMetricsForScenario(config.scenario, eventPositionInSession);

  return {
    id: crypto.generateId(),
    timestamp,
    active_tab_title: tabInfo.title,
    active_tab_url: tabInfo.url,
    tab_category: category,
    idle_seconds: metrics.idle_seconds,
    keystrokes_per_minute: metrics.keystrokes_per_minute,
    tab_switches_in_period: metrics.tab_switches,
    is_focused: metrics.is_focused,
    struggle_score: metrics.struggle_score,
    synced: false,
    created_at: timestamp
  };
}

/**
 * Select activity category based on mix percentages
 */
function selectActivityCategory(mix: Record<string, number>): string {
  const rand = Math.random() * 100;
  let cumulative = 0;

  if (rand < (cumulative += mix.docs_percentage)) return "docs";
  if (rand < (cumulative += mix.coding_percentage)) return "coding";
  if (rand < (cumulative += mix.research_percentage)) return "research";
  return "other";
}

/**
 * Get random tab in category
 */
function getRandomTabInCategory(category: string): { title: string; url: string } {
  const tabs = TAB_DOMAINS[category as keyof typeof TAB_DOMAINS] || TAB_DOMAINS.other;
  return tabs[Math.floor(Math.random() * tabs.length)];
}

/**
 * Generate realistic metrics based on scenario
 */
function generateMetricsForScenario(
  scenario: SimulationScenario,
  positionInSession: number
): {
  idle_seconds: number;
  keystrokes_per_minute: number;
  tab_switches: number;
  is_focused: boolean;
  struggle_score: number;
} {
  // Base values
  let idle = 15;
  let kpm = 40;
  let tab_switches = 2;
  let struggle = 0.2;

  // Scenario modifiers
  if (scenario === "high_focus") {
    idle = 5 + Math.random() * 10; // 5-15s idle
    kpm = 50 + Math.random() * 30; // 50-80 kpm
    tab_switches = 0 + Math.random() * 2; // 0-2 switches
    struggle = 0.1 + Math.random() * 0.2; // 0.1-0.3
  } else if (scenario === "normal_study") {
    idle = 15 + Math.random() * 15; // 15-30s idle
    kpm = 35 + Math.random() * 25; // 35-60 kpm
    tab_switches = 1 + Math.random() * 3; // 1-4 switches
    struggle = 0.3 + Math.random() * 0.3; // 0.3-0.6
  } else if (scenario === "struggling") {
    idle = 40 + Math.random() * 30; // 40-70s idle
    kpm = 10 + Math.random() * 20; // 10-30 kpm
    tab_switches = 3 + Math.random() * 5; // 3-8 switches
    struggle = 0.6 + Math.random() * 0.3; // 0.6-0.9
  } else if (scenario === "distracted") {
    idle = 30 + Math.random() * 40; // 30-70s idle
    kpm = 15 + Math.random() * 25; // 15-40 kpm
    tab_switches = 5 + Math.random() * 10; // 5-15 switches (frequent task switching)
    struggle = 0.5 + Math.random() * 0.4; // 0.5-0.9
  }

  // Fatigue effect: increase idle towards end of session
  const fatigueMultiplier = 1 + positionInSession * 0.3;
  idle *= fatigueMultiplier;
  kpm /= fatigueMultiplier;

  return {
    idle_seconds: Math.min(120, Math.round(idle)),
    keystrokes_per_minute: Math.round(Math.max(0, kpm)),
    tab_switches: Math.round(tab_switches),
    is_focused: Math.random() > 0.1, // 90% focused, 10% unfocused
    struggle_score: Math.min(1, struggle)
  };
}

/**
 * Aggregate events into single metric
 */
function aggregateToMetric(
  events: SimulatedActivityEvent[],
  windowStart: number,
  windowEnd: number
): {
  id: string;
  avg_idle_seconds: number;
  avg_keystrokes_per_minute: number;
  total_tab_switches: number;
  struggle_events_count: number;
  focus_score: number;
  dominant_tab_category: string;
} {
  const totalIdle = events.reduce((sum, e) => sum + e.idle_seconds, 0);
  const avgIdle = totalIdle / events.length;

  const totalKpm = events.reduce((sum, e) => sum + e.keystrokes_per_minute, 0);
  const avgKpm = totalKpm / events.length;

  const totalTabSwitches = events.reduce((sum, e) => sum + e.tab_switches_in_period, 0);
  const struggleCount = events.filter((e) => e.struggle_score > 0.6).length;

  // Find dominant category
  const categoryCount = events.reduce(
    (acc, e) => {
      acc[e.tab_category] = (acc[e.tab_category] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );
  const dominant = Object.entries(categoryCount).sort(([, a], [, b]) => b - a)[0];

  // Calculate focus score (0-100)
  let focusScore = 100;
  if (avgIdle > 30) focusScore -= Math.min(50, ((avgIdle - 30) / 120) * 50);
  if (avgKpm < 10) focusScore -= Math.min(30, ((10 - avgKpm) / 10) * 30);
  focusScore = Math.max(0, Math.min(100, focusScore));

  return {
    id: crypto.generateId(),
    avg_idle_seconds: Math.round(avgIdle * 10) / 10,
    avg_keystrokes_per_minute: Math.round(avgKpm),
    total_tab_switches: totalTabSwitches,
    struggle_events_count: struggleCount,
    focus_score: Math.round(focusScore),
    dominant_tab_category: dominant ? dominant[0] : "other"
  };
}

/**
 * Generate human-readable summary
 */
function generateSummary(
  events: SimulatedActivityEvent[],
  metric: any,
  scenario: SimulationScenario
): {
  total_time_minutes: number;
  focus_quality: "excellent" | "good" | "moderate" | "poor";
  estimated_productivity: number;
  recommendations: string[];
} {
  const totalMinutes = events.length / 6; // 6 events per minute

  // Determine focus quality
  let focusQuality: "excellent" | "good" | "moderate" | "poor" = "good";
  if (metric.focus_score > 85) focusQuality = "excellent";
  else if (metric.focus_score > 70) focusQuality = "good";
  else if (metric.focus_score > 50) focusQuality = "moderate";
  else focusQuality = "poor";

  // Productivity estimate (rough)
  const productivity = metric.focus_score;

  // Generate recommendations
  const recommendations: string[] = [];
  if (metric.avg_idle_seconds > 30) {
    recommendations.push("Try taking more frequent short breaks");
  }
  if (metric.total_tab_switches > 20) {
    recommendations.push("Consider closing distracting tabs");
  }
  if (metric.struggle_events_count > 3) {
    recommendations.push("Take a break and come back fresh");
  }
  if (metric.focus_score > 80) {
    recommendations.push("Great focus! Keep up the momentum");
  }
  if (recommendations.length === 0) {
    recommendations.push("Session went well!");
  }

  return {
    total_time_minutes: Math.round(totalMinutes),
    focus_quality: focusQuality,
    estimated_productivity: Math.round(productivity),
    recommendations
  };
}
