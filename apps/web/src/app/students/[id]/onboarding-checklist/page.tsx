'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, use } from 'react';
import { DOCUMENT_TYPE_LABELS, type DocumentType } from 'shared';

// ============================================================
// Types
// ============================================================

type DocStatus = 'pending' | 'submitted' | 'verified' | 'rejected';

type ChecklistItem = {
  id: string;
  document_type: DocumentType;
  status: DocStatus;
  submission_date?: string | null;
  admin_verification_date?: string | null;
  rejection_reason?: string | null;
  reminder_count: number;
  reminder_last_sent_at?: string | null;
  signed_url?: string | null;
};

type Summary = { total: number; completed: number; pending: number; submitted: number };

// ============================================================
// Helpers
// ============================================================

const STATUS_BADGE: Record<DocStatus, string> = {
  pending: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400',
  submitted: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  verified: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};

const STATUS_ICON: Record<DocStatus, string> = {
  pending: '⭕',
  submitted: '⏳',
  verified: '✅',
  rejected: '❌',
};

function formatDate(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ============================================================
// Main Page
// ============================================================

export default function OnboardingChecklistPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: studentId } = use(params);

  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [summary, setSummary] = useState<Summary>({ total: 0, completed: 0, pending: 0, submitted: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [reminderSending, setReminderSending] = useState(false);
  const [reminderMsg, setReminderMsg] = useState<string | null>(null);

  const adminId = 'admin';

  const fetchChecklist = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/onboarding/checklist/${studentId}`);
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error ?? 'Failed to load checklist');
      setItems(data.items);
      setSummary(data.summary);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    fetchChecklist();
  }, [fetchChecklist]);

  async function handleVerify(documentType: DocumentType) {
    setActionId(documentType);
    try {
      const res = await fetch(`/api/onboarding/checklist/${studentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentType, action: 'verify', adminId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error ?? 'Failed to verify');

      setItems((prev) =>
        prev.map((item) =>
          item.document_type === documentType
            ? { ...item, status: 'verified', admin_verification_date: new Date().toISOString() }
            : item
        )
      );
      setSummary((prev) => ({ ...prev, completed: prev.completed + 1, submitted: Math.max(0, prev.submitted - 1) }));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionId(null);
    }
  }

  async function handleSendReminder() {
    setReminderSending(true);
    setReminderMsg(null);
    try {
      const res = await fetch('/api/onboarding/reminder-missing-docs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Note: real key from env, here as placeholder
          'x-internal-api-key': process.env.NEXT_PUBLIC_INTERNAL_API_KEY ?? 'dev-key',
        },
        body: JSON.stringify({ schoolId: undefined }), // trigger for all schools
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error ?? 'Reminder trigger failed');
      setReminderMsg(`Reminder sent! (${data.remindersQueued} queued)`);
    } catch (err: any) {
      setReminderMsg(`Error: ${err.message}`);
    } finally {
      setReminderSending(false);
    }
  }

  const completionPct = summary.total > 0 ? Math.round((summary.completed / summary.total) * 100) : 0;
  const hasPending = items.some((i) => i.status === 'pending' || i.status === 'rejected');

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
              Onboarding Checklist
            </h1>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Admin view — Student ID: {studentId}
            </p>
          </div>
          <div className="flex gap-2">
            {hasPending && (
              <button
                onClick={handleSendReminder}
                disabled={reminderSending}
                className="px-4 py-2 text-sm font-medium bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white rounded-lg transition-colors"
              >
                {reminderSending ? 'Sending...' : '📧 Send Reminder'}
              </button>
            )}
            <a
              href={`/students/${studentId}/onboarding-documents`}
              className="px-4 py-2 text-sm font-medium bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors text-neutral-700 dark:text-neutral-300"
            >
              View Documents →
            </a>
          </div>
        </div>

        {/* Reminder Message */}
        {reminderMsg && (
          <div className={`p-3 rounded-xl text-sm ${
            reminderMsg.startsWith('Error')
              ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
              : 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300'
          }`}>
            {reminderMsg}
          </div>
        )}

        {/* Progress Card */}
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-5">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-neutral-600 dark:text-neutral-400 font-medium">
              Completion Progress
            </span>
            <span className={`font-bold ${completionPct === 100 ? 'text-green-600' : 'text-blue-600'}`}>
              {completionPct}%
            </span>
          </div>
          <div className="h-3 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                completionPct === 100 ? 'bg-green-500' : 'bg-blue-500'
              }`}
              style={{ width: `${completionPct}%` }}
            />
          </div>

          {/* Stats Row */}
          <div className="flex gap-6 mt-4 text-sm">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{summary.completed}</p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">Verified</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">{summary.submitted}</p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">Under Review</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-neutral-500">{summary.pending}</p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">Not Uploaded</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-neutral-800 dark:text-neutral-100">{summary.total}</p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">Total Required</p>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {/* Checklist Items */}
        {loading && items.length === 0 ? (
          <div className="text-center py-12 text-sm text-neutral-400">Loading checklist...</div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => {
              const label = DOCUMENT_TYPE_LABELS[item.document_type] ?? item.document_type;
              const isActioning = actionId === item.document_type;

              return (
                <div
                  key={item.id}
                  className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1">
                      <span className="text-xl">{STATUS_ICON[item.status]}</span>
                      <div>
                        <p className="font-semibold text-sm text-neutral-900 dark:text-neutral-100">
                          {label}
                        </p>
                        <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium mt-1 capitalize ${STATUS_BADGE[item.status]}`}>
                          {item.status.replace('_', ' ')}
                        </span>

                        {/* Metadata */}
                        <div className="mt-2 text-xs text-neutral-400 space-y-0.5">
                          {item.submission_date && (
                            <p>Submitted: {formatDate(item.submission_date)}</p>
                          )}
                          {item.admin_verification_date && (
                            <p className="text-green-600 dark:text-green-400">
                              Verified: {formatDate(item.admin_verification_date)}
                            </p>
                          )}
                          {item.reminder_count > 0 && (
                            <p>
                              Reminders sent: <strong>{item.reminder_count}</strong>
                              {item.reminder_last_sent_at && ` (last: ${formatDate(item.reminder_last_sent_at)})`}
                            </p>
                          )}
                          {item.rejection_reason && (
                            <p className="text-red-500 dark:text-red-400">
                              Rejection: {item.rejection_reason}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Quick Verify */}
                    {item.status === 'submitted' && (
                      <div className="flex gap-2 flex-shrink-0">
                        {item.signed_url && (
                          <a
                            href={item.signed_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="py-1.5 px-3 text-xs font-medium border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300"
                          >
                            View
                          </a>
                        )}
                        <button
                          onClick={() => handleVerify(item.document_type)}
                          disabled={isActioning}
                          className="py-1.5 px-3 text-xs font-semibold bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg transition-colors"
                        >
                          {isActioning ? '...' : '✓ Verify'}
                        </button>
                        <a
                          href={`/students/${studentId}/onboarding-documents`}
                          className="py-1.5 px-3 text-xs font-medium bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-400 rounded-lg transition-colors"
                        >
                          Review
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Reminder History Info */}
        {items.some((i) => i.reminder_count > 0) && (
          <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl p-4 text-sm text-amber-700 dark:text-amber-300">
            <p className="font-semibold mb-1">Reminder History</p>
            <ul className="space-y-1 text-xs">
              {items
                .filter((i) => i.reminder_count > 0)
                .map((i) => (
                  <li key={i.id}>
                    {DOCUMENT_TYPE_LABELS[i.document_type] ?? i.document_type}: {i.reminder_count} reminder
                    {i.reminder_count !== 1 ? 's' : ''} sent
                    {i.reminder_last_sent_at && `, last on ${formatDate(i.reminder_last_sent_at)}`}
                  </li>
                ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
