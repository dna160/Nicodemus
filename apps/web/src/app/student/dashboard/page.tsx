'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

// ============================================================
// Types
// ============================================================

type HomeworkItem = {
  id: string;
  title: string;
  description: string;
  subject: string;
  due_at: string;
  days_until_due: number;
  points_possible: number;
  is_overdue: boolean;
  submission: {
    id: string;
    status: string;
    ai_grade: number | null;
    final_grade: number | null;
    submitted_at: string;
  } | null;
};

type PerAnswerFeedbackItem = {
  questionId: string;
  questionPrompt: string;
  answer: string;
  teacher_feedback: string;
  ai_feedback: string | null;
};

type Question = {
  id: string;
  prompt: string;
  type: string;
  points: number;
};

type AssignmentDetail = {
  id: string;
  title: string;
  description: string;
  subject: string;
  due_at: string;
  points_possible: number;
  content: { questions: Question[] };
  rubric: Record<string, any>;
};

// ============================================================
// Homework List Component
// ============================================================

function HomeworkList({
  studentId,
  onOpen,
}: {
  studentId: string;
  onOpen: (id: string) => void;
}) {
  const [items, setItems] = useState<HomeworkItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'pending' | 'graded' | 'all'>('pending');

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await window.fetch(`/api/student/homework?studentId=${studentId}`);
      const data = await res.json();
      if (data.success) setItems(data.assignments);
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => { fetch(); }, [fetch]);

  const filtered = items.filter((item) => {
    if (filter === 'pending') return !item.submission || item.submission.status !== 'graded';
    if (filter === 'graded') return item.submission?.status === 'graded';
    return true;
  });

  const dueBadge = (item: HomeworkItem) => {
    if (item.submission?.status === 'graded') {
      const g = item.submission.final_grade ?? item.submission.ai_grade;
      const color = g != null && g >= 70 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700';
      return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${color}`}>{g != null ? `${Math.round(g)}/100` : 'Graded'}</span>;
    }
    if (item.submission?.status === 'pending_review') {
      return <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-xs font-semibold">Under Review</span>;
    }
    if (item.submission?.status === 'grading') {
      return <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">Grading...</span>;
    }
    if (item.submission) {
      return <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-semibold">Submitted</span>;
    }
    if (item.is_overdue) {
      return <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-semibold">Overdue</span>;
    }
    if (item.days_until_due <= 2) {
      return <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-semibold">Due soon</span>;
    }
    return <span className="px-2 py-0.5 bg-neutral-100 text-neutral-600 rounded-full text-xs font-semibold">{item.days_until_due}d left</span>;
  };

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex gap-1 border-b border-neutral-200 dark:border-neutral-800">
        {(['pending', 'graded', 'all'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize ${
              filter === f
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
          >
            {f === 'pending' ? 'To Do' : f === 'graded' ? 'Completed' : 'All'}
          </button>
        ))}
        <button onClick={fetch} className="ml-auto text-xs text-neutral-400 hover:text-neutral-600 px-2">↻</button>
      </div>

      {loading ? (
        <p className="text-sm text-neutral-400">Loading homework...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-4xl mb-3">🎉</p>
          <p className="text-neutral-500 text-sm">
            {filter === 'pending' ? 'No pending homework!' : 'No homework here.'}
          </p>
          <p className="text-neutral-400 text-xs mt-1">New assignments appear here when your teacher creates a curriculum.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 hover:border-blue-300 dark:hover:border-blue-700 transition-colors cursor-pointer shadow-sm"
              onClick={() => onOpen(item.id)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    {item.subject && (
                      <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs font-medium">
                        {item.subject}
                      </span>
                    )}
                    {dueBadge(item)}
                  </div>
                  <h3 className="font-semibold text-neutral-800 dark:text-neutral-100">{item.title}</h3>
                  {item.description && (
                    <p className="text-sm text-neutral-500 mt-0.5 line-clamp-2">{item.description}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-neutral-400">Due</p>
                  <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    {new Date(item.due_at).toLocaleDateString()}
                  </p>
                  <p className="text-xs text-neutral-400 mt-0.5">{item.points_possible} pts</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Homework Detail + Submission Component
// ============================================================

function HomeworkDetail({
  assignmentId,
  studentId,
  onBack,
}: {
  assignmentId: string;
  studentId: string;
  onBack: () => void;
}) {
  const [assignment, setAssignment] = useState<AssignmentDetail | null>(null);
  const [submission, setSubmission] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    grade: number | null;
    feedback: string;
    teacherNotes: string;
    next_steps: string;
    per_answer_feedback: PerAnswerFeedbackItem[];
  } | null>(null);
  const [pendingReview, setPendingReview] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const res = await window.fetch(`/api/student/homework/${assignmentId}?studentId=${studentId}`);
      const data = await res.json();
      if (data.success) {
        setAssignment(data.assignment);
        setSubmission(data.submission);
        if (data.submission?.content) {
          setAnswers(data.submission.content);
        }
        const status = data.submission?.submission_status;
        if (status === 'graded') {
          // Parse overall_feedback which may be JSON or string
          let overallFeedbackText = '';
          let teacherNotes = '';
          try {
            const parsed = JSON.parse(data.submission.overall_feedback || '{}');
            if (typeof parsed === 'object' && parsed.ai_synthesis) {
              overallFeedbackText = parsed.ai_synthesis || '';
              teacherNotes = parsed.teacher_notes || '';
            } else {
              overallFeedbackText = data.submission.overall_feedback || data.submission.ai_feedback || data.submission.feedback || '';
            }
          } catch {
            overallFeedbackText = data.submission.overall_feedback || data.submission.ai_feedback || data.submission.feedback || '';
          }

          setResult({
            grade: data.submission.final_grade ?? data.submission.teacher_grade ?? data.submission.ai_grade ?? data.submission.grade,
            feedback: overallFeedbackText,
            teacherNotes: teacherNotes,
            next_steps: data.submission.ai_next_steps ?? '',
            per_answer_feedback: data.submission.per_answer_feedback ?? [],
          });
        } else if (status === 'pending_review' || status === 'grading') {
          setPendingReview(true);
        }
      }
      setLoading(false);
    };
    load();
  }, [assignmentId, studentId]);

  const handleSubmit = async () => {
    if (!assignment) return;
    setSubmitting(true);
    try {
      const res = await window.fetch(`/api/student/homework/${assignmentId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, answers }),
      });
      const data = await res.json();
      if (data.success) {
        // Submission accepted — awaiting teacher review
        setPendingReview(true);
      } else {
        alert('Submission failed: ' + data.error);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const allAnswered = assignment?.content?.questions?.every((q) => (answers[q.id] ?? '').trim().length > 0) ?? false;

  if (loading) {
    return <div className="text-center py-12 text-neutral-400">Loading assignment...</div>;
  }

  if (!assignment) {
    return <div className="text-center py-12 text-neutral-400">Assignment not found.</div>;
  }

  const gradeColor = (g: number) => g >= 80 ? 'text-green-600' : g >= 60 ? 'text-amber-600' : 'text-red-500';

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-800 transition-colors"
      >
        ← Back to Homework
      </button>

      {/* Header */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            {assignment.subject && (
              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">{assignment.subject}</span>
            )}
            <h2 className="text-xl font-bold text-neutral-800 dark:text-neutral-100 mt-2">{assignment.title}</h2>
            {assignment.description && (
              <p className="text-neutral-500 mt-1 text-sm">{assignment.description}</p>
            )}
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs text-neutral-400">Due</p>
            <p className="text-sm font-semibold">{new Date(assignment.due_at).toLocaleDateString()}</p>
            <p className="text-xs text-neutral-400 mt-1">{assignment.points_possible} points</p>
          </div>
        </div>
      </div>

      {/* Pending review state */}
      {pendingReview && !result && (
        <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-200 dark:border-indigo-800 p-6 shadow-sm text-center space-y-3">
          <p className="text-3xl">📬</p>
          <h3 className="font-semibold text-indigo-800 dark:text-indigo-300">Submitted — Under Teacher Review</h3>
          <p className="text-sm text-indigo-600 dark:text-indigo-400">
            Your homework has been submitted and is being reviewed by your teacher.
            Your grade and feedback will appear here once they complete the review.
          </p>
        </div>
      )}

      {/* Grade result */}
      {result ? (
        <div className="space-y-4">
          {/* Grade summary card */}
          <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-6 shadow-sm space-y-4">
            <h3 className="font-semibold text-neutral-800 dark:text-neutral-200">📊 Your Results</h3>

            {result.grade != null && (
              <div className="flex items-center gap-4">
                <div className={`text-5xl font-bold ${gradeColor(result.grade)}`}>{Math.round(result.grade)}</div>
                <div>
                  <p className="text-sm text-neutral-500">out of {assignment.points_possible} points</p>
                  <p className={`text-sm font-medium ${gradeColor(result.grade)}`}>
                    {result.grade >= 90 ? 'Excellent work!' : result.grade >= 75 ? 'Good job!' : result.grade >= 60 ? 'Keep pushing!' : 'Room to grow!'}
                  </p>
                </div>
              </div>
            )}

            {/* Teacher notes - concise */}
            {result.teacherNotes && (
              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                <p className="text-xs font-medium text-amber-700 dark:text-amber-400 uppercase mb-1">📝 Teacher's Note</p>
                <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">{result.teacherNotes}</p>
              </div>
            )}

            {/* Encouraging closing message */}
            {result.grade != null && (
              <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                <p className="text-sm text-green-800 dark:text-green-300 leading-relaxed">
                  {result.grade >= 90
                    ? '🌟 Outstanding! You have a strong grasp of this material. Keep up the excellent work!'
                    : result.grade >= 75
                    ? '👍 Great effort! Review the feedback on each answer to sharpen your understanding even further.'
                    : result.grade >= 60
                    ? '💪 You\'re on the right track! Focus on the improvement tips below — you\'ve got this.'
                    : '📚 Don\'t get discouraged! Every expert was once a beginner. Read each tip carefully and try again.'}
                </p>
              </div>
            )}
          </div>

          {/* Per-answer feedback — AI insight integrated into each question */}
          {result.per_answer_feedback.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-neutral-700 dark:text-neutral-300 text-sm uppercase tracking-wide">
                💬 Question Feedback
              </h3>
              {result.per_answer_feedback.map((item, i) => (
                <div
                  key={item.questionId}
                  className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-4 shadow-sm space-y-3"
                >
                  {/* Question */}
                  <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                    <span className="text-neutral-400 mr-1">{i + 1}.</span>{item.questionPrompt}
                  </p>

                  {/* Your answer */}
                  <div className="pl-3 border-l-2 border-neutral-200 dark:border-neutral-700">
                    <p className="text-xs text-neutral-400 uppercase font-medium mb-0.5">Your Answer</p>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400 italic whitespace-pre-wrap">{item.answer}</p>
                  </div>

                  {/* Feedback row — teacher + AI side by side when both present */}
                  {(item.teacher_feedback || item.ai_feedback) && (
                    <div className={`grid gap-2 ${item.teacher_feedback && item.ai_feedback ? 'grid-cols-2' : 'grid-cols-1'}`}>
                      {item.teacher_feedback && (
                        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-2.5">
                          <p className="text-xs font-medium text-amber-700 dark:text-amber-400 uppercase mb-1">Teacher</p>
                          <p className="text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed">{item.teacher_feedback}</p>
                        </div>
                      )}
                      {item.ai_feedback && (
                        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-2.5">
                          <p className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase mb-1">💡 What to Improve</p>
                          <p className="text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed">
                            {/* Show only the most actionable part — first 2 sentences */}
                            {item.ai_feedback.split(/(?<=[.!?])\s+/).slice(0, 2).join(' ')}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : !pendingReview ? (
        /* Questions form */
        <div className="space-y-4">
          {assignment.content?.questions?.map((q, i) => (
            <div
              key={q.id}
              className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-5 shadow-sm"
            >
              <div className="flex justify-between items-start mb-3">
                <p className="font-medium text-neutral-800 dark:text-neutral-200">
                  <span className="text-neutral-400 mr-2">{i + 1}.</span>{q.prompt}
                </p>
                <span className="text-xs text-neutral-400 shrink-0 ml-2">{q.points} pts</span>
              </div>
              <textarea
                value={answers[q.id] ?? ''}
                onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                placeholder={q.type === 'essay' ? 'Write your answer here...' : 'Your answer...'}
                rows={q.type === 'essay' ? 5 : 2}
                disabled={!!submission && (submission.submission_status === 'graded' || submission.submission_status === 'pending_review')}
                className="w-full p-3 text-sm rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
              />
            </div>
          ))}

          <button
            onClick={handleSubmit}
            disabled={!allAnswered || submitting}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? '⏳ Submitting...' : '✓ Submit Homework'}
          </button>

          {!allAnswered && (
            <p className="text-xs text-center text-neutral-400">Answer all questions to submit.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

// ============================================================
// Main Student Dashboard Page
// ============================================================

export default function StudentDashboard() {
  const [studentId, setStudentId] = useState<string | null>(null);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setStudentId(user.id);
      } else {
        // Demo fallback — use first student in DB or a test ID
        setStudentId('00000000-0000-0000-0000-000000000002');
      }
    };
    getUser();
  }, []);

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 p-6 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <header className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
              My Homework
            </h1>
            <p className="text-neutral-500 text-sm mt-0.5">Complete assignments and get instant AI feedback</p>
          </div>
          <a
            href="/dashboard"
            className="text-xs text-neutral-400 hover:text-neutral-600 transition-colors"
          >
            Teacher Dashboard →
          </a>
        </header>

        {/* Content */}
        {studentId && (
          selectedAssignmentId ? (
            <HomeworkDetail
              assignmentId={selectedAssignmentId}
              studentId={studentId}
              onBack={() => setSelectedAssignmentId(null)}
            />
          ) : (
            <HomeworkList
              studentId={studentId}
              onOpen={(id) => setSelectedAssignmentId(id)}
            />
          )
        )}
      </div>
    </div>
  );
}
