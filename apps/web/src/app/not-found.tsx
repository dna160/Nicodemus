import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex items-center justify-center p-8">
      <div className="bg-white dark:bg-neutral-900 p-8 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm max-w-md w-full text-center space-y-4">
        <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
          Page Not Found
        </h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          The page you are looking for does not exist.
        </p>
        <Link
          href="/dashboard"
          className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
