import { Season } from '@/types/plant';

/**
 * Determines the current season based on date and hemisphere
 * @param date - The date to check (defaults to now)
 * @param hemisphere - 'northern' or 'southern' (defaults to 'northern')
 */
export function getCurrentSeason(
  date: Date = new Date(),
  hemisphere: 'northern' | 'southern' = 'northern'
): Season {
  const month = date.getMonth(); // 0-11 (Jan-Dec)
  
  let season: Season;
  
  if (hemisphere === 'northern') {
    if (month >= 2 && month <= 4) {
      season = 'spring'; // March-May
    } else if (month >= 5 && month <= 7) {
      season = 'summer'; // June-August
    } else if (month >= 8 && month <= 10) {
      season = 'fall'; // September-November
    } else {
      season = 'winter'; // December-February
    }
  } else {
    // Southern hemisphere: seasons are reversed
    if (month >= 2 && month <= 4) {
      season = 'fall';
    } else if (month >= 5 && month <= 7) {
      season = 'winter';
    } else if (month >= 8 && month <= 10) {
      season = 'spring';
    } else {
      season = 'summer';
    }
  }
  
  return season;
}

/**
 * Gets the appropriate care frequency for the current season
 */
export function getSeasonalFrequency(
  seasonalFrequency: {
    spring: number;
    summer: number;
    fall: number;
    winter: number;
  },
  date: Date = new Date()
): number {
  const season = getCurrentSeason(date);
  return seasonalFrequency[season];
}

/**
 * Gets a friendly season name with emoji
 */
export function getSeasonDisplay(season: Season): string {
  const seasonEmojis = {
    spring: '🌸 Spring',
    summer: '☀️ Summer',
    fall: '🍂 Fall',
    winter: '❄️ Winter',
  };
  return seasonEmojis[season];
}
