'use client';

import { useState } from 'react';
import { Hemisphere, useAuth } from '@/lib/auth-context';
import { AuthForm } from '@/components/AuthForm';

export default function AccountPage() {
  const { ready, email, isAnonymous, hemisphere, error, retry, signOut, setHemisphere } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [savingHemisphere, setSavingHemisphere] = useState(false);
  const [hemisphereError, setHemisphereError] = useState<string | null>(null);

  const handleHemisphereChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as Hemisphere;
    setSavingHemisphere(true);
    setHemisphereError(null);
    try {
      await setHemisphere(value);
    } catch (err) {
      setHemisphereError(err instanceof Error ? err.message : 'Could not save that preference.');
    } finally {
      setSavingHemisphere(false);
    }
  };

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

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-900">Preferences</h2>
        <label htmlFor="hemisphere" className="block text-sm text-gray-700">
          Hemisphere
        </label>
        <p className="text-xs text-gray-500">
          Sets which months count as spring, summer, fall, and winter for your plants&apos;
          seasonal care schedules.
        </p>
        <select
          id="hemisphere"
          value={hemisphere}
          onChange={handleHemisphereChange}
          disabled={savingHemisphere}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
        >
          <option value="northern">Northern</option>
          <option value="southern">Southern</option>
        </select>
        {hemisphereError && <p className="text-sm text-red-700">{hemisphereError}</p>}
      </div>

      <div className="border-t pt-6 space-y-6">
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
    </div>
  );
}
