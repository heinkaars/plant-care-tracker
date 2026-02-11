'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { storage } from '@/lib/storage';
import { getCareStatus, getCurrentFrequency } from '@/lib/careStatus';
import { Plant, CareType } from '@/types/plant';
import { format, parseISO } from 'date-fns';
import { getCurrentSeason, getSeasonDisplay } from '@/lib/seasonUtils';

export default function PlantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [plant, setPlant] = useState<Plant | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const loadedPlant = storage.getPlant(id);
    if (!loadedPlant) {
      router.push('/plants');
      return;
    }
    setPlant(loadedPlant);
    setLoading(false);
  }, [id, router]);

  const handleCareEvent = (careType: CareType) => {
    const notes = prompt(`Add notes for ${careType} (optional):`);
    storage.addCareEvent(id, careType, notes || undefined);
    setPlant(storage.getPlant(id)!);
  };

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this plant?')) {
      storage.deletePlant(id);
      router.push('/plants');
    }
  };

  if (loading || !plant) {
    return <div className="text-center py-12">Loading...</div>;
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'overdue':
        return 'bg-red-100 text-red-800';
      case 'due-soon':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-green-100 text-green-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'overdue':
        return 'Overdue';
      case 'due-soon':
        return 'Due Soon';
      default:
        return 'Up to date';
    }
  };

  const getCareIcon = (type: CareType) => {
    switch (type) {
      case 'watering':
        return '💧';
      case 'fertilizing':
        return '🌱';
      case 'repotting':
        return '🪴';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <Link href="/plants" className="text-gray-600 hover:text-gray-900">
          ← Back to Plants
        </Link>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Plant Info */}
        <div className="lg:col-span-1 space-y-6">
          {/* Plant Photo */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="aspect-square bg-gray-100 flex items-center justify-center text-8xl">
              {plant.photo ? (
                <img
                  src={plant.photo}
                  alt={plant.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                '🌿'
              )}
            </div>
            <div className="p-6">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{plant.name}</h1>
              {plant.scientificName && (
                <p className="text-gray-600 italic mb-4">{plant.scientificName}</p>
              )}
              {plant.notes && (
                <div className="border-t pt-4">
                  <p className="text-sm text-gray-700">{plant.notes}</p>
                </div>
              )}
              <div className="border-t pt-4 mt-4">
                <p className="text-xs text-gray-500">
                  Added {format(parseISO(plant.dateAdded), 'MMM d, yyyy')}
                </p>
              </div>
              <button
                onClick={handleDelete}
                className="w-full mt-4 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition"
              >
                Delete Plant
              </button>
            </div>
          </div>
        </div>

        {/* Right Column - Care Schedules & History */}
        <div className="lg:col-span-2 space-y-6">
          {/* Care Schedules */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Care Schedule</h2>
            </div>
            <div className="p-6 space-y-4">
              {plant.careSchedules.map((schedule) => {
                const status = getCareStatus(schedule);
                const currentSeason = getCurrentSeason();
                const currentFreq = getCurrentFrequency(schedule);
                const hasSeasonal = !!schedule.seasonalFrequency;
                
                return (
                  <div
                    key={schedule.type}
                    className="border border-gray-200 rounded-lg p-4"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-4 flex-1">
                        <div className="text-3xl">{getCareIcon(schedule.type)}</div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-1">
                            <h3 className="font-semibold text-gray-900 capitalize">
                              {schedule.type}
                            </h3>
                            <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(status)}`}>
                              {getStatusText(status)}
                            </span>
                          </div>
                          {hasSeasonal ? (
                            <p className="text-sm text-gray-600">
                              Current ({getSeasonDisplay(currentSeason)}): Every {currentFreq} days
                            </p>
                          ) : (
                            <p className="text-sm text-gray-600">
                              Every {schedule.frequencyDays} days
                            </p>
                          )}
                          {schedule.nextDueDate && (
                            <p className="text-sm text-gray-500">
                              Next due: {format(parseISO(schedule.nextDueDate), 'MMM d, yyyy')}
                            </p>
                          )}
                          {schedule.lastCareDate && (
                            <p className="text-xs text-gray-400">
                              Last done: {format(parseISO(schedule.lastCareDate), 'MMM d, yyyy')}
                            </p>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleCareEvent(schedule.type)}
                        className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition whitespace-nowrap"
                      >
                        Mark Done
                      </button>
                    </div>
                    
                    {/* Show seasonal breakdown if available */}
                    {hasSeasonal && schedule.seasonalFrequency && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <p className="text-xs text-gray-500 mb-2">Seasonal Schedule:</p>
                        <div className="grid grid-cols-4 gap-2 text-xs">
                          <div className="text-center p-2 bg-pink-50 rounded">
                            <div className="font-medium">🌸 Spring</div>
                            <div className="text-gray-600">{schedule.seasonalFrequency.spring}d</div>
                          </div>
                          <div className="text-center p-2 bg-yellow-50 rounded">
                            <div className="font-medium">☀️ Summer</div>
                            <div className="text-gray-600">{schedule.seasonalFrequency.summer}d</div>
                          </div>
                          <div className="text-center p-2 bg-orange-50 rounded">
                            <div className="font-medium">🍂 Fall</div>
                            <div className="text-gray-600">{schedule.seasonalFrequency.fall}d</div>
                          </div>
                          <div className="text-center p-2 bg-blue-50 rounded">
                            <div className="font-medium">❄️ Winter</div>
                            <div className="text-gray-600">
                              {schedule.seasonalFrequency.winter === 0 ? 'Skip' : `${schedule.seasonalFrequency.winter}d`}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Care History */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Care History</h2>
            </div>
            <div className="divide-y divide-gray-200">
              {plant.careHistory.length === 0 ? (
                <div className="px-6 py-12 text-center text-gray-500">
                  No care history yet. Mark care events to track your plant's health!
                </div>
              ) : (
                plant.careHistory.map((event) => (
                  <div key={event.id} className="px-6 py-4 flex items-start space-x-4">
                    <div className="text-2xl">{getCareIcon(event.type)}</div>
                    <div className="flex-1">
                      <div className="flex items-baseline space-x-2">
                        <h3 className="font-medium text-gray-900 capitalize">{event.type}</h3>
                        <span className="text-sm text-gray-500">
                          {format(parseISO(event.date), 'MMM d, yyyy')}
                        </span>
                      </div>
                      {event.notes && (
                        <p className="text-sm text-gray-600 mt-1">{event.notes}</p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
