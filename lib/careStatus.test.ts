import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addDays } from 'date-fns';
import {
  computeNextDueDate,
  getCareStatus,
  getCurrentFrequency,
  getDashboardStats,
  getPlantStatus,
  getUpcomingCare,
} from '@/lib/careStatus';
import { CareSchedule, Plant } from '@/types/plant';

function makeSchedule(overrides: Partial<CareSchedule> = {}): CareSchedule {
  return {
    type: 'watering',
    frequencyDays: 7,
    lastCareDate: null,
    nextDueDate: null,
    ...overrides,
  };
}

function makePlant(overrides: Partial<Plant> = {}): Plant {
  return {
    id: 'p1',
    name: 'Test Plant',
    careSchedules: [],
    careHistory: [],
    dateAdded: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('getCurrentFrequency', () => {
  it('returns frequencyDays when there is no seasonal breakdown', () => {
    const schedule = makeSchedule({ frequencyDays: 5 });
    expect(getCurrentFrequency(schedule)).toBe(5);
  });

  it('returns the seasonal frequency for the current season when present', () => {
    vi.setSystemTime(new Date('2026-01-15'));
    const schedule = makeSchedule({
      frequencyDays: 7,
      seasonalFrequency: { spring: 3, summer: 1, fall: 5, winter: 0 },
    });
    expect(getCurrentFrequency(schedule)).toBe(0);
  });

  it('uses the southern-hemisphere season when passed one (ISSUES.md #17)', () => {
    // Same date is northern summer / southern winter — a schedule with
    // "skip in winter" (0) should resolve differently per hemisphere.
    vi.setSystemTime(new Date('2026-07-01'));
    const schedule = makeSchedule({
      frequencyDays: 7,
      seasonalFrequency: { spring: 3, summer: 1, fall: 5, winter: 0 },
    });
    expect(getCurrentFrequency(schedule, 'northern')).toBe(1);
    expect(getCurrentFrequency(schedule, 'southern')).toBe(0);
  });
});

describe('computeNextDueDate', () => {
  it('returns null when the current frequency is 0 (winter skip)', () => {
    const schedule = makeSchedule({ frequencyDays: 0, lastCareDate: '2026-01-01T00:00:00.000Z' });
    expect(computeNextDueDate(schedule, '2025-12-01T00:00:00.000Z')).toBeNull();
  });

  it('counts forward from lastCareDate when present', () => {
    const schedule = makeSchedule({ frequencyDays: 10, lastCareDate: '2026-01-01T00:00:00.000Z' });
    const result = computeNextDueDate(schedule, '2025-12-01T00:00:00.000Z');
    expect(result).toBe(addDays(new Date('2026-01-01T00:00:00.000Z'), 10).toISOString());
  });

  it('counts forward from the fallback date when the plant has never been cared for', () => {
    const schedule = makeSchedule({ frequencyDays: 10, lastCareDate: null });
    const result = computeNextDueDate(schedule, '2025-12-01T00:00:00.000Z');
    expect(result).toBe(addDays(new Date('2025-12-01T00:00:00.000Z'), 10).toISOString());
  });

  it('uses the seasonal frequency for the current season, not frequencyDays', () => {
    vi.setSystemTime(new Date('2026-07-01'));
    const schedule = makeSchedule({
      frequencyDays: 7,
      lastCareDate: '2026-01-01T00:00:00.000Z',
      seasonalFrequency: { spring: 3, summer: 1, fall: 5, winter: 0 },
    });
    const result = computeNextDueDate(schedule, '2025-12-01T00:00:00.000Z');
    expect(result).toBe(addDays(new Date('2026-01-01T00:00:00.000Z'), 1).toISOString());
  });

  it('skips (returns null) when the current season is a 0-frequency winter, even with a lastCareDate', () => {
    vi.setSystemTime(new Date('2026-01-15'));
    const schedule = makeSchedule({
      frequencyDays: 7,
      lastCareDate: '2026-01-01T00:00:00.000Z',
      seasonalFrequency: { spring: 3, summer: 1, fall: 5, winter: 0 },
    });
    expect(computeNextDueDate(schedule, '2025-12-01T00:00:00.000Z')).toBeNull();
  });
});

describe('getCareStatus', () => {
  const now = new Date('2026-06-15T12:00:00.000Z');

  beforeEach(() => {
    vi.setSystemTime(now);
  });

  it('is "ok" when there is no nextDueDate', () => {
    expect(getCareStatus(makeSchedule({ nextDueDate: null }))).toBe('ok');
  });

  it('is "overdue" when nextDueDate is in the past', () => {
    const schedule = makeSchedule({ nextDueDate: addDays(now, -1).toISOString() });
    expect(getCareStatus(schedule)).toBe('overdue');
  });

  it('is "due-soon" at exactly the 3-day boundary', () => {
    const schedule = makeSchedule({ nextDueDate: addDays(now, 3).toISOString() });
    expect(getCareStatus(schedule)).toBe('due-soon');
  });

  it('is "due-soon" when due today (0 days out)', () => {
    const schedule = makeSchedule({ nextDueDate: addDays(now, 0).toISOString() });
    expect(getCareStatus(schedule)).toBe('due-soon');
  });

  it('is "ok" just past the 3-day boundary', () => {
    const schedule = makeSchedule({ nextDueDate: addDays(now, 4).toISOString() });
    expect(getCareStatus(schedule)).toBe('ok');
  });
});

describe('getPlantStatus', () => {
  const now = new Date('2026-06-15T12:00:00.000Z');

  beforeEach(() => {
    vi.setSystemTime(now);
  });

  it('is "overdue" if any schedule is overdue, even if others are ok', () => {
    const plant = makePlant({
      careSchedules: [
        makeSchedule({ nextDueDate: addDays(now, 30).toISOString() }),
        makeSchedule({ nextDueDate: addDays(now, -1).toISOString() }),
      ],
    });
    expect(getPlantStatus(plant)).toBe('overdue');
  });

  it('is "due-soon" if nothing is overdue but something is due soon', () => {
    const plant = makePlant({
      careSchedules: [
        makeSchedule({ nextDueDate: addDays(now, 30).toISOString() }),
        makeSchedule({ nextDueDate: addDays(now, 2).toISOString() }),
      ],
    });
    expect(getPlantStatus(plant)).toBe('due-soon');
  });

  it('is "ok" when every schedule is ok', () => {
    const plant = makePlant({
      careSchedules: [makeSchedule({ nextDueDate: addDays(now, 30).toISOString() })],
    });
    expect(getPlantStatus(plant)).toBe('ok');
  });
});

describe('getDashboardStats', () => {
  const now = new Date('2026-06-15T12:00:00.000Z');

  beforeEach(() => {
    vi.setSystemTime(now);
  });

  it('counts overdue and due-soon schedules across all plants', () => {
    const plants = [
      makePlant({
        id: 'p1',
        careSchedules: [
          makeSchedule({ nextDueDate: addDays(now, -1).toISOString() }),
          makeSchedule({ nextDueDate: addDays(now, 1).toISOString() }),
        ],
      }),
      makePlant({
        id: 'p2',
        careSchedules: [makeSchedule({ nextDueDate: addDays(now, 30).toISOString() })],
      }),
    ];

    expect(getDashboardStats(plants)).toEqual({
      totalPlants: 2,
      overdueCount: 1,
      upcomingCount: 1,
    });
  });
});

describe('getUpcomingCare', () => {
  const now = new Date('2026-06-15T12:00:00.000Z');

  beforeEach(() => {
    vi.setSystemTime(now);
  });

  it('excludes schedules with no due date or that are not overdue/due-soon', () => {
    const plant = makePlant({
      careSchedules: [
        makeSchedule({ nextDueDate: null }),
        makeSchedule({ nextDueDate: addDays(now, 30).toISOString() }),
      ],
    });
    expect(getUpcomingCare([plant])).toHaveLength(0);
  });

  it('sorts the most urgent task first', () => {
    const plant = makePlant({
      careSchedules: [
        makeSchedule({ type: 'fertilizing', nextDueDate: addDays(now, 2).toISOString() }),
        makeSchedule({ type: 'watering', nextDueDate: addDays(now, -1).toISOString() }),
      ],
    });
    const upcoming = getUpcomingCare([plant]);
    expect(upcoming.map((t) => t.schedule.type)).toEqual(['watering', 'fertilizing']);
    expect(upcoming[0].status).toBe('overdue');
    expect(upcoming[1].status).toBe('due-soon');
  });
});

afterEach(() => {
  vi.useRealTimers();
});
