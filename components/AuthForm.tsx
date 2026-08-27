'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';

/**
 * Minimal email/password sign-up + sign-in form. The user already has an
 * anonymous account (created silently by AuthProvider), so "Create account"
 * just attaches an email + password to it — their existing plants stay
 * theirs, nothing migrates.
 */
export function AuthForm() {
  const { signUp, signIn, isAnonymous, email } = useAuth();
  const [mode, setMode] = useState<'sign-up' | 'sign-in'>(isAnonymous ? 'sign-up' : 'sign-in');
  const [formEmail, setFormEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (email) {
    return <p>Signed in as {email}</p>;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'sign-up') {
        await signUp(formEmail, password);
      } else {
        await signIn(formEmail, password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 max-w-sm">
      <input
        type="email"
        placeholder="Email"
        value={formEmail}
        onChange={(e) => setFormEmail(e.target.value)}
        required
        className="border rounded px-3 py-2"
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        minLength={6}
        className="border rounded px-3 py-2"
      />
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button type="submit" disabled={busy} className="bg-green-600 text-white rounded px-3 py-2">
        {mode === 'sign-up' ? 'Create account' : 'Sign in'}
      </button>
      <button
        type="button"
        onClick={() => setMode(mode === 'sign-up' ? 'sign-in' : 'sign-up')}
        className="text-sm underline"
      >
        {mode === 'sign-up' ? 'Already have an account? Sign in' : 'Need an account? Create one'}
      </button>
    </form>
  );
}
