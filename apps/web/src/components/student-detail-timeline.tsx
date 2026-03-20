'use client';

import { useState } from 'react';

// ============================================================
// Types
// ============================================================

export type TimelineEvent = {
  id: string;
  date: string;
  type:
    | 'enrollment'
    | 'application'
    | 'absence'
    | 'metric'
    | 'communication'
    | 'submission'
    | 'note'
    | 'onboarding';
  title: string;
  description?: string;
  severity?: 'info' | 'warning' | 'success' | 'neutral';
  metadata?: Record<string, any>;
};

export type UnifiedStudent = {
  id: string;
  user_id: string;
  grade_level: string;
  date_of_birth?: string | null;
  email: string;
  full_name: string;
  enrollment_date?: string | null;
  last_absence?: string | null;
  behavior_event_count?: number;
  last_metric_at?: string | null;
  avg_distraction_index?: number | null;
  parent_updates_sent?: number;
  submission_breakdown?: Record<string, number> | null;
  timeline: TimelineEvent[];
  onboarding_complete?: boolean;
};

// ============================================================
// Helper: color & icon by type/severity
// ============================================================

function getEventStyle(event: TimelineEvent): {
  dotColor: string;
  bg: string;
  icon: string;
} {
  const severity = event.severity ?? 'neutral';

  const severityMap: Record<string, { dot: string; bg: string }> = {
    success: { dot: 'bg-green-500', bg: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' },
    warning: { dot: 'bg-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' },
    info: { dot: 'bg-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' },
    neutral: { dot: 'bg-neutral-400', bg: 'bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700' },
  };

  const iconMap: Record<TimelineEvent['type'], string> = {
    enrollment: '🎓',
    application: '📋',
    absence: '📅',
    metric: '📊',
    communication: '✉️',
    submission: '📝',
    note: '🗒️',
    onboarding: '📁',
  };

  const { dot, bg } = severityMap[severity];
  return { dotColor: dot, bg, icon: iconMap[event.type] };
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ============================================================
// Timeline Component
// ============================================================

function StudentTimeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-neutral-400">
        No timeline events recorded yet.
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-neutral-200 dark:bg-neutral-700" />

      <div className="space-y-4">
        {events.map((event) => {
          const { dotColor, bg, icon } = getEventStyle(event);
          return (
            <div key={event.id} className="relative flex gap-4 pl-12">
              {/* Dot */}
              <div
                className={`absolute left-4 top-3 w-3 h-3 rounded-full border-2 border-white dark:border-neutral-900 ${dotColor}`}
              />

              {/* Card */}
              <div className={`flex-1 rounded-lg border p-3 text-sm ${bg}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span>{icon}</span>
                    <span className="font-medium text-neutral-800 dark:text-neutral-100">
                      {event.title}
                    </span>
                  </div>
                  <span className="flex-shrink-0 text-xs text-neutral-500 dark:text-neutral-400">
                    {formatDate(event.date)}
                  </span>
                </div>
                {event.description && (
                  <p className="mt-1 text-neutral-600 dark:text-neutral-400 pl-6">
                    {event.description}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// Main Detail Panel
// ============================================================

interface StudentDetailTimelineProps {
  student: UnifiedStudent;
  onClose: () => void;
  onContactParent?: (student: UnifiedStudent) => void;
  onViewHomework?: (student: UnifiedStudent) => void;
}

export function StudentDetailTimeline({
  student,
  onClose,
  onContactParent,
  onViewHomework,
}: StudentDetailTimelineProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'timeline' | 'submissions'>('overview');

  const submissionBreakdown = student.submission_breakdown ?? {};
  const totalSubmissions = Object.values(submissionBreakdown).reduce((a, b) => a + b, 0);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-start justify-between p-5 border-b border-neutral-200 dark:border-neutral-700">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg">
            {student.full_name.charAt(0)}
          </div>
          <div>
            <h2 className="font-bold text-lg text-neutral-900 dark:text-neutral-100">
              {student.full_name}
            </h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Grade {student.grade_level} &bull; {student.email}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500"
        >
          ✕
        </button>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 px-5 pt-4">
        {onContactParent && (
          <button
            onClick={() => onContactParent(student)}
            className="flex-1 py-2 px-3 text-sm font-medium bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg transition-colors"
          >
            ✉️ Contact Parent
          </button>
        )}
        {onViewHomework && (
          <button
            onClick={() => onViewHomework(student)}
            className="flex-1 py-2 px-3 text-sm font-medium bg-neutral-50 hover:bg-neutral-100 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-lg transition-colors"
          >
            📚 View Homework
          </button>
        )}
        <a
          href={`/students/${student.id}/onboarding-documents`}
          className="flex-1 py-2 px-3 text-sm font-medium bg-neutral-50 hover:bg-neutral-100 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-lg transition-colors text-center"
        >
          📁 Documents
        </a>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-5 pt-4 border-b border-neutral-200 dark:border-neutral-700">
        {(['overview', 'timeline', 'submissions'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-2 text-sm font-medium rounded-t-lg transition-colors capitalize ${
              activeTab === tab
                ? 'bg-white dark:bg-neutral-800 border border-b-white dark:border-neutral-700 dark:border-b-neutral-800 text-blue-600 dark:text-blue-400'
                : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-5">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-neutral-50 dark:bg-neutral-800 rounded-xl p-4">
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">Behavior Events</p>
                <p className={`text-2xl font-bold ${
                  (student.behavior_event_count ?? 0) > 5
                    ? 'text-amber-600'
                    : 'text-neutral-800 dark:text-neutral-100'
                }`}>
                  {student.behavior_event_count ?? 0}
                </p>
              </div>
              <div className="bg-neutral-50 dark:bg-neutral-800 rounded-xl p-4">
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">Avg Distraction</p>
                <p className={`text-2xl font-bold ${
                  (student.avg_distraction_index ?? 0) > 7
                    ? 'text-red-600'
                    : (student.avg_distraction_index ?? 0) > 4
                    ? 'text-amber-600'
                    : 'text-green-600'
                }`}>
                  {student.avg_distraction_index != null
                    ? student.avg_distraction_index.toFixed(1)
                    : '—'}
                </p>
              </div>
              <div className="bg-neutral-50 dark:bg-neutral-800 rounded-xl p-4">
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">Parent Updates Sent</p>
                <p className="text-2xl font-bold text-neutral-800 dark:text-neutral-100">
                  {student.parent_updates_sent ?? 0}
                </p>
              </div>
              <div className="bg-neutral-50 dark:bg-neutral-800 rounded-xl p-4">
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">Onboarding</p>
                <p className={`text-sm font-semibold mt-1 ${
                  student.onboarding_complete ? 'text-green-600' : 'text-amber-600'
                }`}>
                  {student.onboarding_complete ? '✅ Complete' : '⏳ In Progress'}
                </p>
              </div>
            </div>

            {/* Key Info */}
            <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl p-4 space-y-3">
              {student.enrollment_date && (
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-500">Enrollment Date</span>
                  <span className="font-medium text-neutral-800 dark:text-neutral-100">
                    {formatDate(student.enrollment_date)}
                  </span>
                </div>
              )}
              {student.date_of_birth && (
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-500">Date of Birth</span>
                  <span className="font-medium text-neutral-800 dark:text-neutral-100">
                    {formatDate(student.date_of_birth)}
                  </span>
                </div>
              )}
              {student.last_absence && (
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-500">Last Absence</span>
                  <span className="font-medium text-amber-600">
                    {formatDate(student.last_absence)}
                  </span>
                </div>
              )}
              {student.last_metric_at && (
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-500">Last Metric Recorded</span>
                  <span className="font-medium text-neutral-800 dark:text-neutral-100">
                    {formatDate(student.last_metric_at)}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Timeline Tab */}
        {activeTab === 'timeline' && (
          <StudentTimeline events={student.timeline} />
        )}

        {/* Submissions Tab */}
        {activeTab === 'submissions' && (
          <div className="space-y-4">
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Total: <strong>{totalSubmissions}</strong> submission{totalSubmissions !== 1 ? 's' : ''}
            </p>
            {totalSubmissions === 0 ? (
              <div className="text-center py-8 text-sm text-neutral-400">
                No submissions recorded yet.
              </div>
            ) : (
              <div className="space-y-2">
                {Object.entries(submissionBreakdown).map(([status, count]) => {
                  const pct = totalSubmissions > 0 ? (count / totalSubmissions) * 100 : 0;
                  const colors: Record<string, string> = {
                    submitted: 'bg-green-500',
                    pending: 'bg-amber-500',
                    graded: 'bg-blue-500',
                    late: 'bg-red-500',
                    missing: 'bg-neutral-400',
                  };
                  const barColor = colors[status] ?? 'bg-neutral-400';
                  return (
                    <div key={status}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="capitalize text-neutral-700 dark:text-neutral-300">{status}</span>
                        <span className="text-neutral-500">{count}</span>
                      </div>
                      <div className="h-2 bg-neutral-100 dark:bg-neutral-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${barColor}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
