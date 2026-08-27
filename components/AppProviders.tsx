'use client';

import { useEffect } from 'react';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import { migrateLocalStorageToSupabase } from '@/lib/migrate-storage';

/**
 * Runs the one-time localStorage -> Supabase copy once the auth bootstrap
 * has produced a session. Must live inside AuthProvider to read `ready`.
 */
function MigrationRunner({ children }: { children: React.ReactNode }) {
  const { ready, userId } = useAuth();

  useEffect(() => {
    if (ready && userId) {
      migrateLocalStorageToSupabase();
    }
  }, [ready, userId]);

  return <>{children}</>;
}

/**
 * Bundles every client-only provider the app needs. Kept separate from
 * app/layout.tsx so that file can stay a Server Component (needed for the
 * `metadata` export) while this handles the 'use client' boundary.
 */
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <MigrationRunner>{children}</MigrationRunner>
    </AuthProvider>
  );
}
