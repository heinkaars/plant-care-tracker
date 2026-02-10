import { Plant, CareHistory, CareType } from '@/types/plant';
import { addDays, parseISO } from 'date-fns';
import { getSeasonalFrequency } from '@/lib/seasonUtils';

const STORAGE_KEY = 'plant-care-tracker-data';

export const storage = {
  // Get all plants
  getPlants: (): Plant[] => {
    if (typeof window === 'undefined') return [];
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error reading from localStorage:', error);
      return [];
    }
  },

  // Save all plants
  savePlants: (plants: Plant[]): void => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(plants));
    } catch (error) {
      console.error('Error writing to localStorage:', error);
    }
  },

  // Get a single plant by ID
  getPlant: (id: string): Plant | undefined => {
    const plants = storage.getPlants();
    return plants.find(plant => plant.id === id);
  },

  // Add a new plant
  addPlant: (plant: Plant): void => {
    const plants = storage.getPlants();
    plants.push(plant);
    storage.savePlants(plants);
  },

  // Update a plant
  updatePlant: (id: string, updatedPlant: Plant): void => {
    const plants = storage.getPlants();
    const index = plants.findIndex(plant => plant.id === id);
    if (index !== -1) {
      plants[index] = updatedPlant;
      storage.savePlants(plants);
    }
  },

  // Delete a plant
  deletePlant: (id: string): void => {
    const plants = storage.getPlants();
    const filtered = plants.filter(plant => plant.id !== id);
    storage.savePlants(filtered);
  },

  // Add care event to a plant
  addCareEvent: (plantId: string, careType: CareType, notes?: string): void => {
    const plant = storage.getPlant(plantId);
    if (!plant) return;

    const now = new Date().toISOString();
    
    // Add to care history
    const careEvent: CareHistory = {
      id: `${Date.now()}-${Math.random()}`,
      type: careType,
      date: now,
      notes,
    };
    plant.careHistory.unshift(careEvent);

    // Update care schedule
    const schedule = plant.careSchedules.find(s => s.type === careType);
    if (schedule) {
      schedule.lastCareDate = now;
      // Use seasonal frequency if available, otherwise use default
      const frequency = schedule.seasonalFrequency
        ? getSeasonalFrequency(schedule.seasonalFrequency)
        : schedule.frequencyDays;
      schedule.nextDueDate = addDays(parseISO(now), frequency).toISOString();
    }

    storage.updatePlant(plantId, plant);
  },
};
