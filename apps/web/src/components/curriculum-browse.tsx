'use client';

import React, { useEffect, useState, useCallback } from 'react';

interface Curriculum {
  id: string;
  title: string;
  subject: string;
  grade_level: string;
  grading_system?: string;
  created_at: string;
}

interface CurriculumBrowseProps {
  teacherId: string;
  onSelectCurriculum: (id: string) => void;
  onGenerateNew: () => void;
}

export function CurriculumBrowse({
  teacherId,
  onSelectCurriculum,
  onGenerateNew,
}: CurriculumBrowseProps) {
  const [curriculums, setCurriculums] = useState<Curriculum[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [gradeFilter, setGradeFilter] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const limit = 50;

  const fetchCurriculums = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        teacherId,
        limit: limit.toString(),
        offset: offset.toString(),
      });

      if (searchTerm) params.append('search', searchTerm);
      if (gradeFilter) params.append('gradeLevel', gradeFilter);
      if (subjectFilter) params.append('subject', subjectFilter);

      // Add timeout to prevent infinite loading
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const res = await fetch(`/api/curriculum?${params}`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const data = await res.json();

      if (data.success) {
        setCurriculums(data.curriculums);
        setTotal(data.total);
      } else {
        console.error('API error:', data.error);
      }
    } catch (error: any) {
      console.error('Failed to fetch curriculums:', error);
      // Show empty state instead of infinite loading
      setCurriculums([]);
    } finally {
      setLoading(false);
    }
  }, [teacherId, offset, searchTerm, gradeFilter, subjectFilter]);

  useEffect(() => {
    setOffset(0);
  }, [searchTerm, gradeFilter, subjectFilter]);

  useEffect(() => {
    fetchCurriculums();
  }, [fetchCurriculums]);

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
  };

  const handleDeleteCurriculum = async (curriculumId: string) => {
    if (
      !confirm(
        'Are you sure you want to delete this curriculum? This action cannot be undone.'
      )
    ) {
      return;
    }

    try {
      const res = await fetch(`/api/curriculum/${curriculumId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacherId }),
      });

      if (res.ok) {
        setCurriculums(
          curriculums.filter((c) => c.id !== curriculumId)
        );
      } else {
        alert('Failed to delete curriculum');
      }
    } catch (error) {
      console.error('Failed to delete curriculum:', error);
      alert('Error deleting curriculum');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="space-y-4">
      {/* Header with button */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Your Curriculums</h2>
        <button
          onClick={onGenerateNew}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          + Generate New
        </button>
      </div>

      {/* Search and Filters */}
      <div className="bg-white dark:bg-neutral-900 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            type="text"
            placeholder="Search by title or subject..."
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800"
          />
          <select
            value={gradeFilter}
            onChange={(e) => setGradeFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800"
          >
            <option value="">All Grade Levels</option>
            {['K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'].map(
              (grade) => (
                <option key={grade} value={grade}>
                  Grade {grade}
                </option>
              )
            )}
          </select>
          <select
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800"
          >
            <option value="">All Subjects</option>
            {['Math', 'Science', 'English', 'History', 'Social Studies', 'Art', 'PE', 'Music'].map(
              (subject) => (
                <option key={subject} value={subject}>
                  {subject}
                </option>
              )
            )}
          </select>
        </div>
      </div>

      {/* Curriculum List */}
      <div className="space-y-2">
        {loading ? (
          <div className="text-center py-12 text-neutral-500">
            Loading curriculums...
          </div>
        ) : curriculums.length === 0 ? (
          <div className="text-center py-12 text-neutral-500">
            <p>No curriculums found.</p>
            <button
              onClick={onGenerateNew}
              className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
            >
              Create your first curriculum
            </button>
          </div>
        ) : (
          curriculums.map((curriculum) => (
            <div
              key={curriculum.id}
              className="bg-white dark:bg-neutral-900 p-4 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:shadow-sm transition-shadow"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1 cursor-pointer" onClick={() => onSelectCurriculum(curriculum.id)}>
                  <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 hover:text-blue-600 dark:hover:text-blue-400">
                    {curriculum.title}
                  </h3>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <span className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
                      {curriculum.subject}
                    </span>
                    <span className="px-2 py-1 text-xs bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded">
                      Grade {curriculum.grade_level}
                    </span>
                    {curriculum.grading_system && (
                      <span className="px-2 py-1 text-xs bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-200 rounded">
                        {curriculum.grading_system}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2">
                    Created {formatDate(curriculum.created_at)}
                  </p>
                </div>
                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => onSelectCurriculum(curriculum.id)}
                    className="px-3 py-1.5 text-sm bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                  >
                    View
                  </button>
                  <button
                    onClick={() => handleDeleteCurriculum(curriculum.id)}
                    className="px-3 py-1.5 text-sm bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {total > limit && (
        <div className="flex justify-between items-center">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Showing {offset + 1}-{Math.min(offset + limit, total)} of {total}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setOffset(Math.max(0, offset - limit))}
              disabled={offset === 0}
              className="px-3 py-1.5 text-sm rounded border border-neutral-300 dark:border-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              Previous
            </button>
            <button
              onClick={() => setOffset(offset + limit)}
              disabled={offset + limit >= total}
              className="px-3 py-1.5 text-sm rounded border border-neutral-300 dark:border-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
