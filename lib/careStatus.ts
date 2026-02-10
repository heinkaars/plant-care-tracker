import { Plant, CareSchedule } from '@/types/plant';
import { parseISO, differenceInDays, isPast, addDays } from 'date-fns';
import { getSeasonalFrequency } from '@/lib/seasonUtils';

export type CareStatus = 'overdue' | 'due-soon' | 'ok';

/**
 * Gets the appropriate frequency for a care schedule based on current season
 */
export function getCurrentFrequency(schedule: CareSchedule): number {
  if (schedule.seasonalFrequency) {
    return getSeasonalFrequency(schedule.seasonalFrequency);
  }
  return schedule.frequencyDays;
}

export function getCareStatus(schedule: CareSchedule): CareStatus {
  if (!schedule.nextDueDate) return 'ok';
  
  const nextDue = parseISO(schedule.nextDueDate);
  const now = new Date();
  
  if (isPast(nextDue)) {
    return 'overdue';
  }
  
  const daysUntilDue = differenceInDays(nextDue, now);
  if (daysUntilDue <= 3) {
    return 'due-soon';
  }
  
  return 'ok';
}

export function getPlantStatus(plant: Plant): CareStatus {
  let hasOverdue = false;
  let hasDueSoon = false;
  
  for (const schedule of plant.careSchedules) {
    const status = getCareStatus(schedule);
    if (status === 'overdue') {
      hasOverdue = true;
    } else if (status === 'due-soon') {
      hasDueSoon = true;
    }
  }
  
  if (hasOverdue) return 'overdue';
  if (hasDueSoon) return 'due-soon';
  return 'ok';
}

export function getDashboardStats(plants: Plant[]) {
  let overdueCount = 0;
  let upcomingCount = 0;
  
  plants.forEach(plant => {
    plant.careSchedules.forEach(schedule => {
      const status = getCareStatus(schedule);
      if (status === 'overdue') {
        overdueCount++;
      } else if (status === 'due-soon') {
        upcomingCount++;
      }
    });
  });
  
  return {
    totalPlants: plants.length,
    overdueCount,
    upcomingCount,
  };
}

export function getUpcomingCare(plants: Plant[]) {
  const upcomingTasks: Array<{
    plant: Plant;
    schedule: CareSchedule;
    status: CareStatus;
    daysUntil: number;
  }> = [];
  
  plants.forEach(plant => {
    plant.careSchedules.forEach(schedule => {
      if (schedule.nextDueDate) {
        const status = getCareStatus(schedule);
        if (status === 'overdue' || status === 'due-soon') {
          const daysUntil = differenceInDays(parseISO(schedule.nextDueDate), new Date());
          upcomingTasks.push({
            plant,
            schedule,
            status,
            daysUntil,
          });
        }
      }
    });
  });
  
  // Sort by most urgent first
  upcomingTasks.sort((a, b) => a.daysUntil - b.daysUntil);
  
  return upcomingTasks;
}
