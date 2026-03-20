'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { DOCUMENT_TYPE_LABELS, type DocumentType } from 'shared';
import { DocumentUploadForm } from '@/components/document-upload-form';
import { NotificationDropdown } from '@/components/notification-dropdown';
import { SearchModal } from '@/components/search-modal';
import {
  Home, BookOpen, BarChart2, FileText, Bell,
  Search, Mic, ChevronRight, CheckSquare,
} from 'lucide-react';

const SLOT_COLORS = [
  'bg-indigo-50 border-indigo-200 text-indigo-900',
  'bg-emerald-50 border-emerald-200 text-emerald-900',
  'bg-amber-50 border-amber-200 text-amber-900',
  'bg-purple-50 border-purple-200 text-purple-900',
  'bg-rose-50 border-rose-200 text-rose-900',
  'bg-cyan-50 border-cyan-200 text-cyan-900',
];

// ─── Demo mode (shown when no auth session) ───────────────────
const DEMO_STUDENT_ID = 'demo';

const DEMO_PROFILE: StudentProfile = {
  id: DEMO_STUDENT_ID,
  name: 'Alex Johnson',
  email: 'alex.johnson@nicodemus.school',
  grade_level: '10',
  enrollment_date: '2024-09-01T00:00:00Z',
  school_name: 'Nicodemus Academy',
  avg_grade: 84,
  graded_count: 4,
  pending_homework: 3,
};

const _now = Date.now();
const DEMO_HOMEWORK: HomeworkItem[] = [
  {
    id: 'demo-hw-1',
    title: 'Quadratic Equations – Problem Set 7',
    description: 'Solve exercises 1–20 using the quadratic formula and factoring.',
    subject: 'Mathematics',
    due_at: new Date(_now + 2 * 86400000).toISOString(),
    days_until_due: 2,
    points_possible: 100,
    is_overdue: false,
    submission: null,
  },
  {
    id: 'demo-hw-2',
    title: 'World War II – Causes & Effects Essay',
    description: 'Write a 500-word essay examining the causes and long-term effects of WWII.',
    subject: 'History',
    due_at: new Date(_now + 5 * 86400000).toISOString(),
    days_until_due: 5,
    points_possible: 100,
    is_overdue: false,
    submission: null,
  },
  {
    id: 'demo-hw-3',
    title: 'Photosynthesis Lab Report',
    description: 'Complete the lab report from Tuesday\'s photosynthesis experiment.',
    subject: 'Biology',
    due_at: new Date(_now - 1 * 86400000).toISOString(),
    days_until_due: -1,
    points_possible: 50,
    is_overdue: true,
    submission: null,
  },
  {
    id: 'demo-hw-4',
    title: 'Sonnet 18 – PEEL Paragraph Analysis',
    description: 'Analyse Shakespeare\'s Sonnet 18 using the PEEL structure.',
    subject: 'English Literature',
    due_at: new Date(_now - 5 * 86400000).toISOString(),
    days_until_due: -5,
    points_possible: 100,
    is_overdue: false,
    submission: { id: 'demo-sub-4', status: 'graded', ai_grade: 88, final_grade: 88, submitted_at: new Date(_now - 6 * 86400000).toISOString() },
  },
  {
    id: 'demo-hw-5',
    title: 'Ionic & Covalent Bonds Worksheet',
    description: 'Complete exercises 1–20 on ionic and covalent bonding.',
    subject: 'Chemistry',
    due_at: new Date(_now - 10 * 86400000).toISOString(),
    days_until_due: -10,
    points_possible: 100,
    is_overdue: false,
    submission: { id: 'demo-sub-5', status: 'graded', ai_grade: 76, final_grade: 76, submitted_at: new Date(_now - 11 * 86400000).toISOString() },
  },
  {
    id: 'demo-hw-6',
    title: 'Spanish Verb Conjugation – Present & Past',
    description: 'Conjugate the 30 provided verbs in present and past tenses.',
    subject: 'Spanish',
    due_at: new Date(_now - 3 * 86400000).toISOString(),
    days_until_due: -3,
    points_possible: 100,
    is_overdue: false,
    submission: { id: 'demo-sub-6', status: 'pending_review', ai_grade: null, final_grade: null, submitted_at: new Date(_now - 3 * 86400000).toISOString() },
  },
  {
    id: 'demo-hw-7',
    title: 'Pythagorean Theorem – 15 Problems',
    description: 'Solve all 15 problems using the Pythagorean theorem.',
    subject: 'Mathematics',
    due_at: new Date(_now - 15 * 86400000).toISOString(),
    days_until_due: -15,
    points_possible: 100,
    is_overdue: false,
    submission: { id: 'demo-sub-7', status: 'graded', ai_grade: 95, final_grade: 95, submitted_at: new Date(_now - 15 * 86400000).toISOString() },
  },
];
import { NicodemusAiModal } from '@/components/nicodemus-ai-modal';
import { ScrollFade } from '@/components/scroll-fade';

// ============================================================
// Shared Types
// ============================================================

type Tab = 'home' | 'homework' | 'grades' | 'documents' | 'updates';

type StudentProfile = {
  id: string;
  name: string;
  email: string;
  grade_level: string;
  enrollment_date: string;
  school_name: string;
  avg_grade: number | null;
  graded_count: number;
  pending_homework: number;
};

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

type PerAnswerFeedback = {
  questionId: string;
  questionPrompt: string;
  answer: string;
  teacher_feedback: string;
  ai_feedback: string | null;
};

type AssignmentDetail = {
  id: string;
  title: string;
  description: string;
  subject: string;
  due_at: string;
  points_possible: number;
  content: { questions: Array<{ id: string; prompt: string; type: string; points: number }> };
  rubric: Record<string, any>;
};

type ChecklistItem = {
  id: string;
  document_type: DocumentType;
  status: 'pending' | 'submitted' | 'verified' | 'rejected';
  submission_date?: string | null;
  admin_verification_date?: string | null;
  rejection_reason?: string | null;
  reminder_count: number;
  signed_url?: string | null;
};

type Notification = {
  id: string;
  type: string;
  subject: string;
  body: string;
  sent_at: string;
};

// ============================================================
// Utility helpers
// ============================================================

function gradeColor(g: number) {
  return g >= 85 ? 'text-green-600' : g >= 70 ? 'text-amber-600' : 'text-red-500';
}

function gradeBg(g: number) {
  return g >= 85
    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
    : g >= 70
    ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
    : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
}

function gradeLabel(g: number) {
  return g >= 90 ? 'Excellent' : g >= 80 ? 'Great' : g >= 70 ? 'Good' : g >= 60 ? 'Okay' : 'Needs work';
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function dueBadge(item: HomeworkItem) {
  if (item.submission?.status === 'graded') {
    const g = item.submission.final_grade ?? item.submission.ai_grade;
    const cls = g != null && g >= 70 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700';
    return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>{g != null ? `${Math.round(g)}/100` : 'Graded'}</span>;
  }
  if (item.submission?.status === 'pending_review') return <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-xs font-semibold">Under Review</span>;
  if (item.submission?.status === 'grading') return <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">Grading…</span>;
  if (item.submission) return <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-semibold">Submitted</span>;
  if (item.is_overdue) return <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-semibold">Overdue</span>;
  if (item.days_until_due <= 2) return <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-semibold">Due soon</span>;
  return <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-black dark:text-white opacity-60 rounded-full text-xs font-semibold">{item.days_until_due}d left</span>;
}

// ============================================================
// Homework: Question Form + Submission (preserves Phase 1 logic)
// ============================================================

function HomeworkDetail({ assignmentId, studentId, onBack }: { assignmentId: string; studentId: string; onBack: () => void }) {
  const [assignment, setAssignment] = useState<AssignmentDetail | null>(null);
  const [submission, setSubmission] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ grade: number | null; feedback: string; teacherNotes: string; next_steps: string; per_answer_feedback: PerAnswerFeedback[] } | null>(null);
  const [pendingReview, setPendingReview] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const res = await fetch(`/api/student/homework/${assignmentId}?studentId=${studentId}`);
      const data = await res.json();
      if (data.success) {
        setAssignment(data.assignment);
        setSubmission(data.submission);
        if (data.submission?.content) setAnswers(data.submission.content);
        const status = data.submission?.submission_status;
        if (status === 'graded') {
          let feedbackText = '';
          let teacherNotes = '';
          try {
            const parsed = JSON.parse(data.submission.overall_feedback || '{}');
            if (typeof parsed === 'object' && parsed.ai_synthesis) {
              feedbackText = parsed.ai_synthesis || '';
              teacherNotes = parsed.teacher_notes || '';
            } else {
              feedbackText = data.submission.overall_feedback || data.submission.ai_feedback || '';
            }
          } catch {
            feedbackText = data.submission.overall_feedback || data.submission.ai_feedback || '';
          }
          setResult({
            grade: data.submission.final_grade ?? data.submission.teacher_grade ?? data.submission.ai_grade ?? data.submission.grade,
            feedback: feedbackText,
            teacherNotes,
            next_steps: data.submission.ai_next_steps ?? '',
            per_answer_feedback: data.submission.per_answer_feedback ?? [],
          });
        } else if (status === 'pending_review' || status === 'grading') {
          setPendingReview(true);
        }
      }
      setLoading(false);
    })();
  }, [assignmentId, studentId]);

  const handleSubmit = async () => {
    if (!assignment) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/student/homework/${assignmentId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, answers }),
      });
      const data = await res.json();
      if (data.success) setPendingReview(true);
      else alert('Submission failed: ' + data.error);
    } finally {
      setSubmitting(false);
    }
  };

  const allAnswered = assignment?.content?.questions?.every((q) => (answers[q.id] ?? '').trim().length > 0) ?? false;

  if (loading) return <div className="text-center py-20 text-black dark:text-white opacity-60">Loading assignment…</div>;
  if (!assignment) return <div className="text-center py-20 text-black dark:text-white opacity-60">Assignment not found.</div>;

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-black dark:text-white opacity-60 hover:text-black dark:hover:text-white transition-colors">
        ← Back to Homework
      </button>

      {/* Header */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            {assignment.subject && <span className="px-2 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded text-xs font-medium">{assignment.subject}</span>}
            <h2 className="text-xl font-bold text-black dark:text-white mt-2">{assignment.title}</h2>
            {assignment.description && <p className="text-sm text-black dark:text-white opacity-60 mt-1">{assignment.description}</p>}
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs text-black dark:text-white opacity-60">Due</p>
            <p className="text-sm font-semibold text-black dark:text-white">{fmtDate(assignment.due_at)}</p>
            <p className="text-xs text-black dark:text-white opacity-60 mt-1">{assignment.points_possible} pts</p>
          </div>
        </div>
      </div>

      {/* Pending review */}
      {pendingReview && !result && (
        <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-200 dark:border-indigo-800 p-8 text-center space-y-3">
          <p className="text-4xl">📬</p>
          <h3 className="font-semibold text-indigo-800 dark:text-indigo-300">Submitted — Under Review</h3>
          <p className="text-sm text-indigo-600 dark:text-indigo-400">Your teacher is reviewing your work. Your grade will appear here once the review is complete.</p>
        </div>
      )}

      {/* Grade result */}
      {result && (
        <div className="space-y-4">
          <div className={`rounded-xl border p-6 shadow-sm space-y-4 ${result.grade != null ? gradeBg(result.grade) : 'bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-700'}`}>
            <h3 className="font-semibold text-black dark:text-white">📊 Your Results</h3>
            {result.grade != null && (
              <div className="flex items-center gap-4">
                <div className={`text-6xl font-bold ${gradeColor(result.grade)}`}>{Math.round(result.grade)}</div>
                <div>
                  <p className="text-sm text-black dark:text-white opacity-60">out of {assignment.points_possible} points</p>
                  <p className={`text-sm font-semibold ${gradeColor(result.grade)}`}>{gradeLabel(result.grade)}</p>
                </div>
              </div>
            )}
            {result.teacherNotes && (
              <div className="bg-white/70 dark:bg-gray-800/60 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                <p className="text-xs font-medium text-amber-700 dark:text-amber-400 uppercase mb-1">📝 Teacher's Note</p>
                <p className="text-sm text-black dark:text-white leading-relaxed">{result.teacherNotes}</p>
              </div>
            )}
            <div className="bg-white/70 dark:bg-gray-800/60 rounded-lg p-3 text-sm text-black dark:text-white leading-relaxed">
              {result.grade != null
                ? result.grade >= 90 ? '🌟 Outstanding! Keep it up.'
                  : result.grade >= 75 ? '👍 Great effort! Review the feedback below to sharpen your skills.'
                  : result.grade >= 60 ? "💪 You're on the right track! Focus on the tips below."
                  : "📚 Don't be discouraged — read each tip carefully and ask your teacher for help."
                : ''}
            </div>
          </div>

          {result.per_answer_feedback.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-black dark:text-white opacity-60 uppercase tracking-wide">💬 Question Feedback</p>
              {result.per_answer_feedback.map((item, i) => (
                <div key={item.questionId} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 p-4 shadow-sm space-y-3">
                  <p className="text-sm font-semibold text-black dark:text-white"><span className="text-black dark:text-white opacity-60 mr-1">{i + 1}.</span>{item.questionPrompt}</p>
                  <div className="pl-3 border-l-2 border-gray-100 dark:border-gray-700">
                    <p className="text-xs text-black dark:text-white opacity-60 uppercase mb-0.5">Your Answer</p>
                    <p className="text-sm text-black dark:text-white opacity-60 italic whitespace-pre-wrap">{item.answer}</p>
                  </div>
                  {(item.teacher_feedback || item.ai_feedback) && (
                    <div className={`grid gap-2 ${item.teacher_feedback && item.ai_feedback ? 'grid-cols-2' : 'grid-cols-1'}`}>
                      {item.teacher_feedback && (
                        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-2.5">
                          <p className="text-xs font-medium text-amber-700 dark:text-amber-400 uppercase mb-1">Teacher</p>
                          <p className="text-xs text-black dark:text-white leading-relaxed">{item.teacher_feedback}</p>
                        </div>
                      )}
                      {item.ai_feedback && (
                        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-2.5">
                          <p className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase mb-1">💡 What to Improve</p>
                          <p className="text-xs text-black dark:text-white leading-relaxed">{item.ai_feedback.split(/(?<=[.!?])\s+/).slice(0, 2).join(' ')}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Question form */}
      {!result && !pendingReview && (
        <div className="space-y-4">
          {assignment.content?.questions?.map((q, i) => (
            <div key={q.id} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 p-5 shadow-sm">
              <div className="flex justify-between items-start mb-3">
                <p className="font-medium text-black dark:text-white"><span className="text-black dark:text-white opacity-60 mr-2">{i + 1}.</span>{q.prompt}</p>
                <span className="text-xs text-black dark:text-white opacity-60 shrink-0 ml-2">{q.points} pts</span>
              </div>
              <textarea
                value={answers[q.id] ?? ''}
                onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                placeholder={q.type === 'essay' ? 'Write your answer here…' : 'Your answer…'}
                rows={q.type === 'essay' ? 5 : 2}
                className="w-full p-3 text-sm rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ))}
          <button
            onClick={handleSubmit}
            disabled={!allAnswered || submitting}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
          >
            {submitting ? '⏳ Submitting…' : '✓ Submit Homework'}
          </button>
          {!allAnswered && <p className="text-xs text-center text-black dark:text-white opacity-60">Answer all questions to submit.</p>}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Tab: Homework (list + detail flow)
// ============================================================

function HomeworkTab({ studentId }: { studentId: string }) {
  const [items, setItems] = useState<HomeworkItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'pending' | 'graded' | 'all'>('pending');
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (studentId === DEMO_STUDENT_ID) {
      setItems(DEMO_HOMEWORK);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/student/homework?studentId=${studentId}`);
      const data = await res.json();
      if (data.success) setItems(data.assignments);
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => { load(); }, [load]);

  if (openId) return <HomeworkDetail assignmentId={openId} studentId={studentId} onBack={() => { setOpenId(null); load(); }} />;

  const filtered = items.filter((item) => {
    if (filter === 'pending') return !item.submission || item.submission.status === 'grading' || item.submission.status === 'pending_review';
    if (filter === 'graded') return item.submission?.status === 'graded';
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 border-b border-gray-100 dark:border-gray-700">
        {(['pending', 'graded', 'all'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize ${filter === f ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-black dark:text-white opacity-60 hover:text-black dark:hover:text-white'}`}>
            {f === 'pending' ? 'To Do' : f === 'graded' ? 'Completed' : 'All'}
          </button>
        ))}
        <button onClick={load} className="ml-auto text-xs text-black dark:text-white opacity-60 hover:text-black dark:hover:text-white px-2">↻</button>
      </div>

      {loading ? (
        <p className="text-center py-12 text-sm text-black dark:text-white opacity-60">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">{filter === 'pending' ? '🎉' : '📭'}</p>
          <p className="text-black dark:text-white opacity-60 text-sm">{filter === 'pending' ? 'No pending homework — you\'re all caught up!' : 'Nothing here yet.'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <div key={item.id} onClick={() => setOpenId(item.id)}
              className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl p-5 hover:border-blue-300 dark:hover:border-blue-700 transition-colors cursor-pointer shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    {item.subject && <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs font-medium">{item.subject}</span>}
                    {dueBadge(item)}
                  </div>
                  <h3 className="font-semibold text-black dark:text-white">{item.title}</h3>
                  {item.description && <p className="text-sm text-black dark:text-white opacity-60 mt-0.5 line-clamp-2">{item.description}</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-black dark:text-white opacity-60">Due</p>
                  <p className="text-sm font-medium text-black dark:text-white">{fmtDate(item.due_at)}</p>
                  <p className="text-xs text-black dark:text-white opacity-60 mt-0.5">{item.points_possible} pts</p>
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
// Tab: Grades
// ============================================================

type GradedSubmission = {
  id: string;
  assignment_id: string;
  final_grade: number | null;
  ai_grade: number | null;
  submitted_at: string;
  assignments?: { title: string; subject: string; points_possible: number };
};

function GradesTab({ studentId }: { studentId: string }) {
  const [submissions, setSubmissions] = useState<GradedSubmission[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const source = studentId === DEMO_STUDENT_ID
          ? DEMO_HOMEWORK
          : await fetch(`/api/student/homework?studentId=${studentId}`)
              .then((r) => r.json())
              .then((d) => (d.success ? d.assignments : []));

        const graded: GradedSubmission[] = (source as HomeworkItem[])
          .filter((a) => a.submission?.status === 'graded')
          .map((a) => ({
            id: a.submission!.id,
            assignment_id: a.id,
            final_grade: a.submission!.final_grade,
            ai_grade: a.submission!.ai_grade,
            submitted_at: a.submission!.submitted_at,
            assignments: { title: a.title, subject: a.subject, points_possible: a.points_possible },
          }));
        setSubmissions(graded);
      } finally {
        setLoading(false);
      }
    })();
  }, [studentId]);

  // Compute per-subject averages
  const bySubject: Record<string, { grades: number[]; subject: string }> = {};
  submissions.forEach((s) => {
    const grade = s.final_grade ?? s.ai_grade;
    const subject = s.assignments?.subject ?? 'General';
    if (grade != null) {
      if (!bySubject[subject]) bySubject[subject] = { grades: [], subject };
      bySubject[subject].grades.push(grade);
    }
  });

  const subjectStats = Object.values(bySubject).map(({ subject, grades }) => ({
    subject,
    avg: Math.round(grades.reduce((a, b) => a + b, 0) / grades.length),
    count: grades.length,
    best: Math.max(...grades),
  })).sort((a, b) => b.avg - a.avg);

  const overallAvg = submissions.length > 0
    ? Math.round(submissions.reduce((sum, s) => sum + (s.final_grade ?? s.ai_grade ?? 0), 0) / submissions.filter(s => (s.final_grade ?? s.ai_grade) != null).length)
    : null;

  if (loading) return <div className="text-center py-20 text-sm text-black dark:text-white opacity-60">Loading grades…</div>;

  if (submissions.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-4xl mb-3">📊</p>
        <p className="text-black dark:text-white opacity-60 text-sm">No graded assignments yet.</p>
        <p className="text-black dark:text-white opacity-60 text-xs mt-1">Grades will appear here once your teacher reviews your submissions.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overall stat */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 p-4 text-center">
          <p className={`text-3xl font-bold ${overallAvg != null ? gradeColor(overallAvg) : 'text-black dark:text-white opacity-60'}`}>
            {overallAvg ?? '—'}
          </p>
          <p className="text-xs text-black dark:text-white opacity-60 mt-1">Overall Avg</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 p-4 text-center">
          <p className="text-3xl font-bold text-black dark:text-white">{submissions.length}</p>
          <p className="text-xs text-black dark:text-white opacity-60 mt-1">Graded</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 p-4 text-center">
          <p className="text-3xl font-bold text-black dark:text-white">{subjectStats.length}</p>
          <p className="text-xs text-black dark:text-white opacity-60 mt-1">Subjects</p>
        </div>
      </div>

      {/* Subject breakdown */}
      {subjectStats.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-black dark:text-white opacity-60 uppercase tracking-wide mb-3">By Subject</p>
          <div className="space-y-2">
            {subjectStats.map((s) => (
              <div key={s.subject} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-medium text-sm text-black dark:text-white">{s.subject}</p>
                    <p className="text-xs text-black dark:text-white opacity-60">{s.count} assignment{s.count !== 1 ? 's' : ''} · Best: {s.best}</p>
                  </div>
                  <p className={`text-2xl font-bold ${gradeColor(s.avg)}`}>{s.avg}</p>
                </div>
                <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${s.avg >= 85 ? 'bg-green-500' : s.avg >= 70 ? 'bg-amber-500' : 'bg-red-500'}`}
                    style={{ width: `${Math.min(s.avg, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent grades list */}
      <div>
        <p className="text-xs font-semibold text-black dark:text-white opacity-60 uppercase tracking-wide mb-3">Recent Grades</p>
        <div className="space-y-2">
          {submissions.slice(0, 10).map((s) => {
            const grade = s.final_grade ?? s.ai_grade;
            return (
              <div key={s.id} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 p-4 flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-black dark:text-white truncate">{s.assignments?.title ?? 'Assignment'}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {s.assignments?.subject && <span className="text-xs text-blue-600 dark:text-blue-400">{s.assignments.subject}</span>}
                    <span className="text-xs text-black dark:text-white opacity-60">{fmtDate(s.submitted_at)}</span>
                  </div>
                </div>
                {grade != null ? (
                  <div className="text-right shrink-0">
                    <p className={`text-xl font-bold ${gradeColor(grade)}`}>{Math.round(grade)}</p>
                    <p className="text-xs text-black dark:text-white opacity-60">/{s.assignments?.points_possible ?? 100}</p>
                  </div>
                ) : (
                  <span className="text-xs text-black dark:text-white opacity-60">No grade</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Tab: Documents (Onboarding checklist + upload)
// ============================================================

const DOC_STATUS_CFG = {
  pending:   { icon: '⭕', label: 'Not uploaded',       badge: 'bg-gray-100 dark:bg-gray-800 text-black dark:text-white opacity-60' },
  submitted: { icon: '⏳', label: 'Under review',       badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  verified:  { icon: '✅', label: 'Verified',           badge: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  rejected:  { icon: '❌', label: 'Needs resubmission', badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
} as const;

function DocumentsTab({ studentId }: { studentId: string }) {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [summary, setSummary] = useState({ total: 0, completed: 0, pending: 0, submitted: 0 });
  const [loading, setLoading] = useState(false);
  const [uploadingType, setUploadingType] = useState<DocumentType | null>(null);

  const load = useCallback(async () => {
    if (studentId === DEMO_STUDENT_ID) {
      // Demo: show a partially-complete checklist
      setItems([
        { id: 'd1', document_type: 'medical_records',     status: 'verified',  submission_date: new Date(_now - 20 * 86400000).toISOString(), admin_verification_date: new Date(_now - 18 * 86400000).toISOString(), rejection_reason: null, reminder_count: 0 },
        { id: 'd2', document_type: 'emergency_contacts',  status: 'submitted', submission_date: new Date(_now - 5 * 86400000).toISOString(),  admin_verification_date: null, rejection_reason: null, reminder_count: 0 },
        { id: 'd3', document_type: 'proof_of_residency',  status: 'pending',   submission_date: null, admin_verification_date: null, rejection_reason: null, reminder_count: 1 },
        { id: 'd4', document_type: 'parent_consent_form', status: 'pending',   submission_date: null, admin_verification_date: null, rejection_reason: null, reminder_count: 0 },
      ] as ChecklistItem[]);
      setSummary({ total: 4, completed: 1, pending: 2, submitted: 1 });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/onboarding/checklist/${studentId}`);
      const data = await res.json();
      if (data.success) { setItems(data.items); setSummary(data.summary); }
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => { load(); }, [load]);

  function handleUploadSuccess(docType: DocumentType) {
    setUploadingType(null);
    setItems((prev) => prev.map((i) => i.document_type === docType ? { ...i, status: 'submitted', submission_date: new Date().toISOString() } : i));
    setSummary((p) => ({ ...p, submitted: p.submitted + 1, pending: Math.max(0, p.pending - 1) }));
  }

  const pct = summary.total > 0 ? Math.round((summary.completed / summary.total) * 100) : 0;
  const allDone = summary.total > 0 && summary.completed === summary.total;

  return (
    <div className="space-y-5">
      {uploadingType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md p-6 border border-gray-100 dark:border-gray-700">
            <DocumentUploadForm studentId={studentId} documentType={uploadingType} onSuccess={handleUploadSuccess} onCancel={() => setUploadingType(null)} />
          </div>
        </div>
      )}

      {/* Progress card */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 p-5">
        <div className="flex justify-between text-sm mb-2">
          <span className="font-medium text-black dark:text-white">Enrollment Documents</span>
          <span className={`font-bold ${allDone ? 'text-green-600' : 'text-blue-600'}`}>{pct}% complete</span>
        </div>
        <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-500 ${allDone ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${pct}%` }} />
        </div>
        <div className="flex gap-4 mt-3 text-xs text-black dark:text-white opacity-60">
          <span className="text-green-600 font-medium">✅ {summary.completed} verified</span>
          <span className="text-blue-600">⏳ {summary.submitted} under review</span>
          <span>⭕ {summary.pending} pending</span>
        </div>
        {allDone && (
          <div className="mt-3 p-2.5 bg-green-50 dark:bg-green-900/20 rounded-lg text-sm text-center font-medium text-green-700 dark:text-green-300">
            🎉 All documents verified — enrollment complete!
          </div>
        )}
      </div>

      {loading && items.length === 0 ? (
        <div className="text-center py-12 text-sm text-black dark:text-white opacity-60">Loading documents…</div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-sm text-black dark:text-white opacity-60">No documents required — or checklist hasn't been set up yet.</div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const cfg = DOC_STATUS_CFG[item.status];
            const label = DOCUMENT_TYPE_LABELS[item.document_type] ?? item.document_type;
            const canUpload = item.status === 'pending' || item.status === 'rejected';
            return (
              <div key={item.id} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <span className="text-xl shrink-0">{cfg.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-black dark:text-white">{label}</p>
                      <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium mt-1 ${cfg.badge}`}>{cfg.label}</span>
                      {item.rejection_reason && (
                        <p className="mt-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded p-2">
                          <strong>Reason:</strong> {item.rejection_reason}
                        </p>
                      )}
                      {item.submission_date && item.status !== 'rejected' && (
                        <p className="mt-1 text-xs text-black dark:text-white opacity-60">Submitted {fmtDate(item.submission_date)}</p>
                      )}
                      {item.status === 'verified' && item.admin_verification_date && (
                        <p className="mt-1 text-xs text-green-600 dark:text-green-400">Verified {fmtDate(item.admin_verification_date)}</p>
                      )}
                      {item.signed_url && item.status !== 'pending' && (
                        <a href={item.signed_url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs text-blue-600 hover:underline">View file</a>
                      )}
                    </div>
                  </div>
                  {canUpload && (
                    <button onClick={() => setUploadingType(item.document_type)}
                      className={`shrink-0 py-1.5 px-3 text-xs font-semibold rounded-lg transition-colors ${item.status === 'rejected' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'} text-white`}>
                      {item.status === 'rejected' ? 'Re-upload' : 'Upload'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Tab: Updates (notifications sent to parent about student)
// ============================================================

const NOTIF_TYPE_CFG: Record<string, { icon: string; color: string }> = {
  progress:          { icon: '📈', color: 'text-blue-600 dark:text-blue-400' },
  alert:             { icon: '⚠️', color: 'text-amber-600 dark:text-amber-400' },
  milestone:         { icon: '🏆', color: 'text-green-600 dark:text-green-400' },
  manual:            { icon: '✉️', color: 'text-black dark:text-white opacity-60' },
  admissions_welcome:{ icon: '🎉', color: 'text-violet-600 dark:text-violet-400' },
  onboarding_reminder:{ icon: '📋', color: 'text-amber-600 dark:text-amber-400' },
};

function UpdatesTab({ studentId }: { studentId: string }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (studentId === DEMO_STUDENT_ID) {
        setNotifications([
          { id: 'dn1', type: 'weekly_digest', subject: 'Weekly Progress Update – Alex is doing great!', body: 'Alex had a strong week in Mathematics and English Literature. Distraction index was low and all homework was submitted on time.', sent_at: new Date(_now - 7 * 86400000).toISOString() },
          { id: 'dn2', type: 'milestone',     subject: 'Milestone reached: 10 assignments completed!', body: 'Alex has now completed 10 graded assignments. Overall average is 84 — well above class median.', sent_at: new Date(_now - 14 * 86400000).toISOString() },
        ]);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(`/api/student/notifications?studentId=${studentId}`);
        const data = await res.json();
        if (data.success) setNotifications(data.notifications);
      } finally {
        setLoading(false);
      }
    })();
  }, [studentId]);

  if (loading) return <div className="text-center py-20 text-sm text-black dark:text-white opacity-60">Loading updates…</div>;

  if (notifications.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-4xl mb-3">📭</p>
        <p className="text-black dark:text-white opacity-60 text-sm">No updates sent to your parent yet.</p>
        <p className="text-black dark:text-white opacity-60 text-xs mt-1">Your teacher's progress updates and milestone messages will appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-black dark:text-white opacity-60">
        These are updates sent to your parent/guardian by the school.
      </p>
      {notifications.map((n) => {
        const cfg = NOTIF_TYPE_CFG[n.type] ?? { icon: '📩', color: 'text-black dark:text-white opacity-60' };
        const isOpen = expanded === n.id;
        return (
          <div key={n.id} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
            <button
              onClick={() => setExpanded(isOpen ? null : n.id)}
              className="w-full text-left p-4 flex items-start gap-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            >
              <span className="text-xl shrink-0">{cfg.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-black dark:text-white truncate">{n.subject}</p>
                <p className="text-xs text-black dark:text-white opacity-60 mt-0.5">{fmtDate(n.sent_at)}</p>
              </div>
              <span className="shrink-0 text-black dark:text-white opacity-30 text-sm">{isOpen ? '▲' : '▼'}</span>
            </button>
            {isOpen && (
              <div className="px-4 pb-4 pt-0 border-t border-gray-100 dark:border-gray-700">
                <div className="prose prose-sm dark:prose-invert max-w-none pt-3 text-black dark:text-white whitespace-pre-wrap text-sm leading-relaxed">
                  {n.body}
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
// Tab: Home (overview dashboard)
// ============================================================

function HomeTab({ profile, studentId, onGoTo }: { profile: StudentProfile; studentId: string; onGoTo: (tab: Tab) => void }) {
  const [homework, setHomework] = useState<HomeworkItem[]>([]);
  const [checklistSummary, setChecklistSummary] = useState<{ total: number; completed: number } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      if (studentId === DEMO_STUDENT_ID) {
        setHomework(DEMO_HOMEWORK);
        setChecklistSummary({ total: 4, completed: 1 });
        return;
      }
      setLoading(true);
      try {
        const [hwRes, docRes] = await Promise.all([
          fetch(`/api/student/homework?studentId=${studentId}`),
          fetch(`/api/onboarding/checklist/${studentId}`),
        ]);
        const [hwData, docData] = await Promise.all([hwRes.json(), docRes.json()]);
        if (hwData.success) setHomework(hwData.assignments);
        if (docData.success) setChecklistSummary({ total: docData.summary.total, completed: docData.summary.completed });
      } finally {
        setLoading(false);
      }
    })();
  }, [studentId]);

  const subjects = Array.from(new Set(homework.map((h) => h.subject).filter(Boolean)));

  const todos = homework
    .filter((h) => !h.submission || ['grading', 'pending_review'].includes(h.submission.status))
    .sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime());

  const recentGrades = homework.filter((h) => h.submission?.status === 'graded').slice(0, 5);

  const docPct = checklistSummary && checklistSummary.total > 0
    ? Math.round((checklistSummary.completed / checklistSummary.total) * 100) : 0;

  const colStyle = 'min-w-[300px] lg:min-w-[320px] flex-1 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-5 flex flex-col';
  const colHeight = { height: 'calc(100vh - 220px)' };
  const colHeaderCls = 'flex items-center justify-between mb-4 border-b border-gray-50 dark:border-gray-700 pb-3';

  return (
    <div className="flex flex-nowrap overflow-x-auto gap-6 pb-4 w-full">

      {/* COL 1: My Subjects */}
      <section className={colStyle} style={colHeight}>
        <div className={colHeaderCls}>
          <h2 className="font-semibold flex items-center gap-2">
            <BookOpen size={18} /> My Subjects
          </h2>
          <span className="text-xs text-black dark:text-white opacity-60">{subjects.length} subjects</span>
        </div>
        <ScrollFade className="pr-2 space-y-3">
          {loading ? (
            <p className="text-sm text-black dark:text-white opacity-60">Loading…</p>
          ) : subjects.length === 0 ? (
            <p className="text-sm italic text-black dark:text-white opacity-60">No subjects yet.</p>
          ) : (
            subjects.map((subject, idx) => {
              const color = SLOT_COLORS[idx % SLOT_COLORS.length];
              const subjectHw = homework.filter((h) => h.subject === subject);
              const pending = subjectHw.filter((h) => !h.submission || h.submission.status === 'grading').length;
              return (
                <div key={subject} className={`rounded-xl border p-4 ${color}`}>
                  <p className="font-semibold text-sm">{subject}</p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <span className="px-2 py-0.5 bg-white/60 rounded-full text-xs font-medium">{subjectHw.length} assignments</span>
                    {pending > 0 && (
                      <span className="px-2 py-0.5 bg-white/60 rounded-full text-xs font-medium">{pending} pending</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </ScrollFade>
      </section>

      {/* COL 2: To-Do List */}
      <section className={colStyle} style={colHeight}>
        <div className={colHeaderCls}>
          <h2 className="font-semibold flex items-center gap-2">
            <CheckSquare size={18} /> To-Do
          </h2>
          <span className="text-xs text-black dark:text-white opacity-60">{todos.length} pending</span>
        </div>
        <ScrollFade className="pr-2 space-y-2">
          {loading ? (
            <p className="text-sm text-black dark:text-white opacity-60">Loading…</p>
          ) : todos.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 py-8">
              <div className="w-12 h-12 bg-green-50 dark:bg-green-900/20 rounded-full flex items-center justify-center">
                <CheckSquare size={22} className="text-green-500" />
              </div>
              <p className="text-sm font-medium text-black dark:text-white">All caught up!</p>
              <p className="text-xs text-black dark:text-white opacity-60 text-center">No pending assignments right now.</p>
            </div>
          ) : (
            todos.map((item) => (
              <div
                key={item.id}
                onClick={() => onGoTo('homework')}
                className="flex items-start gap-3 p-3 rounded-xl border border-gray-100 dark:border-gray-700 hover:border-indigo-200 dark:hover:border-indigo-700 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-all"
              >
                <div className={`w-4 h-4 mt-0.5 rounded border-2 shrink-0 ${item.is_overdue ? 'border-red-400' : 'border-gray-300 dark:border-gray-500'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-black dark:text-white truncate">{item.title}</p>
                  {item.subject && <p className="text-xs text-indigo-600 mt-0.5">{item.subject}</p>}
                  <p className="text-xs text-black dark:text-white opacity-60 mt-1">{fmtDate(item.due_at)}</p>
                </div>
                <div className="shrink-0">{dueBadge(item)}</div>
              </div>
            ))
          )}
        </ScrollFade>
        {todos.length > 0 && (
          <button
            onClick={() => onGoTo('homework')}
            className="mt-3 text-xs text-indigo-600 hover:text-indigo-700 font-medium text-center"
          >
            View all homework →
          </button>
        )}
      </section>

      {/* COL 3: Stats & Quick Links */}
      <section className={colStyle} style={colHeight}>
        <div className={colHeaderCls}>
          <h2 className="font-semibold flex items-center gap-2">
            <BarChart2 size={18} /> Overview
          </h2>
        </div>
        <ScrollFade className="pr-2 space-y-4">

          {/* Stats grid */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
            <p className="text-xs font-semibold text-black dark:text-white uppercase mb-3">My Stats</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Avg Grade', value: profile.avg_grade != null ? String(profile.avg_grade) : '—', color: profile.avg_grade != null ? gradeColor(profile.avg_grade) : 'text-black dark:text-white' },
                { label: 'Graded', value: String(profile.graded_count), color: 'text-black dark:text-white' },
                { label: 'Pending', value: String(profile.pending_homework), color: profile.pending_homework > 3 ? 'text-amber-600' : 'text-black dark:text-white' },
                { label: 'Docs', value: `${docPct}%`, color: docPct === 100 ? 'text-green-600' : 'text-indigo-600' },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-white dark:bg-gray-900 rounded-lg p-3 text-center border border-gray-100 dark:border-gray-700">
                  <p className={`text-2xl font-bold ${color}`}>{value}</p>
                  <p className="text-xs text-black dark:text-white opacity-60 mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Recent grades */}
          {recentGrades.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-black dark:text-white uppercase mb-3">Recent Grades</p>
              <div className="space-y-2">
                {recentGrades.map((item) => {
                  const g = item.submission!.final_grade ?? item.submission!.ai_grade;
                  return (
                    <div key={item.id} className="flex items-center justify-between gap-2">
                      <p className="text-sm text-black dark:text-white truncate flex-1">{item.title}</p>
                      {g != null && <p className={`text-sm font-bold shrink-0 ${gradeColor(g)}`}>{Math.round(g)}</p>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quick links */}
          <div>
            <p className="text-xs font-semibold text-black dark:text-white uppercase mb-3">Quick Links</p>
            <div className="space-y-2">
              {([
                { label: 'Homework', tab: 'homework' as Tab, icon: <BookOpen size={14} /> },
                { label: 'Grades',   tab: 'grades'   as Tab, icon: <BarChart2 size={14} /> },
                { label: 'Documents',tab: 'documents' as Tab, icon: <FileText size={14} /> },
                { label: 'Updates',  tab: 'updates'  as Tab, icon: <Bell size={14} /> },
              ]).map(({ label, tab, icon }) => (
                <button
                  key={tab}
                  onClick={() => onGoTo(tab)}
                  className="flex items-center justify-between w-full p-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm hover:border-indigo-200 hover:shadow-md transition-all group text-left"
                >
                  <span className="flex items-center gap-2 text-sm font-medium text-black dark:text-white group-hover:text-indigo-600">{icon} {label}</span>
                  <ChevronRight size={14} className="text-black dark:text-white opacity-60 group-hover:text-indigo-500" />
                </button>
              ))}
            </div>
          </div>

          {/* Docs nudge */}
          {checklistSummary && checklistSummary.total > 0 && checklistSummary.completed < checklistSummary.total && (
            <button
              onClick={() => onGoTo('documents')}
              className="w-full bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 flex items-center gap-3 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors text-left"
            >
              <span className="text-lg">📋</span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-xs text-amber-800 dark:text-amber-200">Documents needed</p>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                  {checklistSummary.total - checklistSummary.completed} still pending
                </p>
              </div>
              <ChevronRight size={14} className="text-amber-400 shrink-0" />
            </button>
          )}
        </ScrollFade>
      </section>
    </div>
  );
}

// ============================================================
// Main Page: Tab shell + auth
// ============================================================

const NAV_ITEMS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'home',      label: 'Home',      icon: <Home size={15} /> },
  { id: 'homework',  label: 'Homework',  icon: <BookOpen size={15} /> },
  { id: 'grades',    label: 'Grades',    icon: <BarChart2 size={15} /> },
  { id: 'documents', label: 'Documents', icon: <FileText size={15} /> },
  { id: 'updates',   label: 'Updates',   icon: <Bell size={15} /> },
];

import React from 'react';

export default function StudentDashboardPage() {
  const [studentId, setStudentId]     = useState<string | null>(null);
  const [profile, setProfile]         = useState<StudentProfile | null>(null);
  const [activeTab, setActiveTab]     = useState<Tab>('home');
  const [profileLoading, setProfileLoading] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen]   = useState(false);
  const [isSearchOpen, setIsSearchOpen]     = useState(false);

  // Auth — fall back to demo mode when no session
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setStudentId(user.id);
      } else {
        setStudentId(DEMO_STUDENT_ID);
        setProfile(DEMO_PROFILE);
      }
    });
  }, []);

  // Profile — skip when in demo mode (already set above)
  useEffect(() => {
    if (!studentId || studentId === DEMO_STUDENT_ID) return;
    setProfileLoading(true);
    fetch(`/api/student/profile?studentId=${studentId}`)
      .then((r) => r.json())
      .then((data) => { if (data.success) setProfile(data.profile); })
      .finally(() => setProfileLoading(false));
  }, [studentId]);

  const initials = profile?.name
    ? profile.name.split(' ').map((p) => p[0]).slice(0, 2).join('')
    : '?';

  // Cmd+K / Ctrl+K to open search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="min-h-screen bg-[#FDFDFD] dark:bg-gray-950 font-sans">

      {/* ── Top Navigation ── */}
      <nav className="flex items-center justify-between px-6 py-3 border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-950 sticky top-0 z-10">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-black rounded-tr-xl rounded-bl-xl rotate-45" />
          <span className="font-bold text-lg tracking-wider ml-2">NICODEMUS AI</span>
        </div>

        {/* Nav links */}
        <div className="hidden md:flex items-center gap-6 text-sm font-medium text-black dark:text-white">
          {NAV_ITEMS.map(({ id, label, icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-1.5 transition-all pb-0.5 ${
                activeTab === id
                  ? 'text-black dark:text-white border-b-2 border-black dark:border-white font-semibold'
                  : 'text-black/50 dark:text-white/50 hover:text-black dark:hover:text-white'
              }`}
            >
              {icon} {label}
            </button>
          ))}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsSearchOpen(true)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full text-black dark:text-white transition-colors"
            aria-label="Search"
          >
            <Search size={18} />
          </button>
          <NotificationDropdown userId={studentId} userRole="student" />
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold select-none">
            {initials}
          </div>
          <button
            onClick={() => setIsAiModalOpen(true)}
            className="flex items-center gap-1.5 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <Mic size={15} /> Nicodemus AI
          </button>
        </div>
      </nav>

      {/* ── Main ── */}
      <main className="max-w-[1400px] mx-auto p-4 md:p-6">

        {/* Page header */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold select-none">
              {initials}
            </div>
            <div>
              <h1 className="font-semibold text-lg">
                {profileLoading ? 'Loading…' : (profile?.name ?? 'Student Dashboard')}
              </h1>
              <p className="text-xs text-black dark:text-white">
                {profile
                  ? `Grade ${profile.grade_level} · ${profile.school_name} · Student View`
                  : 'Student View'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/dashboard"
              className="flex items-center gap-1.5 text-sm font-medium text-black dark:text-white border border-gray-200 dark:border-gray-600 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Teacher View <ChevronRight size={14} />
            </a>
          </div>
        </div>

        {/* Content */}
        {!studentId ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-6">
            {activeTab === 'home' && profile && (
              <HomeTab profile={profile} studentId={studentId} onGoTo={setActiveTab} />
            )}
            {activeTab === 'home' && !profile && !profileLoading && (
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-12 text-center text-sm text-black dark:text-white">
                Could not load profile.
              </div>
            )}
            {activeTab === 'homework'  && <HomeworkTab  studentId={studentId} />}
            {activeTab === 'grades'    && <GradesTab    studentId={studentId} />}
            {activeTab === 'documents' && <DocumentsTab studentId={studentId} />}
            {activeTab === 'updates'   && <UpdatesTab   studentId={studentId} />}
          </div>
        )}
      </main>

      {/* AI Modal */}
      {isAiModalOpen && <NicodemusAiModal onClose={() => setIsAiModalOpen(false)} />}

      {/* Search Modal */}
      <SearchModal
        open={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        userId={studentId}
        userRole="student"
        onNavigate={(tab) => { setActiveTab(tab as Tab); setIsSearchOpen(false); }}
      />
    </div>
  );
}
