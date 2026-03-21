'use client';

export const dynamic = 'force-dynamic';

import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  LayoutDashboard, GraduationCap, Users, UserPlus, CreditCard,
  Search, Mic, ChevronDown, ChevronRight, MoreVertical,
} from 'lucide-react';
import { NicodemusAiModal } from '@/components/nicodemus-ai-modal';
import { NotificationDropdown } from '@/components/notification-dropdown';
import { SearchModal } from '@/components/search-modal';

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'teachers' | 'students' | 'admissions' | 'finance';

interface PipelineSummary {
  inquiry_received: number;
  tour_scheduled: number;
  waitlisted: number;
  enrolled: number;
  churned: number;
}

interface OverviewStats {
  totalStudents: number;
  totalTeachers: number;
  totalClasses: number;
  pendingInvoiceCount: number;
  pendingInvoiceAmountCents: number;
  pipelineSummary: PipelineSummary;
  totalProspects: number;
}

interface OverviewData {
  stats: OverviewStats;
  recentActivity: Array<{ type: 'enrollment'; text: string; at: string }>;
}

interface TeacherClass {
  id: string;
  name: string;
  subject: string;
  grade_level: string;
  period: number;
  student_count: number;
}

interface Teacher {
  id: string;
  name: string;
  email: string;
  subjects: string[];
  grade_levels: string[];
  classes: TeacherClass[];
  totalClasses: number;
  totalStudents: number;
  lessonCount: number;
  joinedAt: string;
}

interface Student {
  id: string;
  name: string;
  email: string;
  grade_level: string;
  enrolledAt: string;
  parent: { name: string; email: string } | null;
  avgGrade: number | null;
  submissionCount: number;
  distractionIndex: number | null;
  lastActivity: string;
}

interface StudentsData {
  students: Student[];
  total: number;
}

// ─── Spinner ──────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="flex justify-center py-16">
      <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

// ─── ErrorCard ────────────────────────────────────────────────────────────────

function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-red-200 shadow-sm p-6 text-center">
      <p className="text-red-600 font-medium mb-3">{message}</p>
      <button
        onClick={onRetry}
        className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
      >
        Retry
      </button>
    </div>
  );
}

// ─── FunnelBar ────────────────────────────────────────────────────────────────

const FUNNEL_STAGES: Array<{
  key: keyof PipelineSummary;
  label: string;
  color: string;
  badge: string;
}> = [
  { key: 'inquiry_received', label: 'Inquiry Received', color: 'bg-blue-500', badge: 'bg-blue-100 text-blue-700' },
  { key: 'tour_scheduled', label: 'Tour Scheduled', color: 'bg-amber-500', badge: 'bg-amber-100 text-amber-700' },
  { key: 'waitlisted', label: 'Waitlisted', color: 'bg-purple-500', badge: 'bg-purple-100 text-purple-700' },
  { key: 'enrolled', label: 'Enrolled', color: 'bg-green-500', badge: 'bg-green-100 text-green-700' },
  { key: 'churned', label: 'Churned', color: 'bg-gray-400', badge: 'bg-gray-100 text-gray-700' },
];

function FunnelBar({ pipeline, totalProspects }: { pipeline: PipelineSummary; totalProspects: number }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 space-y-3">
      {FUNNEL_STAGES.map(({ key, label, color, badge }) => {
        const count = pipeline[key] ?? 0;
        const pct = totalProspects > 0 ? Math.round((count / totalProspects) * 100) : 0;
        return (
          <div key={key} className="flex items-center gap-3">
            <span className="w-36 text-sm text-black dark:text-white text-right shrink-0">{label}</span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badge} w-10 text-center shrink-0`}>
              {count}
            </span>
            <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
              <div
                className={`h-2 rounded-full transition-all duration-500 ${color}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs text-black dark:text-white w-9 text-right shrink-0">{pct}%</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── StudentSidePanel ─────────────────────────────────────────────────────────

function StudentSidePanel({ student, onClose }: { student: Student; onClose: () => void }) {
  const gradeColor =
    student.avgGrade === null
      ? 'bg-gray-100 dark:bg-gray-700 text-black dark:text-white opacity-60'
      : student.avgGrade >= 80
      ? 'bg-green-50 text-green-600 border border-green-100'
      : student.avgGrade >= 60
      ? 'bg-amber-50 text-amber-600 border border-amber-100'
      : 'bg-red-50 text-red-600 border border-red-100';

  return (
    <>
      <div
        className="fixed inset-0 bg-black/20 z-30"
        onClick={onClose}
      />
      <aside className="fixed top-0 right-0 h-full w-[380px] bg-white dark:bg-gray-900 border-l border-gray-100 dark:border-gray-700 shadow-xl z-40 flex flex-col overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-bold text-black dark:text-white">{student.name}</h2>
            <span className="inline-block mt-1 text-xs font-semibold px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100">
              Grade {student.grade_level}
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 text-black dark:text-white hover:bg-gray-200 dark:hover:bg-gray-600 hover:text-black dark:hover:text-white transition-colors"
          >
            ×
          </button>
        </div>

        <div className="flex-1 px-6 py-5 space-y-6">
          {/* Performance */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-black dark:text-white mb-3">
              Performance
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-3 text-center">
                <p className="text-xs text-black dark:text-white mb-1">Avg Grade</p>
                <span className={`text-sm font-bold px-2 py-0.5 rounded-lg ${gradeColor}`}>
                  {student.avgGrade !== null ? `${student.avgGrade}%` : '—'}
                </span>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-3 text-center">
                <p className="text-xs text-black dark:text-white mb-1">Submissions</p>
                <p className="text-lg font-bold text-black dark:text-white">{student.submissionCount}</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-3 text-center">
                <p className="text-xs text-black dark:text-white mb-1">Distraction</p>
                <p className="text-lg font-bold text-black dark:text-white">
                  {student.distractionIndex !== null ? student.distractionIndex.toFixed(1) : '—'}
                </p>
              </div>
            </div>
          </section>

          {/* Parent Contact */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-black dark:text-white mb-3">
              Parent Contact
            </h3>
            {student.parent ? (
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 space-y-2">
                <p className="text-sm font-medium text-black dark:text-white">{student.parent.name}</p>
                <p className="text-sm text-black dark:text-white">{student.parent.email}</p>
                <a
                  href={`mailto:${student.parent.email}`}
                  className="inline-block mt-2 px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700"
                >
                  Email Parent
                </a>
              </div>
            ) : (
              <p className="text-sm text-black dark:text-white italic">No parent on file</p>
            )}
          </section>

          {/* Quick Links */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-black dark:text-white mb-3">
              Quick Links
            </h3>
            <div className="space-y-2">
              <a
                href={`/student/${student.id}/dashboard`}
                className="flex items-center justify-between w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 text-sm font-medium text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                View Full Profile <span>→</span>
              </a>
              <a
                href={`/students/${student.id}/onboarding-documents`}
                className="flex items-center justify-between w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 text-sm font-medium text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                View Documents <span>→</span>
              </a>
            </div>
          </section>
        </div>
      </aside>
    </>
  );
}

// ─── TeacherRow ───────────────────────────────────────────────────────────────

function TeacherRow({
  teacher,
  expanded,
  onToggle,
}: {
  teacher: Teacher;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr
        className="hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
        onClick={onToggle}
      >
        <td className="px-4 py-3">
          <div className="font-medium text-black dark:text-white">{teacher.name}</div>
          <div className="text-xs text-black dark:text-white">{teacher.email}</div>
        </td>
        <td className="px-4 py-3">
          <div className="flex flex-wrap gap-1">
            {teacher.subjects.slice(0, 3).map((s) => (
              <span
                key={s}
                className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-lg"
              >
                {s}
              </span>
            ))}
            {teacher.subjects.length > 3 && (
              <span className="text-xs text-black dark:text-white">+{teacher.subjects.length - 3}</span>
            )}
          </div>
        </td>
        <td className="px-4 py-3 text-center text-sm text-black dark:text-white">{teacher.totalClasses}</td>
        <td className="px-4 py-3 text-center text-sm text-black dark:text-white">{teacher.totalStudents}</td>
        <td className="px-4 py-3 text-center text-sm text-black dark:text-white">{teacher.lessonCount}</td>
        <td className="px-4 py-3 text-sm text-black dark:text-white">
          {new Date(teacher.joinedAt).toLocaleDateString()}
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <a
              href={`/teacher/${teacher.id}`}
              onClick={(e) => e.stopPropagation()}
              className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
            >
              View →
            </a>
            {expanded
              ? <ChevronDown size={16} className="text-black dark:text-white" />
              : <ChevronRight size={16} className="text-black dark:text-white" />
            }
          </div>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={7} className="px-4 pb-4 bg-gray-50 dark:bg-gray-800">
            <div className="pt-2 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {teacher.classes.length === 0 ? (
                <p className="text-sm text-black dark:text-white col-span-full">No classes assigned</p>
              ) : (
                teacher.classes.map((cls) => (
                  <div
                    key={cls.id}
                    className="bg-gray-50 dark:bg-gray-700 rounded-xl border border-gray-100 dark:border-gray-600 p-3"
                  >
                    <p className="text-sm font-medium text-black dark:text-white truncate">{cls.name}</p>
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      <span className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-lg">
                        {cls.subject}
                      </span>
                      <span className="text-xs text-black dark:text-white">Gr {cls.grade_level}</span>
                    </div>
                    <p className="text-xs text-black dark:text-white mt-1.5">{cls.student_count} students · P{cls.period}</p>
                  </div>
                ))
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── TeachersTab ──────────────────────────────────────────────────────────────

function TeachersTab({ schoolId }: { schoolId: string }) {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/teachers?schoolId=${schoolId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setTeachers(json.teachers ?? []);
    } catch {
      setError('Failed to load teachers.');
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Spinner />;
  if (error) return <ErrorCard message={error} onRetry={load} />;

  const filtered = teachers.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <input
        type="text"
        placeholder="Search teachers…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full max-w-sm px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
              {['Name', 'Subjects', 'Classes', 'Students', 'Lessons', 'Joined', 'Actions'].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs font-semibold text-black dark:text-white uppercase tracking-wider"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-black dark:text-white text-sm">
                  No teachers found
                </td>
              </tr>
            ) : (
              filtered.map((t) => (
                <TeacherRow
                  key={t.id}
                  teacher={t}
                  expanded={expandedId === t.id}
                  onToggle={() => setExpandedId(expandedId === t.id ? null : t.id)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── StudentsTab ──────────────────────────────────────────────────────────────

const GRADE_OPTIONS = ['All', 'K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

function StudentsTab({ schoolId }: { schoolId: string }) {
  const [data, setData] = useState<StudentsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [grade, setGrade] = useState('All');
  const [selected, setSelected] = useState<Student | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ schoolId });
      if (search) params.set('search', search);
      if (grade !== 'All') params.set('grade', grade);
      const res = await fetch(`/api/admin/students?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData({ students: json.students ?? [], total: json.total ?? 0 });
    } catch {
      setError('Failed to load students.');
    } finally {
      setLoading(false);
    }
  }, [schoolId, search, grade]);

  useEffect(() => { load(); }, [load]);

  const gradebadge = (avg: number | null) => {
    if (avg === null) return 'bg-gray-100 dark:bg-gray-700 text-black dark:text-white opacity-60';
    if (avg >= 80) return 'bg-green-100 text-green-700';
    if (avg >= 60) return 'bg-amber-100 text-amber-700';
    return 'bg-red-100 text-red-700';
  };

  return (
    <>
      {selected && (
        <StudentSidePanel student={selected} onClose={() => setSelected(null)} />
      )}

      <div className="space-y-4">
        <div className="flex gap-3 flex-wrap">
          <input
            type="text"
            placeholder="Search students…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[200px] max-w-sm px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-900 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <select
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
            className="px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-900 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {GRADE_OPTIONS.map((g) => (
              <option key={g} value={g}>
                {g === 'All' ? 'All Grades' : `Grade ${g}`}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <Spinner />
        ) : error ? (
          <ErrorCard message={error} onRetry={load} />
        ) : (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex justify-between items-center">
              <span className="text-xs text-black dark:text-white opacity-60 font-medium uppercase tracking-wider">
                {data?.total ?? 0} students
              </span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700">
                  {['Name', 'Grade', 'Avg Grade', 'Submissions', 'Last Active', 'Parent', 'Actions'].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-semibold text-black dark:text-white opacity-60 uppercase tracking-wider"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {!data || data.students.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-black dark:text-white opacity-50 text-sm">
                      No students found
                    </td>
                  </tr>
                ) : (
                  data.students.map((s) => (
                    <tr
                      key={s.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                      onClick={() => setSelected(s)}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-black dark:text-white">{s.name}</div>
                        <div className="text-xs text-black dark:text-white opacity-60">{s.email}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                          {s.grade_level}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${gradeband(s.avgGrade)}`}>
                          {s.avgGrade !== null ? `${s.avgGrade}%` : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-black dark:text-white">{s.submissionCount}</td>
                      <td className="px-4 py-3 text-black dark:text-white opacity-60 text-xs">
                        {new Date(s.lastActivity).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        {s.parent ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm text-black dark:text-white">{s.parent.name}</span>
                            <a
                              href={`mailto:${s.parent.email}`}
                              onClick={(e) => e.stopPropagation()}
                              title={s.parent.email}
                              className="text-blue-500 hover:text-blue-700"
                            >
                              ✉
                            </a>
                          </div>
                        ) : (
                          <span className="text-black dark:text-white opacity-50 text-xs italic">None</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelected(s); }}
                          className="text-xs px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-black dark:text-white opacity-60 rounded-lg hover:opacity-100 font-medium"
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

// helper defined outside component to avoid recreating on render
function gradeband(avg: number | null) {
  if (avg === null) return 'bg-gray-100 dark:bg-gray-700 text-black dark:text-white opacity-60';
  if (avg >= 80) return 'bg-green-100 text-green-700';
  if (avg >= 60) return 'bg-amber-100 text-amber-700';
  return 'bg-red-100 text-red-700';
}

// ─── AdmissionsTab ────────────────────────────────────────────────────────────

const PIPELINE_STAGES = [
  { key: 'inquiry_received', label: 'Inquiry',        color: 'border-blue-400',   bg: 'bg-blue-50 dark:bg-blue-950',   badge: 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' },
  { key: 'tour_scheduled',  label: 'Tour Scheduled',  color: 'border-purple-400', bg: 'bg-purple-50 dark:bg-purple-950', badge: 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300' },
  { key: 'waitlisted',      label: 'Waitlist',        color: 'border-amber-400',  bg: 'bg-amber-50 dark:bg-amber-950',  badge: 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300' },
  { key: 'enrolled',        label: 'Enrolled',        color: 'border-green-400',  bg: 'bg-green-50 dark:bg-green-950',  badge: 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' },
  { key: 'churned',         label: 'Churned',         color: 'border-red-400',    bg: 'bg-red-50 dark:bg-red-950',      badge: 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300' },
] as const;

type PipelineStageKey = typeof PIPELINE_STAGES[number]['key'];

interface ProspectStudent {
  id: string;
  child_name: string;
  parent_name: string;
  email: string;
  phone: string | null;
  grade_interested: string;
  current_stage: PipelineStageKey;
  date_of_birth: string | null;
  location: string | null;
  student_id: string | null;
  profile_picture_url: string | null;
  curriculum_id: string | null;
  created_at: string;
  last_contact_at: string | null;
}

function calcAgeAndGrade(dob: string): { age: number; recommendedGrade: string } {
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  const grades = ['Pre-K','Kindergarten','Grade 1','Grade 2','Grade 3','Grade 4','Grade 5','Grade 6','Grade 7','Grade 8','Grade 9','Grade 10','Grade 11','Grade 12'];
  const idx = Math.max(0, Math.min(age - 4, grades.length - 1));
  return { age, recommendedGrade: age < 4 ? 'Pre-K' : grades[idx] ?? 'Grade 12' };
}

// ── Create Student Modal ──────────────────────────────────────────────────────
function CreateStudentModal({ schoolId, onClose, onCreated }: {
  schoolId: string;
  onClose: () => void;
  onCreated: (student: ProspectStudent) => void;
}) {
  const [form, setForm] = React.useState({
    studentName: '', pipeline: 'inquiry_received', dateOfBirth: '', gradeLevel: '',
    location: '', parentName: '', parentEmail: '', parentPhone: '', curriculumId: '',
  });
  const [picture, setPicture] = React.useState<File | null>(null);
  const [picturePreview, setPicturePreview] = React.useState<string | null>(null);
  const [curricula, setCurricula] = React.useState<Array<{ id: string; title: string }>>([]);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [createdId, setCreatedId] = React.useState<string | null>(null);

  // DOB → grade recommendation
  const gradeRec = form.dateOfBirth ? calcAgeAndGrade(form.dateOfBirth) : null;

  React.useEffect(() => {
    if (gradeRec && !form.gradeLevel) {
      setForm(f => ({ ...f, gradeLevel: gradeRec.recommendedGrade }));
    }
  }, [form.dateOfBirth]);

  // Load curricula for picker
  React.useEffect(() => {
    fetch('/api/curriculum').then(r => r.json()).then(d => {
      if (d.lessons) setCurricula(d.lessons.map((l: any) => ({ id: l.id, title: l.title })));
    }).catch(() => {});
  }, []);

  function handlePicture(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setPicture(file);
    if (file) setPicturePreview(URL.createObjectURL(file));
    else setPicturePreview(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      fd.append('schoolId', schoolId);
      if (picture) fd.append('profilePicture', picture);

      const res = await fetch('/api/admin/students/create', { method: 'POST', body: fd });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setCreatedId(json.studentId);
      onCreated(json.student);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const inputCls = 'w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-black dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400';
  const labelCls = 'block text-xs font-semibold text-black dark:text-white opacity-70 mb-1';

  if (createdId) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-8 w-full max-w-sm text-center">
        <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">✓</span>
        </div>
        <h2 className="text-xl font-bold text-black dark:text-white mb-2">Student Created!</h2>
        <p className="text-sm text-black dark:text-white opacity-60 mb-4">Student ID generated successfully</p>
        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl px-6 py-4 mb-6">
          <p className="text-xs text-black dark:text-white opacity-50 uppercase tracking-widest mb-1">Student ID</p>
          <p className="text-2xl font-mono font-bold text-indigo-600 dark:text-indigo-400">{createdId}</p>
        </div>
        <button onClick={onClose} className="w-full py-2.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors">
          Done
        </button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-900 flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700 rounded-t-2xl z-10">
          <h2 className="text-lg font-bold text-black dark:text-white">Create Student</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-black dark:text-white transition-colors">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Profile Picture */}
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800 flex items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-600 shrink-0">
              {picturePreview
                ? <img src={picturePreview} alt="preview" className="w-full h-full object-cover" />
                : <span className="text-2xl opacity-40">📷</span>
              }
            </div>
            <div>
              <p className="text-sm font-semibold text-black dark:text-white mb-1">Profile Picture</p>
              <label className="cursor-pointer px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-black dark:text-white text-xs rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                {picturePreview ? 'Change Photo' : 'Upload Photo'}
                <input type="file" accept="image/*" className="hidden" onChange={handlePicture} />
              </label>
              <p className="text-xs text-black dark:text-white opacity-40 mt-1">JPG, PNG, WebP · Max 5MB</p>
            </div>
          </div>

          {/* Row 1: Name + Pipeline */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Student Name *</label>
              <input required className={inputCls} placeholder="Full name" value={form.studentName}
                onChange={e => setForm(f => ({ ...f, studentName: e.target.value }))} />
            </div>
            <div>
              <label className={labelCls}>Pipeline Stage *</label>
              <select required className={inputCls} value={form.pipeline}
                onChange={e => setForm(f => ({ ...f, pipeline: e.target.value }))}>
                <option value="inquiry_received">Inquiry</option>
                <option value="tour_scheduled">Tour Scheduled</option>
                <option value="waitlisted">Waitlist</option>
                <option value="enrolled">Enrolled</option>
                <option value="churned">Churned</option>
              </select>
            </div>
          </div>

          {/* Row 2: DOB + Grade */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Date of Birth</label>
              <input type="date" className={inputCls} value={form.dateOfBirth}
                onChange={e => setForm(f => ({ ...f, dateOfBirth: e.target.value, gradeLevel: '' }))} />
              {gradeRec && (
                <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1">
                  Age {gradeRec.age} · Recommended: {gradeRec.recommendedGrade}
                </p>
              )}
            </div>
            <div>
              <label className={labelCls}>Grade Level</label>
              <select className={inputCls} value={form.gradeLevel}
                onChange={e => setForm(f => ({ ...f, gradeLevel: e.target.value }))}>
                <option value="">Select grade…</option>
                {['Pre-K','Kindergarten','Grade 1','Grade 2','Grade 3','Grade 4','Grade 5','Grade 6','Grade 7','Grade 8','Grade 9','Grade 10','Grade 11','Grade 12'].map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Location */}
          <div>
            <label className={labelCls}>Location</label>
            <input className={inputCls} placeholder="City, State" value={form.location}
              onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
          </div>

          {/* Parent info */}
          <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
            <p className="text-xs font-bold text-black dark:text-white opacity-50 uppercase tracking-widest mb-3">Parent / Guardian</p>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className={labelCls}>Parent Name *</label>
                <input required className={inputCls} placeholder="Full name" value={form.parentName}
                  onChange={e => setForm(f => ({ ...f, parentName: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}>Parent Email *</label>
                <input required type="email" className={inputCls} placeholder="email@example.com" value={form.parentEmail}
                  onChange={e => setForm(f => ({ ...f, parentEmail: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Parent Phone</label>
              <input type="tel" className={inputCls} placeholder="+1 (555) 000-0000" value={form.parentPhone}
                onChange={e => setForm(f => ({ ...f, parentPhone: e.target.value }))} />
            </div>
          </div>

          {/* Curriculum */}
          <div>
            <label className={labelCls}>Assign Curriculum</label>
            <select className={inputCls} value={form.curriculumId}
              onChange={e => setForm(f => ({ ...f, curriculumId: e.target.value }))}>
              <option value="">None</option>
              {curricula.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </div>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-semibold text-black dark:text-white hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors">
              {saving ? 'Creating…' : 'Create Student'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Pipeline Card ─────────────────────────────────────────────────────────────
function PipelineCard({ student, stages, onMove, adminId }: {
  student: ProspectStudent;
  stages: typeof PIPELINE_STAGES;
  onMove: (id: string, stage: PipelineStageKey) => void;
  adminId: string;
}) {
  const [moving, setMoving] = React.useState(false);
  const [moveError, setMoveError] = React.useState<string | null>(null);
  const currentIdx = stages.findIndex(s => s.key === student.current_stage);
  const initials = student.child_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  async function move(stage: PipelineStageKey) {
    setMoving(true);
    setMoveError(null);
    try {
      if (stage === 'enrolled') {
        // Full enrollment: creates user + student records in the DB
        const res = await fetch(`/api/students/${student.id}/enroll`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            adminId,
            gradeLevel: student.grade_interested,
            feeChoices: { registration_fee_cents: 0, monthly_tuition_cents: 0, activity_fees_cents: 0 },
          }),
        });
        const json = await res.json();
        if (json.success) {
          onMove(student.id, stage);
        } else {
          // Already enrolled is fine — just update the UI stage
          if (res.status === 409) {
            onMove(student.id, stage);
          } else {
            setMoveError(json.error ?? 'Enrollment failed');
          }
        }
      } else {
        // Non-enrollment stage changes just update the pipeline stage
        const res = await fetch('/api/admin/students/pipeline', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ studentId: student.id, stage }),
        });
        const json = await res.json();
        if (json.success) onMove(student.id, stage);
        else setMoveError(json.error ?? 'Stage update failed');
      }
    } finally {
      setMoving(false);
    }
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-3 space-y-2">
      {/* Avatar + name */}
      <div className="flex items-center gap-2">
        {student.profile_picture_url
          ? <img src={student.profile_picture_url} alt={student.child_name} className="w-8 h-8 rounded-full object-cover shrink-0" />
          : <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-300">{initials}</span>
            </div>
        }
        <div className="min-w-0">
          <p className="text-sm font-semibold text-black dark:text-white truncate">{student.child_name}</p>
          <p className="text-xs text-black dark:text-white opacity-50 truncate">{student.grade_interested}</p>
        </div>
      </div>

      {/* Student ID */}
      {student.student_id && (
        <p className="text-xs font-mono text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 rounded px-1.5 py-0.5 inline-block">
          {student.student_id}
        </p>
      )}

      {/* Parent info */}
      <div className="text-xs text-black dark:text-white opacity-60 space-y-0.5">
        <p className="truncate">👤 {student.parent_name}</p>
        <p className="truncate">✉️ {student.email}</p>
        {student.location && <p className="truncate">📍 {student.location}</p>}
      </div>

      {/* Move error */}
      {moveError && (
        <p className="text-xs text-red-500 dark:text-red-400">{moveError}</p>
      )}

      {/* Move buttons */}
      <div className="flex gap-1 pt-1 flex-wrap">
        {currentIdx > 0 && (
          <button onClick={() => move(stages[currentIdx - 1].key)} disabled={moving}
            className="text-xs px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 text-black dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-40">
            ← {stages[currentIdx - 1].label}
          </button>
        )}
        {currentIdx < stages.length - 1 && (
          <button onClick={() => move(stages[currentIdx + 1].key)} disabled={moving}
            className={`text-xs px-2 py-1 rounded-lg transition-colors disabled:opacity-40 ml-auto ${
              stages[currentIdx + 1].key === 'enrolled'
                ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-800'
                : 'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-800'
            }`}>
            {moving && stages[currentIdx + 1].key === 'enrolled' ? 'Enrolling…' : `${stages[currentIdx + 1].label} →`}
          </button>
        )}
      </div>
    </div>
  );
}

// ── AdmissionsTab ─────────────────────────────────────────────────────────────
function AdmissionsTab({ schoolId, adminId }: { schoolId: string; adminId: string }) {
  const [students, setStudents] = React.useState<ProspectStudent[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showCreate, setShowCreate] = React.useState(false);

  const fetchStudents = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/pipeline?schoolId=${schoolId}`);
      const json = await res.json();
      if (json.success) setStudents(json.students);
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  React.useEffect(() => { fetchStudents(); }, [fetchStudents]);

  function handleCreated(student: ProspectStudent) {
    setStudents(prev => [student, ...prev]);
  }

  function handleMove(id: string, stage: PipelineStageKey) {
    setStudents(prev => prev.map(s => s.id === id ? { ...s, current_stage: stage } : s));
  }

  const byStage = (key: string) => students.filter(s => s.current_stage === key);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-black dark:text-white">Admissions Pipeline</h2>
          <p className="text-sm text-black dark:text-white opacity-50">{students.length} total prospects</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors"
        >
          <UserPlus size={15} /> Create Student
        </button>
      </div>

      {/* Kanban board */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {PIPELINE_STAGES.map(stage => {
            const cards = byStage(stage.key);
            return (
              <div key={stage.key} className={`flex-shrink-0 w-64 rounded-2xl border-t-4 ${stage.color} ${stage.bg} p-3 flex flex-col gap-2`}>
                {/* Column header */}
                <div className="flex items-center justify-between px-1 mb-1">
                  <span className="text-sm font-bold text-black dark:text-white">{stage.label}</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${stage.badge}`}>{cards.length}</span>
                </div>
                {/* Cards */}
                {cards.length === 0 ? (
                  <div className="text-xs text-black dark:text-white opacity-30 italic text-center py-6">
                    No students
                  </div>
                ) : (
                  cards.map(s => (
                    <PipelineCard key={s.id} student={s} stages={PIPELINE_STAGES} onMove={handleMove} adminId={adminId} />
                  ))
                )}
              </div>
            );
          })}
        </div>
      )}

      {showCreate && (
        <CreateStudentModal
          schoolId={schoolId}
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}

// ─── FinanceTab ───────────────────────────────────────────────────────────────

function FinanceTab({ overviewData }: { overviewData: OverviewData | null }) {
  const fmt = (cents: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);

  const pending = overviewData?.stats.pendingInvoiceCount ?? 0;
  const amount = overviewData?.stats.pendingInvoiceAmountCents ?? 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
          <p className="text-xs text-black dark:text-white opacity-60 uppercase tracking-wider font-medium">Pending Invoices</p>
          <p className="text-3xl font-bold text-black dark:text-white mt-1">{pending}</p>
          <p className="text-sm text-amber-600 font-medium mt-0.5">{fmt(amount)} outstanding</p>
        </div>
        <div className="bg-white rounded-xl border border-amber-200 bg-amber-50 shadow-sm p-6 flex items-center gap-3">
          <span className="text-2xl">⚠️</span>
          <div>
            <p className="text-sm font-semibold text-amber-800">Stripe not configured</p>
            <p className="text-xs text-amber-600 mt-0.5">Payment gateway TBD</p>
          </div>
        </div>
      </div>

      {/* Placeholder table */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-base font-semibold text-black dark:text-white">Invoices</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
              {['Student', 'Amount', 'Status', 'Due Date', 'Actions'].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs font-semibold text-black dark:text-white opacity-60 uppercase tracking-wider"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...Array(4)].map((_, i) => (
              <tr key={i} className="border-b border-gray-100 dark:border-gray-700">
                {[...Array(5)].map((_, j) => (
                  <td key={j} className="px-4 py-3">
                    <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded animate-pulse w-3/4" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-6 py-4 bg-amber-50 border-t border-amber-100">
          <p className="text-sm text-amber-700">
            Payment gateway integration is on hold. Once configured, invoices will appear here with pay/send actions.
          </p>
        </div>
      </div>

      {/* Configure CTA */}
      <div className="flex items-center gap-4">
        <div className="relative group">
          <button
            disabled
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-black dark:text-white opacity-40 rounded-lg text-sm font-medium cursor-not-allowed"
          >
            Configure Payment Gateway →
          </button>
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap pointer-events-none">
            Contact your administrator
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── AdminDashboard ───────────────────────────────────────────────────────────

const NAV_ITEMS: Array<{ id: Tab; label: string; icon: React.ReactNode }> = [
  { id: 'overview',   label: 'Overview',   icon: <LayoutDashboard size={15} /> },
  { id: 'teachers',   label: 'Teachers',   icon: <GraduationCap size={15} /> },
  { id: 'students',   label: 'Students',   icon: <Users size={15} /> },
  { id: 'admissions', label: 'Admissions', icon: <UserPlus size={15} /> },
  { id: 'finance',    label: 'Finance',    icon: <CreditCard size={15} /> },
];

const DEMO_SCHOOL_ID = '00000000-0000-0000-0000-000000000001';

export default function AdminDashboard() {
  const [activeTab, setActiveTab]       = useState<Tab>('overview');
  const [schoolId, setSchoolId]         = useState<string>(DEMO_SCHOOL_ID);
  const [userId, setUserId]             = useState<string>('00000000-0000-0000-0000-000000000002');
  const [activatedTabs, setActivatedTabs] = useState<Set<Tab>>(new Set(['overview']));
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen]   = useState(false);

  // Shared state so Admissions + Finance can reuse overview data
  const [overviewData, setOverviewData] = useState<OverviewData | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const meta = data?.user?.user_metadata;
      if (data?.user?.id) setUserId(data.user.id);
      if (meta?.school_id) setSchoolId(meta.school_id);
      else if (data?.user?.app_metadata?.school_id) setSchoolId(data.user.app_metadata.school_id);
    });
  }, []);

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

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    setActivatedTabs((prev) => new Set([...prev, tab]));
  };

  const handleOverviewLoaded = useCallback((data: OverviewData) => {
    setOverviewData(data);
  }, []);

  const pipeline      = overviewData?.stats.pipelineSummary ?? null;
  const totalProspects = overviewData?.stats.totalProspects ?? 0;

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
              onClick={() => handleTabChange(id)}
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
          <NotificationDropdown userId={userId} userRole="admin" />
          <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-white text-xs font-bold select-none">
            A
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
      <main className="max-w-[1600px] mx-auto p-4 md:p-6">

        {/* Page header */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-white font-bold text-sm select-none">
              A
            </div>
            <div>
              <h1 className="font-semibold text-lg">Admin Dashboard</h1>
              <p className="text-xs text-black dark:text-white">School Management · Full Visibility</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/admissions/pipeline"
              className="flex items-center gap-1.5 text-sm font-medium text-black dark:text-white border border-gray-200 dark:border-gray-600 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <UserPlus size={14} /> Admissions Pipeline
            </a>
            <a
              href="/students/unified-listing"
              className="flex items-center gap-1.5 text-sm font-medium text-black dark:text-white border border-gray-200 dark:border-gray-600 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <Users size={14} /> All Students
            </a>
            <a
              href="/dashboard"
              className="flex items-center gap-1.5 text-sm font-medium text-black dark:text-white border border-gray-200 dark:border-gray-600 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <GraduationCap size={14} /> Teacher View
            </a>
          </div>
        </div>

        {/* Tab content */}
        <div className="space-y-6">
          {activeTab === 'overview' && (
            <OverviewTabWithCallback schoolId={schoolId} onLoaded={handleOverviewLoaded} />
          )}
          {activeTab === 'teachers' && activatedTabs.has('teachers') && (
            <TeachersTab schoolId={schoolId} />
          )}
          {activeTab === 'students' && activatedTabs.has('students') && (
            <StudentsTab schoolId={schoolId} />
          )}
          {activeTab === 'admissions' && activatedTabs.has('admissions') && (
            <AdmissionsTab schoolId={schoolId} adminId={userId} />
          )}
          {activeTab === 'finance' && activatedTabs.has('finance') && (
            <FinanceTab overviewData={overviewData} />
          )}
        </div>
      </main>

      {/* AI Modal */}
      {isAiModalOpen && <NicodemusAiModal onClose={() => setIsAiModalOpen(false)} />}

      {/* Search Modal */}
      <SearchModal
        open={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        userId={userId}
        userRole="admin"
        onNavigate={(tab) => { handleTabChange(tab as Tab); setIsSearchOpen(false); }}
      />
    </div>
  );
}

// ─── OverviewTab with callback ────────────────────────────────────────────────

function OverviewTabWithCallback({
  schoolId,
  onLoaded,
}: {
  schoolId: string;
  onLoaded: (data: OverviewData) => void;
}) {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/overview?schoolId=${schoolId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: OverviewData = await res.json();
      setData(json);
      onLoaded(json);
    } catch {
      setError('Failed to load overview data.');
    } finally {
      setLoading(false);
    }
  }, [schoolId, onLoaded]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Spinner />;
  if (error || !data) return <ErrorCard message={error ?? 'Unknown error'} onRetry={load} />;

  const { stats, recentActivity } = data;
  const fmt = (cents: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);

  const statCards = [
    { icon: '👩‍🎓', label: 'Students', value: stats.totalStudents, sub: null },
    { icon: '👨‍🏫', label: 'Teachers', value: stats.totalTeachers, sub: null },
    { icon: '📚', label: 'Classes', value: stats.totalClasses, sub: null },
    {
      icon: '💰',
      label: 'Pending Invoices',
      value: stats.pendingInvoiceCount,
      sub: fmt(stats.pendingInvoiceAmountCents),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(({ icon, label, value, sub }) => (
          <div key={label} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
            <div className="text-2xl mb-2">{icon}</div>
            <p className="text-xs text-black dark:text-white opacity-60 uppercase tracking-wider font-medium">{label}</p>
            <p className="text-3xl font-bold text-black dark:text-white mt-1">{value}</p>
            {sub && <p className="text-sm text-amber-600 font-medium mt-0.5">{sub}</p>}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
          <h2 className="text-base font-semibold text-black dark:text-white mb-5">Admissions Funnel</h2>
          <FunnelBar pipeline={stats.pipelineSummary} totalProspects={stats.totalProspects} />
          <p className="text-xs text-black dark:text-white opacity-50 mt-4">
            {stats.totalProspects} total prospects in pipeline
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6 flex flex-col">
          <h2 className="text-base font-semibold text-black dark:text-white mb-4">Recent Activity</h2>
          <div className="space-y-3 flex-1 overflow-y-auto max-h-80">
            {recentActivity.length === 0 && (
              <p className="text-sm text-black dark:text-white opacity-50 italic">No recent activity</p>
            )}
            {recentActivity.slice(0, 10).map((item, i) => (
              <div key={i} className="flex gap-2 items-start">
                <span className="mt-1 w-2 h-2 rounded-full bg-blue-400 shrink-0" />
                <div>
                  <p className="text-sm text-black dark:text-white">{item.text}</p>
                  <p className="text-xs text-black dark:text-white opacity-50">
                    {new Date(item.at).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
