'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  StudentDetailTimeline,
  type UnifiedStudent,
} from '@/components/student-detail-timeline';

// ============================================================
// Types
// ============================================================

type SortField = 'full_name' | 'grade_level' | 'last_metric_at' | 'behavior_event_count';
type SortDir = 'asc' | 'desc';

// ============================================================
// Helpers
// ============================================================

function formatDate(dateStr?: string | null) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function DistractionBadge({ value }: { value?: number | null }) {
  if (value == null) return <span className="text-neutral-400">—</span>;
  const cls =
    value > 7
      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
      : value > 4
      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
      : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
      {value.toFixed(1)}
    </span>
  );
}

// ============================================================
// Main Page
// ============================================================

const GRADE_OPTIONS = ['All', 'K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
const PAGE_SIZE = 50;

export default function UnifiedStudentListingPage() {
  const [students, setStudents] = useState<UnifiedStudent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [gradeFilter, setGradeFilter] = useState('All');
  const [sortField, setSortField] = useState<SortField>('full_name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [page, setPage] = useState(0);

  const [selectedStudent, setSelectedStudent] = useState<UnifiedStudent | null>(null);

  // In a real deployment, schoolId would come from auth context
  const schoolId = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('schoolId') ?? ''
    : '';

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(page * PAGE_SIZE) });
      if (schoolId) params.set('schoolId', schoolId);
      if (gradeFilter !== 'All') params.set('gradeLevel', gradeFilter);
      if (search) params.set('search', search);

      const res = await fetch(`/api/students/unified-listing?${params.toString()}`);
      const data = await res.json();

      if (!res.ok || !data.success) throw new Error(data.error ?? 'Failed to load students');
      setStudents(data.students);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [schoolId, gradeFilter, search, page]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  // Client-side sort
  const sorted = [...students].sort((a, b) => {
    const aVal = a[sortField] ?? '';
    const bVal = b[sortField] ?? '';
    const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
    return sortDir === 'asc' ? cmp : -cmp;
  });

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <span className="text-neutral-300 ml-1">↕</span>;
    return <span className="text-blue-500 ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  }

  return (
    <div className="flex h-screen bg-neutral-50 dark:bg-neutral-950">
      {/* Main Panel */}
      <div className={`flex flex-col flex-1 min-w-0 transition-all ${selectedStudent ? 'mr-0' : ''}`}>
        {/* Header */}
        <div className="bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
                Student Directory
              </h1>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                Unified view of all enrolled students
              </p>
            </div>
            <button
              onClick={fetchStudents}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Loading...' : '↻ Refresh'}
            </button>
          </div>

          {/* Filters */}
          <div className="flex gap-3 flex-wrap">
            <input
              type="search"
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              className="flex-1 min-w-48 px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <select
              value={gradeFilter}
              onChange={(e) => { setGradeFilter(e.target.value); setPage(0); }}
              className="px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {GRADE_OPTIONS.map((g) => (
                <option key={g} value={g}>
                  {g === 'All' ? 'All Grades' : g === 'K' ? 'Kindergarten' : `Grade ${g}`}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {loading && students.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-sm text-neutral-400">
              Loading students...
            </div>
          ) : sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-sm text-neutral-400">
              <p>No students found.</p>
              {(search || gradeFilter !== 'All') && (
                <button
                  onClick={() => { setSearch(''); setGradeFilter('All'); }}
                  className="mt-2 text-blue-500 hover:text-blue-600 underline"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 sticky top-0">
                <tr>
                  <th
                    className="text-left px-4 py-3 font-medium text-neutral-600 dark:text-neutral-400 cursor-pointer hover:text-neutral-900 dark:hover:text-neutral-100 select-none"
                    onClick={() => toggleSort('full_name')}
                  >
                    Name <SortIcon field="full_name" />
                  </th>
                  <th
                    className="text-left px-4 py-3 font-medium text-neutral-600 dark:text-neutral-400 cursor-pointer hover:text-neutral-900 dark:hover:text-neutral-100 select-none"
                    onClick={() => toggleSort('grade_level')}
                  >
                    Grade <SortIcon field="grade_level" />
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-neutral-600 dark:text-neutral-400">
                    Email
                  </th>
                  <th
                    className="text-left px-4 py-3 font-medium text-neutral-600 dark:text-neutral-400 cursor-pointer hover:text-neutral-900 dark:hover:text-neutral-100 select-none"
                    onClick={() => toggleSort('last_metric_at')}
                  >
                    Last Activity <SortIcon field="last_metric_at" />
                  </th>
                  <th
                    className="text-center px-4 py-3 font-medium text-neutral-600 dark:text-neutral-400 cursor-pointer hover:text-neutral-900 dark:hover:text-neutral-100 select-none"
                    onClick={() => toggleSort('behavior_event_count')}
                  >
                    Events <SortIcon field="behavior_event_count" />
                  </th>
                  <th className="text-center px-4 py-3 font-medium text-neutral-600 dark:text-neutral-400">
                    Distraction
                  </th>
                  <th className="text-center px-4 py-3 font-medium text-neutral-600 dark:text-neutral-400">
                    Parent Comms
                  </th>
                  <th className="text-center px-4 py-3 font-medium text-neutral-600 dark:text-neutral-400">
                    Onboarding
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {sorted.map((student) => (
                  <tr
                    key={student.id}
                    onClick={() => setSelectedStudent(student)}
                    className={`hover:bg-blue-50 dark:hover:bg-blue-900/10 cursor-pointer transition-colors ${
                      selectedStudent?.id === student.id
                        ? 'bg-blue-50 dark:bg-blue-900/10'
                        : 'bg-white dark:bg-neutral-900'
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold text-xs flex-shrink-0">
                          {student.full_name.charAt(0)}
                        </div>
                        <span className="font-medium text-neutral-900 dark:text-neutral-100">
                          {student.full_name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                      {student.grade_level === 'K' ? 'Kindergarten' : `Grade ${student.grade_level}`}
                    </td>
                    <td className="px-4 py-3 text-neutral-500 dark:text-neutral-400 max-w-48 truncate">
                      {student.email}
                    </td>
                    <td className="px-4 py-3 text-neutral-500 dark:text-neutral-400">
                      {formatDate(student.last_metric_at)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`font-semibold ${
                        (student.behavior_event_count ?? 0) > 5
                          ? 'text-amber-600'
                          : 'text-neutral-800 dark:text-neutral-100'
                      }`}>
                        {student.behavior_event_count ?? 0}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <DistractionBadge value={student.avg_distraction_index} />
                    </td>
                    <td className="px-4 py-3 text-center text-neutral-600 dark:text-neutral-400">
                      {student.parent_updates_sent ?? 0}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {student.onboarding_complete ? (
                        <span className="text-green-600 text-base">✅</span>
                      ) : (
                        <span className="text-amber-500 text-base">⏳</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {!loading && sorted.length > 0 && (
          <div className="bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800 px-6 py-3 flex items-center justify-between">
            <span className="text-sm text-neutral-500 dark:text-neutral-400">
              Showing {page * PAGE_SIZE + 1}–{page * PAGE_SIZE + sorted.length} students
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-3 py-1.5 text-sm rounded-lg border border-neutral-300 dark:border-neutral-700 disabled:opacity-40 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
              >
                ← Prev
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={sorted.length < PAGE_SIZE}
                className="px-3 py-1.5 text-sm rounded-lg border border-neutral-300 dark:border-neutral-700 disabled:opacity-40 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Side Panel */}
      {selectedStudent && (
        <div className="w-96 flex-shrink-0 bg-white dark:bg-neutral-900 border-l border-neutral-200 dark:border-neutral-800 flex flex-col overflow-hidden">
          <StudentDetailTimeline
            student={selectedStudent}
            onClose={() => setSelectedStudent(null)}
          />
        </div>
      )}
    </div>
  );
}
