/**
 * Server-side gate for Route Handlers (app/api/*\/route.ts). Verifies the
 * caller's session cookie and enforces a rate limit.
 *
 * Same underlying pattern as WildPack's api-guard.ts, adapted for Next.js:
 * the caller's identity comes from the session cookie (via the request-scoped
 * server client) rather than a bearer token, since same-origin fetches from
 * your own pages carry cookies automatically.
 */
import { createClient as createServerClient, type SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let usage: SupabaseClient | null = null;

/**
 * The rate-limit counter's home. Writing it needs the service role key,
 * because the table deliberately has no RLS policies: a caller able to
 * delete rows could erase the ceiling that limits them.
 */
function usageStore() {
  if (!supabaseUrl || !serviceRoleKey) return null;
  if (!usage) {
    usage = createServerClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return usage;
}

/**
 * The id of the caller, or null when there's no valid session cookie.
 *
 * getUser() asks Supabase to verify the token against its servers, rather
 * than just trusting whatever the cookie claims — the same reasoning as
 * WildPack's version, just reading the identity from a cookie instead of a
 * bearer header.
 *
 * Anonymous accounts pass deliberately, matching the "usable before sign-up"
 * flow in auth-context.tsx. Drop this check if a route should require a real
 * (non-anonymous) account.
 */
export async function requireUser(): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  return error || !data.user ? null : data.user.id;
}

const WINDOW_MS = 60_000;
const SWEEP_AT = 5_000;

const hits = new Map<string, number[]>();

/**
 * Fallback in-memory counter, used only when the Postgres table can't be
 * reached. Note: in Next.js dev mode this can behave inconsistently across
 * hot reloads; the durable Postgres path (`anyOverBudget`) is what actually
 * holds in production.
 */
export function rateLimited(key: string, max: number): boolean {
  const now = Date.now();

  if (hits.size > SWEEP_AT) {
    for (const [tracked, times] of hits) {
      if (times.every((time) => now - time >= WINDOW_MS)) hits.delete(tracked);
    }
  }

  const recent = (hits.get(key) ?? []).filter((time) => now - time < WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);

  return recent.length > max;
}

/**
 * How many proxies sit in front of this app. Vercel counts as 1. Left unset
 * there is no address worth trusting, so the per-address ceiling is skipped
 * rather than fed a value the caller picked for themselves.
 */
const TRUSTED_PROXY_HOPS = Number(process.env.TRUSTED_PROXY_HOPS ?? 0);
const MAX_IP_CHARS = 45;

let warnedAboutForwarding = false;

/**
 * The address a proxy we actually run behind observed, or null.
 *
 * Proxies APPEND to x-forwarded-for, so counting in from the RIGHT by the
 * number of proxies we genuinely run behind lands on the entry the outermost
 * one wrote — the one a caller cannot forge.
 */
function callerIp(request: Request): string | null {
  const header = request.headers.get('x-forwarded-for');

  if (TRUSTED_PROXY_HOPS < 1) {
    if (header && !warnedAboutForwarding) {
      warnedAboutForwarding = true;
      console.warn(
        '[rate-limit] x-forwarded-for is present but TRUSTED_PROXY_HOPS is unset, so the ' +
          'per-address ceiling is off. Set it to the number of proxies in front of this app ' +
          '(1 on Vercel) to turn it on.',
      );
    }
    return null;
  }

  const chain =
    header
      ?.split(',')
      .map((entry) => entry.trim())
      .filter(Boolean) ?? [];

  const ip = chain[chain.length - TRUSTED_PROXY_HOPS];
  return ip && ip.length <= MAX_IP_CHARS ? ip : null;
}

type Bucket = { bucket: string; max: number };

const SWEEP_CHANCE = 0.02;
const SWEEP_OLDER_THAN_MS = 60 * 60 * 1000;

function sweep(store: SupabaseClient): void {
  if (Math.random() > SWEEP_CHANCE) return;
  const cutoff = new Date(Date.now() - SWEEP_OLDER_THAN_MS).toISOString();
  void store
    .from('api_usage')
    .delete()
    .lt('created_at', cutoff)
    .then(({ error }) => {
      if (error) console.error('[rate-limit] sweep failed', error.message);
    });
}

/**
 * True when any of these buckets has spent its allowance for the last
 * minute, counted in Postgres so the ceiling survives a redeploy and is
 * shared across serverless instances.
 */
async function anyOverBudget(buckets: Bucket[]): Promise<boolean> {
  const store = usageStore();
  if (!store) return buckets.some((entry) => rateLimited(entry.bucket, entry.max));

  try {
    const { data, error } = await store.rpc('claim_api_budget', {
      p_buckets: buckets.map((entry) => entry.bucket),
      p_maxes: buckets.map((entry) => entry.max),
      p_window_seconds: WINDOW_MS / 1000,
    });
    if (error) throw new Error(error.message);

    sweep(store);
    return data !== true;
  } catch (error) {
    console.error(
      '[rate-limit] durable store unavailable, falling back to this process only. If this ' +
        'is every request, claim_api_budget is probably missing — run supabase/schema.sql.',
      error,
    );
    return buckets.some((entry) => rateLimited(entry.bucket, entry.max));
  }
}

type Allowed = { userId: string; response?: undefined };
type Refused = { userId?: undefined; response: Response };

/**
 * One call at the top of a Route Handler: proves who is asking, then holds
 * them to a per-account and a per-address budget.
 *
 * Usage:
 *   export async function POST(request: Request) {
 *     const result = await guard(request, 'identify-plant', 10, 30);
 *     if (result.response) return result.response;
 *     const { userId } = result;
 *     ...
 *   }
 */
export async function guard(
  request: Request,
  route: string,
  perUser: number,
  perIp: number,
): Promise<Allowed | Refused> {
  const userId = await requireUser();
  if (!userId) {
    return { response: Response.json({ error: 'Sign in required' }, { status: 401 }) };
  }

  const buckets: Bucket[] = [{ bucket: `${route}:user:${userId}`, max: perUser }];

  const ip = callerIp(request);
  if (ip) buckets.push({ bucket: `${route}:ip:${ip}`, max: perIp });

  if (await anyOverBudget(buckets)) {
    return { response: Response.json({ error: 'Too many requests' }, { status: 429 }) };
  }

  return { userId };
}
