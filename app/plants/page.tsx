'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { storage } from '@/lib/storage';
import { useAuth } from '@/lib/auth-context';
import { getPlantStatus } from '@/lib/careStatus';
import { Plant } from '@/types/plant';
import AddPlantModal from '@/components/AddPlantModal';

export default function PlantsPage() {
  const { ready, userId, error, retry } = useAuth();
  const [plants, setPlants] = useState<Plant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Check URL params
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('add') === 'true') {
      setShowAddModal(true);
      // Clean up URL
      window.history.replaceState({}, '', '/plants');
    }
  }, []);

  // Wait for the auth bootstrap to produce a session before reading —
  // otherwise this races signInAnonymously and RLS just returns zero rows.
  useEffect(() => {
    if (!ready || !userId) return;
    let cancelled = false;
    storage.getPlants().then((loaded) => {
      if (!cancelled) {
        setPlants(loaded);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [ready, userId]);

  // Returns whether the save succeeded so AddPlantModal can keep itself
  // open and show the failure instead of closing as though it had worked.
  const handlePlantAdded = async (plant: Plant): Promise<boolean> => {
    const added = await storage.addPlant(plant);
    if (!added) return false;
    setPlants(await storage.getPlants());
    setShowAddModal(false);
    return true;
  };

  const handleDeletePlant = async (id: string) => {
    if (confirm('Are you sure you want to delete this plant?')) {
      await storage.deletePlant(id);
      setPlants(await storage.getPlants());
    }
  };

  if (error) {
    return (
      <div className="max-w-md mx-auto bg-white rounded-lg shadow p-6 space-y-4 text-center">
        <p className="text-red-700">{error}</p>
        <button
          onClick={retry}
          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!ready || loading) {
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">My Plants</h1>
        <div className="flex items-center space-x-4">
          <div className="flex bg-white rounded-lg shadow-sm">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-4 py-2 rounded-l-lg ${
                viewMode === 'grid' ? 'bg-green-600 text-white' : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              Grid
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-4 py-2 rounded-r-lg ${
                viewMode === 'list' ? 'bg-green-600 text-white' : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              List
            </button>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
          >
            + Add Plant
          </button>
        </div>
      </div>

      {plants.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="text-6xl mb-4">🪴</div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">No plants yet</h2>
          <p className="text-gray-600 mb-6">Start your plant collection by adding your first plant!</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition"
          >
            Add Your First Plant
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {plants.map((plant) => {
            const status = getPlantStatus(plant);
            return (
              <div key={plant.id} className="bg-white rounded-lg shadow hover:shadow-lg transition">
                <Link href={`/plants/${plant.id}`}>
                  <div className="aspect-square bg-gray-100 rounded-t-lg flex items-center justify-center text-6xl overflow-hidden">
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
                </Link>
                <div className="p-4">
                  <Link href={`/plants/${plant.id}`}>
                    <h3 className="font-semibold text-lg text-gray-900 mb-1 hover:text-green-600">
                      {plant.name}
                    </h3>
                  </Link>
                  {plant.scientificName && (
                    <p className="text-sm text-gray-600 italic mb-2">{plant.scientificName}</p>
                  )}
                  <div className="flex items-center justify-between">
                    <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(status)}`}>
                      {getStatusText(status)}
                    </span>
                    <button
                      onClick={() => handleDeletePlant(plant.id)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="divide-y divide-gray-200">
            {plants.map((plant) => {
              const status = getPlantStatus(plant);
              return (
                <div key={plant.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                  <Link href={`/plants/${plant.id}`} className="flex items-center space-x-4 flex-1">
                    <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center text-2xl overflow-hidden flex-shrink-0">
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
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 hover:text-green-600">
                        {plant.name}
                      </h3>
                      {plant.scientificName && (
                        <p className="text-sm text-gray-600 italic">{plant.scientificName}</p>
                      )}
                    </div>
                  </Link>
                  <div className="flex items-center space-x-4">
                    <span className={`text-xs px-3 py-1 rounded-full ${getStatusColor(status)}`}>
                      {getStatusText(status)}
                    </span>
                    <button
                      onClick={() => handleDeletePlant(plant.id)}
                      className="text-red-600 hover:text-red-800 text-sm px-3 py-1"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showAddModal && (
        <AddPlantModal
          onClose={() => setShowAddModal(false)}
          onPlantAdded={handlePlantAdded}
        />
      )}
    </div>
  );
}
