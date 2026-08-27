import { Plant, CareHistory, CareType } from '@/types/plant';
import { addDays, parseISO } from 'date-fns';
import { getSeasonalFrequency } from '@/lib/seasonUtils';
import { createClient } from '@/lib/supabase/client';

/**
 * Same public shape as the old localStorage-backed `storage`, but every
 * method now talks to Supabase and is async. Call sites need `await` added
 * — see MIGRATION.md for the exact diffs in page.tsx, plants/page.tsx, and
 * plants/[id]/page.tsx.
 *
 * Data is scoped by Row Level Security to whoever is signed in (including
 * the silent anonymous account created on first visit — see
 * lib/auth-context.tsx), so no explicit user_id filtering is needed here:
 * Postgres does it for us.
 */

type PlantRow = {
  id: string;
  user_id: string;
  name: string;
  scientific_name: string | null;
  photo: string | null;
  care_schedules: Plant['careSchedules'];
  care_history: Plant['careHistory'];
  notes: string | null;
  date_added: string;
};

function fromRow(row: PlantRow): Plant {
  return {
    id: row.id,
    name: row.name,
    scientificName: row.scientific_name ?? undefined,
    photo: row.photo ?? undefined,
    careSchedules: row.care_schedules,
    careHistory: row.care_history,
    notes: row.notes ?? undefined,
    dateAdded: row.date_added,
  };
}

export const storage = {
  // Get all plants
  getPlants: async (): Promise<Plant[]> => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('plants')
      .select('*')
      .order('date_added', { ascending: false });

    if (error) {
      console.error('Error reading plants:', error);
      return [];
    }
    return (data as PlantRow[]).map(fromRow);
  },

  // Get a single plant by ID
  getPlant: async (id: string): Promise<Plant | undefined> => {
    const supabase = createClient();
    const { data, error } = await supabase.from('plants').select('*').eq('id', id).maybeSingle();

    if (error) {
      console.error('Error reading plant:', error);
      return undefined;
    }
    return data ? fromRow(data as PlantRow) : undefined;
  },

  // Add a new plant. Supabase generates the id — pass a Plant without a
  // real id (AddPlantModal's client-side placeholder id is ignored) and use
  // the returned row for the real one.
  addPlant: async (plant: Plant): Promise<Plant | undefined> => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      console.error('Cannot add plant: no signed-in user');
      return undefined;
    }

    const { data, error } = await supabase
      .from('plants')
      .insert({
        user_id: user.id,
        name: plant.name,
        scientific_name: plant.scientificName ?? null,
        photo: plant.photo ?? null,
        care_schedules: plant.careSchedules,
        care_history: plant.careHistory,
        notes: plant.notes ?? null,
        date_added: plant.dateAdded,
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding plant:', error);
      return undefined;
    }
    return fromRow(data as PlantRow);
  },

  // Update a plant
  updatePlant: async (id: string, updatedPlant: Plant): Promise<void> => {
    const supabase = createClient();
    const { error } = await supabase
      .from('plants')
      .update({
        name: updatedPlant.name,
        scientific_name: updatedPlant.scientificName ?? null,
        photo: updatedPlant.photo ?? null,
        care_schedules: updatedPlant.careSchedules,
        care_history: updatedPlant.careHistory,
        notes: updatedPlant.notes ?? null,
      })
      .eq('id', id);

    if (error) console.error('Error updating plant:', error);
  },

  // Delete a plant
  deletePlant: async (id: string): Promise<void> => {
    const supabase = createClient();
    const { error } = await supabase.from('plants').delete().eq('id', id);
    if (error) console.error('Error deleting plant:', error);
  },

  // Add care event to a plant
  addCareEvent: async (plantId: string, careType: CareType, notes?: string): Promise<void> => {
    const plant = await storage.getPlant(plantId);
    if (!plant) return;

    const now = new Date().toISOString();

    const careEvent: CareHistory = {
      id: `${Date.now()}-${Math.random()}`,
      type: careType,
      date: now,
      notes,
    };
    plant.careHistory.unshift(careEvent);

    const schedule = plant.careSchedules.find((s) => s.type === careType);
    if (schedule) {
      schedule.lastCareDate = now;
      const frequency = schedule.seasonalFrequency
        ? getSeasonalFrequency(schedule.seasonalFrequency)
        : schedule.frequencyDays;
      schedule.nextDueDate = addDays(parseISO(now), frequency).toISOString();
    }

    await storage.updatePlant(plantId, plant);
  },
};
