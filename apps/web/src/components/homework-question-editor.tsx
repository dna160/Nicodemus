'use client';

import React, { useState } from 'react';

interface Question {
  id: string;
  prompt: string;
  type: string;
  points: number;
}

interface HomeworkQuestionEditorProps {
  questions: Question[];
  onSave: (questions: Question[]) => void;
  onCancel: () => void;
}

export function HomeworkQuestionEditor({
  questions,
  onSave,
  onCancel,
}: HomeworkQuestionEditorProps) {
  const [editedQuestions, setEditedQuestions] = useState<Question[]>(questions);
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleUpdateQuestion = (id: string, updates: Partial<Question>) => {
    setEditedQuestions(
      editedQuestions.map((q) =>
        q.id === id ? { ...q, ...updates } : q
      )
    );
  };

  const handleAddQuestion = () => {
    const newQuestion: Question = {
      id: `q_${Date.now()}`,
      prompt: 'New question',
      type: 'short_answer',
      points: 10,
    };
    setEditedQuestions([...editedQuestions, newQuestion]);
    setEditingId(newQuestion.id);
  };

  const handleRemoveQuestion = (id: string) => {
    if (editedQuestions.length === 1) {
      alert('At least one question is required');
      return;
    }
    setEditedQuestions(editedQuestions.filter((q) => q.id !== id));
  };

  const handleSave = () => {
    // Validate all questions have prompts and points
    if (editedQuestions.some((q) => !q.prompt.trim())) {
      alert('All questions must have a prompt');
      return;
    }
    if (editedQuestions.some((q) => q.points <= 0)) {
      alert('All questions must have points greater than 0');
      return;
    }
    onSave(editedQuestions);
  };

  const totalPoints = editedQuestions.reduce((sum, q) => sum + q.points, 0);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          Edit Questions
        </h3>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Total Points: {totalPoints}
        </p>
      </div>

      <div className="space-y-3 max-h-[400px] overflow-y-auto">
        {editedQuestions.map((question, idx) => (
          <div
            key={question.id}
            className="bg-neutral-50 dark:bg-neutral-800 p-4 rounded-lg border border-neutral-200 dark:border-neutral-700 space-y-3"
          >
            <div className="flex justify-between items-start gap-2">
              <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Question {idx + 1}
              </label>
              <button
                onClick={() => handleRemoveQuestion(question.id)}
                className="text-xs px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
              >
                Remove
              </button>
            </div>

            <textarea
              value={question.prompt}
              onChange={(e) =>
                handleUpdateQuestion(question.id, { prompt: e.target.value })
              }
              placeholder="Enter question text"
              className="w-full p-2 rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 text-sm"
              rows={3}
            />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  Type
                </label>
                <select
                  value={question.type}
                  onChange={(e) =>
                    handleUpdateQuestion(question.id, { type: e.target.value })
                  }
                  className="w-full mt-1 p-2 rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 text-sm"
                >
                  <option value="short_answer">Short Answer</option>
                  <option value="essay">Essay</option>
                  <option value="multiple_choice">Multiple Choice</option>
                  <option value="true_false">True/False</option>
                  <option value="matching">Matching</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  Points
                </label>
                <input
                  type="number"
                  min="1"
                  value={question.points}
                  onChange={(e) =>
                    handleUpdateQuestion(question.id, {
                      points: parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-full mt-1 p-2 rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 text-sm"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={handleAddQuestion}
        className="w-full px-3 py-2 text-sm border border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
      >
        + Add Question
      </button>

      <div className="flex gap-2 pt-4 border-t border-neutral-200 dark:border-neutral-700">
        <button
          onClick={onCancel}
          className="flex-1 px-4 py-2 border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
        >
          ✓ Save Questions
        </button>
      </div>
    </div>
  );
}
