import { createBrowserClient } from '@supabase/ssr';

/**
 * Supabase client for use in Client Components ('use client'). Session is
 * stored in cookies (via @supabase/ssr) rather than localStorage, so it's
 * readable by Server Components, Route Handlers, and middleware too — that's
 * the web equivalent of WildPack's chunked-SecureStore adapter: one client,
 * one storage mechanism the whole stack can see.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
