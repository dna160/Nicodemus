'use client';

import { useState } from 'react';

export default function Dashboard() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [formData, setFormData] = useState({
    title: '',
    gradeLevel: '5',
    subject: 'Math',
    gradingSystem: 'local_alphabetical',
    durationWeeks: 4
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/curriculum/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await response.json();
      if (data.success) {
        setResult(data.lesson);
      } else {
        alert('Generation failed: ' + data.error);
      }
    } catch (err) {
      alert('Error: ' + err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">Nicodemus Dashboard</h1>
            <p className="text-neutral-500">Phase 1a: Teacher Curriculum Assistant</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">Phase 1a Active</span>
          </div>
        </header>

        <section className="bg-white dark:bg-neutral-900 p-6 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
          <h2 className="text-xl font-semibold mb-4 text-neutral-800 dark:text-neutral-200">Generate New Curriculum</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Unit Title</label>
              <input 
                value={formData.title}
                onChange={e => setFormData({...formData, title: e.target.value})}
                placeholder="e.g. Fractions & Decimals" 
                className="w-full p-2 rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Subject</label>
              <select 
                value={formData.subject}
                onChange={e => setFormData({...formData, subject: e.target.value})}
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
                onChange={e => setFormData({...formData, gradeLevel: e.target.value})}
                placeholder="e.g. 5" 
                className="w-full p-2 rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Duration (Weeks)</label>
              <input 
                type="number"
                value={formData.durationWeeks}
                onChange={e => setFormData({...formData, durationWeeks: parseInt(e.target.value)})}
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
                      onChange={e => setFormData({...formData, gradingSystem: e.target.value})}
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
              <div className="p-4 bg-neutral-100 dark:bg-neutral-800 rounded-lg overflow-auto max-h-96">
                <pre className="text-xs">{JSON.stringify(JSON.parse(result.content || '{}'), null, 2)}</pre>
              </div>
              <p className="text-sm text-neutral-500 italic text-right">Saved to Supabase with ID: {result.id}</p>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
