'use client';

import { Plant } from '@/types/plant';
import { createClient } from '@/lib/supabase/client';

const OLD_STORAGE_KEY = 'plant-care-tracker-data';
const MIGRATED_FLAG_KEY = 'plant-care-tracker-migrated';

/**
 * Copies any plants sitting in localStorage from before this project had
 * accounts into the signed-in user's Supabase rows, once, then marks it done
 * so it never runs again (including for a user who deletes every plant
 * afterward — an empty result should not look like "never migrated").
 *
 * Call this once, after the auth bootstrap has produced a session — e.g. in
 * a top-level effect in app/layout.tsx or a wrapper component rendered
 * inside <AuthProvider>. Safe to call on every load; it's a no-op after the
 * first successful run.
 */
export async function migrateLocalStorageToSupabase(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (localStorage.getItem(MIGRATED_FLAG_KEY) === 'true') return;

  const raw = localStorage.getItem(OLD_STORAGE_KEY);
  if (!raw) {
    localStorage.setItem(MIGRATED_FLAG_KEY, 'true');
    return;
  }

  let oldPlants: Plant[];
  try {
    oldPlants = JSON.parse(raw);
  } catch (error) {
    console.error('[migration] could not parse old localStorage plants:', error);
    return; // Leave the flag unset so this can be retried/inspected later.
  }

  if (oldPlants.length === 0) {
    localStorage.setItem(MIGRATED_FLAG_KEY, 'true');
    return;
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return; // No session yet — try again on the next load.

  const { error } = await supabase.from('plants').insert(
    oldPlants.map((plant) => ({
      user_id: user.id,
      name: plant.name,
      scientific_name: plant.scientificName ?? null,
      photo: plant.photo ?? null,
      care_schedules: plant.careSchedules,
      care_history: plant.careHistory,
      notes: plant.notes ?? null,
      date_added: plant.dateAdded,
    })),
  );

  if (error) {
    console.error('[migration] failed to copy plants to Supabase:', error);
    return; // Leave the flag unset so this retries on the next load.
  }

  localStorage.setItem(MIGRATED_FLAG_KEY, 'true');
  localStorage.removeItem(OLD_STORAGE_KEY);
}
