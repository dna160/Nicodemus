'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { DOCUMENT_TYPE_LABELS, type DocumentType } from 'shared';
import { DocumentUploadForm } from '@/components/document-upload-form';

// ============================================================
// Types
// ============================================================

type ChecklistStatus = 'pending' | 'submitted' | 'verified' | 'rejected';

type ChecklistItem = {
  id: string;
  document_type: DocumentType;
  status: ChecklistStatus;
  submission_date?: string | null;
  admin_verification_date?: string | null;
  rejection_reason?: string | null;
  reminder_count: number;
  signed_url?: string | null;
};

type ChecklistSummary = {
  total: number;
  completed: number;
  pending: number;
  submitted: number;
};

// ============================================================
// Helpers
// ============================================================

const STATUS_CONFIG: Record<ChecklistStatus, { label: string; badge: string; icon: string }> = {
  pending: {
    label: 'Pending Upload',
    badge: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400',
    icon: '⭕',
  },
  submitted: {
    label: 'Under Review',
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    icon: '⏳',
  },
  verified: {
    label: 'Verified',
    badge: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    icon: '✅',
  },
  rejected: {
    label: 'Needs Resubmission',
    badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    icon: '❌',
  },
};

function formatDate(dateStr?: string | null) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ============================================================
// Main Page
// ============================================================

export default function ParentDashboardPage() {
  // In real app, studentId comes from auth session
  const [studentId, setStudentId] = useState<string | null>(null);
  const [studentName, setStudentName] = useState('Your Child');
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [summary, setSummary] = useState<ChecklistSummary>({ total: 0, completed: 0, pending: 0, submitted: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingType, setUploadingType] = useState<DocumentType | null>(null);

  // Read studentId from URL params (in real app: from auth)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sid = params.get('studentId');
    const name = params.get('name');
    if (sid) setStudentId(sid);
    if (name) setStudentName(name);
  }, []);

  const fetchChecklist = useCallback(async () => {
    if (!studentId) return;
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

  function handleUploadSuccess(documentType: DocumentType) {
    setUploadingType(null);
    // Optimistically update status
    setItems((prev) =>
      prev.map((item) =>
        item.document_type === documentType
          ? { ...item, status: 'submitted', submission_date: new Date().toISOString() }
          : item
      )
    );
    setSummary((prev) => ({ ...prev, submitted: prev.submitted + 1, pending: Math.max(0, prev.pending - 1) }));
  }

  const completionPct = summary.total > 0 ? Math.round((summary.completed / summary.total) * 100) : 0;
  const allVerified = summary.total > 0 && summary.completed === summary.total;

  if (!studentId) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <p className="text-neutral-600 dark:text-neutral-400 mb-4">
            Please access this page from your enrollment confirmation email, or contact the school for your parent portal link.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-sm border border-neutral-200 dark:border-neutral-800 p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
                Parent Portal
              </h1>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                Enrollment documents for <strong>{studentName}</strong>
              </p>
            </div>
            <button
              onClick={fetchChecklist}
              disabled={loading}
              className="text-sm text-blue-600 hover:text-blue-700 disabled:opacity-50"
            >
              {loading ? 'Loading...' : '↻ Refresh'}
            </button>
          </div>

          {/* Progress Bar */}
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-neutral-600 dark:text-neutral-400">
                {summary.completed} of {summary.total} documents verified
              </span>
              <span className={`font-semibold ${allVerified ? 'text-green-600' : 'text-blue-600'}`}>
                {completionPct}%
              </span>
            </div>
            <div className="h-3 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  allVerified ? 'bg-green-500' : 'bg-blue-500'
                }`}
                style={{ width: `${completionPct}%` }}
              />
            </div>
          </div>

          {allVerified && (
            <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl text-sm text-green-700 dark:text-green-300 text-center font-medium">
              🎉 All documents verified! Your enrollment is complete.
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {/* Upload Modal (inline overlay) */}
        {uploadingType && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-md p-6 border border-neutral-200 dark:border-neutral-700">
              <DocumentUploadForm
                studentId={studentId}
                documentType={uploadingType}
                onSuccess={handleUploadSuccess}
                onCancel={() => setUploadingType(null)}
              />
            </div>
          </div>
        )}

        {/* Checklist */}
        <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-sm border border-neutral-200 dark:border-neutral-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-neutral-100 dark:border-neutral-800">
            <h2 className="font-semibold text-neutral-900 dark:text-neutral-100">
              Required Documents
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              Please upload all required documents for your child&apos;s enrollment.
            </p>
          </div>

          {loading && items.length === 0 ? (
            <div className="py-12 text-center text-sm text-neutral-400">
              Loading your checklist...
            </div>
          ) : items.length === 0 ? (
            <div className="py-12 text-center text-sm text-neutral-400">
              No documents found. Please contact the school if you believe this is an error.
            </div>
          ) : (
            <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {items.map((item) => {
                const cfg = STATUS_CONFIG[item.status];
                const docLabel = DOCUMENT_TYPE_LABELS[item.document_type] ?? item.document_type;
                const canUpload = item.status === 'pending' || item.status === 'rejected';

                return (
                  <div key={item.id} className="px-6 py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <span className="text-xl flex-shrink-0 mt-0.5">{cfg.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-neutral-900 dark:text-neutral-100">
                            {docLabel}
                          </p>
                          <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium ${cfg.badge}`}>
                            {cfg.label}
                          </span>

                          {/* Rejection reason */}
                          {item.status === 'rejected' && item.rejection_reason && (
                            <p className="mt-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded p-2">
                              <strong>Reason:</strong> {item.rejection_reason}
                            </p>
                          )}

                          {/* Submission date */}
                          {item.submission_date && item.status !== 'rejected' && (
                            <p className="mt-1 text-xs text-neutral-400">
                              Submitted: {formatDate(item.submission_date)}
                            </p>
                          )}

                          {/* Verification date */}
                          {item.status === 'verified' && item.admin_verification_date && (
                            <p className="mt-1 text-xs text-green-600 dark:text-green-400">
                              Verified: {formatDate(item.admin_verification_date)}
                            </p>
                          )}

                          {/* View uploaded file */}
                          {item.signed_url && item.status !== 'pending' && (
                            <a
                              href={item.signed_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-block mt-1 text-xs text-blue-600 hover:text-blue-700 underline"
                            >
                              View uploaded file
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Upload / Re-upload button */}
                      {canUpload && (
                        <button
                          onClick={() => setUploadingType(item.document_type)}
                          className={`flex-shrink-0 py-1.5 px-3 text-xs font-semibold rounded-lg transition-colors ${
                            item.status === 'rejected'
                              ? 'bg-red-600 hover:bg-red-700 text-white'
                              : 'bg-blue-600 hover:bg-blue-700 text-white'
                          }`}
                        >
                          {item.status === 'rejected' ? 'Re-upload' : 'Upload'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Help Text */}
        <div className="text-center text-xs text-neutral-400 dark:text-neutral-600 pb-4">
          Having trouble? Contact your school&apos;s admissions office for assistance.
        </div>
      </div>
    </div>
  );
}
