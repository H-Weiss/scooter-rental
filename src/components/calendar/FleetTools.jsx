import { useState } from 'react'
import { Search, Bike } from 'lucide-react'
import AvailabilityChecker from './AvailabilityChecker'
import CurrentStatus from './CurrentStatus'

const FleetTools = ({ scooters = [], rentals = [] }) => {
  const [activeView, setActiveView] = useState('availability') // 'availability' | 'status'

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 mb-4">
      {/* Header with Toggle */}
      <div className="p-4 pb-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div className="flex items-center space-x-2">
            <Search className="h-5 w-5 text-blue-600" />
            <h3 className="text-lg font-medium text-gray-900">Fleet Tools</h3>
          </div>

          {/* Toggle Button */}
          <div className="flex bg-gray-200 rounded-lg p-1">
            <button
              onClick={() => setActiveView('availability')}
              className={`flex items-center px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                activeView === 'availability'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <Search className="h-4 w-4 mr-1.5" />
              Check Availability
            </button>
            <button
              onClick={() => setActiveView('status')}
              className={`flex items-center px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                activeView === 'status'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <Bike className="h-4 w-4 mr-1.5" />
              Current Status
            </button>
          </div>
        </div>
      </div>

      {/* Active View Content */}
      {activeView === 'availability' ? (
        <AvailabilityChecker scooters={scooters} rentals={rentals} isEmbedded={true} />
      ) : (
        <CurrentStatus scooters={scooters} rentals={rentals} />
      )}
    </div>
  )
}

export default FleetTools
