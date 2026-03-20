'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-8">
      <div className="bg-white p-8 rounded-xl border border-neutral-200 shadow-sm max-w-md w-full text-center space-y-4">
        <h2 className="text-xl font-semibold text-red-600">
          Application Error
        </h2>
        <p className="text-sm text-neutral-600">
          {error.message || 'A critical error occurred.'}
        </p>
        <button
          onClick={reset}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
