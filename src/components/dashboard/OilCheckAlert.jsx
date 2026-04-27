import { useState } from 'react'
import { Droplets, Check, Settings } from 'lucide-react'
import { updateScooterOilCheck } from '../../lib/database'

const DEFAULT_OIL_CHECK_DAYS = 7

export default function OilCheckAlert({ scootersNeedingOilCheck, onDone, onThresholdChange }) {
  const [showSettings, setShowSettings] = useState(false)
  const [threshold, setThreshold] = useState(
    () => Number(localStorage.getItem('oilCheckThresholdDays')) || DEFAULT_OIL_CHECK_DAYS
  )
  const [dismissedIds, setDismissedIds] = useState([])

  const visibleScooters = scootersNeedingOilCheck.filter(s => !dismissedIds.includes(s.id))

  if (visibleScooters.length === 0) return null

  const handleDone = async (scooterId) => {
    try {
      setDismissedIds(prev => [...prev, scooterId])
      await updateScooterOilCheck(scooterId)
      onDone?.()
    } catch (error) {
      console.error('Error marking oil check done:', error)
      setDismissedIds(prev => prev.filter(id => id !== scooterId))
      alert('Failed to update oil check status')
    }
  }

  const handleThresholdChange = (value) => {
    const days = Math.max(1, Number(value) || DEFAULT_OIL_CHECK_DAYS)
    setThreshold(days)
    localStorage.setItem('oilCheckThresholdDays', days.toString())
    onThresholdChange?.()
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4 sm:mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Droplets className="h-5 w-5 text-amber-600" />
          <h3 className="text-sm sm:text-base font-semibold text-amber-900">
            Oil Check Required
          </h3>
          <span className="bg-amber-200 text-amber-800 text-xs font-medium px-2 py-0.5 rounded-full">
            {visibleScooters.length}
          </span>
        </div>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="text-amber-500 hover:text-amber-700 p-2 rounded hover:bg-amber-100"
          title="Settings"
        >
          <Settings size={16} />
        </button>
      </div>

      {showSettings && (
        <div className="flex items-center gap-2 mb-3 p-2 bg-amber-100 rounded">
          <label className="text-xs text-amber-800">Alert after</label>
          <input
            type="number"
            min="1"
            value={threshold}
            onChange={(e) => handleThresholdChange(e.target.value)}
            className="w-16 px-2 py-1 text-sm border border-amber-300 rounded focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
          <span className="text-xs text-amber-800">days idle</span>
        </div>
      )}

      <div className="space-y-2">
        {visibleScooters.map(scooter => (
          <div
            key={scooter.id}
            className="flex items-center justify-between bg-white rounded-md px-3 py-2 border border-amber-100"
          >
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-900">{scooter.licensePlate}</span>
              <span className="text-xs text-gray-500">{scooter.color}</span>
              <span className="text-xs text-amber-600 font-medium">{scooter.idleDays} days idle</span>
            </div>
            <button
              onClick={() => handleDone(scooter.id)}
              className="flex items-center gap-1 text-xs font-medium text-green-700 hover:text-green-900 px-2 py-1 rounded hover:bg-green-50 border border-green-200"
            >
              <Check size={14} />
              Done
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
