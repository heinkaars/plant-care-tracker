'use client';

import { useEffect } from 'react';

export default function Error({
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
    <div className="max-w-md mx-auto bg-white rounded-lg shadow p-6 space-y-4 text-center">
      <p className="text-red-700">Something went wrong. Please try again.</p>
      <button
        onClick={reset}
        className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
      >
        Try again
      </button>
    </div>
  );
}
