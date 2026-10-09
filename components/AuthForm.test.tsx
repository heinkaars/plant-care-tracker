// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockSignUp = vi.fn();
const mockConfirmSignUp = vi.fn();
const mockSignIn = vi.fn();
const mockRequestPasswordReset = vi.fn();
const mockResetPassword = vi.fn();

function mockAuth(overrides: Record<string, unknown> = {}) {
  return {
    signUp: mockSignUp,
    confirmSignUp: mockConfirmSignUp,
    signIn: mockSignIn,
    requestPasswordReset: mockRequestPasswordReset,
    resetPassword: mockResetPassword,
    isAnonymous: true,
    email: null,
    ...overrides,
  };
}

const mockUseAuth = vi.fn();
vi.mock('@/lib/auth-context', () => ({
  useAuth: () => mockUseAuth(),
}));

// vi.mock calls are hoisted above this import by vitest.
const { AuthForm } = await import('@/components/AuthForm');

describe('AuthForm', () => {
  beforeEach(() => {
    mockSignUp.mockReset();
    mockConfirmSignUp.mockReset();
    mockSignIn.mockReset();
    mockRequestPasswordReset.mockReset();
    mockResetPassword.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('shows a signed-in message instead of the form once an email is attached', () => {
    mockUseAuth.mockReturnValue(mockAuth({ isAnonymous: false, email: 'jane@example.com' }));
    render(<AuthForm />);

    expect(screen.getByText('Signed in as jane@example.com')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Sign in' })).toBeNull();
  });

  it('starts anonymous users on sign-up and existing users on sign-in', () => {
    mockUseAuth.mockReturnValue(mockAuth({ isAnonymous: true }));
    const { unmount } = render(<AuthForm />);
    expect(screen.getByRole('button', { name: 'Create account' })).toBeTruthy();
    unmount();

    mockUseAuth.mockReturnValue(mockAuth({ isAnonymous: false }));
    render(<AuthForm />);
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeTruthy();
  });

  it('claims the anonymous account directly when the project does not require confirmation', async () => {
    mockUseAuth.mockReturnValue(mockAuth({ isAnonymous: true }));
    mockSignUp.mockResolvedValue('complete');
    const user = userEvent.setup();
    render(<AuthForm />);

    await user.type(screen.getByPlaceholderText('Email'), 'new@example.com');
    await user.type(screen.getByPlaceholderText('Password'), 'secret123');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => expect(mockSignUp).toHaveBeenCalledWith('new@example.com', 'secret123'));
    // 'complete' needs no code, so the confirmation step must not appear.
    expect(screen.queryByPlaceholderText('Confirmation code')).toBeNull();
  });

  it('walks sign-up into the confirmation step when the project requires it (ISSUES.md #26)', async () => {
    mockUseAuth.mockReturnValue(mockAuth({ isAnonymous: true }));
    mockSignUp.mockResolvedValue('confirmation-required');
    mockConfirmSignUp.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<AuthForm />);

    await user.type(screen.getByPlaceholderText('Email'), 'new@example.com');
    await user.type(screen.getByPlaceholderText('Password'), 'secret123');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByPlaceholderText('Confirmation code')).toBeTruthy();

    await user.type(screen.getByPlaceholderText('Confirmation code'), '123456');
    await user.click(screen.getByRole('button', { name: 'Confirm account' }));

    await waitFor(() =>
      expect(mockConfirmSignUp).toHaveBeenCalledWith('new@example.com', '123456', 'secret123'),
    );
  });

  it('signs in an existing user', async () => {
    mockUseAuth.mockReturnValue(mockAuth({ isAnonymous: false }));
    mockSignIn.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<AuthForm />);

    await user.type(screen.getByPlaceholderText('Email'), 'jane@example.com');
    await user.type(screen.getByPlaceholderText('Password'), 'secret123');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(mockSignIn).toHaveBeenCalledWith('jane@example.com', 'secret123'));
  });

  it('shows the friendly error message when sign-in fails', async () => {
    mockUseAuth.mockReturnValue(mockAuth({ isAnonymous: false }));
    mockSignIn.mockRejectedValue(new Error('That email and password do not match an account.'));
    const user = userEvent.setup();
    render(<AuthForm />);

    await user.type(screen.getByPlaceholderText('Email'), 'jane@example.com');
    await user.type(screen.getByPlaceholderText('Password'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('That email and password do not match an account.')).toBeTruthy();
  });

  it('walks the forgot-password flow through request and confirm', async () => {
    mockUseAuth.mockReturnValue(mockAuth({ isAnonymous: false }));
    mockRequestPasswordReset.mockResolvedValue(undefined);
    mockResetPassword.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<AuthForm />);

    await user.click(screen.getByRole('button', { name: 'Forgot password?' }));
    await user.type(screen.getByPlaceholderText('Email'), 'jane@example.com');
    await user.click(screen.getByRole('button', { name: 'Send reset code' }));

    await waitFor(() => expect(mockRequestPasswordReset).toHaveBeenCalledWith('jane@example.com'));
    expect(
      await screen.findByText('If an account exists for jane@example.com, a reset code is on its way.'),
    ).toBeTruthy();

    await user.type(screen.getByPlaceholderText('Reset code'), '654321');
    await user.type(screen.getByPlaceholderText('New password'), 'newsecret1');
    await user.click(screen.getByRole('button', { name: 'Reset password' }));

    await waitFor(() =>
      expect(mockResetPassword).toHaveBeenCalledWith('jane@example.com', '654321', 'newsecret1'),
    );
    expect(await screen.findByText('Password updated. Sign in with your new password.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeTruthy();
  });
});
