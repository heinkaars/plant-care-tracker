'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { storage } from '@/lib/storage';
import { getDashboardStats, getUpcomingCare } from '@/lib/careStatus';
import { Plant } from '@/types/plant';
import { format, parseISO } from 'date-fns';

export default function Dashboard() {
  const [plants, setPlants] = useState<Plant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
  }, []);

  if (loading) {
    return <div className="text-center py-12">Loading...</div>;
  }

  const stats = getDashboardStats(plants);
  const upcomingCare = getUpcomingCare(plants);

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <Link
          href="/plants?add=true"
          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
        >
          + Add Plant
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Plants</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalPlants}</p>
            </div>
            <div className="text-4xl">🪴</div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Upcoming Care</p>
              <p className="text-3xl font-bold text-yellow-600 mt-2">{stats.upcomingCount}</p>
            </div>
            <div className="text-4xl">⏰</div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Overdue Tasks</p>
              <p className="text-3xl font-bold text-red-600 mt-2">{stats.overdueCount}</p>
            </div>
            <div className="text-4xl">🚨</div>
          </div>
        </div>
      </div>

      {/* Upcoming Care Tasks */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Upcoming Care Tasks</h2>
        </div>
        <div className="divide-y divide-gray-200">
          {upcomingCare.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-500">
              {plants.length === 0 ? (
                <div>
                  <p className="text-lg mb-4">No plants yet!</p>
                  <Link
                    href="/plants?add=true"
                    className="text-green-600 hover:text-green-700 font-medium"
                  >
                    Add your first plant →
                  </Link>
                </div>
              ) : (
                <p>All caught up! No upcoming care tasks.</p>
              )}
            </div>
          ) : (
            upcomingCare.slice(0, 10).map((task, index) => (
              <Link
                key={index}
                href={`/plants/${task.plant.id}`}
                className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition"
              >
                <div className="flex items-center space-x-4">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      task.status === 'overdue' ? 'bg-red-500' : 'bg-yellow-500'
                    }`}
                  />
                  <div>
                    <p className="font-medium text-gray-900">{task.plant.name}</p>
                    <p className="text-sm text-gray-600 capitalize">
                      {task.schedule.type.replace('ing', '')}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p
                    className={`text-sm font-medium ${
                      task.status === 'overdue' ? 'text-red-600' : 'text-yellow-600'
                    }`}
                  >
                    {task.daysUntil < 0
                      ? `${Math.abs(task.daysUntil)} days overdue`
                      : task.daysUntil === 0
                      ? 'Due today'
                      : `Due in ${task.daysUntil} days`}
                  </p>
                  {task.schedule.nextDueDate && (
                    <p className="text-xs text-gray-500">
                      {format(parseISO(task.schedule.nextDueDate), 'MMM d, yyyy')}
                    </p>
                  )}
                </div>
              </Link>
            ))
          )}
        </div>
      </div>

      {/* Recent Plants */}
      {plants.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-900">Recent Plants</h2>
            <Link href="/plants" className="text-green-600 hover:text-green-700 text-sm font-medium">
              View all →
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-6">
            {plants.slice(0, 4).map((plant) => (
              <Link
                key={plant.id}
                href={`/plants/${plant.id}`}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition"
              >
                <div className="aspect-square bg-gray-100 rounded-lg mb-3 flex items-center justify-center text-4xl">
                  {plant.photo ? (
                    <img
                      src={plant.photo}
                      alt={plant.name}
                      className="w-full h-full object-cover rounded-lg"
                    />
                  ) : (
                    '🌿'
                  )}
                </div>
                <h3 className="font-medium text-gray-900 truncate">{plant.name}</h3>
                {plant.scientificName && (
                  <p className="text-sm text-gray-500 italic truncate">{plant.scientificName}</p>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
