import React, { useState } from 'react';
import { GradingSystem } from 'shared';

const GRADING_SYSTEMS: { value: GradingSystem; label: string; description: string }[] = [
  {
    value: 'local_alphabetical',
    label: 'Alphabetical (A-F)',
    description: 'Standard US grading: A+ through F',
  },
  {
    value: 'local_integer',
    label: 'Percentage (0-100)',
    description: '100% perfect, 0% failing',
  },
  {
    value: 'national_ccss',
    label: 'National Standards (CCSS)',
    description: 'Common Core State Standards',
  },
  {
    value: 'state_standards',
    label: 'State Standards',
    description: 'Your state\'s education standards',
  },
  {
    value: 'international_ib',
    label: 'International (IB)',
    description: 'International Baccalaureate',
  },
];

export default function TeacherDashboard() {
  const [formData, setFormData] = useState({
    unitTitle: 'Algebra',
    subject: 'Math',
    gradeLevel: '7',
    durationWeeks: '4',
    gradingSystem: 'local_alphabetical' as GradingSystem,
  });

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleGenerateCurriculum = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/curriculum/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.unitTitle,
          gradeLevel: formData.gradeLevel,
          subject: formData.subject,
          durationWeeks: parseInt(formData.durationWeeks),
          gradingSystem: formData.gradingSystem,
        }),
      });

      if (!response.ok) throw new Error('Failed to generate curriculum');

      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error('Error:', error);
      alert('Error generating curriculum. Check console.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900">Nicodemus Dashboard</h1>
          <p className="text-lg text-gray-600 mt-2">Phase 1a: Teacher Curriculum Assistant</p>
          <div className="mt-4 inline-block bg-green-100 text-green-800 px-4 py-2 rounded-lg font-semibold">
            Phase 1a Active
          </div>
        </div>

        {/* Main Form Card */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Generate New Curriculum</h2>

          <form onSubmit={handleGenerateCurriculum} className="space-y-6">
            {/* Row 1: Unit Title & Subject */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Unit Title</label>
                <input
                  type="text"
                  name="unitTitle"
                  value={formData.unitTitle}
                  onChange={handleInputChange}
                  placeholder="e.g., Fractions, Photosynthesis"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Subject</label>
                <select
                  name="subject"
                  value={formData.subject}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="Math">Math</option>
                  <option value="Science">Science</option>
                  <option value="English">English / Language Arts</option>
                  <option value="Social Studies">Social Studies</option>
                  <option value="History">History</option>
                  <option value="Art">Art</option>
                  <option value="PE">Physical Education</option>
                </select>
              </div>
            </div>

            {/* Row 2: Grade Level & Duration */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Grade Level</label>
                <input
                  type="text"
                  name="gradeLevel"
                  value={formData.gradeLevel}
                  onChange={handleInputChange}
                  placeholder="e.g., K, 1, 2, ... 12"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Duration (Weeks)
                </label>
                <input
                  type="number"
                  name="durationWeeks"
                  value={formData.durationWeeks}
                  onChange={handleInputChange}
                  min="1"
                  max="36"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
            </div>

            {/* Grading System Dropdown (NEW!) */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Grading System
              </label>
              <div className="space-y-2">
                {GRADING_SYSTEMS.map((system) => (
                  <label
                    key={system.value}
                    className="flex items-center p-4 border-2 rounded-lg cursor-pointer hover:bg-blue-50 transition"
                    style={{
                      borderColor: formData.gradingSystem === system.value ? '#3b82f6' : '#e5e7eb',
                      backgroundColor:
                        formData.gradingSystem === system.value ? '#eff6ff' : 'transparent',
                    }}
                  >
                    <input
                      type="radio"
                      name="gradingSystem"
                      value={system.value}
                      checked={formData.gradingSystem === system.value}
                      onChange={handleInputChange}
                      className="w-5 h-5 text-blue-600 cursor-pointer"
                      required
                    />
                    <div className="ml-4">
                      <p className="font-semibold text-gray-900">{system.label}</p>
                      <p className="text-sm text-gray-600">{system.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-4 px-6 rounded-lg text-lg transition duration-200"
            >
              {loading ? 'Generating Curriculum...' : 'Generate Curriculum Unit'}
            </button>
          </form>
        </div>

        {/* Results Card */}
        {result && (
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Generated Curriculum</h3>
            <div className="bg-gray-50 p-6 rounded-lg max-h-96 overflow-y-auto">
              <pre className="text-sm text-gray-700 font-mono whitespace-pre-wrap">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="animate-spin inline-block w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full"></div>
            <p className="mt-4 text-gray-600 font-semibold">Generating your curriculum...</p>
          </div>
        )}
      </div>
    </div>
  );
}
