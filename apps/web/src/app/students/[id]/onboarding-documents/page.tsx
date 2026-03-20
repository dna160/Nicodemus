'use client';

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
  verified_by?: string | null;
  signed_url?: string | null;
};

type Summary = { total: number; completed: number; pending: number; submitted: number };

// ============================================================
// Helpers
// ============================================================

const STATUS_CONFIG: Record<DocStatus, { label: string; badge: string; icon: string }> = {
  pending: {
    label: 'Pending',
    badge: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400',
    icon: '⭕',
  },
  submitted: {
    label: 'Submitted — Awaiting Review',
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    icon: '⏳',
  },
  verified: {
    label: 'Verified',
    badge: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    icon: '✅',
  },
  rejected: {
    label: 'Rejected',
    badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    icon: '❌',
  },
};

function formatDate(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ============================================================
// Reject Reason Modal
// ============================================================

function RejectModal({
  onConfirm,
  onCancel,
}: {
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-md p-6 border border-neutral-200 dark:border-neutral-700 space-y-4">
        <h3 className="font-bold text-neutral-900 dark:text-neutral-100">Reject Document</h3>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Provide a reason so the parent knows what to fix when re-uploading.
        </p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder="e.g. Missing signature on page 2, please resubmit with all pages signed."
          className="w-full px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
        />
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2 text-sm font-medium border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => reason.trim() && onConfirm(reason.trim())}
            disabled={!reason.trim()}
            className="flex-1 py-2 text-sm font-semibold bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-lg transition-colors"
          >
            Reject & Notify Parent
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Document Preview
// ============================================================

function DocumentPreview({ url, onClose }: { url: string; onClose: () => void }) {
  const isPdf = url.includes('.pdf') || url.includes('application%2Fpdf');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-3xl h-[80vh] flex flex-col border border-neutral-200 dark:border-neutral-700">
        <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-200 dark:border-neutral-700">
          <span className="font-semibold text-sm text-neutral-800 dark:text-neutral-100">Document Preview</span>
          <div className="flex gap-2">
            <a
              href={url}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
            >
              Download
            </a>
            <button
              onClick={onClose}
              className="px-3 py-1 text-xs font-medium border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800"
            >
              Close
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-hidden rounded-b-2xl">
          {isPdf ? (
            <iframe src={url} className="w-full h-full" title="Document preview" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-neutral-50 dark:bg-neutral-800 p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt="Document preview"
                className="max-w-full max-h-full object-contain rounded"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Main Page
// ============================================================

export default function OnboardingDocumentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: studentId } = use(params);

  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [summary, setSummary] = useState<Summary>({ total: 0, completed: 0, pending: 0, submitted: 0 });
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [rejectingType, setRejectingType] = useState<DocumentType | null>(null);

  // In real app, admin ID comes from auth session
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

  async function handleAction(documentType: DocumentType, action: 'verify' | 'reject', rejectionReason?: string) {
    setActionId(documentType);
    try {
      const res = await fetch(`/api/onboarding/checklist/${studentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentType, action, adminId, rejectionReason }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error ?? 'Action failed');

      // Update local state
      setItems((prev) =>
        prev.map((item) =>
          item.document_type === documentType
            ? {
                ...item,
                status: action === 'verify' ? 'verified' : 'rejected',
                rejection_reason: rejectionReason ?? null,
                admin_verification_date: action === 'verify' ? new Date().toISOString() : null,
                verified_by: action === 'verify' ? adminId : null,
              }
            : item
        )
      );
      setSummary((prev) => ({
        ...prev,
        completed: action === 'verify' ? prev.completed + 1 : prev.completed,
        submitted: Math.max(0, prev.submitted - 1),
      }));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionId(null);
      setRejectingType(null);
    }
  }

  const completionPct = summary.total > 0 ? Math.round((summary.completed / summary.total) * 100) : 0;

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 py-8 px-4">
      {/* Reject Modal */}
      {rejectingType && (
        <RejectModal
          onConfirm={(reason) => handleAction(rejectingType, 'reject', reason)}
          onCancel={() => setRejectingType(null)}
        />
      )}

      {/* Preview Modal */}
      {previewUrl && (
        <DocumentPreview url={previewUrl} onClose={() => setPreviewUrl(null)} />
      )}

      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
              Onboarding Documents
            </h1>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Student ID: {studentId}
            </p>
          </div>
          <button
            onClick={fetchChecklist}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Loading...' : '↻ Refresh'}
          </button>
        </div>

        {/* Progress */}
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-5">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-neutral-600 dark:text-neutral-400">
              {summary.completed} / {summary.total} verified
            </span>
            <span className="font-semibold text-blue-600">{completionPct}%</span>
          </div>
          <div className="h-2.5 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                completionPct === 100 ? 'bg-green-500' : 'bg-blue-500'
              }`}
              style={{ width: `${completionPct}%` }}
            />
          </div>
          <div className="flex gap-4 mt-3 text-xs text-neutral-500 dark:text-neutral-400">
            <span>⏳ {summary.submitted} awaiting review</span>
            <span>⭕ {summary.pending} pending upload</span>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {/* Document Cards */}
        {loading && items.length === 0 ? (
          <div className="text-center py-12 text-sm text-neutral-400">Loading documents...</div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => {
              const cfg = STATUS_CONFIG[item.status];
              const label = DOCUMENT_TYPE_LABELS[item.document_type] ?? item.document_type;
              const isActioning = actionId === item.document_type;
              const canReview = item.status === 'submitted';

              return (
                <div
                  key={item.id}
                  className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <span className="text-2xl flex-shrink-0">{cfg.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-neutral-900 dark:text-neutral-100">
                          {label}
                        </p>
                        <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium mt-1 ${cfg.badge}`}>
                          {cfg.label}
                        </span>

                        <div className="mt-2 space-y-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                          {item.submission_date && (
                            <p>Submitted: {formatDate(item.submission_date)}</p>
                          )}
                          {item.admin_verification_date && (
                            <p className="text-green-600 dark:text-green-400">
                              Verified: {formatDate(item.admin_verification_date)}
                            </p>
                          )}
                          {item.reminder_count > 0 && (
                            <p>Reminders sent: {item.reminder_count} (last: {formatDate(item.reminder_last_sent_at)})</p>
                          )}
                          {item.rejection_reason && (
                            <p className="text-red-600 dark:text-red-400">
                              Rejection reason: {item.rejection_reason}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 flex-shrink-0">
                      {item.signed_url && (
                        <button
                          onClick={() => setPreviewUrl(item.signed_url!)}
                          className="py-1.5 px-3 text-xs font-medium border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 transition-colors"
                        >
                          View
                        </button>
                      )}
                      {canReview && (
                        <>
                          <button
                            onClick={() => handleAction(item.document_type, 'verify')}
                            disabled={isActioning}
                            className="py-1.5 px-3 text-xs font-semibold bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg transition-colors"
                          >
                            {isActioning ? '...' : 'Verify'}
                          </button>
                          <button
                            onClick={() => setRejectingType(item.document_type)}
                            disabled={isActioning}
                            className="py-1.5 px-3 text-xs font-semibold bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-lg transition-colors"
                          >
                            Reject
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
