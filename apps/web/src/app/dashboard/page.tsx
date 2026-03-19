'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { CurriculumTab } from '@/components/curriculum-tab';

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

type Tab = 'curriculum' | 'communications' | 'erp';

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
          <h2 className="text-xl font-semibold text-neutral-800 dark:text-neutral-200">Parent Communications</h2>
          <p className="text-sm text-neutral-500 mt-0.5">AI drafts parent emails — you review and approve before anything is sent.</p>
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
                className="w-full p-2 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Notification Type</label>
              <select
                value={draftForm.notificationType}
                onChange={e => setDraftForm({ ...draftForm, notificationType: e.target.value })}
                className="w-full p-2 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900"
              >
                <option value="progress">Progress Update</option>
                <option value="alert">Concern / Alert</option>
                <option value="milestone">Milestone / Achievement</option>
                <option value="manual">General Message</option>
              </select>
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-sm font-medium">
                Details <span className="text-neutral-400 font-normal">(JSON or plain text — Claude will use this)</span>
              </label>
              <textarea
                value={draftForm.details}
                onChange={e => setDraftForm({ ...draftForm, details: e.target.value })}
                placeholder={'e.g. {"grade": "B+", "improvement": "algebra skills", "concern": "missing homework"}'}
                rows={3}
                className="w-full p-2 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 font-mono text-xs"
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
                className="px-4 py-2.5 border border-neutral-300 dark:border-neutral-700 rounded-lg text-sm transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Pending Drafts */}
      <section className="bg-white dark:bg-neutral-900 p-6 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="font-semibold text-neutral-800 dark:text-neutral-200">Pending Your Review</h3>
          {drafts.length > 0 && (
            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-semibold">
              {drafts.length}
            </span>
          )}
        </div>

        {loadingComms ? (
          <p className="text-sm text-neutral-400">Loading...</p>
        ) : drafts.length === 0 ? (
          <p className="text-sm text-neutral-400 italic">No drafts awaiting review.</p>
        ) : (
          <div className="space-y-4">
            {drafts.map((notif) => (
              <div key={notif.id} className="border border-amber-200 dark:border-amber-800 rounded-lg p-4 bg-amber-50 dark:bg-amber-900/10">
                <div className="flex justify-between items-start gap-2 mb-2">
                  <div>
                    <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                      {typeLabels[notif.type] ?? notif.type}
                    </span>
                    <h4 className="font-semibold text-neutral-800 dark:text-neutral-200 mt-0.5">{notif.subject}</h4>
                  </div>
                  <span className="text-xs text-neutral-400 whitespace-nowrap">
                    {new Date(notif.created_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4 leading-relaxed">{notif.body}</p>
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
                    className="px-4 py-1.5 border border-neutral-300 dark:border-neutral-700 text-sm rounded-md font-medium transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50"
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
        <section className="bg-white dark:bg-neutral-900 p-6 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
          <h3 className="font-semibold text-neutral-800 dark:text-neutral-200 mb-4">Recently Sent (30 days)</h3>
          <div className="space-y-2">
            {history.map((notif) => (
              <div key={notif.id} className="flex justify-between items-center py-2 border-b border-neutral-100 dark:border-neutral-800 last:border-0">
                <div>
                  <span className="text-xs text-neutral-400 mr-2">{typeLabels[notif.type] ?? notif.type}</span>
                  <span className="text-sm text-neutral-700 dark:text-neutral-300">{notif.subject}</span>
                </div>
                <span className="text-xs text-neutral-400">
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
    <section className="bg-white dark:bg-neutral-900 p-6 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <h3 className="font-semibold text-neutral-800 dark:text-neutral-200">📋 Student Reviews</h3>
        {tasks.length > 0 && (
          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">{tasks.length} pending</span>
        )}
        <button onClick={fetchTasks} className="ml-auto text-xs text-neutral-400 hover:text-neutral-600">↻ Refresh</button>
      </div>

      {successMsg && (
        <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-sm text-green-700 dark:text-green-300">
          ✅ {successMsg}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-neutral-400">Loading...</p>
      ) : tasks.length === 0 ? (
        <p className="text-sm text-neutral-400 italic">No reviews pending. Homework submissions and study sessions will appear here.</p>
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
                      <span className="text-xs text-neutral-400">{new Date(task.created_at).toLocaleString()}</span>
                    </div>
                    {isHomework && sub ? (
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <span className="font-semibold text-neutral-800 dark:text-neutral-100 text-sm">{sub.assignments?.title ?? 'Homework'}</span>
                        {sub.assignments?.subject && <span className="text-xs text-neutral-400">· {sub.assignments.subject}</span>}
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
                        <span className="text-xs text-neutral-500">Focus Score</span>
                        <span className="text-xs text-neutral-400">· {m.dominant_tab_category}</span>
                        {m.struggle_events_count > 0 && (
                          <span className="text-xs text-amber-600">⚠️ {m.struggle_events_count} struggles</span>
                        )}
                      </div>
                    ) : null}
                  </div>
                  <span className="text-neutral-400 text-sm">{isExpanded ? '▲' : '▼'}</span>
                </div>

                {/* ── Expanded panel ── */}
                {isExpanded && (
                  <div className={`border-t p-5 space-y-5 ${isHomework ? 'border-purple-100 dark:border-purple-900 bg-purple-50/50 dark:bg-purple-900/5' : 'border-blue-100 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-900/5'}`}>

                    {/* ── HOMEWORK review panel ── */}
                    {isHomework && sub && (
                      <>
                        {/* AI pre-grade reference */}
                        {sub.ai_grade != null && (
                          <div className="p-3 bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 space-y-2">
                            <div className="flex items-center gap-4">
                              <div>
                                <p className="text-xs text-neutral-400 uppercase font-medium">AI Suggested Grade</p>
                                <p className={`text-2xl font-bold ${gradeColor(sub.ai_grade)}`}>
                                  {Math.round(sub.ai_grade)}<span className="text-sm font-normal text-neutral-400">/{sub.assignments?.points_possible ?? 100}</span>
                                </p>
                              </div>
                              {sub.ai_feedback && (
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs text-neutral-400 uppercase font-medium mb-1">AI Summary</p>
                                  {/* Show first 2 sentences as a concise summary */}
                                  <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
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
                                <div className={`space-y-1 pt-1 border-t border-neutral-100 dark:border-neutral-700 ${expandedAIFeedback.has(task.id) ? '' : 'hidden'}`}>
                                  {extras.map((s, i) => (
                                    <p key={i} className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed pl-3 border-l-2 border-purple-200 dark:border-purple-800">
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
                            <p className="text-xs font-semibold text-neutral-500 uppercase">Review Each Answer</p>
                            {questions.map((q, i) => (
                              <div key={q.id} className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-4 space-y-3">
                                {/* Question header */}
                                <div className="flex justify-between items-start gap-2 pb-2 border-b border-neutral-200 dark:border-neutral-700">
                                  <p className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
                                    <span className="text-neutral-400 mr-1">{i + 1}.</span>{q.prompt}
                                  </p>
                                  <span className="text-xs text-neutral-400 shrink-0 font-semibold">{q.points} pts</span>
                                </div>

                                {/* Student's answer - prominent display */}
                                <div className="bg-blue-50 dark:bg-blue-900/10 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
                                  <p className="text-xs text-blue-600 dark:text-blue-400 uppercase font-medium mb-1">Student's Answer</p>
                                  <p className="text-sm text-neutral-800 dark:text-neutral-200 leading-relaxed whitespace-pre-wrap">
                                    {answers[q.id] || <span className="text-neutral-400 italic">(no answer provided)</span>}
                                  </p>
                                </div>

                                {/* Feedback and score */}
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <label className="text-xs text-neutral-400 uppercase font-medium block mb-1">
                                      Your Feedback <span className="text-neutral-300">(optional)</span>
                                    </label>
                                    <textarea
                                      value={perAnswerFeedback[task.id]?.[q.id] ?? ''}
                                      onChange={(e) => setPerAnswerFeedback({
                                        ...perAnswerFeedback,
                                        [task.id]: { ...(perAnswerFeedback[task.id] ?? {}), [q.id]: e.target.value },
                                      })}
                                      placeholder="e.g. Great reasoning, but missing the key formula..."
                                      rows={3}
                                      className="w-full p-2 text-sm rounded-md border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 resize-none focus:outline-none focus:ring-1 focus:ring-purple-400"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-xs text-neutral-400 uppercase font-medium block mb-1">Score</label>
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
                                        className="w-full p-2 text-sm rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 focus:outline-none focus:ring-1 focus:ring-purple-400 text-center"
                                      />
                                      <span className="text-xs text-neutral-400 font-medium shrink-0">/ {q.points}</span>
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
                                    {sub.ai_grade != null ? Math.round(sub.ai_grade) : '—'}<span className="text-xs font-normal text-neutral-400">/{sub.assignments?.points_possible ?? 100}</span>
                                  </p>
                                </div>
                                <div className={`rounded-lg p-3 border ${calculatedGrade !== null ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800' : 'bg-neutral-50 dark:bg-neutral-900/20 border-neutral-200 dark:border-neutral-800'}`}>
                                  <p className={`text-xs uppercase font-medium mb-0.5 ${calculatedGrade !== null ? 'text-purple-600 dark:text-purple-400' : 'text-neutral-400'}`}>Final Grade</p>
                                  <p className={`text-xl font-bold ${calculatedGrade !== null ? gradeColor(calculatedGrade) : 'text-neutral-400'}`}>
                                    {calculatedGrade !== null ? Math.round(calculatedGrade) : '—'}<span className="text-xs font-normal text-neutral-400">/{sub.assignments?.points_possible ?? 100}</span>
                                  </p>
                                </div>
                              </div>
                              {/* Overall notes */}
                              <div>
                                <label className="text-xs font-medium text-neutral-500 uppercase block mb-1">Overall Notes</label>
                                <textarea
                                  value={overallNotes[task.id] ?? ''}
                                  onChange={(e) => setOverallNotes({ ...overallNotes, [task.id]: e.target.value })}
                                  placeholder="Add an overall note for the student..."
                                  rows={2}
                                  className="w-full p-2 text-sm rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 resize-none focus:outline-none focus:ring-1 focus:ring-purple-400"
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
                            className="px-4 py-2 border border-neutral-300 dark:border-neutral-700 text-sm rounded-md font-medium transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50"
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
                          <div className="bg-white dark:bg-neutral-800 rounded-lg p-3">
                            <div className="text-lg font-bold text-neutral-800 dark:text-neutral-100">{m.avg_keystrokes_per_minute}</div>
                            <div className="text-xs text-neutral-500">KPM</div>
                          </div>
                          <div className="bg-white dark:bg-neutral-800 rounded-lg p-3">
                            <div className="text-lg font-bold text-neutral-800 dark:text-neutral-100">{m.avg_idle_seconds}s</div>
                            <div className="text-xs text-neutral-500">Avg Idle</div>
                          </div>
                          <div className="bg-white dark:bg-neutral-800 rounded-lg p-3">
                            <div className="text-lg font-bold text-neutral-800 dark:text-neutral-100">{m.total_tab_switches}</div>
                            <div className="text-xs text-neutral-500">Tab Switches</div>
                          </div>
                        </div>

                        {summary?.recommendations && (
                          <div>
                            <p className="text-xs font-medium text-neutral-500 uppercase mb-1">AI Recommendations</p>
                            <ul className="space-y-1">
                              {(summary.recommendations as string[]).map((r, i) => (
                                <li key={i} className="text-sm text-neutral-700 dark:text-neutral-300">• {r}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        <div>
                          <label className="text-xs font-medium text-neutral-500 uppercase block mb-1">Your Notes (optional)</label>
                          <textarea
                            value={studyNotes[task.id] || ''}
                            onChange={(e) => setStudyNotes({ ...studyNotes, [task.id]: e.target.value })}
                            placeholder="Add a note for the parent email..."
                            rows={2}
                            className="w-full p-2 text-sm rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900"
                          />
                        </div>

                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={sendToParents[task.id] ?? false}
                            onChange={(e) => setSendToParents({ ...sendToParents, [task.id]: e.target.checked })}
                            className="w-4 h-4 rounded"
                          />
                          <span className="text-sm text-neutral-700 dark:text-neutral-300">
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
                            className="px-4 py-2 border border-neutral-300 dark:border-neutral-700 text-sm rounded-md font-medium transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50"
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
          <h2 className="text-xl font-semibold text-neutral-800 dark:text-neutral-200">Substitute Management</h2>
          <p className="text-sm text-neutral-500 mt-0.5">Log absences and manage substitute assignments</p>
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
                  className="w-full p-2 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium">Reason</label>
                <select
                  value={absenceForm.reason}
                  onChange={e => setAbsenceForm({ ...absenceForm, reason: e.target.value })}
                  className="w-full p-2 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900"
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
                  className="w-full p-2 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium">End Date</label>
                <input
                  type="date"
                  value={absenceForm.dateEnd}
                  onChange={e => setAbsenceForm({ ...absenceForm, dateEnd: e.target.value })}
                  className="w-full p-2 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900"
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
                className="w-full p-2 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Materials Available</label>
              <input
                value={absenceForm.materialsAvailable}
                onChange={e => setAbsenceForm({ ...absenceForm, materialsAvailable: e.target.value })}
                placeholder="e.g. textbooks, markers, projector (comma-separated)"
                className="w-full p-2 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Special Instructions</label>
              <textarea
                value={absenceForm.specialInstructions}
                onChange={e => setAbsenceForm({ ...absenceForm, specialInstructions: e.target.value })}
                placeholder="e.g. seating chart, behavioral notes, etc."
                rows={2}
                className="w-full p-2 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900"
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
                className="px-4 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg text-sm transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="bg-white dark:bg-neutral-900 p-6 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
        <h3 className="font-semibold text-neutral-800 dark:text-neutral-200 mb-4">Your Absences</h3>
        {loadingERP ? (
          <p className="text-sm text-neutral-400">Loading...</p>
        ) : absences.length === 0 ? (
          <p className="text-sm text-neutral-400 italic">No absences logged.</p>
        ) : (
          <div className="space-y-3">
            {absences.map(absence => (
              <div key={absence.id} className="border border-neutral-200 dark:border-neutral-700 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase">{absence.reason}</span>
                    <p className="font-semibold text-neutral-800 dark:text-neutral-200 mt-1">
                      {absence.date_start} to {absence.date_end}
                    </p>
                    <p className="text-sm text-neutral-500">
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
// Main Dashboard Page
// ============================================================

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('curriculum');
  const [userId, setUserId] = useState<string | null>(null);

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

  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: 'curriculum', label: 'Curriculum' },
    { id: 'communications', label: 'Communications' },
    { id: 'erp', label: 'ERP' },
  ];

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <header className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">Nicodemus Dashboard</h1>
            <p className="text-neutral-500">Teacher AI Suite — Phase 1a + 1b</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">Phase 1a ✓</span>
            <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">Phase 1b Active</span>
          </div>
        </header>

        {/* Tabs */}
        <nav className="flex border-b border-neutral-200 dark:border-neutral-800">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
              }`}
            >
              {tab.label}
              {tab.badge ? (
                <span className="ml-2 px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs">{tab.badge}</span>
              ) : null}
            </button>
          ))}
        </nav>

        {/* Tab Content */}
        {activeTab === 'curriculum' && userId && (
          <CurriculumTab teacherId={userId} />
        )}

        {activeTab === 'communications' && userId && (
          <CommunicationsTab teacherId={userId} />
        )}

        {activeTab === 'erp' && userId && (
          <ERPTab teacherId={userId} />
        )}
      </div>
    </div>
  );
}
