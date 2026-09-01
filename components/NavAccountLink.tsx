'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';

/**
 * Small nav-bar link that doubles as the account status indicator: "Sign in"
 * for the silent anonymous account, the user's email once they've attached
 * one. Lives in the client-only part of the tree since layout.tsx stays a
 * Server Component for its `metadata` export.
 */
export function NavAccountLink() {
  const { ready, email } = useAuth();

  return (
    <Link
      href="/account"
      className="text-gray-700 hover:text-green-600 px-3 py-2 rounded-md text-sm font-medium truncate max-w-[160px]"
    >
      {ready && email ? email : 'Sign in'}
    </Link>
  );
}
