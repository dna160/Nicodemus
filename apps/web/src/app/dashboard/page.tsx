'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { CurriculumTab } from '@/components/curriculum-tab';
import {
  Home, BookOpen, Users, GraduationCap, MessageSquare, Settings,
  Search, Bell, Mic, Calendar, ChevronRight
} from 'lucide-react';
import { NicodemusAiModal } from '@/components/nicodemus-ai-modal';
import { ScrollFade } from '@/components/scroll-fade';

// ============================================================
// Types
// ============================================================

type Notification = {
  id: string;
  type: string;
  subject: string;
  body: string;
  status: string;
  student_id: string | null;
  created_at: string;
  sent_at?: string | null;
};

type Absence = {
  id: string;
  teacher_id: string;
  class_id: string;
  date_start: string;
  date_end: string;
  reason: string;
  created_at: string;
  substitute_assignments?: Array<{ substitute_id: string; status: string }>;
};

type Tab = 'home' | 'classes' | 'students' | 'curriculum' | 'communications' | 'erp';

// ============================================================
// Communications Tab Component
// ============================================================

function CommunicationsTab({ teacherId }: { teacherId: string }) {
  const [drafts, setDrafts] = useState<Notification[]>([]);
  const [history, setHistory] = useState<Notification[]>([]);
  const [loadingComms, setLoadingComms] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Draft email form state
  const [showDraftForm, setShowDraftForm] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [draftForm, setDraftForm] = useState({
    studentName: '',
    notificationType: 'progress',
    details: '',
  });

  const fetchNotifications = useCallback(async () => {
    setLoadingComms(true);
    try {
      const res = await fetch(`/api/communications?teacherId=${teacherId}`);
      const data = await res.json();
      if (data.success) {
        setDrafts(data.drafts);
        setHistory(data.history);
      }
    } finally {
      setLoadingComms(false);
    }
  }, [teacherId]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleApprove = async (notificationId: string) => {
    setActionLoading(notificationId);
    try {
      const res = await fetch(`/api/communications/${notificationId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacherId }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchNotifications();
      } else {
        alert('Approval failed: ' + data.error);
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (notificationId: string) => {
    setActionLoading(notificationId);
    try {
      const res = await fetch(`/api/communications/${notificationId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacherId }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchNotifications();
      } else {
        alert('Rejection failed: ' + data.error);
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleDraftSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDrafting(true);
    try {
      let parsedDetails: Record<string, unknown> = {};
      try {
        parsedDetails = draftForm.details ? JSON.parse(draftForm.details) : {};
      } catch {
        parsedDetails = { notes: draftForm.details };
      }

      const res = await fetch('/api/communications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacherId,
          studentName: draftForm.studentName,
          notificationType: draftForm.notificationType,
          details: parsedDetails,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowDraftForm(false);
        setDraftForm({ studentName: '', notificationType: 'progress', details: '' });
        await fetchNotifications();
      } else {
        alert('Draft creation failed: ' + data.error);
      }
    } finally {
      setDrafting(false);
    }
  };

  const typeLabels: Record<string, string> = {
    progress: '📈 Progress Update',
    alert: '⚠️ Concern',
    milestone: '🎉 Milestone',
    manual: '✉️ General',
  };

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-black dark:text-white">Parent Communications</h2>
          <p className="text-sm text-black dark:text-white opacity-60 mt-0.5">AI drafts parent emails — you review and approve before anything is sent.</p>
        </div>
        <button
          onClick={() => setShowDraftForm(!showDraftForm)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          + New Draft
        </button>
      </div>

      {/* Draft form */}
      {showDraftForm && (
        <section className="bg-blue-50 dark:bg-blue-900/20 p-5 rounded-xl border border-blue-200 dark:border-blue-800">
          <h3 className="font-semibold text-blue-800 dark:text-blue-300 mb-3">Generate Parent Email Draft</h3>
          <form onSubmit={handleDraftSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">Student Name</label>
              <input
                value={draftForm.studentName}
                onChange={e => setDraftForm({ ...draftForm, studentName: e.target.value })}
                placeholder="e.g. Alex"
                className="w-full p-2 rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-black dark:text-white"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Notification Type</label>
              <select
                value={draftForm.notificationType}
                onChange={e => setDraftForm({ ...draftForm, notificationType: e.target.value })}
                className="w-full p-2 rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-black dark:text-white"
              >
                <option value="progress">Progress Update</option>
                <option value="alert">Concern / Alert</option>
                <option value="milestone">Milestone / Achievement</option>
                <option value="manual">General Message</option>
              </select>
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-sm font-medium">
                Details <span className="text-black dark:text-white opacity-50 font-normal">(JSON or plain text — Claude will use this)</span>
              </label>
              <textarea
                value={draftForm.details}
                onChange={e => setDraftForm({ ...draftForm, details: e.target.value })}
                placeholder={'e.g. {"grade": "B+", "improvement": "algebra skills", "concern": "missing homework"}'}
                rows={3}
                className="w-full p-2 rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-black dark:text-white font-mono text-xs"
              />
            </div>
            <div className="md:col-span-2 flex gap-3">
              <button
                type="submit"
                disabled={drafting}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {drafting ? 'Claude is drafting...' : 'Generate Draft'}
              </button>
              <button
                type="button"
                onClick={() => setShowDraftForm(false)}
                className="px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg text-sm transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Pending Drafts */}
      <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="font-semibold text-black dark:text-white">Pending Your Review</h3>
          {drafts.length > 0 && (
            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-semibold">
              {drafts.length}
            </span>
          )}
        </div>

        {loadingComms ? (
          <p className="text-sm text-black dark:text-white opacity-50">Loading...</p>
        ) : drafts.length === 0 ? (
          <p className="text-sm text-black dark:text-white opacity-50 italic">No drafts awaiting review.</p>
        ) : (
          <div className="space-y-4">
            {drafts.map((notif) => (
              <div key={notif.id} className="border border-amber-200 dark:border-amber-800 rounded-lg p-4 bg-amber-50 dark:bg-amber-900/10">
                <div className="flex justify-between items-start gap-2 mb-2">
                  <div>
                    <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                      {typeLabels[notif.type] ?? notif.type}
                    </span>
                    <h4 className="font-semibold text-black dark:text-white mt-0.5">{notif.subject}</h4>
                  </div>
                  <span className="text-xs text-black dark:text-white opacity-50 whitespace-nowrap">
                    {new Date(notif.created_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm text-black dark:text-white mb-4 leading-relaxed">{notif.body}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleApprove(notif.id)}
                    disabled={actionLoading === notif.id}
                    className="px-4 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm rounded-md font-medium transition-colors disabled:opacity-50"
                  >
                    {actionLoading === notif.id ? 'Processing...' : '✓ Approve & Send'}
                  </button>
                  <button
                    onClick={() => handleReject(notif.id)}
                    disabled={actionLoading === notif.id}
                    className="px-4 py-1.5 border border-gray-200 dark:border-gray-600 text-sm rounded-md font-medium transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
                  >
                    ✕ Discard
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Sent History */}
      {history.length > 0 && (
        <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
          <h3 className="font-semibold text-black dark:text-white mb-4">Recently Sent (30 days)</h3>
          <div className="space-y-2">
            {history.map((notif) => (
              <div key={notif.id} className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
                <div>
                  <span className="text-xs text-black dark:text-white opacity-50 mr-2">{typeLabels[notif.type] ?? notif.type}</span>
                  <span className="text-sm text-black dark:text-white">{notif.subject}</span>
                </div>
                <span className="text-xs text-black dark:text-white opacity-50">
                  {notif.sent_at ? new Date(notif.sent_at).toLocaleDateString() : '—'}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ============================================================
// Study Review HITL Component
// ============================================================

type ReviewTask = {
  id: string;
  metric_id: string | null;
  submission_id: string | null;
  student_id: string | null;
  teacher_id: string | null;
  review_type: string;
  status: string;
  created_at: string;
  student_metrics: {
    focus_score: number;
    avg_idle_seconds: number;
    avg_keystrokes_per_minute: number;
    struggle_events_count: number;
    dominant_tab_category: string;
    total_tab_switches: number;
    summary: Record<string, any> | null;
  } | null;
  submissions: {
    id: string;
    content: Record<string, string> | null;
    ai_grade: number | null;
    ai_feedback: string | null;
    ai_next_steps: string | null;
    submitted_at: string;
    assignments: {
      id: string;
      title: string;
      subject: string | null;
      points_possible: number;
      content: { questions: Array<{ id: string; prompt: string; type: string; points: number }> } | null;
    } | null;
  } | null;
};

function StudyReviewsSection({ teacherId }: { teacherId: string }) {
  const [tasks, setTasks] = useState<ReviewTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Per-homework review state
  // perAnswerFeedback: { [taskId]: { [questionId]: feedback } }
  const [perAnswerFeedback, setPerAnswerFeedback] = useState<Record<string, Record<string, string>>>({});
  // perAnswerScores: { [taskId]: { [questionId]: scoreString } }
  const [perAnswerScores, setPerAnswerScores] = useState<Record<string, Record<string, string>>>({});
  // overallNotes: { [taskId]: string }
  const [overallNotes, setOverallNotes] = useState<Record<string, string>>({});

  // Study session review state
  const [sendToParents, setSendToParents] = useState<Record<string, boolean>>({});
  const [studyNotes, setStudyNotes] = useState<Record<string, string>>({});

  // Expand AI feedback by task ID
  const [expandedAIFeedback, setExpandedAIFeedback] = useState<Set<string>>(new Set());

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/erp/review-tasks?teacherId=${teacherId}`);
      const data = await res.json();
      if (data.success) setTasks(data.tasks);
    } finally {
      setLoading(false);
    }
  }, [teacherId]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  // ── Homework: complete teacher review ──────────────────────
  const handleCompleteReview = async (task: ReviewTask) => {
    const sub = task.submissions;
    if (!sub) return;
    setActionLoading(task.id);
    try {
      const questions = sub.assignments?.content?.questions ?? [];
      const answers = sub.content ?? {};
      const scores = perAnswerScores[task.id] ?? {};

      // Build per-answer array with scores
      const perAnswer = questions.map((q) => {
        const scoreStr = scores[q.id] ?? '';
        const score = scoreStr !== '' ? parseFloat(scoreStr) : null;
        return {
          questionId: q.id,
          questionPrompt: q.prompt,
          answer: answers[q.id] ?? '(no answer)',
          feedback: perAnswerFeedback[task.id]?.[q.id] ?? '',
          score: !isNaN(score as number) ? score : null,
        };
      });

      // Calculate final grade by summing per-answer scores
      const scoredAnswers = perAnswer.filter((p) => p.score !== null);
      const teacherGrade =
        scoredAnswers.length > 0
          ? scoredAnswers.reduce((sum, p) => sum + (p.score || 0), 0)
          : null;

      const res = await fetch(`/api/erp/review-tasks/${task.id}/complete-review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacherId,
          teacherGrade,
          perAnswerFeedback: perAnswer,
          overallNotes: overallNotes[task.id] ?? '',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(data.message);
        setExpandedId(null);
        await fetchTasks();
        setTimeout(() => setSuccessMsg(null), 6000);
      } else {
        alert('Error: ' + data.error);
      }
    } finally {
      setActionLoading(null);
    }
  };

  // ── Study session: approve (unchanged flow) ────────────────
  const handleApprove = async (taskId: string) => {
    setActionLoading(taskId);
    try {
      const res = await fetch(`/api/erp/review-tasks/${taskId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacherId,
          notes: studyNotes[taskId] || '',
          sendToParents: sendToParents[taskId] ?? false,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(data.message);
        setExpandedId(null);
        await fetchTasks();
        setTimeout(() => setSuccessMsg(null), 5000);
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleDismiss = async (taskId: string) => {
    setActionLoading(taskId);
    try {
      await fetch(`/api/erp/review-tasks/${taskId}/dismiss`, { method: 'POST' });
      await fetchTasks();
    } finally {
      setActionLoading(null);
    }
  };

  const gradeColor = (g: number) => g >= 80 ? 'text-green-600' : g >= 60 ? 'text-amber-600' : 'text-red-500';
  const focusColor = (score: number) =>
    score >= 80 ? 'text-green-600' : score >= 60 ? 'text-amber-600' : 'text-red-500';

  return (
    <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
      <div className="flex items-center gap-2 mb-4">
        <h3 className="font-semibold text-black dark:text-white">📋 Student Reviews</h3>
        {tasks.length > 0 && (
          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">{tasks.length} pending</span>
        )}
        <button onClick={fetchTasks} className="ml-auto text-xs text-black dark:text-white opacity-50 hover:text-black dark:hover:text-white hover:opacity-100">↻ Refresh</button>
      </div>

      {successMsg && (
        <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-sm text-green-700 dark:text-green-300">
          ✅ {successMsg}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-black dark:text-white opacity-50">Loading...</p>
      ) : tasks.length === 0 ? (
        <p className="text-sm text-black dark:text-white opacity-50 italic">No reviews pending. Homework submissions and study sessions will appear here.</p>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => {
            const m = task.student_metrics;
            const sub = task.submissions;
            const isHomework = task.review_type === 'homework_grade';
            const isExpanded = expandedId === task.id;
            const summary = m?.summary as Record<string, any> | null;
            const questions = sub?.assignments?.content?.questions ?? [];
            const answers = sub?.content ?? {};

            return (
              <div key={task.id} className={`border rounded-lg overflow-hidden ${isHomework ? 'border-purple-200 dark:border-purple-800' : 'border-blue-200 dark:border-blue-800'}`}>

                {/* ── Task header ── */}
                <div
                  className={`flex items-center gap-4 p-4 cursor-pointer ${isHomework ? 'hover:bg-purple-50 dark:hover:bg-purple-900/10' : 'hover:bg-blue-50 dark:hover:bg-blue-900/10'}`}
                  onClick={() => setExpandedId(isExpanded ? null : task.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-medium uppercase ${isHomework ? 'text-purple-600 dark:text-purple-400' : 'text-blue-600 dark:text-blue-400'}`}>
                        {isHomework ? '📝 Homework Review' : '📊 Study Progress'}
                      </span>
                      <span className="text-xs text-black dark:text-white opacity-50">{new Date(task.created_at).toLocaleString()}</span>
                    </div>
                    {isHomework && sub ? (
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <span className="font-semibold text-black dark:text-white text-sm">{sub.assignments?.title ?? 'Homework'}</span>
                        {sub.assignments?.subject && <span className="text-xs text-black dark:text-white opacity-50">· {sub.assignments.subject}</span>}
                        {sub.ai_grade != null ? (
                          <span className={`text-sm font-semibold ${gradeColor(sub.ai_grade)}`}>
                            AI: {Math.round(sub.ai_grade)}/{sub.assignments?.points_possible ?? 100}
                          </span>
                        ) : (
                          <span className="text-xs text-amber-600 font-medium">AI grading pending</span>
                        )}
                      </div>
                    ) : m ? (
                      <div className="flex items-center gap-4 mt-1 flex-wrap">
                        <span className={`text-lg font-bold ${focusColor(m.focus_score)}`}>{m.focus_score}/100</span>
                        <span className="text-xs text-black dark:text-white opacity-60">Focus Score</span>
                        <span className="text-xs text-black dark:text-white opacity-50">· {m.dominant_tab_category}</span>
                        {m.struggle_events_count > 0 && (
                          <span className="text-xs text-amber-600">⚠️ {m.struggle_events_count} struggles</span>
                        )}
                      </div>
                    ) : null}
                  </div>
                  <span className="text-black dark:text-white opacity-50 text-sm">{isExpanded ? '▲' : '▼'}</span>
                </div>

                {/* ── Expanded panel ── */}
                {isExpanded && (
                  <div className={`border-t p-5 space-y-5 ${isHomework ? 'border-purple-100 dark:border-purple-900 bg-purple-50/50 dark:bg-purple-900/5' : 'border-blue-100 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-900/5'}`}>

                    {/* ── HOMEWORK review panel ── */}
                    {isHomework && sub && (
                      <>
                        {/* AI pre-grade reference */}
                        {sub.ai_grade != null && (
                          <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 space-y-2">
                            <div className="flex items-center gap-4">
                              <div>
                                <p className="text-xs text-black dark:text-white opacity-50 uppercase font-medium">AI Suggested Grade</p>
                                <p className={`text-2xl font-bold ${gradeColor(sub.ai_grade)}`}>
                                  {Math.round(sub.ai_grade)}<span className="text-sm font-normal text-black dark:text-white opacity-50">/{sub.assignments?.points_possible ?? 100}</span>
                                </p>
                              </div>
                              {sub.ai_feedback && (
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs text-black dark:text-white opacity-50 uppercase font-medium mb-1">AI Summary</p>
                                  {/* Show first 2 sentences as a concise summary */}
                                  <p className="text-xs text-black dark:text-white leading-relaxed">
                                    {sub.ai_feedback.split(/(?<=[.!?])\s+/).slice(0, 2).join(' ')}
                                  </p>
                                </div>
                              )}
                            </div>
                            {/* Segmented AI insights — one bullet per sentence after the first 2 */}
                            {sub.ai_feedback && (() => {
                              const sentences = sub.ai_feedback.split(/(?<=[.!?])\s+/).filter(Boolean);
                              const extras = sentences.slice(2, 6); // show up to 4 more
                              if (extras.length === 0) return null;
                              return (
                                <div className={`space-y-1 pt-1 border-t border-gray-100 dark:border-gray-700 ${expandedAIFeedback.has(task.id) ? '' : 'hidden'}`}>
                                  {extras.map((s, i) => (
                                    <p key={i} className="text-xs text-black dark:text-white leading-relaxed pl-3 border-l-2 border-purple-200 dark:border-purple-800">
                                      {s}
                                    </p>
                                  ))}
                                </div>
                              );
                            })()}
                            {sub.ai_feedback && sub.ai_feedback.split(/(?<=[.!?])\s+/).length > 2 && (
                              <button
                                onClick={() => {
                                  const next = new Set(expandedAIFeedback);
                                  if (next.has(task.id)) next.delete(task.id); else next.add(task.id);
                                  setExpandedAIFeedback(next);
                                }}
                                className="text-xs font-medium text-purple-600 hover:text-purple-700 dark:text-purple-400"
                              >
                                {expandedAIFeedback.has(task.id) ? '↑ Less' : '↓ More details'}
                              </button>
                            )}
                          </div>
                        )}

                        {/* Per-answer review */}
                        {questions.length > 0 && (
                          <div className="space-y-3">
                            <p className="text-xs font-semibold text-black dark:text-white opacity-60 uppercase">Review Each Answer</p>
                            {questions.map((q, i) => (
                              <div key={q.id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 p-4 space-y-3">
                                {/* Question header */}
                                <div className="flex justify-between items-start gap-2 pb-2 border-b border-gray-100 dark:border-gray-700">
                                  <p className="text-sm font-medium text-black dark:text-white">
                                    <span className="text-black dark:text-white opacity-50 mr-1">{i + 1}.</span>{q.prompt}
                                  </p>
                                  <span className="text-xs text-black dark:text-white opacity-50 shrink-0 font-semibold">{q.points} pts</span>
                                </div>

                                {/* Student's answer - prominent display */}
                                <div className="bg-blue-50 dark:bg-blue-900/10 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
                                  <p className="text-xs text-blue-600 dark:text-blue-400 uppercase font-medium mb-1">Student's Answer</p>
                                  <p className="text-sm text-black dark:text-white leading-relaxed whitespace-pre-wrap">
                                    {answers[q.id] || <span className="text-black dark:text-white opacity-50 italic">(no answer provided)</span>}
                                  </p>
                                </div>

                                {/* Feedback and score */}
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <label className="text-xs text-black dark:text-white opacity-50 uppercase font-medium block mb-1">
                                      Your Feedback <span className="opacity-75">(optional)</span>
                                    </label>
                                    <textarea
                                      value={perAnswerFeedback[task.id]?.[q.id] ?? ''}
                                      onChange={(e) => setPerAnswerFeedback({
                                        ...perAnswerFeedback,
                                        [task.id]: { ...(perAnswerFeedback[task.id] ?? {}), [q.id]: e.target.value },
                                      })}
                                      placeholder="e.g. Great reasoning, but missing the key formula..."
                                      rows={3}
                                      className="w-full p-2 text-sm rounded-md border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-black dark:text-white resize-none focus:outline-none focus:ring-1 focus:ring-purple-400"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-xs text-black dark:text-white opacity-50 uppercase font-medium block mb-1">Score</label>
                                    <div className="flex items-center gap-1 mb-2">
                                      <input
                                        type="number"
                                        min="0"
                                        max={q.points}
                                        value={perAnswerScores[task.id]?.[q.id] ?? ''}
                                        onChange={(e) => setPerAnswerScores({
                                          ...perAnswerScores,
                                          [task.id]: { ...(perAnswerScores[task.id] ?? {}), [q.id]: e.target.value },
                                        })}
                                        placeholder={String(q.points)}
                                        className="w-full p-2 text-sm rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-black dark:text-white focus:outline-none focus:ring-1 focus:ring-purple-400 text-center"
                                      />
                                      <span className="text-xs text-black dark:text-white opacity-50 font-medium shrink-0">/ {q.points}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Grade display + overall notes */}
                        {(() => {
                          const questions = sub.assignments?.content?.questions ?? [];
                          const scores = perAnswerScores[task.id] ?? {};
                          const scoredAnswers = questions
                            .map((q) => {
                              const scoreStr = scores[q.id] ?? '';
                              const score = scoreStr !== '' ? parseFloat(scoreStr) : null;
                              return !isNaN(score as number) ? score : null;
                            })
                            .filter((s) => s !== null);
                          const calculatedGrade = scoredAnswers.length > 0 ? scoredAnswers.reduce((a, b) => a + (b || 0), 0) : null;
                          return (
                            <div className="space-y-4">
                              {/* Grade comparison */}
                              <div className="grid grid-cols-2 gap-3">
                                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
                                  <p className="text-xs text-blue-600 dark:text-blue-400 uppercase font-medium mb-0.5">AI Grade</p>
                                  <p className={`text-xl font-bold ${gradeColor(sub.ai_grade ?? 0)}`}>
                                    {sub.ai_grade != null ? Math.round(sub.ai_grade) : '—'}<span className="text-xs font-normal text-black dark:text-white opacity-50">/{sub.assignments?.points_possible ?? 100}</span>
                                  </p>
                                </div>
                                <div className={`rounded-lg p-3 border ${calculatedGrade !== null ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800' : 'bg-gray-50 dark:bg-gray-800 border-gray-100 dark:border-gray-700'}`}>
                                  <p className={`text-xs uppercase font-medium mb-0.5 ${calculatedGrade !== null ? 'text-purple-600 dark:text-purple-400' : 'text-black dark:text-white opacity-50'}`}>Final Grade</p>
                                  <p className={`text-xl font-bold ${calculatedGrade !== null ? gradeColor(calculatedGrade) : 'text-black dark:text-white opacity-50'}`}>
                                    {calculatedGrade !== null ? Math.round(calculatedGrade) : '—'}<span className="text-xs font-normal text-black dark:text-white opacity-50">/{sub.assignments?.points_possible ?? 100}</span>
                                  </p>
                                </div>
                              </div>
                              {/* Overall notes */}
                              <div>
                                <label className="text-xs font-medium text-black dark:text-white opacity-60 uppercase block mb-1">Overall Notes</label>
                                <textarea
                                  value={overallNotes[task.id] ?? ''}
                                  onChange={(e) => setOverallNotes({ ...overallNotes, [task.id]: e.target.value })}
                                  placeholder="Add an overall note for the student..."
                                  rows={2}
                                  className="w-full p-2 text-sm rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-black dark:text-white resize-none focus:outline-none focus:ring-1 focus:ring-purple-400"
                                />
                              </div>
                            </div>
                          );
                        })()}

                        {/* Complete review actions */}
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={() => handleCompleteReview(task)}
                            disabled={actionLoading === task.id}
                            className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-md font-semibold transition-colors disabled:opacity-50"
                          >
                            {actionLoading === task.id ? '⏳ Processing...' : '✓ Complete Review & Return to Student'}
                          </button>
                          <button
                            onClick={() => handleDismiss(task.id)}
                            disabled={actionLoading === task.id}
                            className="px-4 py-2 border border-gray-200 dark:border-gray-600 text-sm rounded-md font-medium transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
                          >
                            ✕ Dismiss
                          </button>
                        </div>
                      </>
                    )}

                    {/* ── STUDY SESSION review panel (unchanged) ── */}
                    {!isHomework && m && (
                      <>
                        <div className="grid grid-cols-3 gap-3 text-center">
                          <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                            <div className="text-lg font-bold text-black dark:text-white">{m.avg_keystrokes_per_minute}</div>
                            <div className="text-xs text-black dark:text-white opacity-60">KPM</div>
                          </div>
                          <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                            <div className="text-lg font-bold text-black dark:text-white">{m.avg_idle_seconds}s</div>
                            <div className="text-xs text-black dark:text-white opacity-60">Avg Idle</div>
                          </div>
                          <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                            <div className="text-lg font-bold text-black dark:text-white">{m.total_tab_switches}</div>
                            <div className="text-xs text-black dark:text-white opacity-60">Tab Switches</div>
                          </div>
                        </div>

                        {summary?.recommendations && (
                          <div>
                            <p className="text-xs font-medium text-black dark:text-white opacity-60 uppercase mb-1">AI Recommendations</p>
                            <ul className="space-y-1">
                              {(summary.recommendations as string[]).map((r, i) => (
                                <li key={i} className="text-sm text-black dark:text-white">• {r}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        <div>
                          <label className="text-xs font-medium text-black dark:text-white opacity-60 uppercase block mb-1">Your Notes (optional)</label>
                          <textarea
                            value={studyNotes[task.id] || ''}
                            onChange={(e) => setStudyNotes({ ...studyNotes, [task.id]: e.target.value })}
                            placeholder="Add a note for the parent email..."
                            rows={2}
                            className="w-full p-2 text-sm rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-black dark:text-white"
                          />
                        </div>

                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={sendToParents[task.id] ?? false}
                            onChange={(e) => setSendToParents({ ...sendToParents, [task.id]: e.target.checked })}
                            className="w-4 h-4 rounded"
                          />
                          <span className="text-sm text-black dark:text-white">
                            Create parent email draft (will appear in Communications tab)
                          </span>
                        </label>

                        <div className="flex gap-2">
                          <button
                            onClick={() => handleApprove(task.id)}
                            disabled={actionLoading === task.id}
                            className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-md font-medium transition-colors disabled:opacity-50"
                          >
                            {actionLoading === task.id ? 'Processing...' : '✓ Approve'}
                          </button>
                          <button
                            onClick={() => handleDismiss(task.id)}
                            disabled={actionLoading === task.id}
                            className="px-4 py-2 border border-gray-200 dark:border-gray-600 text-sm rounded-md font-medium transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
                          >
                            ✕ Dismiss
                          </button>
                        </div>
                      </>
                    )}

                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ============================================================
// ERP Tab Component (Substitute Management)
// ============================================================

function ERPTab({ teacherId }: { teacherId: string }) {
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [loadingERP, setLoadingERP] = useState(false);
  const [showAbsenceForm, setShowAbsenceForm] = useState(false);
  const [creatingAbsence, setCreatingAbsence] = useState(false);
  const [absenceForm, setAbsenceForm] = useState({
    classId: '',
    dateStart: new Date().toISOString().split('T')[0],
    dateEnd: new Date().toISOString().split('T')[0],
    reason: 'other',
    lessonObjectives: '',
    materialsAvailable: '',
    specialInstructions: '',
  });

  const fetchAbsences = useCallback(async () => {
    setLoadingERP(true);
    try {
      const res = await fetch(`/api/erp/absences?teacherId=${teacherId}`);
      const data = await res.json();
      if (data.success) {
        setAbsences(data.absences);
      }
    } finally {
      setLoadingERP(false);
    }
  }, [teacherId]);

  useEffect(() => {
    fetchAbsences();
  }, [fetchAbsences]);

  const handleAbsenceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingAbsence(true);
    try {
      const res = await fetch('/api/erp/absences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacherId,
          classId: absenceForm.classId,
          dateStart: absenceForm.dateStart,
          dateEnd: absenceForm.dateEnd,
          reason: absenceForm.reason,
          lessonObjectives: absenceForm.lessonObjectives,
          materialsAvailable: absenceForm.materialsAvailable
            .split(',')
            .map(m => m.trim())
            .filter(m => m),
          specialInstructions: absenceForm.specialInstructions,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowAbsenceForm(false);
        setAbsenceForm({
          classId: '',
          dateStart: new Date().toISOString().split('T')[0],
          dateEnd: new Date().toISOString().split('T')[0],
          reason: 'other',
          lessonObjectives: '',
          materialsAvailable: '',
          specialInstructions: '',
        });
        await fetchAbsences();
      } else {
        alert('Error: ' + data.error);
      }
    } finally {
      setCreatingAbsence(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Student Study Reviews — HITL */}
      <StudyReviewsSection teacherId={teacherId} />

      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-black dark:text-white">Substitute Management</h2>
          <p className="text-sm text-black dark:text-white opacity-60 mt-0.5">Log absences and manage substitute assignments</p>
        </div>
        <button
          onClick={() => setShowAbsenceForm(!showAbsenceForm)}
          className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          + Log Absence
        </button>
      </div>

      {showAbsenceForm && (
        <section className="bg-amber-50 dark:bg-amber-900/20 p-5 rounded-xl border border-amber-200 dark:border-amber-800">
          <h3 className="font-semibold text-amber-800 dark:text-amber-300 mb-3">Log Absence</h3>
          <form onSubmit={handleAbsenceSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Class ID</label>
                <input
                  value={absenceForm.classId}
                  onChange={e => setAbsenceForm({ ...absenceForm, classId: e.target.value })}
                  placeholder="Class ID"
                  className="w-full p-2 rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-black dark:text-white"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium">Reason</label>
                <select
                  value={absenceForm.reason}
                  onChange={e => setAbsenceForm({ ...absenceForm, reason: e.target.value })}
                  className="w-full p-2 rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-black dark:text-white"
                >
                  <option value="sick">Sick Leave</option>
                  <option value="personal">Personal Day</option>
                  <option value="conference">Conference</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Start Date</label>
                <input
                  type="date"
                  value={absenceForm.dateStart}
                  onChange={e => setAbsenceForm({ ...absenceForm, dateStart: e.target.value })}
                  className="w-full p-2 rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-black dark:text-white"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium">End Date</label>
                <input
                  type="date"
                  value={absenceForm.dateEnd}
                  onChange={e => setAbsenceForm({ ...absenceForm, dateEnd: e.target.value })}
                  className="w-full p-2 rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-black dark:text-white"
                  required
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Lesson Objectives</label>
              <textarea
                value={absenceForm.lessonObjectives}
                onChange={e => setAbsenceForm({ ...absenceForm, lessonObjectives: e.target.value })}
                placeholder="What should the substitute help students learn?"
                rows={3}
                className="w-full p-2 rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-black dark:text-white"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Materials Available</label>
              <input
                value={absenceForm.materialsAvailable}
                onChange={e => setAbsenceForm({ ...absenceForm, materialsAvailable: e.target.value })}
                placeholder="e.g. textbooks, markers, projector (comma-separated)"
                className="w-full p-2 rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-black dark:text-white"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Special Instructions</label>
              <textarea
                value={absenceForm.specialInstructions}
                onChange={e => setAbsenceForm({ ...absenceForm, specialInstructions: e.target.value })}
                placeholder="e.g. seating chart, behavioral notes, etc."
                rows={2}
                className="w-full p-2 rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-black dark:text-white"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={creatingAbsence}
                className="flex-1 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {creatingAbsence ? 'Creating...' : 'Log Absence'}
              </button>
              <button
                type="button"
                onClick={() => setShowAbsenceForm(false)}
                className="px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
        <h3 className="font-semibold text-black dark:text-white mb-4">Your Absences</h3>
        {loadingERP ? (
          <p className="text-sm text-black dark:text-white opacity-50">Loading...</p>
        ) : absences.length === 0 ? (
          <p className="text-sm text-black dark:text-white opacity-50 italic">No absences logged.</p>
        ) : (
          <div className="space-y-3">
            {absences.map(absence => (
              <div key={absence.id} className="border border-gray-100 dark:border-gray-700 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase">{absence.reason}</span>
                    <p className="font-semibold text-black dark:text-white mt-1">
                      {absence.date_start} to {absence.date_end}
                    </p>
                    <p className="text-sm text-black dark:text-white opacity-60">
                      {absence.substitute_assignments?.length ?? 0} substitutes invited
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ============================================================
// Classes Tab Component
// ============================================================

type ClassStudent = {
  id: string;
  name: string;
  email: string;
  grade_level: string | null;
  completionRate: number | null;
  avgGrade: number | null;
};

type ClassLesson = {
  id: string;
  title: string;
  subject: string | null;
  status: string;
  publishedAt: string | null;
};

type TeacherClass = {
  id: string;
  name: string;
  subject: string | null;
  grade_level: string | null;
  period: number | null;
  studentCount: number;
  students: ClassStudent[];
  lessons: ClassLesson[];
  lessonCount: number;
  activeAssignments: number;
  classCompletionRate: number | null;
};

function ClassesTab({ teacherId }: { teacherId: string }) {
  const [classes, setClasses] = useState<TeacherClass[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedClassId, setExpandedClassId] = useState<string | null>(null);

  const fetchClasses = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/teacher/classes?teacherId=${teacherId}`);
      const data = await res.json();
      if (data.classes) setClasses(data.classes);
    } finally {
      setLoading(false);
    }
  }, [teacherId]);

  useEffect(() => { fetchClasses(); }, [fetchClasses]);

  const subjectColor = (subject: string | null) => {
    if (!subject) return 'bg-gray-100 dark:bg-gray-700 text-black dark:text-white';
    const s = subject.toLowerCase();
    if (s.includes('math')) return 'bg-blue-100 text-blue-700';
    if (s.includes('science') || s.includes('bio') || s.includes('chem')) return 'bg-green-100 text-green-700';
    if (s.includes('english') || s.includes('language') || s.includes('lit')) return 'bg-purple-100 text-purple-700';
    if (s.includes('history') || s.includes('social')) return 'bg-amber-100 text-amber-700';
    return 'bg-gray-100 dark:bg-gray-700 text-black dark:text-white';
  };

  const completionColor = (rate: number | null) => {
    if (rate === null) return 'bg-gray-100 dark:bg-gray-700 text-black dark:text-white';
    if (rate >= 80) return 'bg-green-100 text-green-700';
    if (rate >= 60) return 'bg-amber-100 text-amber-700';
    return 'bg-red-100 text-red-600';
  };

  const gradeColor = (g: number | null) => {
    if (g === null) return 'bg-gray-100 dark:bg-gray-700 text-black dark:text-white';
    if (g >= 80) return 'bg-green-100 text-green-700';
    if (g >= 60) return 'bg-amber-100 text-amber-700';
    return 'bg-red-100 text-red-600';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (classes.length === 0) {
    return (
      <div className="text-center py-16 text-black dark:text-white opacity-50 italic">
        No classes yet. Create your first class to get started.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {classes.map((cls) => {
        const isExpanded = expandedClassId === cls.id;
        return (
          <div
            key={cls.id}
            className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-5 hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => setExpandedClassId(isExpanded ? null : cls.id)}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-2 mb-3">
              <h3 className="text-lg font-bold text-black dark:text-white leading-tight">{cls.name}</h3>
              <span className="text-black dark:text-white opacity-50 text-sm shrink-0">{isExpanded ? '▲' : '▼'}</span>
            </div>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {cls.subject && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${subjectColor(cls.subject)}`}>
                  {cls.subject}
                </span>
              )}
              {cls.grade_level && (
                <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-black dark:text-white rounded-full text-xs font-medium">
                  {cls.grade_level}
                </span>
              )}
              {cls.period != null && (
                <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-black dark:text-white rounded-full text-xs">
                  Period {cls.period}
                </span>
              )}
            </div>

            {/* Stats row */}
            <p className="text-xs text-black dark:text-white opacity-60 mb-3">
              {cls.studentCount} students · {cls.lessonCount} lessons · {cls.activeAssignments} active assignments
            </p>

            {/* Completion bar */}
            {cls.classCompletionRate !== null && (
              <div className="mb-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-black dark:text-white opacity-60">Class Completion</span>
                  <span className="text-xs font-semibold text-black dark:text-white">{Math.round(cls.classCompletionRate)}%</span>
                </div>
                <div className="h-2 bg-blue-100 rounded-full overflow-hidden">
                  <div
                    className="h-2 bg-blue-600 rounded-full transition-all"
                    style={{ width: `${Math.min(100, cls.classCompletionRate)}%` }}
                  />
                </div>
              </div>
            )}

            {/* Expanded section */}
            {isExpanded && (
              <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 space-y-4" onClick={(e) => e.stopPropagation()}>
                {/* Students sub-list */}
                <div>
                  <p className="text-xs font-semibold text-black dark:text-white opacity-50 uppercase mb-2">Enrolled Students</p>
                  {cls.students.length === 0 ? (
                    <p className="text-xs text-black dark:text-white opacity-50 italic">No students enrolled.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {cls.students.map((student) => (
                        <div key={student.id} className="flex items-center justify-between gap-2">
                          <span className="text-sm text-black dark:text-white truncate">{student.name}</span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${completionColor(student.completionRate)}`}>
                              {student.completionRate !== null ? `${Math.round(student.completionRate)}%` : '—'}
                            </span>
                            <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${gradeColor(student.avgGrade)}`}>
                              {student.avgGrade !== null ? `${Math.round(student.avgGrade)}` : '—'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Lessons sub-list */}
                <div>
                  <p className="text-xs font-semibold text-black dark:text-white opacity-50 uppercase mb-2">Recent Lessons</p>
                  {cls.lessons.length === 0 ? (
                    <p className="text-xs text-black dark:text-white opacity-50 italic">No lessons yet.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {cls.lessons.slice(0, 5).map((lesson) => (
                        <div key={lesson.id} className="flex items-center justify-between gap-2">
                          <span className="text-sm text-black dark:text-white truncate">{lesson.title}</span>
                          <span className={`px-1.5 py-0.5 rounded text-xs font-medium shrink-0 ${
                            lesson.status === 'published'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 dark:bg-gray-700 text-black dark:text-white'
                          }`}>
                            {lesson.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// Students Tab Component
// ============================================================

type FlatStudent = {
  id: string;
  name: string;
  email: string;
  grade_level: string | null;
  classes: string[];
  avgGrade: number | null;
  completionRate: number | null;
};

type QuickGlanceData = {
  student: {
    id: string;
    name: string;
    grade_level: string | null;
  };
  enrolledClasses: Array<{ id: string; name: string }>;
  performance: {
    avgGrade: number | null;
    completionRate: number | null;
    submissionsCount: number;
  };
  behavior: {
    avgDistractionIndex: number | null;
    timeOnTaskSeconds: number | null;
  };
  pendingAssignments: Array<{ id: string; title: string; dueDate: string | null }>;
  recentSubmissions: Array<{ id: string; title: string; grade: number | null; submittedAt: string }>;
  aiInsight: {
    ready: boolean;
    message: string;
    submissionsCompleted: number;
  };
};

function StudentsTab({ teacherId }: { teacherId: string }) {
  const [classes, setClasses] = useState<TeacherClass[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [quickGlanceData, setQuickGlanceData] = useState<QuickGlanceData | null>(null);
  const [quickGlanceLoading, setQuickGlanceLoading] = useState(false);

  const fetchClasses = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/teacher/classes?teacherId=${teacherId}`);
      const data = await res.json();
      if (data.classes) setClasses(data.classes);
    } finally {
      setLoading(false);
    }
  }, [teacherId]);

  useEffect(() => { fetchClasses(); }, [fetchClasses]);

  // Flatten and deduplicate students across all classes
  const flatStudents: FlatStudent[] = (() => {
    const map = new Map<string, FlatStudent>();
    for (const cls of classes) {
      for (const s of cls.students) {
        if (map.has(s.id)) {
          const existing = map.get(s.id)!;
          existing.classes.push(cls.name);
          // Aggregate completionRate as average
          if (s.completionRate !== null) {
            const prev = existing.completionRate;
            existing.completionRate = prev !== null
              ? (prev + s.completionRate) / 2
              : s.completionRate;
          }
          // Pick first non-null avgGrade
          if (existing.avgGrade === null && s.avgGrade !== null) {
            existing.avgGrade = s.avgGrade;
          }
        } else {
          map.set(s.id, {
            id: s.id,
            name: s.name,
            email: s.email,
            grade_level: s.grade_level,
            classes: [cls.name],
            avgGrade: s.avgGrade,
            completionRate: s.completionRate,
          });
        }
      }
    }
    return Array.from(map.values());
  })();

  const filtered = flatStudents.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  const openQuickGlance = async (studentId: string) => {
    setSelectedStudentId(studentId);
    setQuickGlanceData(null);
    setQuickGlanceLoading(true);
    try {
      const res = await fetch(`/api/teacher/students/${studentId}/quick-glance?teacherId=${teacherId}`);
      const data = await res.json();
      // Normalize API response to match QuickGlanceData type
      setQuickGlanceData({
        student: data.student,
        enrolledClasses: data.enrolledClasses ?? [],
        performance: {
          avgGrade: data.performance?.avgGrade ?? null,
          completionRate: data.performance?.completionRate ?? null,
          submissionsCount: data.performance?.submittedCount ?? 0,
        },
        behavior: {
          avgDistractionIndex: data.behavior?.avgDistractionIndex ?? null,
          timeOnTaskSeconds: data.behavior?.totalTimeOnTaskSeconds ?? null,
        },
        pendingAssignments: data.performance?.pendingAssignments ?? [],
        recentSubmissions: data.recentSubmissions ?? [],
        aiInsight: {
          ready: data.aiInsight?.ready ?? false,
          message: data.aiInsight?.message ?? '',
          submissionsCompleted: data.performance?.gradedCount ?? 0,
        },
      });
    } finally {
      setQuickGlanceLoading(false);
    }
  };

  const closeModal = () => {
    setSelectedStudentId(null);
    setQuickGlanceData(null);
  };

  const gradeColorClass = (g: number | null) => {
    if (g === null) return 'bg-gray-100 dark:bg-gray-700 text-black dark:text-white';
    if (g >= 80) return 'bg-green-100 text-green-700';
    if (g >= 60) return 'bg-amber-100 text-amber-700';
    return 'bg-red-100 text-red-600';
  };

  const completionColorClass = (r: number | null) => {
    if (r === null) return 'bg-gray-100 dark:bg-gray-700 text-black dark:text-white';
    if (r >= 80) return 'bg-green-100 text-green-700';
    if (r >= 60) return 'bg-amber-100 text-amber-700';
    return 'bg-red-100 text-red-600';
  };

  const distractionColor = (d: number | null) => {
    if (d === null) return 'text-black dark:text-white opacity-50';
    if (d > 7) return 'text-red-600';
    if (d > 4) return 'text-amber-600';
    return 'text-green-600';
  };

  const formatTimeOnTask = (seconds: number | null) => {
    if (seconds === null) return '—';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search students by name..."
        className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-black dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
      />

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
              <th className="text-left px-4 py-3 font-semibold text-black dark:text-white text-xs uppercase">Name</th>
              <th className="text-left px-4 py-3 font-semibold text-black dark:text-white text-xs uppercase">Grade</th>
              <th className="text-left px-4 py-3 font-semibold text-black dark:text-white text-xs uppercase">Classes</th>
              <th className="text-left px-4 py-3 font-semibold text-black dark:text-white text-xs uppercase">Completion</th>
              <th className="text-left px-4 py-3 font-semibold text-black dark:text-white text-xs uppercase">Avg Grade</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-10 text-black dark:text-white opacity-50 italic">
                  {flatStudents.length === 0 ? 'No students in your classes yet.' : 'No students match your search.'}
                </td>
              </tr>
            ) : (
              filtered.map((student) => (
                <tr
                  key={student.id}
                  className="border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                  onClick={() => openQuickGlance(student.id)}
                >
                  <td className="px-4 py-3 font-medium text-black dark:text-white">{student.name}</td>
                  <td className="px-4 py-3">
                    {student.grade_level ? (
                      <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-black dark:text-white rounded text-xs">{student.grade_level}</span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-black dark:text-white text-xs">
                    {student.classes.slice(0, 2).join(', ')}
                    {student.classes.length > 2 && (
                      <span className="text-black dark:text-white opacity-50 ml-1">+{student.classes.length - 2} more</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {student.completionRate !== null ? (
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className="h-1.5 bg-blue-500 rounded-full"
                            style={{ width: `${Math.min(100, student.completionRate)}%` }}
                          />
                        </div>
                        <span className="text-xs text-black dark:text-white">{Math.round(student.completionRate)}%</span>
                      </div>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${gradeColorClass(student.avgGrade)}`}>
                      {student.avgGrade !== null ? Math.round(student.avgGrade) : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={(e) => { e.stopPropagation(); openQuickGlance(student.id); }}
                      className="text-black dark:text-white opacity-50 hover:text-blue-600 dark:hover:text-blue-400 hover:opacity-100 transition-colors text-base"
                      title="Quick Glance"
                    >
                      👁
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Quick Glance Modal */}
      {selectedStudentId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-black/30">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-[520px] max-h-[90vh] overflow-y-auto">
            {quickGlanceLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : quickGlanceData ? (
              <div className="p-6 space-y-5">
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-black dark:text-white">{quickGlanceData.student.name}</h2>
                    {quickGlanceData.student.grade_level && (
                      <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-black dark:text-white rounded text-xs font-medium mt-1 inline-block">
                        {quickGlanceData.student.grade_level}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={closeModal}
                    className="text-black dark:text-white opacity-50 hover:text-black dark:hover:text-white hover:opacity-100 text-xl font-light leading-none"
                  >
                    ×
                  </button>
                </div>

                {/* Enrolled classes */}
                {quickGlanceData.enrolledClasses.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {quickGlanceData.enrolledClasses.map((c) => (
                      <span key={c.id} className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                        {c.name}
                      </span>
                    ))}
                  </div>
                )}

                {/* Performance */}
                <div>
                  <p className="text-xs font-semibold text-black dark:text-white opacity-50 uppercase mb-2">Performance</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-center">
                      <p className={`text-2xl font-bold ${
                        quickGlanceData.performance.avgGrade !== null
                          ? (quickGlanceData.performance.avgGrade >= 80 ? 'text-green-600' : quickGlanceData.performance.avgGrade >= 60 ? 'text-amber-600' : 'text-red-500')
                          : 'text-black dark:text-white opacity-50'
                      }`}>
                        {quickGlanceData.performance.avgGrade !== null ? Math.round(quickGlanceData.performance.avgGrade) : '—'}
                      </p>
                      <p className="text-xs text-black dark:text-white opacity-60 mt-0.5">Avg Grade</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-black dark:text-white">
                        {quickGlanceData.performance.completionRate !== null ? `${Math.round(quickGlanceData.performance.completionRate)}%` : '—'}
                      </p>
                      <p className="text-xs text-black dark:text-white opacity-60 mt-0.5">Completion</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-black dark:text-white">{quickGlanceData.performance.submissionsCount}</p>
                      <p className="text-xs text-black dark:text-white opacity-60 mt-0.5">Submissions</p>
                    </div>
                  </div>
                </div>

                {/* Behavior */}
                <div>
                  <p className="text-xs font-semibold text-black dark:text-white opacity-50 uppercase mb-2">Behavior</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                      <p className={`text-xl font-bold ${distractionColor(quickGlanceData.behavior.avgDistractionIndex)}`}>
                        {quickGlanceData.behavior.avgDistractionIndex !== null ? quickGlanceData.behavior.avgDistractionIndex.toFixed(1) : '—'}
                      </p>
                      <p className="text-xs text-black dark:text-white opacity-60 mt-0.5">Avg Distraction Index</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                      <p className="text-xl font-bold text-black dark:text-white">
                        {formatTimeOnTask(quickGlanceData.behavior.timeOnTaskSeconds)}
                      </p>
                      <p className="text-xs text-black dark:text-white opacity-60 mt-0.5">Time on Task</p>
                    </div>
                  </div>
                </div>

                {/* Pending Assignments */}
                {quickGlanceData.pendingAssignments.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-black dark:text-white opacity-50 uppercase mb-2">Pending Assignments</p>
                    <div className="space-y-1.5">
                      {quickGlanceData.pendingAssignments.map((a) => (
                        <div key={a.id} className="flex items-center justify-between gap-2">
                          <span className="text-sm text-black dark:text-white truncate">{a.title}</span>
                          {a.dueDate && (
                            <span className="px-2 py-0.5 bg-red-50 text-red-600 rounded text-xs shrink-0">
                              Due {new Date(a.dueDate).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent Submissions */}
                {quickGlanceData.recentSubmissions.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-black dark:text-white opacity-50 uppercase mb-2">Recent Submissions</p>
                    <div className="space-y-1.5">
                      {quickGlanceData.recentSubmissions.slice(0, 3).map((sub) => (
                        <div key={sub.id} className="flex items-center justify-between gap-2">
                          <span className="text-sm text-black dark:text-white truncate">{sub.title}</span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${gradeColorClass(sub.grade)}`}>
                              {sub.grade !== null ? Math.round(sub.grade) : '—'}
                            </span>
                            <span className="text-xs text-black dark:text-white opacity-50">
                              {new Date(sub.submittedAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* AI Insight */}
                <div className={`rounded-xl p-4 border ${
                  quickGlanceData.aiInsight.ready
                    ? 'bg-blue-50 border-blue-200'
                    : 'bg-amber-50 border-amber-200'
                }`}>
                  <div className="flex items-start gap-2">
                    <span className="text-xl">🤖</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm leading-relaxed ${
                        quickGlanceData.aiInsight.ready ? 'text-blue-800' : 'text-amber-800'
                      }`}>
                        {quickGlanceData.aiInsight.message}
                      </p>
                      {!quickGlanceData.aiInsight.ready && (
                        <p className="text-xs text-amber-600 mt-1">
                          {quickGlanceData.aiInsight.submissionsCompleted}/10 submissions completed
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="pt-1 border-t border-gray-100 dark:border-gray-700">
                  <a
                    href={`/student/dashboard?studentId=${selectedStudentId}`}
                    className="text-sm font-medium text-blue-600 hover:text-blue-700"
                  >
                    View Full Profile →
                  </a>
                </div>
              </div>
            ) : (
              <div className="p-6 text-center text-black dark:text-white opacity-50 italic">
                <p>Could not load student data.</p>
                <button onClick={closeModal} className="mt-3 text-sm text-blue-600 hover:underline">Close</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// HomeView Component (3-column overview)
// ============================================================

const SLOT_COLORS = [
  'bg-pink-100 text-pink-700 border-pink-200',
  'bg-blue-100 text-blue-700 border-blue-200',
  'bg-amber-100 text-amber-700 border-amber-200',
  'bg-green-100 text-green-700 border-green-200',
  'bg-purple-100 text-purple-700 border-purple-200',
];

function HomeView({ teacherId }: { teacherId: string }) {
  const [classes, setClasses] = useState<TeacherClass[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchClasses = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/teacher/classes?teacherId=${teacherId}`);
      const data = await res.json();
      if (data.classes) setClasses(data.classes);
    } finally {
      setLoading(false);
    }
  }, [teacherId]);

  useEffect(() => { fetchClasses(); }, [fetchClasses]);

  // Flatten unique students from all classes
  const allStudents: ClassStudent[] = (() => {
    const map = new Map<string, ClassStudent & { completionRate: number | null }>();
    for (const cls of classes) {
      for (const s of cls.students) {
        if (!map.has(s.id)) map.set(s.id, s);
      }
    }
    return Array.from(map.values());
  })();

  const totalStudents = allStudents.length;
  const totalActiveAssignments = classes.reduce((sum, c) => sum + c.activeAssignments, 0);

  const completionBadge = (rate: number | null) => {
    if (rate === null) return 'bg-gray-50 dark:bg-gray-800 text-black dark:text-white border-gray-100 dark:border-gray-700';
    if (rate >= 80) return 'bg-green-50 text-green-600 border-green-100';
    if (rate >= 50) return 'bg-amber-50 text-amber-600 border-amber-100';
    return 'bg-red-50 text-red-600 border-red-100';
  };

  return (
    <div className="flex flex-nowrap overflow-x-auto gap-6 pb-4 w-full">

      {/* COLUMN 1: Today's Classes */}
      <section
        className="min-w-[320px] lg:min-w-[340px] flex-1 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-5 flex flex-col"
        style={{ height: 'calc(100vh - 200px)' }}
      >
        <div className="flex items-center justify-between mb-4 border-b border-gray-50 dark:border-gray-700 pb-3">
          <h2 className="font-semibold flex items-center gap-2">
            <Calendar size={18} className="text-black dark:text-white" /> Today's Classes
          </h2>
          <span className="text-xs text-black dark:text-white">{classes.length} classes</span>
        </div>
        <ScrollFade className="pr-2 space-y-4">
          {loading ? (
            <p className="text-sm text-black dark:text-white">Loading...</p>
          ) : classes.length === 0 ? (
            <p className="text-sm text-black dark:text-white italic">No classes yet.</p>
          ) : (
            classes.map((cls, idx) => {
              const color = SLOT_COLORS[idx % SLOT_COLORS.length];
              return (
                <div key={cls.id} className={`rounded-xl border p-4 ${color}`}>
                  <p className="text-xs font-medium mb-1 opacity-70">
                    {cls.period != null ? `Period ${cls.period}` : `Class ${idx + 1}`}
                  </p>
                  <p className="font-semibold text-sm leading-snug">{cls.name}</p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {cls.subject && (
                      <span className="px-2 py-0.5 bg-white/60 rounded-full text-xs font-medium">{cls.subject}</span>
                    )}
                    {cls.grade_level && (
                      <span className="px-2 py-0.5 bg-white/60 rounded-full text-xs font-medium">{cls.grade_level}</span>
                    )}
                    <span className="px-2 py-0.5 bg-white/60 rounded-full text-xs font-medium">{cls.studentCount} students</span>
                  </div>
                </div>
              );
            })
          )}
        </ScrollFade>
      </section>

      {/* COLUMN 2: Students Snapshot */}
      <section
        className="min-w-[300px] lg:min-w-[320px] flex-1 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-5 flex flex-col"
        style={{ height: 'calc(100vh - 200px)' }}
      >
        <div className="flex items-center justify-between mb-4 border-b border-gray-50 dark:border-gray-700 pb-3">
          <h2 className="font-semibold flex items-center gap-2">
            <Users size={18} className="text-black dark:text-white" /> Students Snapshot
          </h2>
          <span className="text-xs text-black dark:text-white">{totalStudents} total</span>
        </div>
        <ScrollFade className="pr-2 space-y-3">
          {loading ? (
            <p className="text-sm text-black dark:text-white">Loading...</p>
          ) : allStudents.length === 0 ? (
            <p className="text-sm text-black dark:text-white italic">No students enrolled yet.</p>
          ) : (
            allStudents.slice(0, 20).map((student) => (
              <div key={student.id} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-semibold shrink-0">
                  {student.name.charAt(0)}
                </div>
                <span className="text-sm text-black dark:text-white flex-1 truncate">{student.name}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${completionBadge(student.completionRate)}`}>
                  {student.completionRate !== null ? `${Math.round(student.completionRate)}%` : '—'}
                </span>
              </div>
            ))
          )}
        </ScrollFade>
      </section>

      {/* COLUMN 3: Recent Activity & Overview */}
      <section
        className="min-w-[300px] lg:min-w-[320px] flex-1 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-5 flex flex-col"
        style={{ height: 'calc(100vh - 200px)' }}
      >
        <div className="flex items-center justify-between mb-4 border-b border-gray-50 dark:border-gray-700 pb-3">
          <h2 className="font-semibold flex items-center gap-2">
            <ChevronRight size={18} className="text-black dark:text-white" /> Activity & Links
          </h2>
        </div>
        <ScrollFade className="pr-2 space-y-4">
          {/* Stats overview */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-black dark:text-white uppercase">Overview</p>
            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-1.5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-lg text-xs font-medium text-black dark:text-white shadow-sm">
                {classes.length} Classes
              </span>
              <span className="px-3 py-1.5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-lg text-xs font-medium text-black dark:text-white shadow-sm">
                {totalStudents} Students
              </span>
              <span className="px-3 py-1.5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-lg text-xs font-medium text-black dark:text-white shadow-sm">
                {totalActiveAssignments} Active Assignments
              </span>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <p className="text-xs font-semibold text-black dark:text-white uppercase mb-3">Quick Links</p>
            <div className="space-y-2">
              <a
                href="/admin/dashboard"
                className="flex items-center justify-between p-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm hover:border-indigo-200 hover:shadow-md transition-all group"
              >
                <span className="text-sm font-medium text-black dark:text-white group-hover:text-indigo-600">Admin Dashboard</span>
                <ChevronRight size={14} className="text-black dark:text-white group-hover:text-indigo-500" />
              </a>
              <a
                href="/admissions/pipeline"
                className="flex items-center justify-between p-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm hover:border-indigo-200 hover:shadow-md transition-all group"
              >
                <span className="text-sm font-medium text-black dark:text-white group-hover:text-indigo-600">Admissions Pipeline</span>
                <ChevronRight size={14} className="text-black dark:text-white group-hover:text-indigo-500" />
              </a>
              <a
                href="/student/dashboard"
                className="flex items-center justify-between p-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm hover:border-indigo-200 hover:shadow-md transition-all group"
              >
                <span className="text-sm font-medium text-black dark:text-white group-hover:text-indigo-600">Student View</span>
                <ChevronRight size={14} className="text-black dark:text-white group-hover:text-indigo-500" />
              </a>
            </div>
          </div>

          {/* Class lesson counts */}
          {classes.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-black dark:text-white uppercase mb-3">Class Summary</p>
              <div className="space-y-2">
                {classes.map((cls) => (
                  <div key={cls.id} className="flex items-center justify-between gap-2">
                    <span className="text-sm text-black dark:text-white truncate">{cls.name}</span>
                    <div className="flex gap-1.5 shrink-0">
                      <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded text-xs font-medium">
                        {cls.lessonCount} lessons
                      </span>
                      {cls.activeAssignments > 0 && (
                        <span className="px-2 py-0.5 bg-amber-50 text-amber-600 rounded text-xs font-medium">
                          {cls.activeAssignments} active
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </ScrollFade>
      </section>
    </div>
  );
}

// ============================================================
// Main Dashboard Page
// ============================================================

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [userId, setUserId] = useState<string | null>(null);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
      } else {
        // For demo: use a test teacher ID
        setUserId('00000000-0000-0000-0000-000000000001');
      }
    };
    getUser();
  }, []);

  const navItems: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'home', label: 'Home', icon: <Home size={16} /> },
    { id: 'classes', label: 'Classes', icon: <BookOpen size={16} /> },
    { id: 'students', label: 'Students', icon: <Users size={16} /> },
    { id: 'curriculum', label: 'Curriculum', icon: <GraduationCap size={16} /> },
    { id: 'communications', label: 'Communicate', icon: <MessageSquare size={16} /> },
    { id: 'erp', label: 'ERP', icon: <Settings size={16} /> },
  ];

  return (
    <div className="min-h-screen bg-[#FDFDFD] dark:bg-gray-950 font-sans">
      {/* Top Navigation */}
      <nav className="flex items-center justify-between px-6 py-3 border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-950 sticky top-0 z-10">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-black rounded-tr-xl rounded-bl-xl rotate-45" />
          <span className="font-bold text-lg tracking-wider ml-2">NICODEMUS AI</span>
        </div>

        {/* Nav links */}
        <div className="hidden md:flex items-center gap-6 text-sm font-medium text-black dark:text-white">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-1.5 transition-colors ${
                activeTab === item.id
                  ? 'text-black dark:text-white border-b-2 border-black dark:border-white pb-1'
                  : 'hover:text-black dark:hover:text-white'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-4">
          <button className="text-black dark:text-white hover:text-black dark:hover:text-white transition-colors">
            <Search size={18} />
          </button>
          <button className="relative text-black dark:text-white hover:text-black dark:hover:text-white transition-colors">
            <Bell size={18} />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />
          </button>
          <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-black dark:text-white font-semibold text-sm">
            T
          </div>
          <button
            onClick={() => setIsAiModalOpen(true)}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <Mic size={14} /> Nicodemus AI
          </button>
        </div>
      </nav>

      {/* Main content */}
      <main className="max-w-[1600px] mx-auto p-4 md:p-6">
        {/* Page header */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-black dark:text-white font-semibold text-lg">
              T
            </div>
            <div>
              <h1 className="font-semibold text-lg">Teacher's Dashboard</h1>
              <p className="text-xs text-black dark:text-white">Educator View</p>
            </div>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'home' && userId && (
          <HomeView teacherId={userId} />
        )}
        {activeTab === 'classes' && userId && (
          <div className="space-y-6">
            <ClassesTab teacherId={userId} />
          </div>
        )}
        {activeTab === 'students' && userId && (
          <div className="space-y-6">
            <StudentsTab teacherId={userId} />
          </div>
        )}
        {activeTab === 'curriculum' && userId && (
          <div className="space-y-6">
            <CurriculumTab teacherId={userId} />
          </div>
        )}
        {activeTab === 'communications' && userId && (
          <div className="space-y-6">
            <CommunicationsTab teacherId={userId} />
          </div>
        )}
        {activeTab === 'erp' && userId && (
          <div className="space-y-6">
            <ERPTab teacherId={userId} />
          </div>
        )}
      </main>

      {/* AI Modal */}
      {isAiModalOpen && <NicodemusAiModal onClose={() => setIsAiModalOpen(false)} />}
    </div>
  );
}
