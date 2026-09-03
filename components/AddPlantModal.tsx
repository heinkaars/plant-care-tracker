'use client';

import { useState } from 'react';
import { CareSchedule, CareType, Plant, PlantFormData, SeasonalFrequency } from '@/types/plant';
import { addDays } from 'date-fns';
import { getCurrentFrequency } from '@/lib/careStatus';
import { compressImageFile } from '@/lib/image';

interface AddPlantModalProps {
  onClose: () => void;
  /** Returns whether the save succeeded, so a failure can be shown here
   * instead of the modal closing as though it had worked. */
  onPlantAdded: (plant: Plant) => Promise<boolean>;
}

type InputMethod = 'manual' | 'search' | 'camera';

export default function AddPlantModal({ onClose, onPlantAdded }: AddPlantModalProps) {
  const [inputMethod, setInputMethod] = useState<InputMethod>('manual');
  const [formData, setFormData] = useState<PlantFormData>({
    name: '',
    scientificName: '',
    photo: '',
    wateringFrequency: 7,
    fertilizingFrequency: 30,
    repottingFrequency: 365,
    notes: '',
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('Plant name is required');
      return;
    }
    createPlant(formData);
  };

  const handleAISearch = async () => {
    if (!searchQuery.trim()) {
      setError('Please enter a search query');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/search-plant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery }),
      });

      if (!response.ok) {
        throw new Error('Failed to search for plant');
      }

      const data = await response.json();
      
      // Pre-fill form with AI results (seasonal data)
      setFormData({
        name: data.name || searchQuery,
        scientificName: data.scientificName || '',
        photo: '',
        // Use summer frequency as default display (most common growing season)
        wateringFrequency: data.watering?.summer || 7,
        fertilizingFrequency: data.fertilizing?.summer || 30,
        repottingFrequency: data.repotting?.summer || 365,
        // Store seasonal data
        wateringSeasonal: data.watering,
        fertilizingSeasonal: data.fertilizing,
        repottingSeasonal: data.repotting,
        notes: data.careNotes || '',
      });
      
      // Switch to manual mode to review/edit
      setInputMethod('manual');
    } catch (err) {
      setError('Failed to search for plant. Please check your API key in .env.local');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCameraCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError('');

    try {
      // Downscale before it ever leaves the browser — a raw phone photo can
      // run 5-10 MB, and nothing downstream (the OpenAI request, the stored
      // row, the plant grid) needs more than a preview-sized JPEG.
      const compressedImage = await compressImageFile(file);

      const response = await fetch('/api/identify-plant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: compressedImage }),
      });

      if (!response.ok) {
        throw new Error('Failed to identify plant');
      }

      const data = await response.json();

      // Pre-fill form with AI results (seasonal data)
      setFormData({
        name: data.name || 'Unknown Plant',
        scientificName: data.scientificName || '',
        photo: compressedImage,
        // Use summer frequency as default display
        wateringFrequency: data.watering?.summer || 7,
        fertilizingFrequency: data.fertilizing?.summer || 30,
        repottingFrequency: data.repotting?.summer || 365,
        // Store seasonal data
        wateringSeasonal: data.watering,
        fertilizingSeasonal: data.fertilizing,
        repottingSeasonal: data.repotting,
        notes: data.careNotes || '',
      });

      // Switch to manual mode to review/edit
      setInputMethod('manual');
    } catch (err) {
      setError('Failed to identify plant. Please check your API key in .env.local');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Seeds a schedule's nextDueDate from the current season's frequency
  // (via getCurrentFrequency) rather than the summer value the form
  // displays, so an AI-added plant is scheduled correctly regardless of
  // what season it's added in. A frequency of 0 means "skip this season" —
  // leave nextDueDate unset rather than due immediately.
  const buildSchedule = (
    type: CareType,
    frequencyDays: number,
    seasonalFrequency?: SeasonalFrequency
  ): CareSchedule => {
    const schedule: CareSchedule = {
      type,
      frequencyDays,
      seasonalFrequency,
      lastCareDate: null,
      nextDueDate: null,
    };
    const frequency = getCurrentFrequency(schedule);
    schedule.nextDueDate = frequency === 0 ? null : addDays(new Date(), frequency).toISOString();
    return schedule;
  };

  const createPlant = async (data: PlantFormData) => {
    const now = new Date().toISOString();
    const plant: Plant = {
      id: `${Date.now()}-${Math.random()}`,
      name: data.name,
      scientificName: data.scientificName,
      photo: data.photo,
      notes: data.notes,
      dateAdded: now,
      careSchedules: [
        buildSchedule('watering', data.wateringFrequency, data.wateringSeasonal),
        buildSchedule('fertilizing', data.fertilizingFrequency, data.fertilizingSeasonal),
        buildSchedule('repotting', data.repottingFrequency, data.repottingSeasonal),
      ],
      careHistory: [],
    };

    setLoading(true);
    setError('');
    const saved = await onPlantAdded(plant);
    setLoading(false);
    if (!saved) {
      setError('Could not save this plant. Check your connection and try again.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">Add New Plant</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>

        <div className="p-6">
          {/* Input Method Selector */}
          <div className="flex space-x-2 mb-6">
            <button
              onClick={() => setInputMethod('manual')}
              className={`flex-1 py-3 px-4 rounded-lg font-medium transition ${
                inputMethod === 'manual'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              ✏️ Manual Entry
            </button>
            <button
              onClick={() => setInputMethod('search')}
              className={`flex-1 py-3 px-4 rounded-lg font-medium transition ${
                inputMethod === 'search'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              🔍 AI Search
            </button>
            <button
              onClick={() => setInputMethod('camera')}
              className={`flex-1 py-3 px-4 rounded-lg font-medium transition ${
                inputMethod === 'camera'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              📷 Camera
            </button>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
            </div>
          )}

          {/* AI Search */}
          {inputMethod === 'search' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Describe the plant you're looking for
                </label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="e.g., 'a succulent with thick leaves' or 'Monstera deliciosa'"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  onKeyPress={(e) => e.key === 'Enter' && handleAISearch()}
                />
              </div>
              <button
                onClick={handleAISearch}
                disabled={loading}
                className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition disabled:bg-gray-400"
              >
                {loading ? 'Searching...' : 'Search with AI'}
              </button>
              <p className="text-sm text-gray-600 text-center">
                Use natural language to search for plants and get care recommendations
              </p>
            </div>
          )}

          {/* Camera Identification */}
          {inputMethod === 'camera' && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <div className="text-6xl mb-4">📷</div>
                <label className="cursor-pointer">
                  <span className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition inline-block">
                    {loading ? 'Identifying...' : 'Take or Upload Photo'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleCameraCapture}
                    className="hidden"
                    disabled={loading}
                  />
                </label>
                <p className="text-sm text-gray-600 mt-4">
                  Take a photo or upload an image to identify the plant with AI
                </p>
              </div>
            </div>
          )}

          {/* Manual Entry Form */}
          {inputMethod === 'manual' && (
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Plant Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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
                  value={formData.scientificName}
                  onChange={(e) => setFormData({ ...formData, scientificName: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="e.g., Monstera deliciosa"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    💧 Watering (days)
                  </label>
                  <input
                    type="number"
                    value={formData.wateringFrequency}
                    onChange={(e) =>
                      setFormData({ ...formData, wateringFrequency: parseInt(e.target.value) || 7 })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    min="1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    🌱 Fertilizing (days)
                  </label>
                  <input
                    type="number"
                    value={formData.fertilizingFrequency}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        fertilizingFrequency: parseInt(e.target.value) || 30,
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    min="1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    🪴 Repotting (days)
                  </label>
                  <input
                    type="number"
                    value={formData.repottingFrequency}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        repottingFrequency: parseInt(e.target.value) || 365,
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    min="1"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes (optional)
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  rows={3}
                  placeholder="Care tips, location, etc."
                />
              </div>

              {formData.photo && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Plant Photo
                  </label>
                  <img
                    src={formData.photo}
                    alt="Plant preview"
                    className="w-full h-48 object-cover rounded-lg"
                  />
                </div>
              )}

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
                  className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                >
                  Add Plant
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
