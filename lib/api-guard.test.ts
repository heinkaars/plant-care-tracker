import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetUser = vi.fn();
const mockRpc = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: mockGetUser } }),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ rpc: mockRpc, from: mockFrom }),
}));

// supabaseUrl/serviceRoleKey/TRUSTED_PROXY_HOPS are all read once at module
// scope, so they must be stubbed before the dynamic import below runs.
vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key');
vi.stubEnv('TRUSTED_PROXY_HOPS', '1');

// vi.mock calls are hoisted above this import by vitest, so api-guard below
// already talks to the mocked clients and stubbed env.
const { guard, rateLimited, requireUser } = await import('@/lib/api-guard');

function makeDeleteBuilder() {
  const builder: Record<string, unknown> = {};
  builder.delete = vi.fn(() => builder);
  builder.lt = vi.fn(() => Promise.resolve({ error: null }));
  return builder;
}

beforeEach(() => {
  mockGetUser.mockReset();
  mockRpc.mockReset();
  mockFrom.mockReset();
  mockFrom.mockReturnValue(makeDeleteBuilder());
  // The sweep step fires on a 2% random chance; pin it off so tests are deterministic.
  vi.spyOn(Math, 'random').mockReturnValue(1);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('requireUser', () => {
  it('returns null when there is no session', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(requireUser()).resolves.toBeNull();
  });

  it('returns null when Supabase reports an error verifying the token', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'invalid token' } });
    await expect(requireUser()).resolves.toBeNull();
  });

  it('returns the user id for a valid session, anonymous or not', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    await expect(requireUser()).resolves.toBe('u1');
  });
});

describe('rateLimited (in-memory fallback)', () => {
  it('allows up to max requests in the window, then refuses', () => {
    const key = 'test:rateLimited:basic';
    expect(rateLimited(key, 2)).toBe(false);
    expect(rateLimited(key, 2)).toBe(false);
    expect(rateLimited(key, 2)).toBe(true);
  });

  it('tracks each key independently', () => {
    expect(rateLimited('test:rateLimited:a', 1)).toBe(false);
    expect(rateLimited('test:rateLimited:b', 1)).toBe(false);
  });
});

describe('guard', () => {
  it('refuses with 401 and never checks the budget when there is no session', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const result = await guard(new Request('http://localhost/api/x'), 'guard-401', 10, 10);

    expect(result.response?.status).toBe(401);
    await expect(result.response?.json()).resolves.toEqual({ error: 'Sign in required' });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('returns the userId when under budget', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    mockRpc.mockResolvedValue({ data: true, error: null });

    const result = await guard(new Request('http://localhost/api/x'), 'guard-ok', 10, 10);

    expect(result.response).toBeUndefined();
    expect(result.userId).toBe('u1');
  });

  it('refuses with 429 when the durable store reports the budget is spent', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    mockRpc.mockResolvedValue({ data: false, error: null });

    const result = await guard(new Request('http://localhost/api/x'), 'guard-429', 10, 10);

    expect(result.response?.status).toBe(429);
    await expect(result.response?.json()).resolves.toEqual({ error: 'Too many requests' });
  });

  it('checks both a per-user and a per-address bucket when x-forwarded-for is trusted', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    mockRpc.mockResolvedValue({ data: true, error: null });

    const request = new Request('http://localhost/api/x', {
      headers: { 'x-forwarded-for': '203.0.113.5' },
    });
    await guard(request, 'guard-ip', 10, 10);

    expect(mockRpc).toHaveBeenCalledWith('claim_api_budget', {
      p_buckets: ['guard-ip:user:u1', 'guard-ip:ip:203.0.113.5'],
      p_maxes: [10, 10],
      p_window_seconds: 60,
    });
  });

  it('falls back to the in-memory limiter when the durable store throws', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u2' } }, error: null });
    mockRpc.mockResolvedValue({ data: null, error: { message: 'claim_api_budget is missing' } });
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const first = await guard(new Request('http://localhost/api/x'), 'guard-fallback', 1, 10);
    expect(first.response).toBeUndefined();
    expect(first.userId).toBe('u2');

    const second = await guard(new Request('http://localhost/api/x'), 'guard-fallback', 1, 10);
    expect(second.response?.status).toBe(429);
  });
});
