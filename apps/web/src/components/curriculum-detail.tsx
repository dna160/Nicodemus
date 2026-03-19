'use client';

import React, { useEffect, useState } from 'react';
import { ParsedCurriculum } from '@/lib/curriculum-parser';
import { HomeworkReviewModal } from './homework-review-modal';

interface CurriculumDetailProps {
  curriculumId: string;
  onBack: () => void;
  onGenerateVariant?: (style: string) => void;
  onDuplicate?: () => void;
  generatingVariant?: boolean;
  teacherId?: string;
}

interface CurriculumData {
  id: string;
  title: string;
  subject: string;
  gradeLevel: string;
  gradingSystem?: string;
  createdAt: string;
  parsed?: ParsedCurriculum;
  rawContent?: any;
}

interface Assignment {
  id: string;
  title: string;
  description?: string;
  status: 'draft' | 'active' | 'archived';
  due_at?: string;
  points_possible?: number;
  published_at?: string;
  content?: {
    questions: Array<{
      id: string;
      prompt: string;
      type: string;
      points: number;
    }>;
  };
  rubric?: {
    criteria: Array<{
      name: string;
      points: number;
      description: string;
    }>;
    total_points: number;
  };
}

export function CurriculumDetail({
  curriculumId,
  onBack,
  onGenerateVariant,
  onDuplicate,
  generatingVariant = false,
  teacherId = '00000000-0000-0000-0000-000000000001',
}: CurriculumDetailProps) {
  const [curriculum, setCurriculum] = useState<CurriculumData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['objectives', 'units'])
  );
  const [variantStyle, setVariantStyle] = useState('');
  const [showVariantMenu, setShowVariantMenu] = useState(false);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loadingHomework, setLoadingHomework] = useState(false);
  const [publishingIds, setPublishingIds] = useState<Set<string>>(new Set());
  const [selectedAssignments, setSelectedAssignments] = useState<Set<string>>(new Set());
  const [showHomeworkPrompt, setShowHomeworkPrompt] = useState(false);
  const [homeworkPrompt, setHomeworkPrompt] = useState('');
  const [generatingHomework, setGeneratingHomework] = useState(false);
  const [reviewingAssignmentId, setReviewingAssignmentId] = useState<string | null>(null);

  useEffect(() => {
    const fetchCurriculum = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/curriculum/${curriculumId}`);
        const data = await res.json();

        if (data.success) {
          setCurriculum(data.curriculum);
          // Fetch homework assignments for this curriculum
          fetchHomework(curriculumId);
        }
      } catch (error) {
        console.error('Failed to fetch curriculum:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCurriculum();
  }, [curriculumId]);

  const fetchHomework = async (lessonId: string) => {
    setLoadingHomework(true);
    try {
      const res = await fetch(`/api/homework?lessonId=${lessonId}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.assignments)) {
        setAssignments(data.assignments);
      }
    } catch (error) {
      console.error('Failed to fetch homework:', error);
    } finally {
      setLoadingHomework(false);
    }
  };

  const handlePublishHomework = async () => {
    if (selectedAssignments.size === 0) {
      alert('Please select at least one assignment to publish');
      return;
    }

    setPublishingIds(selectedAssignments);
    try {
      const res = await fetch('/api/homework/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lessonId: curriculumId,
          assignmentIds: Array.from(selectedAssignments),
          teacherId,
        }),
      });

      const data = await res.json();
      if (data.success) {
        // Refresh assignments
        await fetchHomework(curriculumId);
        setSelectedAssignments(new Set());
        alert(`Published ${selectedAssignments.size} assignment(s) to students`);
      } else {
        alert('Failed to publish homework: ' + data.error);
      }
    } catch (error) {
      console.error('Failed to publish homework:', error);
      alert('Error publishing homework');
    } finally {
      setPublishingIds(new Set());
    }
  };

  const toggleAssignmentSelection = (assignmentId: string) => {
    const newSelected = new Set(selectedAssignments);
    if (newSelected.has(assignmentId)) {
      newSelected.delete(assignmentId);
    } else {
      newSelected.add(assignmentId);
    }
    setSelectedAssignments(newSelected);
  };

  const handleGenerateCustomHomework = async () => {
    if (!homeworkPrompt.trim()) {
      alert('Please enter a homework topic');
      return;
    }

    if (!curriculum) {
      alert('Curriculum not loaded');
      return;
    }

    setGeneratingHomework(true);
    try {
      const res = await fetch('/api/homework/custom-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lessonId: curriculumId,
          teacherId,
          subject: curriculum.subject,
          gradeLevel: curriculum.gradeLevel,
          gradingSystem: curriculum.gradingSystem,
          topic: homeworkPrompt,
          curriculumContent: curriculum.rawContent,
        }),
      });

      const data = await res.json();
      if (data.success) {
        // Refresh assignments to show the new one
        await fetchHomework(curriculumId);
        setHomeworkPrompt('');
        setShowHomeworkPrompt(false);
        alert('Custom homework generated successfully!');
      } else {
        alert('Failed to generate homework: ' + data.error);
      }
    } catch (error) {
      console.error('Failed to generate homework:', error);
      alert('Error generating homework');
    } finally {
      setGeneratingHomework(false);
    }
  };

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const handleGenerateVariant = (style: string) => {
    onGenerateVariant?.(style);
    setShowVariantMenu(false);
  };

  const handleReviewHomework = (assignmentId: string) => {
    setReviewingAssignmentId(assignmentId);
  };

  const handleUpdateHomework = async (data: {
    dueAt: string;
    title: string;
    description: string;
  }) => {
    if (!reviewingAssignmentId) return;

    try {
      const res = await fetch('/api/homework/draft-update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignmentId: reviewingAssignmentId,
          dueAt: data.dueAt,
          title: data.title,
          description: data.description,
        }),
      });

      const response = await res.json();
      if (response.success) {
        // Update the local assignment
        setAssignments(
          assignments.map((a) =>
            a.id === reviewingAssignmentId
              ? {
                  ...a,
                  due_at: data.dueAt,
                  title: data.title,
                  description: data.description,
                }
              : a
          )
        );
      } else {
        throw new Error(response.error || 'Failed to update');
      }
    } catch (error) {
      console.error('Failed to update homework:', error);
      throw error;
    }
  };

  const handlePublishFromModal = async () => {
    if (!reviewingAssignmentId) return;

    try {
      setPublishingIds(new Set([...publishingIds, reviewingAssignmentId]));

      const res = await fetch('/api/homework/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lessonId: curriculumId,
          teacherId,
          assignmentIds: [reviewingAssignmentId],
        }),
      });

      const data = await res.json();
      if (data.success) {
        // Update local state
        setAssignments(
          assignments.map((a) =>
            a.id === reviewingAssignmentId ? { ...a, status: 'active' as const } : a
          )
        );
        setReviewingAssignmentId(null);
        setSelectedAssignments(new Set());
      } else {
        alert('Failed to publish: ' + data.error);
      }
    } catch (error) {
      console.error('Failed to publish homework:', error);
      alert('Error publishing homework');
    } finally {
      setPublishingIds(
        new Set([...publishingIds].filter((id) => id !== reviewingAssignmentId))
      );
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-neutral-600 dark:text-neutral-400">Loading curriculum...</p>
      </div>
    );
  }

  if (!curriculum) {
    return (
      <div className="text-center py-12">
        <p className="text-neutral-600 dark:text-neutral-400">Curriculum not found</p>
      </div>
    );
  }

  const parsed = curriculum.parsed;

  return (
    <div className="space-y-4">
      {/* Back button */}
      <button
        onClick={onBack}
        className="text-sm text-blue-600 hover:text-blue-700 font-medium"
      >
        ← Back to Curriculums
      </button>

      {/* Header */}
      <div className="bg-white dark:bg-neutral-900 p-6 rounded-xl border border-neutral-200 dark:border-neutral-800">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
              {curriculum.title}
            </h1>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="px-2 py-1 text-sm bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
                {curriculum.subject}
              </span>
              <span className="px-2 py-1 text-sm bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded">
                Grade {curriculum.gradeLevel}
              </span>
              {curriculum.gradingSystem && (
                <span className="px-2 py-1 text-sm bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-200 rounded">
                  {curriculum.gradingSystem}
                </span>
              )}
              <span className="text-xs text-neutral-500 dark:text-neutral-400 ml-auto self-center">
                Created{' '}
                {new Date(curriculum.createdAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 flex-wrap">
          <div className="relative">
            <button
              onClick={() => setShowVariantMenu(!showVariantMenu)}
              disabled={generatingVariant}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {generatingVariant ? 'Generating Variant...' : '✨ Generate Variant'}
            </button>

            {showVariantMenu && (
              <div className="absolute top-full left-0 mt-2 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg shadow-lg z-10 min-w-max">
                {[
                  { value: 'lecture', label: 'Lecture-based' },
                  { value: 'project', label: 'Project-based' },
                  { value: 'discussion', label: 'Discussion-based' },
                  { value: 'hands-on', label: 'Hands-on/Lab' },
                  { value: 'hybrid', label: 'Hybrid' },
                ].map((style) => (
                  <button
                    key={style.value}
                    onClick={() => handleGenerateVariant(style.value)}
                    disabled={generatingVariant}
                    className="w-full text-left px-4 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 first:rounded-t-lg last:rounded-b-lg disabled:opacity-50"
                  >
                    {style.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={onDuplicate}
            className="px-4 py-2 bg-neutral-600 hover:bg-neutral-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            📋 Duplicate
          </button>
        </div>
      </div>

      {/* Main Content - Key Points Sections */}
      <div className="space-y-3">
        {/* Learning Objectives */}
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
          <button
            onClick={() => toggleSection('objectives')}
            className="w-full px-6 py-4 flex justify-between items-center hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors border-b border-neutral-200 dark:border-neutral-800"
          >
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              📚 Learning Objectives
            </h2>
            <span className="text-neutral-500">
              {expandedSections.has('objectives') ? '−' : '+'}
            </span>
          </button>
          {expandedSections.has('objectives') && (
            <div className="px-6 py-4 space-y-2">
              {parsed?.learningObjectives && parsed.learningObjectives.length > 0 ? (
                parsed.learningObjectives.map((objective, i) => (
                  <div
                    key={i}
                    className="flex gap-3 text-neutral-700 dark:text-neutral-300"
                  >
                    <span className="text-blue-600 dark:text-blue-400 flex-shrink-0 font-bold">
                      •
                    </span>
                    <p>{objective}</p>
                  </div>
                ))
              ) : (
                <p className="text-neutral-500 italic">No learning objectives specified</p>
              )}
            </div>
          )}
        </div>

        {/* Units/Days */}
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
          <button
            onClick={() => toggleSection('units')}
            className="w-full px-6 py-4 flex justify-between items-center hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors border-b border-neutral-200 dark:border-neutral-800"
          >
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              📅 Daily Breakdown ({parsed?.units?.length || 0} days)
            </h2>
            <span className="text-neutral-500">
              {expandedSections.has('units') ? '−' : '+'}
            </span>
          </button>
          {expandedSections.has('units') && (
            <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {parsed?.units && parsed.units.length > 0 ? (
                parsed.units.map((unit, i) => (
                  <div key={i} className="px-6 py-4">
                    <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
                      {unit.dayLabel}: {unit.title}
                    </h3>
                    {unit.keyTopics && unit.keyTopics.length > 0 && (
                      <div className="mb-2">
                        <p className="text-sm text-neutral-600 dark:text-neutral-400 font-medium mb-1">
                          Key Topics:
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {unit.keyTopics.map((topic, j) => (
                            <span
                              key={j}
                              className="px-2 py-1 text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded"
                            >
                              {topic}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {unit.activities && unit.activities.length > 0 && (
                      <div>
                        <p className="text-sm text-neutral-600 dark:text-neutral-400 font-medium mb-1">
                          Activities:
                        </p>
                        <ul className="text-sm text-neutral-700 dark:text-neutral-300 space-y-1">
                          {unit.activities.slice(0, 3).map((activity, j) => (
                            <li key={j} className="flex gap-2">
                              <span className="text-purple-600 dark:text-purple-400">→</span>
                              <span>{activity}</span>
                            </li>
                          ))}
                          {unit.activities.length > 3 && (
                            <li className="text-neutral-500 italic">
                              +{unit.activities.length - 3} more activities
                            </li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="px-6 py-4">
                  <p className="text-neutral-500 italic">No daily breakdown available</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Key Concepts */}
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
          <button
            onClick={() => toggleSection('concepts')}
            className="w-full px-6 py-4 flex justify-between items-center hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors border-b border-neutral-200 dark:border-neutral-800"
          >
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              💡 Key Concepts
            </h2>
            <span className="text-neutral-500">
              {expandedSections.has('concepts') ? '−' : '+'}
            </span>
          </button>
          {expandedSections.has('concepts') && (
            <div className="px-6 py-4">
              {parsed?.keyConcepts && parsed.keyConcepts.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {parsed.keyConcepts.map((concept, i) => (
                    <span
                      key={i}
                      className="px-3 py-1.5 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded-full text-sm"
                    >
                      {concept}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-neutral-500 italic">No key concepts specified</p>
              )}
            </div>
          )}
        </div>

        {/* Assessment Methods */}
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
          <button
            onClick={() => toggleSection('assessment')}
            className="w-full px-6 py-4 flex justify-between items-center hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors border-b border-neutral-200 dark:border-neutral-800"
          >
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              ✅ Assessment Methods
            </h2>
            <span className="text-neutral-500">
              {expandedSections.has('assessment') ? '−' : '+'}
            </span>
          </button>
          {expandedSections.has('assessment') && (
            <div className="px-6 py-4 space-y-2">
              {parsed?.assessmentMethods && parsed.assessmentMethods.length > 0 ? (
                parsed.assessmentMethods.map((method, i) => (
                  <div key={i} className="flex gap-3 text-neutral-700 dark:text-neutral-300">
                    <span className="text-green-600 dark:text-green-400 flex-shrink-0 font-bold">
                      ✓
                    </span>
                    <p>{method}</p>
                  </div>
                ))
              ) : (
                <p className="text-neutral-500 italic">No assessment methods specified</p>
              )}
            </div>
          )}
        </div>

        {/* Homework Section */}
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
          <button
            onClick={() => toggleSection('homework')}
            className="w-full px-6 py-4 flex justify-between items-center hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors border-b border-neutral-200 dark:border-neutral-800"
          >
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              📝 Homework Assignments
            </h2>
            <span className="text-neutral-500">
              {expandedSections.has('homework') ? '−' : '+'}
            </span>
          </button>
          {expandedSections.has('homework') && (
            <div className="px-6 py-4 space-y-4">
              {/* Custom Homework Generator */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                {!showHomeworkPrompt ? (
                  <button
                    onClick={() => setShowHomeworkPrompt(true)}
                    className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                  >
                    ✨ Generate Custom Homework
                  </button>
                ) : (
                  <div className="space-y-3">
                    <label className="block text-sm font-medium text-neutral-900 dark:text-neutral-100">
                      Homework Topic (contextual to {curriculum?.subject})
                    </label>
                    <textarea
                      value={homeworkPrompt}
                      onChange={(e) => setHomeworkPrompt(e.target.value)}
                      placeholder="e.g., 'Create homework on quadratic equations focusing on real-world applications like projectile motion'"
                      className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={3}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleGenerateCustomHomework}
                        disabled={generatingHomework || !homeworkPrompt.trim()}
                        className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-neutral-400 text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed"
                      >
                        {generatingHomework ? '⏳ Generating...' : '✨ Generate'}
                      </button>
                      <button
                        onClick={() => {
                          setShowHomeworkPrompt(false);
                          setHomeworkPrompt('');
                        }}
                        disabled={generatingHomework}
                        className="px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg text-neutral-700 dark:text-neutral-300 font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {loadingHomework ? (
                <p className="text-neutral-500">Loading homework assignments...</p>
              ) : assignments.length === 0 ? (
                <p className="text-neutral-500 italic">No homework assignments generated yet</p>
              ) : (
                <>
                  {/* List of assignments */}
                  <div className="space-y-2">
                    {assignments.map((assignment) => (
                      <div
                        key={assignment.id}
                        className="p-3 border border-neutral-200 dark:border-neutral-700 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors cursor-pointer"
                        onClick={() => assignment.status === 'draft' && handleReviewHomework(assignment.id)}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={selectedAssignments.has(assignment.id)}
                            onChange={() => toggleAssignmentSelection(assignment.id)}
                            disabled={assignment.status === 'active' || publishingIds.has(assignment.id)}
                            className="mt-1 cursor-pointer disabled:opacity-50"
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div className="flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h3 className="font-medium text-neutral-900 dark:text-neutral-100">
                                  {assignment.title}
                                </h3>
                                {assignment.description && (
                                  <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
                                    {assignment.description}
                                  </p>
                                )}
                              </div>
                              <span
                                className={`px-2 py-1 text-xs font-medium rounded whitespace-nowrap ${
                                  assignment.status === 'draft'
                                    ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
                                    : assignment.status === 'active'
                                    ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                                    : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200'
                                }`}
                              >
                                {assignment.status === 'draft'
                                  ? '📋 Draft'
                                  : assignment.status === 'active'
                                  ? '✓ Published'
                                  : 'Archived'}
                              </span>
                            </div>
                            {assignment.due_at && (
                              <p className="text-xs text-neutral-500 mt-2">
                                Due:{' '}
                                {new Date(assignment.due_at).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Publish button */}
                  {assignments.some((a) => a.status === 'draft') && (
                    <div className="pt-4 border-t border-neutral-200 dark:border-neutral-700">
                      <button
                        onClick={handlePublishHomework}
                        disabled={selectedAssignments.size === 0 || publishingIds.size > 0}
                        className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-neutral-400 text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed"
                      >
                        {publishingIds.size > 0
                          ? '⏳ Publishing...'
                          : `📤 Publish ${selectedAssignments.size > 0 ? `(${selectedAssignments.size})` : ''}`}
                      </button>
                      {selectedAssignments.size > 0 && (
                        <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-2">
                          {selectedAssignments.size} assignment(s) selected for publishing
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Homework Review Modal */}
      {reviewingAssignmentId && (
        (() => {
          const assignment = assignments.find((a) => a.id === reviewingAssignmentId);
          if (!assignment) return null;

          return (
            <HomeworkReviewModal
              assignmentId={assignment.id}
              title={assignment.title}
              description={assignment.description || ''}
              dueAt={assignment.due_at || new Date().toISOString()}
              content={
                assignment.content || {
                  questions: [],
                }
              }
              rubric={
                assignment.rubric || {
                  criteria: [],
                  total_points: 0,
                }
              }
              onClose={() => setReviewingAssignmentId(null)}
              onPublish={handlePublishFromModal}
              onUpdate={handleUpdateHomework}
            />
          );
        })()
      )}
    </div>
  );
}
