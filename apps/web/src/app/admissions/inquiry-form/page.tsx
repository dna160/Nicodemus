'use client';

import { useState } from 'react';

type FormState = {
  parent_name: string;
  email: string;
  phone: string;
  child_name: string;
  grade_interested: string;
  school_id: string;
  // Open-ended inquiry questions
  current_school: string;
  reason_for_switching: string;
  specific_concerns: string;
  extracurricular_interests: string;
  how_did_you_hear: string;
};

const GRADES = ['K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

const INITIAL_STATE: FormState = {
  parent_name: '',
  email: '',
  phone: '',
  child_name: '',
  grade_interested: '',
  school_id: '',
  current_school: '',
  reason_for_switching: '',
  specific_concerns: '',
  extracurricular_interests: '',
  how_did_you_hear: '',
};

type SubmitStatus = 'idle' | 'submitting' | 'success' | 'error';

export default function InquiryFormPage() {
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [status, setStatus] = useState<SubmitStatus>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('submitting');
    setErrorMsg('');

    try {
      const res = await fetch('/api/public/inquiry-form', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentName: form.parent_name,
          email: form.email,
          phone: form.phone,
          childName: form.child_name,
          gradeInterested: form.grade_interested,
          schoolId: form.school_id || undefined,
          source: form.how_did_you_hear || 'website',
          inquiryResponses: [
            { question: 'Current School', answer: form.current_school },
            { question: 'Reason for Switching', answer: form.reason_for_switching },
            { question: 'Specific Concerns', answer: form.specific_concerns },
            { question: 'Extracurricular Interests', answer: form.extracurricular_interests },
            { question: 'How Did You Hear', answer: form.how_did_you_hear },
          ].filter((r) => r.answer),
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error ?? 'Submission failed. Please try again.');
      }

      setStatus('success');
    } catch (err: any) {
      setStatus('error');
      setErrorMsg(err.message);
    }
  };

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-10 max-w-lg w-full text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h1 className="text-2xl font-bold text-neutral-900 mb-3">
            Thank You for Your Interest!
          </h1>
          <p className="text-neutral-600 mb-6">
            We&apos;ve received your inquiry for{' '}
            <strong>{form.child_name}</strong>. Our admissions team will be in touch
            within 1–2 business days to discuss next steps and schedule a tour.
          </p>
          <div className="bg-blue-50 rounded-xl p-4 text-sm text-blue-700 mb-6">
            A confirmation email will be sent to <strong>{form.email}</strong>
          </div>
          <button
            onClick={() => {
              setForm(INITIAL_STATE);
              setStatus('idle');
            }}
            className="text-sm text-blue-600 hover:text-blue-700 underline"
          >
            Submit another inquiry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-neutral-900 mb-2">
            School Inquiry Form
          </h1>
          <p className="text-neutral-600">
            Interested in enrolling your child? Fill out the form below and our
            admissions team will reach out to you.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-xl p-8 space-y-6"
        >
          {/* Section: Contact Information */}
          <div>
            <h2 className="text-lg font-semibold text-neutral-800 mb-4 pb-2 border-b border-neutral-100">
              Contact Information
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Parent / Guardian Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="parent_name"
                  required
                  value={form.parent_name}
                  onChange={handleChange}
                  placeholder="Jane Smith"
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  name="email"
                  required
                  value={form.email}
                  onChange={handleChange}
                  placeholder="jane@example.com"
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="(555) 123-4567"
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Section: Child Information */}
          <div>
            <h2 className="text-lg font-semibold text-neutral-800 mb-4 pb-2 border-b border-neutral-100">
              Student Information
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Child&apos;s Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="child_name"
                  required
                  value={form.child_name}
                  onChange={handleChange}
                  placeholder="Alex Smith"
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Grade Applying For <span className="text-red-500">*</span>
                </label>
                <select
                  name="grade_interested"
                  required
                  value={form.grade_interested}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select grade...</option>
                  {GRADES.map((g) => (
                    <option key={g} value={g}>
                      {g === 'K' ? 'Kindergarten' : `Grade ${g}`}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Current School (if applicable)
                </label>
                <input
                  type="text"
                  name="current_school"
                  value={form.current_school}
                  onChange={handleChange}
                  placeholder="Lincoln Elementary School"
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Section: Open-Ended Questions */}
          <div>
            <h2 className="text-lg font-semibold text-neutral-800 mb-4 pb-2 border-b border-neutral-100">
              Tell Us More
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  What brings you to consider our school?
                </label>
                <textarea
                  name="reason_for_switching"
                  value={form.reason_for_switching}
                  onChange={handleChange}
                  rows={3}
                  placeholder="We're looking for a school that focuses on..."
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Any specific concerns or questions about our program?
                </label>
                <textarea
                  name="specific_concerns"
                  value={form.specific_concerns}
                  onChange={handleChange}
                  rows={3}
                  placeholder="We'd like to know more about..."
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  What extracurricular activities is your child interested in?
                </label>
                <input
                  type="text"
                  name="extracurricular_interests"
                  value={form.extracurricular_interests}
                  onChange={handleChange}
                  placeholder="Soccer, drama, robotics..."
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  How did you hear about us?
                </label>
                <select
                  name="how_did_you_hear"
                  value={form.how_did_you_hear}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select one...</option>
                  <option value="referral">Friend or Family Referral</option>
                  <option value="open_house">Open House Event</option>
                  <option value="google">Google / Online Search</option>
                  <option value="social_media">Social Media</option>
                  <option value="flyer">Flyer or Poster</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {status === 'error' && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              {errorMsg || 'Something went wrong. Please try again.'}
            </div>
          )}

          {/* Submit */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={status === 'submitting'}
              className="w-full py-3 px-6 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold rounded-xl transition-colors text-sm"
            >
              {status === 'submitting' ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Submitting...
                </span>
              ) : (
                'Submit Inquiry'
              )}
            </button>
            <p className="text-xs text-neutral-400 text-center mt-3">
              By submitting, you agree to be contacted by our admissions team regarding your inquiry.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
