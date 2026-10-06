import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addDays } from 'date-fns';
import { CareSchedule, NewPlant, Plant } from '@/types/plant';

const mockFrom = vi.fn();
const mockRpc = vi.fn();
const mockGetUser = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: mockFrom,
    rpc: mockRpc,
    auth: { getUser: mockGetUser },
  }),
}));

// vi.mock calls are hoisted above this import by vitest, so `storage` below
// already talks to the mocked client.
const { storage } = await import('@/lib/storage');

// Mimics the real Supabase query builder closely enough for these tests:
// every chain method returns the same builder, and the builder itself is
// thenable so `await supabase.from(...).select(...).eq(...)` resolves
// without a terminal `.single()`/`.maybeSingle()` call, exactly like the
// real PostgrestFilterBuilder.
function makeBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  builder.select = vi.fn(chain);
  builder.order = vi.fn(chain);
  builder.eq = vi.fn(chain);
  builder.insert = vi.fn(chain);
  builder.update = vi.fn(chain);
  builder.delete = vi.fn(chain);
  builder.single = vi.fn(() => Promise.resolve(result));
  builder.maybeSingle = vi.fn(() => Promise.resolve(result));
  builder.then = (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(onFulfilled, onRejected);
  return builder;
}

function makePlantRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'p1',
    user_id: 'u1',
    name: 'Monstera',
    scientific_name: null,
    photo: null,
    care_schedules: [] as CareSchedule[],
    care_history: [],
    notes: null,
    date_added: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeNewPlant(overrides: Partial<NewPlant> = {}): NewPlant {
  return {
    name: 'Monstera',
    careSchedules: [],
    careHistory: [],
    dateAdded: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  mockFrom.mockReset();
  mockRpc.mockReset();
  mockGetUser.mockReset();
});

describe('storage.getPlants', () => {
  it('maps rows to Plant objects', async () => {
    mockFrom.mockReturnValue(makeBuilder({ data: [makePlantRow({ notes: 'likes bright light' })], error: null }));

    const plants = await storage.getPlants();
    expect(plants).toEqual<Plant[]>([
      {
        id: 'p1',
        name: 'Monstera',
        scientificName: undefined,
        photo: undefined,
        careSchedules: [],
        careHistory: [],
        notes: 'likes bright light',
        dateAdded: '2026-01-01T00:00:00.000Z',
      },
    ]);
  });

  it('throws a friendly error instead of swallowing a Supabase error', async () => {
    mockFrom.mockReturnValue(makeBuilder({ data: null, error: { message: 'network blip' } }));

    await expect(storage.getPlants()).rejects.toThrow(
      'Could not load your plants. Check your connection and try again.',
    );
  });
});

describe('storage.getPlant', () => {
  it('returns undefined for a genuine not-found, not an error', async () => {
    mockFrom.mockReturnValue(makeBuilder({ data: null, error: null }));

    await expect(storage.getPlant('missing')).resolves.toBeUndefined();
  });

  it('maps the row when found', async () => {
    mockFrom.mockReturnValue(makeBuilder({ data: makePlantRow(), error: null }));

    const plant = await storage.getPlant('p1');
    expect(plant?.id).toBe('p1');
    expect(plant?.name).toBe('Monstera');
  });

  it('throws on a Supabase error rather than returning undefined', async () => {
    mockFrom.mockReturnValue(makeBuilder({ data: null, error: { message: 'timeout' } }));

    await expect(storage.getPlant('p1')).rejects.toThrow(
      'Could not load that plant. Check your connection and try again.',
    );
  });
});

describe('storage.addPlant', () => {
  it('requires a signed-in user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    await expect(storage.addPlant(makeNewPlant())).rejects.toThrow('You need to be signed in to add a plant.');
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('inserts and returns the row Supabase generated an id for', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockFrom.mockReturnValue(makeBuilder({ data: makePlantRow({ id: 'generated-id' }), error: null }));

    const plant = await storage.addPlant(makeNewPlant());
    expect(plant.id).toBe('generated-id');
  });

  it('throws a friendly error on an insert failure', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockFrom.mockReturnValue(makeBuilder({ data: null, error: { message: 'constraint violation' } }));

    await expect(storage.addPlant(makeNewPlant())).rejects.toThrow(
      'Could not save that plant. Check your connection and try again.',
    );
  });
});

describe('storage.updatePlant', () => {
  it('resolves on success', async () => {
    mockFrom.mockReturnValue(makeBuilder({ data: null, error: null }));

    await expect(
      storage.updatePlant('p1', {
        id: 'p1',
        name: 'Monstera',
        careSchedules: [],
        careHistory: [],
        dateAdded: '2026-01-01T00:00:00.000Z',
      }),
    ).resolves.toBeUndefined();
  });

  it('throws a friendly error on failure', async () => {
    mockFrom.mockReturnValue(makeBuilder({ data: null, error: { message: 'denied' } }));

    await expect(
      storage.updatePlant('p1', {
        id: 'p1',
        name: 'Monstera',
        careSchedules: [],
        careHistory: [],
        dateAdded: '2026-01-01T00:00:00.000Z',
      }),
    ).rejects.toThrow('Could not update that plant. Check your connection and try again.');
  });
});

describe('storage.deletePlant', () => {
  it('resolves on success', async () => {
    mockFrom.mockReturnValue(makeBuilder({ data: null, error: null }));
    await expect(storage.deletePlant('p1')).resolves.toBeUndefined();
  });

  it('throws a friendly error on failure', async () => {
    mockFrom.mockReturnValue(makeBuilder({ data: null, error: { message: 'denied' } }));
    await expect(storage.deletePlant('p1')).rejects.toThrow(
      'Could not delete that plant. Check your connection and try again.',
    );
  });
});

describe('storage.addCareEvent', () => {
  beforeEach(() => {
    vi.setSystemTime(new Date('2026-06-15T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('no-ops without calling rpc when the plant does not exist', async () => {
    mockFrom.mockReturnValue(makeBuilder({ data: null, error: null }));

    await storage.addCareEvent('missing', 'watering');
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('computes nextDueDate from frequencyDays and calls append_care_event', async () => {
    const schedule: CareSchedule = {
      type: 'watering',
      frequencyDays: 5,
      lastCareDate: null,
      nextDueDate: null,
    };
    mockFrom.mockReturnValue(makeBuilder({ data: makePlantRow({ care_schedules: [schedule] }), error: null }));
    mockRpc.mockResolvedValue({ error: null });

    await storage.addCareEvent('p1', 'watering', 'looking good');

    expect(mockRpc).toHaveBeenCalledWith('append_care_event', {
      p_plant_id: 'p1',
      p_care_type: 'watering',
      p_care_date: '2026-06-15T12:00:00.000Z',
      p_next_due_date: addDays(new Date('2026-06-15T12:00:00.000Z'), 5).toISOString(),
      p_notes: 'looking good',
    });
  });

  it('leaves nextDueDate null when the current frequency is 0 (winter skip)', async () => {
    const schedule: CareSchedule = {
      type: 'fertilizing',
      frequencyDays: 0,
      lastCareDate: null,
      nextDueDate: null,
    };
    mockFrom.mockReturnValue(makeBuilder({ data: makePlantRow({ care_schedules: [schedule] }), error: null }));
    mockRpc.mockResolvedValue({ error: null });

    await storage.addCareEvent('p1', 'fertilizing');

    expect(mockRpc).toHaveBeenCalledWith(
      'append_care_event',
      expect.objectContaining({ p_next_due_date: null }),
    );
  });

  it('uses the seasonal frequency for the current season when present', async () => {
    const schedule: CareSchedule = {
      type: 'fertilizing',
      frequencyDays: 21,
      lastCareDate: null,
      nextDueDate: null,
      seasonalFrequency: { spring: 21, summer: 14, fall: 30, winter: 0 },
    };
    mockFrom.mockReturnValue(makeBuilder({ data: makePlantRow({ care_schedules: [schedule] }), error: null }));
    mockRpc.mockResolvedValue({ error: null });

    // 2026-06-15 is northern summer -> seasonal frequency 14, not frequencyDays (21).
    await storage.addCareEvent('p1', 'fertilizing');

    expect(mockRpc).toHaveBeenCalledWith(
      'append_care_event',
      expect.objectContaining({
        p_next_due_date: addDays(new Date('2026-06-15T12:00:00.000Z'), 14).toISOString(),
      }),
    );
  });

  it('respects the southern hemisphere when resolving the seasonal frequency', async () => {
    const schedule: CareSchedule = {
      type: 'fertilizing',
      frequencyDays: 21,
      lastCareDate: null,
      nextDueDate: null,
      seasonalFrequency: { spring: 21, summer: 14, fall: 30, winter: 0 },
    };
    mockFrom.mockReturnValue(makeBuilder({ data: makePlantRow({ care_schedules: [schedule] }), error: null }));
    mockRpc.mockResolvedValue({ error: null });

    // 2026-06-15 is southern winter -> seasonal frequency 0 -> skip (null).
    await storage.addCareEvent('p1', 'fertilizing', undefined, 'southern');

    expect(mockRpc).toHaveBeenCalledWith(
      'append_care_event',
      expect.objectContaining({ p_next_due_date: null }),
    );
  });

  it('leaves nextDueDate null when the plant has no matching schedule', async () => {
    mockFrom.mockReturnValue(makeBuilder({ data: makePlantRow({ care_schedules: [] }), error: null }));
    mockRpc.mockResolvedValue({ error: null });

    await storage.addCareEvent('p1', 'repotting');

    expect(mockRpc).toHaveBeenCalledWith(
      'append_care_event',
      expect.objectContaining({ p_next_due_date: null }),
    );
  });

  it('throws a friendly error when the rpc call fails', async () => {
    const schedule: CareSchedule = {
      type: 'watering',
      frequencyDays: 5,
      lastCareDate: null,
      nextDueDate: null,
    };
    mockFrom.mockReturnValue(makeBuilder({ data: makePlantRow({ care_schedules: [schedule] }), error: null }));
    mockRpc.mockResolvedValue({ error: { message: 'denied by RLS' } });

    await expect(storage.addCareEvent('p1', 'watering')).rejects.toThrow(
      'Could not save that care update. Check your connection and try again.',
    );
  });
});
