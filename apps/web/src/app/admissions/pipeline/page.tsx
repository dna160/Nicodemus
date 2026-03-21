'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { KanbanBoard, type ProspectCard } from '@/components/kanban-board';
import { PROSPECT_STAGES, PROSPECT_STAGE_LABELS, type ProspectStage } from 'shared';

// ============================================================
// Types
// ============================================================

type Notification = {
  id: string;
  subject: string;
  body: string;
  status: string;
  created_at: string;
};

type EnrollmentFeeForm = {
  registration_fee_cents: number;
  monthly_tuition_cents: number;
  activity_fees_cents: number;
};

// ============================================================
// Prospect Detail Panel
// ============================================================

function ProspectDetailPanel({
  prospect,
  adminId,
  onClose,
  onStageChange,
  onEnrolled,
}: {
  prospect: ProspectCard;
  adminId: string;
  onClose: () => void;
  onStageChange: (newStage: ProspectStage) => Promise<void>;
  onEnrolled: () => void;
}) {
  const [drafts, setDrafts] = useState<Notification[]>([]);
  const [generatingEmail, setGeneratingEmail] = useState(false);
  const [approvingEmail, setApprovingEmail] = useState<string | null>(null);
  const [showEnrollDialog, setShowEnrollDialog] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [feeForm, setFeeForm] = useState<EnrollmentFeeForm>({
    registration_fee_cents: 50000,
    monthly_tuition_cents: 150000,
    activity_fees_cents: 5000,
  });
  const [notes, setNotes] = useState(prospect.notes ?? '');
  const [savingNotes, setSavingNotes] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  // Fetch draft emails for this prospect
  const fetchDrafts = useCallback(async () => {
    const res = await fetch(
      `/api/admissions/${prospect.id}/drafts?adminId=${adminId}`
    ).catch(() => null);
    if (!res?.ok) return;
    const data = await res.json().catch(() => null);
    if (data?.success) setDrafts(data.drafts ?? []);
  }, [prospect.id, adminId]);

  useEffect(() => {
    fetchDrafts();
  }, [fetchDrafts]);

  const totalFees =
    feeForm.registration_fee_cents +
    feeForm.monthly_tuition_cents +
    feeForm.activity_fees_cents;

  const handleGenerateEmail = async () => {
    setGeneratingEmail(true);
    setStatusMsg('');
    try {
      const res = await fetch(`/api/admissions/${prospect.id}/generate-welcome-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminId,
          schoolName: 'Nicodemus Academy',
          suggestedTourTimes: ['Monday 10AM', 'Wednesday 2PM', 'Friday 9AM'],
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg('✅ Welcome email draft generated!');
        fetchDrafts();
      } else {
        setStatusMsg(`❌ ${data.error}`);
      }
    } catch {
      setStatusMsg('❌ Failed to generate email');
    } finally {
      setGeneratingEmail(false);
    }
  };

  const handleApproveEmail = async (notificationId: string) => {
    setApprovingEmail(notificationId);
    try {
      const res = await fetch(`/api/admissions/${prospect.id}/approve-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId, adminId }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg('✅ Email approved and sent!');
        setDrafts((prev) => prev.filter((d) => d.id !== notificationId));
      } else {
        setStatusMsg(`❌ ${data.error}`);
      }
    } finally {
      setApprovingEmail(null);
    }
  };

  const handleSaveNotes = async () => {
    setSavingNotes(true);
    await fetch(`/api/admissions/pipeline/${prospect.id}/stage`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stage: prospect.current_stage,
        adminId,
        notes,
      }),
    });
    setSavingNotes(false);
    setStatusMsg('✅ Notes saved');
  };

  const handleEnroll = async () => {
    setEnrolling(true);
    setStatusMsg('');
    try {
      const res = await fetch(`/api/students/${prospect.id}/enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminId,
          gradeLevel: prospect.grade_interested,
          feeChoices: feeForm,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg(`✅ ${data.message}`);
        setShowEnrollDialog(false);
        onEnrolled();
        onClose();
      } else {
        setStatusMsg(`❌ ${data.error}`);
      }
    } catch {
      setStatusMsg('❌ Enrollment failed. Please try again.');
    } finally {
      setEnrolling(false);
    }
  };

  const inquiryResponses =
    prospect.inquiry_forms?.[0]?.form_data ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/40">
      <div className="w-full max-w-lg h-full bg-white dark:bg-neutral-900 shadow-2xl overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-neutral-200 dark:border-neutral-800 sticky top-0 bg-white dark:bg-neutral-900 z-10">
          <div>
            <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
              {prospect.child_name}
            </h2>
            <p className="text-sm text-neutral-500">Grade {prospect.grade_interested} · {prospect.parent_name}</p>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 text-2xl font-light"
          >
            ×
          </button>
        </div>

        {/* Status message */}
        {statusMsg && (
          <div className="mx-5 mt-4 px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-sm text-blue-700 dark:text-blue-300">
            {statusMsg}
          </div>
        )}

        <div className="flex-1 p-5 space-y-6">
          {/* Contact Info */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-400 mb-2">Contact</h3>
            <div className="text-sm space-y-1">
              <p><span className="text-neutral-500">Email:</span> <a href={`mailto:${prospect.email}`} className="text-blue-600 hover:underline">{prospect.email}</a></p>
              {prospect.phone && <p><span className="text-neutral-500">Phone:</span> {prospect.phone}</p>}
              <p><span className="text-neutral-500">Source:</span> {prospect.source.replace(/_/g, ' ')}</p>
              <p><span className="text-neutral-500">Inquired:</span> {new Date(prospect.created_at).toLocaleDateString()}</p>
            </div>
          </section>

          {/* Pipeline Stage */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-400 mb-2">Move Stage</h3>
            <div className="flex flex-wrap gap-2">
              {(Object.entries(PROSPECT_STAGE_LABELS) as [ProspectStage, string][]).map(([stage, label]) => (
                <button
                  key={stage}
                  disabled={prospect.current_stage === stage}
                  onClick={() => onStageChange(stage)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                    prospect.current_stage === stage
                      ? 'bg-blue-600 text-white border-blue-600 cursor-default'
                      : 'bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700 hover:border-blue-400'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </section>

          {/* Inquiry Responses */}
          {inquiryResponses.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-400 mb-2">Inquiry Responses</h3>
              <div className="space-y-3">
                {inquiryResponses.map((item: any, i: number) => (
                  <div key={i} className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-3">
                    <p className="text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">{item.question}</p>
                    <p className="text-sm text-neutral-800 dark:text-neutral-200">{item.answer}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* AI Welcome Email */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Welcome Email</h3>
              <button
                onClick={handleGenerateEmail}
                disabled={generatingEmail}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
              >
                {generatingEmail ? 'Generating…' : '✨ Generate Draft'}
              </button>
            </div>
            {drafts.length > 0 ? (
              <div className="space-y-3">
                {drafts.map((draft) => (
                  <div key={draft.id} className="border border-neutral-200 dark:border-neutral-700 rounded-lg p-3">
                    <p className="font-medium text-sm text-neutral-800 dark:text-neutral-200 mb-1">
                      {draft.subject}
                    </p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-3 mb-3">
                      {draft.body}
                    </p>
                    <button
                      onClick={() => handleApproveEmail(draft.id)}
                      disabled={approvingEmail === draft.id}
                      className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-medium disabled:opacity-50"
                    >
                      {approvingEmail === draft.id ? 'Sending…' : '✅ Approve & Send'}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-neutral-400">No drafts yet. Click Generate Draft to create one.</p>
            )}
          </section>

          {/* Admin Notes */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-400 mb-2">Admin Notes</h3>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Internal notes (not visible to parents)…"
              className="w-full px-3 py-2 text-sm border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleSaveNotes}
              disabled={savingNotes}
              className="mt-2 px-3 py-1.5 bg-neutral-700 hover:bg-neutral-600 text-white rounded-lg text-xs font-medium disabled:opacity-50"
            >
              {savingNotes ? 'Saving…' : 'Save Notes'}
            </button>
          </section>
        </div>

        {/* Enroll Button Footer */}
        {prospect.current_stage !== 'enrolled' && prospect.current_stage !== 'churned' && (
          <div className="p-5 border-t border-neutral-200 dark:border-neutral-800 sticky bottom-0 bg-white dark:bg-neutral-900">
            <button
              onClick={() => setShowEnrollDialog(true)}
              className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl text-sm transition-colors"
            >
              🎓 Enroll Student
            </button>
          </div>
        )}
      </div>

      {/* Enrollment Confirmation Dialog */}
      {showEnrollDialog && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 mb-1">
              Confirm Enrollment
            </h3>
            <p className="text-sm text-neutral-500 mb-5">
              Enrolling <strong>{prospect.child_name}</strong> (Grade {prospect.grade_interested}). A Stripe invoice will be sent to <strong>{prospect.email}</strong>.
            </p>

            {/* Fee Breakdown */}
            <div className="space-y-3 mb-5">
              {[
                { label: 'Registration Fee', key: 'registration_fee_cents' as const },
                { label: 'Monthly Tuition', key: 'monthly_tuition_cents' as const },
                { label: 'Activity Fees', key: 'activity_fees_cents' as const },
              ].map(({ label, key }) => (
                <div key={key} className="flex items-center justify-between gap-3">
                  <label className="text-sm text-neutral-700 dark:text-neutral-300 w-40">{label}</label>
                  <div className="flex items-center gap-1">
                    <span className="text-neutral-400 text-sm">$</span>
                    <input
                      type="number"
                      value={feeForm[key] / 100}
                      onChange={(e) =>
                        setFeeForm((prev) => ({
                          ...prev,
                          [key]: Math.round(parseFloat(e.target.value || '0') * 100),
                        }))
                      }
                      min={0}
                      step={0.01}
                      className="w-28 px-2 py-1.5 text-sm border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-right"
                    />
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between pt-3 border-t border-neutral-200 dark:border-neutral-700">
                <span className="font-semibold text-neutral-900 dark:text-neutral-100">Total</span>
                <span className="font-bold text-green-600 text-lg">
                  ${(totalFees / 100).toFixed(2)}
                </span>
              </div>
            </div>

            {statusMsg && (
              <p className="text-sm text-red-600 mb-3">{statusMsg}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowEnrollDialog(false)}
                disabled={enrolling}
                className="flex-1 py-2.5 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800"
              >
                Cancel
              </button>
              <button
                onClick={handleEnroll}
                disabled={enrolling || totalFees < 0}
                className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors"
              >
                {enrolling ? 'Enrolling…' : `Confirm & Send Invoice`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Main Admissions Pipeline Page
// ============================================================

export default function AdmissionsPipelinePage() {
  const [adminId, setAdminId] = useState('00000000-0000-0000-0000-000000000001');
  const [schoolId, setSchoolId] = useState('00000000-0000-0000-0000-000000000001');
  const [grouped, setGrouped] = useState<Record<ProspectStage, ProspectCard[]>>({
    inquiry_received: [],
    tour_scheduled: [],
    waitlisted: [],
    enrolled: [],
    churned: [],
  });
  const [loading, setLoading] = useState(true);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [selectedProspect, setSelectedProspect] = useState<ProspectCard | null>(null);
  const [search, setSearch] = useState('');

  const fetchPipeline = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ schoolId });
      if (search) params.set('search', search);
      const res = await fetch(`/api/admissions/pipeline?${params}`);
      const data = await res.json();
      if (data.success) setGrouped(data.grouped);
    } catch (e) {
      console.error('Pipeline fetch failed:', e);
    } finally {
      setLoading(false);
    }
  }, [schoolId, search]);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (data.user?.id) {
        setAdminId(data.user.id);
        const { data: userData } = await supabase
          .from('users')
          .select('school_id')
          .eq('id', data.user.id)
          .single();
        if (userData?.school_id) setSchoolId(userData.school_id);
      }
    });
  }, []);

  useEffect(() => {
    fetchPipeline();
  }, [fetchPipeline]);

  const handleMoveStage = async (prospectId: string, newStage: ProspectStage) => {
    setMovingId(prospectId);
    try {
      const res = await fetch(`/api/admissions/pipeline/${prospectId}/stage`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: newStage, adminId }),
      });
      const data = await res.json();
      if (data.success) {
        // Optimistically update grouped state
        setGrouped((prev) => {
          const updated = { ...prev };
          let movedCard: ProspectCard | undefined;
          for (const stage of Object.keys(updated) as ProspectStage[]) {
            const idx = updated[stage].findIndex((c) => c.id === prospectId);
            if (idx !== -1) {
              [movedCard] = updated[stage].splice(idx, 1);
              break;
            }
          }
          if (movedCard) {
            updated[newStage] = [{ ...movedCard, current_stage: newStage }, ...updated[newStage]];
          }
          return updated;
        });
      }
    } catch (e) {
      console.error('Stage move failed:', e);
    } finally {
      setMovingId(null);
    }
  };

  const totalProspects = Object.values(grouped).reduce((s, arr) => s + arr.length, 0);

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
            Admissions Pipeline
          </h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            {totalProspects} prospective students · Drag cards to move between stages
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="px-3 py-2 text-sm border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 w-56 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={fetchPipeline}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            ↻ Refresh
          </button>
          <a
            href="/admissions/inquiry-form"
            className="px-4 py-2 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-lg text-sm font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            View Public Form ↗
          </a>
        </div>
      </div>

      {/* Kanban Board */}
      {loading ? (
        <div className="flex items-center justify-center h-64 text-neutral-400">
          Loading pipeline…
        </div>
      ) : (
        <KanbanBoard
          grouped={grouped}
          onMoveStage={handleMoveStage}
          onSelectCard={setSelectedProspect}
          movingId={movingId}
        />
      )}

      {/* Prospect Detail Panel */}
      {selectedProspect && (
        <ProspectDetailPanel
          prospect={selectedProspect}
          adminId={adminId}
          onClose={() => setSelectedProspect(null)}
          onStageChange={async (newStage) => {
            await handleMoveStage(selectedProspect.id, newStage);
            setSelectedProspect((prev) => prev ? { ...prev, current_stage: newStage } : null);
          }}
          onEnrolled={() => {
            fetchPipeline();
            setSelectedProspect(null);
          }}
        />
      )}
    </div>
  );
}
