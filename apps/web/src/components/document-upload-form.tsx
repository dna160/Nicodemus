'use client';

import { useState, useRef, useCallback } from 'react';
import { DOCUMENT_TYPE_LABELS, type DocumentType } from 'shared';

// ============================================================
// Types
// ============================================================

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';

interface DocumentUploadFormProps {
  studentId: string;
  documentType: DocumentType;
  onSuccess?: (documentType: DocumentType) => void;
  onCancel?: () => void;
}

const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
const ALLOWED_EXTENSIONS = '.pdf, .jpg, .jpeg, .png, .webp, .doc, .docx';
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

// ============================================================
// Component
// ============================================================

export function DocumentUploadForm({
  studentId,
  documentType,
  onSuccess,
  onCancel,
}: DocumentUploadFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const label = DOCUMENT_TYPE_LABELS[documentType] ?? documentType;

  function validateFile(f: File): string | null {
    if (f.size > MAX_SIZE_BYTES) return `File too large. Maximum size is 10MB (this file is ${(f.size / 1024 / 1024).toFixed(1)}MB).`;
    if (!ALLOWED_TYPES.includes(f.type)) return 'File type not allowed. Please upload a PDF, image (JPG/PNG), or Word document.';
    return null;
  }

  function handleFileSelect(files: FileList | null) {
    if (!files || files.length === 0) return;
    const f = files[0];
    const err = validateFile(f);
    if (err) {
      setErrorMsg(err);
      return;
    }
    setFile(f);
    setErrorMsg('');
    setStatus('idle');
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => setDragOver(false), []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleUpload = async () => {
    if (!file) return;
    setStatus('uploading');
    setProgress(0);
    setErrorMsg('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('document_type', documentType);
      formData.append('student_id', studentId);

      // Simulate progress (XHR would give real progress; fetch doesn't)
      const progressInterval = setInterval(() => {
        setProgress((p) => Math.min(p + 15, 90));
      }, 200);

      const res = await fetch('/api/onboarding/upload-document', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setProgress(100);

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error ?? 'Upload failed. Please try again.');
      }

      setStatus('success');
      setTimeout(() => {
        onSuccess?.(documentType);
      }, 800);
    } catch (err: any) {
      setStatus('error');
      setErrorMsg(err.message);
      setProgress(0);
    }
  };

  function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  return (
    <div className="space-y-4">
      {/* Document Type Header */}
      <div className="flex items-center gap-2">
        <span className="text-lg">📁</span>
        <div>
          <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 text-sm">
            Upload: {label}
          </h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Accepted: PDF, JPG, PNG, Word docs — max 10MB
          </p>
        </div>
      </div>

      {/* Drop Zone */}
      {status !== 'success' && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-xl p-6 cursor-pointer transition-all text-center ${
            dragOver
              ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20'
              : file
              ? 'border-green-400 bg-green-50 dark:bg-green-900/10'
              : 'border-neutral-300 dark:border-neutral-600 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/10'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={ALLOWED_EXTENSIONS}
            className="hidden"
            onChange={(e) => handleFileSelect(e.target.files)}
          />

          {file ? (
            <div className="space-y-2">
              <div className="text-3xl">📄</div>
              <p className="font-medium text-sm text-neutral-800 dark:text-neutral-100 truncate max-w-full">
                {file.name}
              </p>
              <p className="text-xs text-neutral-500">{formatSize(file.size)}</p>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setFile(null);
                  setStatus('idle');
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="text-xs text-red-500 hover:text-red-600 underline"
              >
                Remove
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-3xl">☁️</div>
              <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Drag & drop your file here
              </p>
              <p className="text-xs text-neutral-400">or click to browse</p>
            </div>
          )}
        </div>
      )}

      {/* Progress Bar */}
      {status === 'uploading' && (
        <div>
          <div className="flex justify-between text-xs text-neutral-500 mb-1">
            <span>Uploading...</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 bg-neutral-100 dark:bg-neutral-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Success State */}
      {status === 'success' && (
        <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl">
          <span className="text-2xl">✅</span>
          <div>
            <p className="font-semibold text-sm text-green-700 dark:text-green-300">
              Document uploaded successfully!
            </p>
            <p className="text-xs text-green-600 dark:text-green-400">
              Your school will review and verify this document.
            </p>
          </div>
        </div>
      )}

      {/* Error */}
      {errorMsg && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
          {errorMsg}
        </div>
      )}

      {/* Actions */}
      {status !== 'success' && (
        <div className="flex gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-2 px-4 text-sm font-medium border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 transition-colors"
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            onClick={handleUpload}
            disabled={!file || status === 'uploading'}
            className="flex-1 py-2 px-4 text-sm font-semibold bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors"
          >
            {status === 'uploading' ? 'Uploading...' : 'Upload Document'}
          </button>
        </div>
      )}
    </div>
  );
}
