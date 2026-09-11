'use client';

import { useState } from 'react';
import { CareType, Plant, SeasonalFrequency } from '@/types/plant';
import { computeNextDueDate } from '@/lib/careStatus';
import { compressImageFile } from '@/lib/image';
import { getSeasonDisplay } from '@/lib/seasonUtils';

interface EditPlantModalProps {
  plant: Plant;
  onClose: () => void;
  /** Returns whether the save succeeded, so a failure can be shown here
   * instead of the modal closing as though it had worked. */
  onSave: (plant: Plant) => Promise<boolean>;
}

const SEASONS: (keyof SeasonalFrequency)[] = ['spring', 'summer', 'fall', 'winter'];
const CARE_LABELS: Record<CareType, string> = {
  watering: '💧 Watering',
  fertilizing: '🌱 Fertilizing',
  repotting: '🪴 Repotting',
};

export default function EditPlantModal({ plant, onClose, onSave }: EditPlantModalProps) {
  const [name, setName] = useState(plant.name);
  const [scientificName, setScientificName] = useState(plant.scientificName ?? '');
  const [notes, setNotes] = useState(plant.notes ?? '');
  const [photo, setPhoto] = useState(plant.photo ?? '');
  const [schedules, setSchedules] = useState(plant.careSchedules);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const updateFrequencyDays = (type: CareType, value: number) => {
    setSchedules((prev) =>
      prev.map((s) => (s.type === type ? { ...s, frequencyDays: value } : s))
    );
  };

  const updateSeasonalFrequency = (type: CareType, season: keyof SeasonalFrequency, value: number) => {
    setSchedules((prev) =>
      prev.map((s) =>
        s.type === type && s.seasonalFrequency
          ? { ...s, seasonalFrequency: { ...s.seasonalFrequency, [season]: value } }
          : s
      )
    );
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setPhoto(await compressImageFile(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that photo.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Plant name is required');
      return;
    }

    // Frequencies may have changed, so the next due date has to move with
    // them — same rule (and same "0 means skip") as when the schedule was
    // first created.
    const updatedSchedules = schedules.map((schedule) => ({
      ...schedule,
      nextDueDate: computeNextDueDate(schedule, plant.dateAdded),
    }));

    const updatedPlant: Plant = {
      ...plant,
      name,
      scientificName: scientificName.trim() || undefined,
      notes: notes.trim() || undefined,
      photo: photo || undefined,
      careSchedules: updatedSchedules,
    };

    setLoading(true);
    setError('');
    const saved = await onSave(updatedPlant);
    setLoading(false);
    if (!saved) {
      setError('Could not save these changes. Check your connection and try again.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">Edit Plant</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">
            ×
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Plant Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="e.g., My Monstera"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Scientific Name (optional)
              </label>
              <input
                type="text"
                value={scientificName}
                onChange={(e) => setScientificName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="e.g., Monstera deliciosa"
              />
            </div>

            <div className="space-y-4">
              {schedules.map((schedule) => (
                <div key={schedule.type} className="border border-gray-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-gray-700 mb-3">{CARE_LABELS[schedule.type]}</p>
                  {schedule.seasonalFrequency ? (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {SEASONS.map((season) => (
                        <div key={season}>
                          <label className="block text-xs text-gray-600 mb-1">
                            {getSeasonDisplay(season)}
                          </label>
                          <input
                            type="number"
                            value={schedule.seasonalFrequency![season]}
                            onChange={(e) =>
                              updateSeasonalFrequency(
                                schedule.type,
                                season,
                                parseInt(e.target.value) || 0
                              )
                            }
                            className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            min="0"
                          />
                        </div>
                      ))}
                      <p className="col-span-2 sm:col-span-4 text-xs text-gray-500">0 = skip this season</p>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Every N days</label>
                      <input
                        type="number"
                        value={schedule.frequencyDays}
                        onChange={(e) => updateFrequencyDays(schedule.type, parseInt(e.target.value) || 1)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        min="1"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                rows={3}
                placeholder="Care tips, location, etc."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Plant Photo</label>
              {photo && (
                <img src={photo} alt="Plant preview" className="w-full h-48 object-cover rounded-lg mb-2" />
              )}
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                className="block w-full text-sm text-gray-600"
              />
            </div>

            <div className="flex space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:bg-gray-400"
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
