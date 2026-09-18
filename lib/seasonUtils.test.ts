import { describe, expect, it } from 'vitest';
import { getCurrentSeason, getSeasonalFrequency, getSeasonDisplay } from '@/lib/seasonUtils';

describe('getCurrentSeason (northern hemisphere)', () => {
  it.each([
    ['2026-01-15', 'winter'],
    ['2026-02-28', 'winter'],
    ['2026-03-01', 'spring'],
    ['2026-04-15', 'spring'],
    ['2026-05-31', 'spring'],
    ['2026-06-01', 'summer'],
    ['2026-07-15', 'summer'],
    ['2026-08-31', 'summer'],
    ['2026-09-01', 'fall'],
    ['2026-10-15', 'fall'],
    ['2026-11-30', 'fall'],
    ['2026-12-01', 'winter'],
    ['2026-12-31', 'winter'],
  ])('%s is %s', (dateStr, expected) => {
    expect(getCurrentSeason(new Date(dateStr))).toBe(expected);
  });
});

describe('getCurrentSeason (southern hemisphere)', () => {
  it.each([
    ['2026-02-28', 'summer'],
    ['2026-03-01', 'fall'],
    ['2026-05-31', 'fall'],
    ['2026-06-01', 'winter'],
    ['2026-08-31', 'winter'],
    ['2026-09-01', 'spring'],
    ['2026-11-30', 'spring'],
    ['2026-12-01', 'summer'],
  ])('%s is %s', (dateStr, expected) => {
    expect(getCurrentSeason(new Date(dateStr), 'southern')).toBe(expected);
  });
});

describe('getSeasonalFrequency', () => {
  const frequencies = { spring: 3, summer: 1, fall: 5, winter: 0 };

  it.each([
    ['2026-04-01', 3],
    ['2026-07-01', 1],
    ['2026-10-01', 5],
    ['2026-01-01', 0],
  ])('returns the frequency for the season containing %s', (dateStr, expected) => {
    expect(getSeasonalFrequency(frequencies, new Date(dateStr))).toBe(expected);
  });

  it('resolves the season by the passed-through hemisphere, not just the date', () => {
    // 2026-07-01 is northern summer / southern winter — same date, opposite
    // seasons, so this only passes if the hemisphere argument actually
    // reaches getCurrentSeason (ISSUES.md #17).
    expect(getSeasonalFrequency(frequencies, new Date('2026-07-01'), 'northern')).toBe(1);
    expect(getSeasonalFrequency(frequencies, new Date('2026-07-01'), 'southern')).toBe(0);
  });
});

describe('getSeasonDisplay', () => {
  it.each([
    ['spring', '🌸 Spring'],
    ['summer', '☀️ Summer'],
    ['fall', '🍂 Fall'],
    ['winter', '❄️ Winter'],
  ] as const)('%s renders as %s', (season, expected) => {
    expect(getSeasonDisplay(season)).toBe(expected);
  });
});
