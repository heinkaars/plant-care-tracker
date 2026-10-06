import { describe, expect, it, vi } from 'vitest';
import { friendlyMessage } from '@/lib/auth-context';

describe('friendlyMessage', () => {
  it('translates invalid login credentials', () => {
    expect(friendlyMessage('Invalid login credentials')).toBe(
      'That email and password do not match an account.',
    );
  });

  it('translates an unconfirmed email', () => {
    expect(friendlyMessage('Email not confirmed')).toBe(
      'This account has not been confirmed yet. Check your email.',
    );
  });

  it('translates a password set before the address was confirmed', () => {
    expect(
      friendlyMessage('Updating password of an anonymous user without an email or phone is not allowed'),
    ).toBe('Confirm your email address before choosing a password.');
  });

  it('treats a wrong code the same as an expired one (ISSUES.md #28)', () => {
    // Supabase answers both with the identical string — the message must not
    // claim to know which one it was.
    expect(friendlyMessage('Token has expired or is invalid')).toBe(
      'That code is not right, or it has expired. Send yourself a new one.',
    );
  });

  it('matches on "expired" alone, without needing the word "token"', () => {
    expect(friendlyMessage('otp_expired')).toBe(
      'That code is not right, or it has expired. Send yourself a new one.',
    );
  });

  it('matches "invalid" only when paired with "token", not every invalid-anything message', () => {
    expect(friendlyMessage('invalid login credentials')).toBe(
      'That email and password do not match an account.',
    );
  });

  it('translates an already-registered email', () => {
    expect(friendlyMessage('User already registered')).toBe(
      'There is already an account with that email. Sign in instead.',
    );
    expect(friendlyMessage('Email already exists')).toBe(
      'There is already an account with that email. Sign in instead.',
    );
  });

  it('translates a too-short password', () => {
    expect(friendlyMessage('Password should be at least 6 characters')).toBe(
      'Passwords need to be at least 6 characters.',
    );
  });

  it('translates a rate limit', () => {
    expect(friendlyMessage('Email rate limit exceeded')).toBe(
      'Too many tries. Wait a minute and try again.',
    );
    expect(friendlyMessage('Too many requests')).toBe('Too many tries. Wait a minute and try again.');
  });

  it('translates a network failure', () => {
    expect(friendlyMessage('Failed to fetch')).toBe('Could not reach the server. Check your connection.');
  });

  it('falls back to a generic message and warns for anything unrecognized', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(friendlyMessage('some brand new Supabase error we have never seen')).toBe(
      'Something went wrong. Please try again.',
    );
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('is case-insensitive', () => {
    expect(friendlyMessage('INVALID LOGIN CREDENTIALS')).toBe(
      'That email and password do not match an account.',
    );
  });
});
