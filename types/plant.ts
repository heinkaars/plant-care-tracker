export type CareType = 'watering' | 'fertilizing' | 'repotting';
export type Season = 'spring' | 'summer' | 'fall' | 'winter';

export interface SeasonalFrequency {
  spring: number;
  summer: number;
  fall: number;
  winter: number;
}

export interface CareSchedule {
  type: CareType;
  frequencyDays: number; // Legacy: average or current season
  seasonalFrequency?: SeasonalFrequency; // New: season-specific frequencies
  lastCareDate: string | null;
  nextDueDate: string | null;
}

export interface CareHistory {
  id: string;
  type: CareType;
  date: string;
  notes?: string;
}

export interface Plant {
  id: string;
  name: string;
  scientificName?: string;
  photo?: string;
  careSchedules: CareSchedule[];
  careHistory: CareHistory[];
  notes?: string;
  dateAdded: string;
}

export interface PlantFormData {
  name: string;
  scientificName?: string;
  photo?: string;
  wateringFrequency: number;
  fertilizingFrequency: number;
  repottingFrequency: number;
  // Seasonal frequencies (optional, for AI-enhanced entries)
  wateringSeasonal?: SeasonalFrequency;
  fertilizingSeasonal?: SeasonalFrequency;
  repottingSeasonal?: SeasonalFrequency;
  notes?: string;
}
