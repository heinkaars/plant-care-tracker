'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';

type Mode = 'sign-up' | 'sign-in' | 'confirm' | 'reset-request' | 'reset-confirm';

/**
 * Minimal email/password sign-up + sign-in form. The user already has an
 * anonymous account (created silently by AuthProvider), so "Create account"
 * just attaches an email + password to it — their existing plants stay
 * theirs, nothing migrates.
 *
 * Sign-up is one step or two depending on whether the project confirms email
 * addresses; `signUp` reports which, and the second step collects the code.
 *
 * Password reset is the same two-step shape: `reset-request` sends the code,
 * `reset-confirm` takes the code plus a new password in one call.
 */
export function AuthForm() {
  const { signUp, confirmSignUp, signIn, requestPasswordReset, resetPassword, isAnonymous, email } =
    useAuth();
  const [mode, setMode] = useState<Mode>(isAnonymous ? 'sign-up' : 'sign-in');
  const [formEmail, setFormEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (email) {
    return <p>Signed in as {email}</p>;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
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
      } else if (mode === 'reset-request') {
        await requestPasswordReset(formEmail);
        setNotice(`If an account exists for ${formEmail}, a reset code is on its way.`);
        setMode('reset-confirm');
      } else if (mode === 'reset-confirm') {
        await resetPassword(formEmail, code, password);
        setNotice('Password updated. Sign in with your new password.');
        setCode('');
        setPassword('');
        setMode('sign-in');
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

  if (mode === 'reset-request') {
    return (
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <p className="text-sm text-gray-600">
          Enter the email on your account and we&apos;ll send you a code to reset your password.
        </p>
        <input
          type="email"
          placeholder="Email"
          value={formEmail}
          onChange={(e) => setFormEmail(e.target.value)}
          required
          className="border rounded px-3 py-2"
        />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button type="submit" disabled={busy} className="bg-green-600 text-white rounded px-3 py-2">
          {busy ? 'Sending...' : 'Send reset code'}
        </button>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setMode('sign-in');
          }}
          className="text-sm underline"
        >
          Back to sign in
        </button>
      </form>
    );
  }

  if (mode === 'reset-confirm') {
    return (
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <p className="text-sm text-gray-600">
          We sent a reset code to <span className="font-medium">{formEmail}</span>. Enter it along
          with your new password.
        </p>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="Reset code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
          className="border rounded px-3 py-2"
        />
        <input
          type="password"
          placeholder="New password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          className="border rounded px-3 py-2"
        />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button type="submit" disabled={busy} className="bg-green-600 text-white rounded px-3 py-2">
          {busy ? 'Resetting...' : 'Reset password'}
        </button>
        <button
          type="button"
          onClick={() => {
            setCode('');
            setPassword('');
            setError(null);
            setMode('reset-request');
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
      {notice && <p className="text-sm text-green-700">{notice}</p>}
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
      {mode === 'sign-in' && (
        <button
          type="button"
          onClick={() => {
            setError(null);
            setNotice(null);
            setMode('reset-request');
          }}
          className="text-sm underline text-gray-500"
        >
          Forgot password?
        </button>
      )}
    </form>
  );
}
