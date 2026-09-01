'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';

type AuthState = {
  /** False until we know whether a session exists. Screens should wait on it. */
  ready: boolean;
  session: Session | null;
  userId: string | null;
  /** True for the silent account created on first visit. */
  isAnonymous: boolean;
  /** True only for the visit that created the account, never after a restore. */
  justCreated: boolean;
  email: string | null;
  /** Set when we could not create the first account (usually no connection). */
  error: string | null;
};

/**
 * Whether `signUp` finished outright, or stopped to wait on the code Supabase
 * just emailed. Which one you get is a project setting, not a code path the
 * caller chooses — see `signUp`.
 */
export type SignUpOutcome = 'complete' | 'confirmation-required';

type AuthContextValue = AuthState & {
  /**
   * Claims the anonymous account for an email and password. The user id does
   * not change, so anything already tied to it (rows tagged with user_id)
   * simply becomes theirs — nothing needs to be copied or migrated.
   *
   * Returns `'confirmation-required'` when the project makes users confirm
   * their address, in which case the account is only half claimed until
   * `confirmSignUp` runs with the emailed code.
   */
  signUp: (email: string, password: string) => Promise<SignUpOutcome>;
  /** Finishes a `signUp` that returned `'confirmation-required'`. */
  confirmSignUp: (email: string, code: string, password: string) => Promise<void>;
  /** Swaps to an existing account. If you keep data scoped to the anonymous
   * user_id that should survive a sign-in, migrate it server-side (e.g. in a
   * Postgres function) before or during this call — see the README. */
  signIn: (email: string, password: string) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  /** Verifies the reset code and sets the new password in one step. */
  resetPassword: (email: string, code: string, password: string) => Promise<void>;
  /** Returns to a fresh anonymous account, never to a signed-out dead end. */
  signOut: () => Promise<void>;
  retry: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const MAX_ATTEMPTS = 5;

/** Supabase phrasing is aimed at developers; these are for people. */
function friendlyMessage(raw: string): string {
  const message = raw.toLowerCase();
  if (message.includes('invalid login credentials')) {
    return 'That email and password do not match an account.';
  }
  if (message.includes('email not confirmed')) {
    return 'This account has not been confirmed yet. Check your email.';
  }
  // Reached when a password is set before the address it belongs to is
  // confirmed — the two halves of sign-up ran out of order.
  if (message.includes('anonymous user without an email')) {
    return 'Confirm your email address before choosing a password.';
  }
  // Supabase answers a wrong code and a stale one with the same string,
  // "Token has expired or is invalid", so this cannot honestly tell the user
  // which of the two it was.
  if (message.includes('expired') || (message.includes('invalid') && message.includes('token'))) {
    return 'That code is not right, or it has expired. Send yourself a new one.';
  }
  if (
    message.includes('already registered') ||
    message.includes('already been registered') ||
    message.includes('already exists')
  ) {
    return 'There is already an account with that email. Sign in instead.';
  }
  if (message.includes('password should be') || message.includes('at least')) {
    return 'Passwords need to be at least 6 characters.';
  }
  if (message.includes('rate limit') || message.includes('too many')) {
    return 'Too many tries. Wait a minute and try again.';
  }
  if (message.includes('network') || message.includes('fetch')) {
    return 'Could not reach the server. Check your connection.';
  }
  console.warn('[auth]', raw);
  return 'Something went wrong. Please try again.';
}

function fail(raw: string): never {
  throw new Error(friendlyMessage(raw));
}

function stateFromSession(
  session: Session | null,
  error: string | null = null,
  justCreated = false,
): AuthState {
  return {
    ready: true,
    session,
    userId: session?.user.id ?? null,
    isAnonymous: session?.user.is_anonymous ?? false,
    justCreated,
    email: session?.user.email ?? null,
    error,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const [state, setState] = useState<AuthState>({
    ready: false,
    session: null,
    userId: null,
    isAnonymous: false,
    justCreated: false,
    email: null,
    error: null,
  });
  const [attempt, setAttempt] = useState(0);
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled.current) return;

      if (data.session) {
        setState(stateFromSession(data.session));
        return;
      }

      // First visit on this browser: create the account silently so the user
      // can start using the app before ever seeing a sign-up screen.
      for (let i = 0; i < MAX_ATTEMPTS; i += 1) {
        const { data: signIn, error } = await supabase.auth.signInAnonymously();
        if (cancelled.current) return;

        if (!error && signIn.session) {
          setState(stateFromSession(signIn.session, null, true));
          return;
        }

        if (i < MAX_ATTEMPTS - 1) {
          await new Promise((resolve) => setTimeout(resolve, 2 ** i * 500));
        }
      }

      if (!cancelled.current) {
        setState(stateFromSession(null, 'Could not reach the server. Check your connection and try again.'));
      }
    })();

    return () => {
      cancelled.current = true;
    };
  }, [supabase, attempt]);

  // Keeps state in step with token refreshes, sign-ups and sign-ins.
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) return;
      setState((prev) => {
        const sameUser = prev.userId === session.user.id;
        return stateFromSession(session, null, sameUser && prev.justCreated);
      });
    });
    return () => data.subscription.unsubscribe();
  }, [supabase]);

  const signUp = useCallback(
    async (email: string, password: string): Promise<SignUpOutcome> => {
      // Order matters: Supabase rejects a password on an anonymous account
      // that has no address yet ("Updating password of an anonymous user
      // without an email or phone is not allowed").
      const { data, error: emailError } = await supabase.auth.updateUser({ email });
      if (emailError) fail(emailError.message);

      // Whether that address attached just now is the project's call, not
      // ours: with "Confirm email" off it lands immediately, with it on (the
      // Supabase default) it sits in `new_email` until the user proves they
      // own it, and `email` stays empty. The password is refused for exactly
      // as long as that is true, so hand the rest to `confirmSignUp`.
      if (!data.user?.email) return 'confirmation-required';

      const { error: passwordError } = await supabase.auth.updateUser({ password });
      if (passwordError) fail(passwordError.message);
      return 'complete';
    },
    [supabase],
  );

  /**
   * The confirmed half of `signUp`: verifying the code attaches the address,
   * which is what finally makes the account non-anonymous and the password
   * legal to set.
   *
   * The password cannot ride along on the emailed link, which is why this
   * takes a typed code and why the project's "Change Email Address" template
   * has to include `{{ .Token }}` — the stock template sends only
   * `{{ .ConfirmationURL }}`. Same requirement `resetPassword` already has.
   */
  const confirmSignUp = useCallback(
    async (email: string, code: string, password: string) => {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: 'email_change',
      });
      if (verifyError) fail(verifyError.message);

      const { error: passwordError } = await supabase.auth.updateUser({ password });
      if (passwordError) fail(passwordError.message);
    },
    [supabase],
  );

  const signIn = useCallback(
    async (email: string, password: string) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) fail(error.message);
    },
    [supabase],
  );

  const requestPasswordReset = useCallback(
    async (email: string) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) fail(error.message);
    },
    [supabase],
  );

  const resetPassword = useCallback(
    async (email: string, code: string, password: string) => {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: 'recovery',
      });
      if (verifyError) fail(verifyError.message);

      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) fail(updateError.message);
    },
    [supabase],
  );

  const signOut = useCallback(async () => {
    setState((prev) => ({ ...prev, ready: false, error: null }));
    await supabase.auth.signOut();
    // Every page reads from a user-scoped table, so there is no signed-out
    // state to land in. Re-running the bootstrap mints a fresh anonymous
    // account, exactly as on a first visit. If your app should have a real
    // signed-out state instead, drop this line.
    setAttempt((n) => n + 1);
  }, [supabase]);

  const retry = useCallback(() => {
    setState((prev) => ({ ...prev, ready: false, error: null }));
    setAttempt((n) => n + 1);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      signUp,
      confirmSignUp,
      signIn,
      requestPasswordReset,
      resetPassword,
      signOut,
      retry,
    }),
    [state, signUp, confirmSignUp, signIn, requestPasswordReset, resetPassword, signOut, retry],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
