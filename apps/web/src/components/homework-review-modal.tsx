'use client';

import React, { useState } from 'react';
import { HomeworkQuestionEditor } from './homework-question-editor';

interface Question {
  id: string;
  prompt: string;
  type: string;
  points: number;
}

interface Rubric {
  criteria: Array<{
    name: string;
    points: number;
    description: string;
  }>;
  total_points: number;
}

interface HomeworkReviewModalProps {
  assignmentId: string;
  title: string;
  description: string;
  dueAt: string;
  content: {
    questions: Question[];
  };
  rubric: Rubric;
  onClose: () => void;
  onPublish: () => void;
  onUpdate: (data: { dueAt: string; title: string; description: string }) => Promise<void>;
}

export function HomeworkReviewModal({
  assignmentId,
  title,
  description,
  dueAt,
  content,
  rubric,
  onClose,
  onPublish,
  onUpdate,
}: HomeworkReviewModalProps) {
  const [editingDueDate, setEditingDueDate] = useState(false);
  const [newDueDate, setNewDueDate] = useState(dueAt.split('T')[0]); // Format for input[type="date"]
  const [updating, setUpdating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [editingQuestions, setEditingQuestions] = useState(false);
  const [currentContent, setCurrentContent] = useState(content);
  const [currentRubric, setCurrentRubric] = useState(rubric);

  const handleUpdateDueDate = async () => {
    setUpdating(true);
    try {
      const isoDate = new Date(newDueDate).toISOString();
      await onUpdate({
        dueAt: isoDate,
        title,
        description,
      });
      setEditingDueDate(false);
    } catch (error) {
      console.error('Failed to update due date:', error);
      alert('Failed to update due date');
    } finally {
      setUpdating(false);
    }
  };

  const handlePublish = async () => {
    setPublishing(true);
    try {
      await onPublish();
    } finally {
      setPublishing(false);
    }
  };

  const handleSaveQuestions = async (editedQuestions: Question[]) => {
    setUpdating(true);
    try {
      // Update the local state first
      setCurrentContent({
        ...currentContent,
        questions: editedQuestions,
      });

      // Call API to save and regenerate rubric
      const res = await fetch(`/api/homework/${assignmentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questions: editedQuestions,
          regenerateRubric: true,
          subject: title.split('-')[0]?.trim() || 'General',
          gradeLevel: '5', // This should ideally come from the assignment context
        }),
      });

      const response = await res.json();
      if (response.success) {
        // Update rubric if it was regenerated
        if (response.assignment.rubric) {
          setCurrentRubric(response.assignment.rubric);
        }
        setEditingQuestions(false);
      } else {
        throw new Error(response.error || 'Failed to save questions');
      }
    } catch (error) {
      console.error('Failed to save questions:', error);
      alert('Failed to save questions. Please try again.');
    } finally {
      setUpdating(false);
    }
  };

  const dueDateObj = new Date(dueAt);
  const formattedDueDate = dueDateObj.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 p-6">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                Review Homework
              </h2>
              <p className="text-sm text-neutral-500 mt-1">{title}</p>
            </div>
            <button
              onClick={onClose}
              className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Description */}
          <div>
            <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
              Description
            </h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">{description}</p>
          </div>

          {/* Due Date */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 rounded-lg">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                  Due Date
                </h3>
                {!editingDueDate && (
                  <p className="text-lg font-medium text-blue-600 dark:text-blue-400 mt-1">
                    {formattedDueDate}
                  </p>
                )}
              </div>
              {!editingDueDate ? (
                <button
                  onClick={() => setEditingDueDate(true)}
                  className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
                >
                  Change
                </button>
              ) : null}
            </div>

            {editingDueDate && (
              <div className="mt-3 space-y-3">
                <input
                  type="date"
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                  className="w-full p-2 border border-blue-300 dark:border-blue-700 rounded-md bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleUpdateDueDate}
                    disabled={updating}
                    className="flex-1 px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors disabled:opacity-50"
                  >
                    {updating ? 'Updating...' : 'Update'}
                  </button>
                  <button
                    onClick={() => setEditingDueDate(false)}
                    className="flex-1 px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-md hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Questions */}
          <div>
            {!editingQuestions ? (
              <>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                    Questions ({currentContent.questions.length})
                  </h3>
                  <button
                    onClick={() => setEditingQuestions(true)}
                    className="text-xs px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                  >
                    ✏️ Edit
                  </button>
                </div>
                <div className="space-y-3">
                  {currentContent.questions.map((question, idx) => (
                    <div
                      key={question.id}
                      className="bg-neutral-50 dark:bg-neutral-800 p-4 rounded-lg border border-neutral-200 dark:border-neutral-700"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <p className="font-medium text-neutral-900 dark:text-neutral-100">
                          Question {idx + 1}
                        </p>
                        <span className="text-xs bg-neutral-200 dark:bg-neutral-700 px-2 py-1 rounded text-neutral-700 dark:text-neutral-300">
                          {question.points} pts
                        </span>
                      </div>
                      <p className="text-neutral-700 dark:text-neutral-300 text-sm whitespace-pre-wrap">
                        {question.prompt}
                      </p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2">
                        Type: {question.type}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <HomeworkQuestionEditor
                questions={currentContent.questions}
                onSave={handleSaveQuestions}
                onCancel={() => setEditingQuestions(false)}
              />
            )}
          </div>

          {/* Rubric */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                Rubric (Total: {currentRubric.total_points} points)
              </h3>
              {currentRubric.total_points !== currentContent.questions.reduce((sum, q) => sum + q.points, 0) && (
                <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded">
                  ⚠️ Rubric may need update
                </span>
              )}
            </div>
            <div className="space-y-2">
              {currentRubric.criteria.map((criterion, idx) => (
                <div
                  key={idx}
                  className="bg-neutral-50 dark:bg-neutral-800 p-3 rounded-lg border border-neutral-200 dark:border-neutral-700"
                >
                  <div className="flex justify-between items-start mb-1">
                    <p className="font-medium text-neutral-900 dark:text-neutral-100 text-sm">
                      {criterion.name}
                    </p>
                    <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-0.5 rounded">
                      {criterion.points} pts
                    </span>
                  </div>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400">
                    {criterion.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer - Action Buttons */}
        <div className="sticky bottom-0 bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800 p-6 flex gap-3">
          <button
            onClick={onClose}
            disabled={updating || editingQuestions}
            className="flex-1 px-4 py-2 border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50"
          >
            Close
          </button>
          <button
            onClick={handlePublish}
            disabled={publishing || editingDueDate || editingQuestions || updating}
            className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {publishing ? 'Publishing...' : updating ? 'Saving...' : '✓ Publish to Students'}
          </button>
        </div>
      </div>
    </div>
  );
}
