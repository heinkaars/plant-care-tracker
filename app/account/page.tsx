'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { AuthForm } from '@/components/AuthForm';

export default function AccountPage() {
  const { ready, email, isAnonymous, error, retry, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  if (!ready) {
    return <div className="text-center py-12">Loading...</div>;
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto bg-white rounded-lg shadow p-6 space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">Account</h1>
        <p className="text-red-700">{error}</p>
        <button
          onClick={retry}
          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto bg-white rounded-lg shadow p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Account</h1>

      {email ? (
        <>
          <p className="text-gray-700">
            Signed in as <span className="font-medium">{email}</span>. Your plants sync to this
            account on any device.
          </p>
          <button
            onClick={async () => {
              setSigningOut(true);
              await signOut();
              setSigningOut(false);
            }}
            disabled={signingOut}
            className="w-full border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
          >
            {signingOut ? 'Signing out...' : 'Sign out'}
          </button>
        </>
      ) : (
        <>
          {isAnonymous && (
            <p className="text-sm text-gray-600">
              Your plants are currently tied to this browser only. Add an email and password to
              keep them if you clear your browser data or switch devices — nothing is lost, your
              existing plants come with you.
            </p>
          )}
          <AuthForm />
        </>
      )}
    </div>
  );
}
