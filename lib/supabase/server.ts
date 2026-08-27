import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Supabase client for use in Server Components, Route Handlers, and Server
 * Actions. Reads/writes the session via Next's cookie store.
 *
 * Call this fresh per request — never module-level singleton — since it's
 * bound to that request's cookies.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component that can't set cookies (e.g.
            // during static rendering). Harmless as long as middleware.ts is
            // also refreshing the session on every request.
          }
        },
      },
    },
  );
}
