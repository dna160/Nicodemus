'use client';

import React, { useState } from 'react';
import { CurriculumBrowse } from './curriculum-browse';
import { CurriculumDetail } from './curriculum-detail';

type CurriculumView = 'browse' | 'detail' | 'generate';

interface CurriculumTabProps {
  teacherId: string;
}

interface FormData {
  title: string;
  subject: string;
  gradeLevel: string;
  durationWeeks: number;
  gradingSystem: string;
}

export function CurriculumTab({ teacherId }: CurriculumTabProps) {
  const [view, setView] = useState<CurriculumView>('browse');
  const [selectedCurriculumId, setSelectedCurriculumId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [generatingVariant, setGeneratingVariant] = useState(false);

  const [formData, setFormData] = useState<FormData>({
    title: '',
    subject: 'Math',
    gradeLevel: '',
    durationWeeks: 8,
    gradingSystem: 'local_alphabetical',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/curriculum/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title,
          subject: formData.subject,
          gradeLevel: formData.gradeLevel,
          durationWeeks: formData.durationWeeks,
          gradingSystem: formData.gradingSystem,
          teacherId,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setResult(data.lesson);
        setFormData({
          title: '',
          subject: 'Math',
          gradeLevel: '',
          durationWeeks: 8,
          gradingSystem: 'local_alphabetical',
        });
        // Navigate to the newly generated curriculum detail view
        const generatedId = data.lesson.id;
        setSelectedCurriculumId(generatedId);
        setView('detail');
      } else {
        alert('Generation failed: ' + data.error);
      }
    } catch (error) {
      console.error('Generation failed:', error);
      alert('Generation failed: ' + error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCurriculum = (id: string) => {
    setSelectedCurriculumId(id);
    setView('detail');
  };

  const handleBackFromDetail = () => {
    setView('browse');
    setSelectedCurriculumId(null);
  };

  const handleGenerateNew = () => {
    setView('generate');
  };

  const handleDuplicate = async () => {
    if (!selectedCurriculumId) return;

    try {
      // Fetch the curriculum to get its data
      const res = await fetch(`/api/curriculum/${selectedCurriculumId}`);
      const data = await res.json();

      if (data.success) {
        const curriculum = data.curriculum;
        setFormData({
          title: `${curriculum.title} (Copy)`,
          subject: curriculum.subject,
          gradeLevel: curriculum.gradeLevel,
          durationWeeks: curriculum.parsed?.units?.length || 8,
          gradingSystem: curriculum.gradingSystem || 'local_alphabetical',
        });
        setView('generate');
      }
    } catch (error) {
      console.error('Failed to duplicate curriculum:', error);
      alert('Failed to duplicate curriculum');
    }
  };

  const handleGenerateVariant = async (style: string) => {
    if (!selectedCurriculumId) return;

    setGeneratingVariant(true);
    try {
      // Fetch the current curriculum to use as basis for variant
      const res = await fetch(`/api/curriculum/${selectedCurriculumId}`);
      const data = await res.json();

      if (data.success) {
        const curriculum = data.curriculum;
        const variantTitle = `${curriculum.title} - ${style}`;
        const durationWeeks = curriculum.parsed?.units?.length || 8;

        // Call the curriculum generation endpoint with a custom prompt for the variant
        const response = await fetch('/api/curriculum/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: variantTitle,
            subject: curriculum.subject,
            gradeLevel: curriculum.gradeLevel,
            gradingSystem: curriculum.gradingSystem || 'local_alphabetical',
            durationWeeks,
            teacherId,
            customPrompt: `Create a curriculum for a ${style} teaching approach. This should be based on "${curriculum.title}" but optimized for ${style} pedagogy. Grade level: ${curriculum.gradeLevel}, Subject: ${curriculum.subject}`,
          }),
        });

        const variantData = await response.json();
        if (variantData.success) {
          // Navigate to the newly generated variant
          const variantId = variantData.lesson.id;
          setSelectedCurriculumId(variantId);
          setView('detail');
        } else {
          alert('Failed to generate variant: ' + variantData.error);
        }
      }
    } catch (error) {
      console.error('Failed to generate variant:', error);
      alert('Failed to generate variant');
    } finally {
      setGeneratingVariant(false);
    }
  };

  return (
    <>
      {view === 'browse' && (
        <CurriculumBrowse
          teacherId={teacherId}
          onSelectCurriculum={handleSelectCurriculum}
          onGenerateNew={handleGenerateNew}
        />
      )}

      {view === 'detail' && selectedCurriculumId && (
        <CurriculumDetail
          curriculumId={selectedCurriculumId}
          onBack={handleBackFromDetail}
          onGenerateVariant={handleGenerateVariant}
          onDuplicate={handleDuplicate}
          generatingVariant={generatingVariant}
        />
      )}

      {view === 'generate' && (
        <div className="space-y-6">
          <button
            onClick={() => setView('browse')}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            ← Back to Curriculums
          </button>

          <section className="bg-white dark:bg-neutral-900 p-6 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
            <h2 className="text-xl font-semibold mb-4 text-neutral-800 dark:text-neutral-200">
              {formData.title.includes('Copy') ? 'Duplicate Curriculum' : 'Generate New Curriculum'}
            </h2>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Unit Title</label>
                <input
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Fractions & Decimals"
                  className="w-full p-2 rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Subject</label>
                <select
                  value={formData.subject}
                  onChange={e => setFormData({ ...formData, subject: e.target.value })}
                  className="w-full p-2 rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent"
                >
                  <option>Math</option>
                  <option>Science</option>
                  <option>English</option>
                  <option>History</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Grade Level</label>
                <input
                  value={formData.gradeLevel}
                  onChange={e => setFormData({ ...formData, gradeLevel: e.target.value })}
                  placeholder="e.g. 5"
                  className="w-full p-2 rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Duration (Days)</label>
                <input
                  type="number"
                  value={formData.durationWeeks}
                  onChange={e => setFormData({ ...formData, durationWeeks: parseInt(e.target.value) })}
                  className="w-full p-2 rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium">Grading System</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
                  {[
                    { id: 'local_alphabetical', label: 'Alphabetical (A-F)', desc: 'Standard US grading: A+ through F' },
                    { id: 'local_integer', label: 'Percentage (0-100)', desc: '100% perfect, 0% failing' },
                    { id: 'national_ccss', label: 'National Standards (CCSS)', desc: 'Common Core State Standards' },
                    { id: 'state_standards', label: 'State Standards', desc: "Your state's education standards" },
                    { id: 'international_ib', label: 'International (IB)', desc: 'International Baccalaureate' }
                  ].map((system) => (
                    <label key={system.id} className={`flex items-start p-3 rounded-lg border cursor-pointer transition-all ${
                      formData.gradingSystem === system.id
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                    }`}>
                      <input
                        type="radio"
                        name="gradingSystem"
                        value={system.id}
                        checked={formData.gradingSystem === system.id}
                        onChange={e => setFormData({ ...formData, gradingSystem: e.target.value })}
                        className="mt-1 mr-3"
                      />
                      <div>
                        <div className="text-sm font-semibold">{system.label}</div>
                        <div className="text-xs text-neutral-500">{system.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              <button
                disabled={loading}
                className="md:col-span-2 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {loading ? 'Generating with Claude...' : 'Generate Curriculum Unit'}
              </button>
            </form>
          </section>

          {result && (
            <section className="bg-white dark:bg-neutral-900 p-6 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm animate-in fade-in slide-in-from-bottom-4">
              <h2 className="text-xl font-semibold mb-4 text-green-600">Successfully Generated!</h2>
              <div className="space-y-4">
                <p className="text-sm text-neutral-500">
                  Your curriculum has been saved and will appear in your curriculum list.
                </p>
                <button
                  onClick={() => {
                    setResult(null);
                    setView('browse');
                  }}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  View All Curriculums
                </button>
              </div>
            </section>
          )}
        </div>
      )}
    </>
  );
}
