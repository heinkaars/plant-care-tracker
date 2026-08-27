import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Refreshes the auth cookie on every request. Without this, a session whose
 * access token has expired keeps failing server-side reads until the user
 * happens to trigger a client-side refresh — this keeps Server Components and
 * Route Handlers looking at a live token.
 *
 * Wired up via middleware.ts at the project root.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Touches the session so an expired token gets refreshed and re-written to
  // the cookie before the request reaches a Server Component or Route Handler.
  await supabase.auth.getUser();

  return response;
}
