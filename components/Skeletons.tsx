// Loading-state skeletons matching each page's eventual layout, so the
// dashboard/list/detail structure is recognizable immediately instead of a
// bare "Loading..." string on an empty screen.

function Pulse({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-gray-200 ${className}`} />;
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <Pulse className="h-9 w-40" />
        <Pulse className="h-10 w-32 rounded-lg" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[0, 1, 2].map((i) => (
          <div key={i} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <Pulse className="h-4 w-24" />
                <Pulse className="h-8 w-12" />
              </div>
              <Pulse className="h-10 w-10 rounded-full" />
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <Pulse className="h-6 w-48" />
        </div>
        <div className="divide-y divide-gray-200">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="px-6 py-4 flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Pulse className="w-3 h-3 rounded-full" />
                <div className="space-y-2">
                  <Pulse className="h-4 w-32" />
                  <Pulse className="h-3 w-20" />
                </div>
              </div>
              <div className="space-y-2 text-right">
                <Pulse className="h-4 w-24 ml-auto" />
                <Pulse className="h-3 w-16 ml-auto" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function PlantsGridSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <Pulse className="h-9 w-40" />
        <div className="flex items-center space-x-4">
          <Pulse className="h-10 w-32 rounded-lg" />
          <Pulse className="h-10 w-32 rounded-lg" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} className="bg-white rounded-lg shadow overflow-hidden">
            <Pulse className="aspect-square rounded-none" />
            <div className="p-4 space-y-3">
              <Pulse className="h-5 w-3/4" />
              <Pulse className="h-4 w-1/2" />
              <div className="flex items-center justify-between">
                <Pulse className="h-5 w-20 rounded-full" />
                <Pulse className="h-4 w-10" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PlantDetailSkeleton() {
  return (
    <div className="space-y-6">
      <Pulse className="h-5 w-32" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <Pulse className="aspect-square rounded-none" />
            <div className="p-6 space-y-4">
              <Pulse className="h-7 w-2/3" />
              <Pulse className="h-4 w-1/2" />
              <Pulse className="h-10 w-full rounded-lg" />
              <Pulse className="h-10 w-full rounded-lg" />
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <Pulse className="h-6 w-40" />
            </div>
            <div className="p-6 space-y-4">
              {[0, 1, 2].map((i) => (
                <Pulse key={i} className="h-20 w-full rounded-lg" />
              ))}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <Pulse className="h-6 w-32" />
            </div>
            <div className="p-6 space-y-3">
              {[0, 1, 2].map((i) => (
                <Pulse key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AccountSkeleton() {
  return (
    <div className="max-w-md mx-auto bg-white rounded-lg shadow p-6 space-y-6">
      <Pulse className="h-7 w-32" />
      <div className="space-y-2">
        <Pulse className="h-4 w-24" />
        <Pulse className="h-3 w-full" />
        <Pulse className="h-10 w-full rounded-lg" />
      </div>
      <div className="border-t pt-6 space-y-4">
        <Pulse className="h-4 w-full" />
        <Pulse className="h-10 w-full rounded-lg" />
      </div>
    </div>
  );
}
