import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreate = vi.fn();
const mockGuard = vi.fn();

vi.mock('openai', () => ({
  default: class {
    chat = { completions: { create: mockCreate } };
  },
}));

vi.mock('@/lib/api-guard', () => ({
  guard: mockGuard,
}));

// vi.mock calls are hoisted above this import by vitest, so the route below
// already talks to the mocked openai client and guard.
const { POST } = await import('@/app/api/search-plant/route');

const validAiJson = {
  name: 'Monstera Deliciosa',
  scientificName: 'Monstera deliciosa',
  watering: { spring: 7, summer: 5, fall: 10, winter: 14 },
  fertilizing: { spring: 21, summer: 21, fall: 30, winter: 0 },
  repotting: { spring: 730, summer: 730, fall: 730, winter: 730 },
  careNotes: 'Water when top 2 inches dry.',
};

function aiCompletion(content: string) {
  return { choices: [{ message: { content } }] };
}

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/search-plant', {
    method: 'POST',
    body: JSON.stringify(body),
  }) as unknown as Parameters<typeof POST>[0];
}

beforeEach(() => {
  mockCreate.mockReset();
  mockGuard.mockReset();
  mockGuard.mockResolvedValue({ userId: 'u1' });
  vi.stubEnv('OPENAI_API_KEY', 'sk-test');
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('POST /api/search-plant', () => {
  it('returns the guard response unchanged when it refuses (401)', async () => {
    mockGuard.mockResolvedValue({
      response: Response.json({ error: 'Sign in required' }, { status: 401 }),
    });

    const res = await POST(makeRequest({ query: 'monstera' }));

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: 'Sign in required' });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('returns the guard response unchanged when it refuses (429)', async () => {
    mockGuard.mockResolvedValue({
      response: Response.json({ error: 'Too many requests' }, { status: 429 }),
    });

    const res = await POST(makeRequest({ query: 'monstera' }));

    expect(res.status).toBe(429);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('returns 400 when query is missing', async () => {
    const res = await POST(makeRequest({}));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'Query is required' });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('returns 500 when OPENAI_API_KEY is not configured', async () => {
    vi.stubEnv('OPENAI_API_KEY', '');

    const res = await POST(makeRequest({ query: 'monstera' }));

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: 'OpenAI API key not configured' });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('returns 200 with the validated data for a well-formed response', async () => {
    mockCreate.mockResolvedValue(aiCompletion(JSON.stringify(validAiJson)));

    const res = await POST(makeRequest({ query: 'monstera' }));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual(validAiJson);
  });

  it('extracts JSON via the regex fallback when the response has surrounding text', async () => {
    const noisy = `Sure, here you go:\n${JSON.stringify(validAiJson)}\nHope that helps!`;
    mockCreate.mockResolvedValue(aiCompletion(noisy));

    const res = await POST(makeRequest({ query: 'monstera' }));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual(validAiJson);
  });

  it('returns 502 when the parsed response fails schema validation', async () => {
    const malformed = { ...validAiJson, watering: { spring: 7, summer: 5, fall: 10 } };
    mockCreate.mockResolvedValue(aiCompletion(JSON.stringify(malformed)));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await POST(makeRequest({ query: 'monstera' }));

    expect(res.status).toBe(502);
    await expect(res.json()).resolves.toEqual({
      error: 'Received an unexpected response from the AI. Please try again.',
    });
  });

  it('returns 500 when the response has no JSON to parse or extract', async () => {
    mockCreate.mockResolvedValue(aiCompletion('not json at all'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await POST(makeRequest({ query: 'monstera' }));

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: 'Failed to search for plant' });
  });

  it('returns 500 when the OpenAI call itself throws', async () => {
    mockCreate.mockRejectedValue(new Error('network error'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await POST(makeRequest({ query: 'monstera' }));

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: 'Failed to search for plant' });
  });
});
