'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';

type Mode = 'sign-up' | 'sign-in' | 'confirm';

/**
 * Minimal email/password sign-up + sign-in form. The user already has an
 * anonymous account (created silently by AuthProvider), so "Create account"
 * just attaches an email + password to it — their existing plants stay
 * theirs, nothing migrates.
 *
 * Sign-up is one step or two depending on whether the project confirms email
 * addresses; `signUp` reports which, and the second step collects the code.
 */
export function AuthForm() {
  const { signUp, confirmSignUp, signIn, isAnonymous, email } = useAuth();
  const [mode, setMode] = useState<Mode>(isAnonymous ? 'sign-up' : 'sign-in');
  const [formEmail, setFormEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
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
        // The password is held here, unsent, until the address is confirmed —
        // Supabase refuses it before then.
        if ((await signUp(formEmail, password)) === 'confirmation-required') {
          setMode('confirm');
        }
      } else if (mode === 'confirm') {
        await confirmSignUp(formEmail, code, password);
      } else {
        await signIn(formEmail, password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  if (mode === 'confirm') {
    return (
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <p className="text-sm text-gray-600">
          We sent a confirmation code to <span className="font-medium">{formEmail}</span>. Enter it
          to finish setting up your account.
        </p>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="Confirmation code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
          className="border rounded px-3 py-2"
        />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button type="submit" disabled={busy} className="bg-green-600 text-white rounded px-3 py-2">
          {busy ? 'Confirming...' : 'Confirm account'}
        </button>
        <button
          type="button"
          onClick={() => {
            setCode('');
            setError(null);
            setMode('sign-up');
          }}
          className="text-sm underline"
        >
          Use a different email
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
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
        onClick={() => {
          setError(null);
          setMode(mode === 'sign-up' ? 'sign-in' : 'sign-up');
        }}
        className="text-sm underline"
      >
        {mode === 'sign-up' ? 'Already have an account? Sign in' : 'Need an account? Create one'}
      </button>
    </form>
  );
}
