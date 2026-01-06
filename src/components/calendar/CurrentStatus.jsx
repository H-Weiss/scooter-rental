import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Calendar, Bike, User, Clock, Wrench, CalendarDays } from 'lucide-react'

// Helper to format date as YYYY-MM-DD in local timezone
const formatDateLocal = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Helper to format date for display
const formatDisplayDate = (date) => {
  return date.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
}

// Helper to calculate days between dates
const daysBetween = (date1, date2) => {
  const d1 = new Date(date1.toISOString().split('T')[0] + 'T00:00:00')
  const d2 = new Date(date2.toISOString().split('T')[0] + 'T00:00:00')
  return Math.ceil((d2 - d1) / (1000 * 60 * 60 * 24))
}

const CurrentStatus = ({ scooters = [], rentals = [] }) => {
  const [selectedDate, setSelectedDate] = useState(new Date())

  // Check if selected date is today
  const isToday = useMemo(() => {
    const today = new Date()
    return formatDateLocal(selectedDate) === formatDateLocal(today)
  }, [selectedDate])

  // Check if selected date is tomorrow
  const isTomorrow = useMemo(() => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    return formatDateLocal(selectedDate) === formatDateLocal(tomorrow)
  }, [selectedDate])

  // Navigate to previous/next day
  const goToPrevDay = () => {
    const newDate = new Date(selectedDate)
    newDate.setDate(newDate.getDate() - 1)
    setSelectedDate(newDate)
  }

  const goToNextDay = () => {
    const newDate = new Date(selectedDate)
    newDate.setDate(newDate.getDate() + 1)
    setSelectedDate(newDate)
  }

  const goToToday = () => {
    setSelectedDate(new Date())
  }

  const goToTomorrow = () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    setSelectedDate(tomorrow)
  }

  // Calculate fleet status for selected date
  const fleetStatus = useMemo(() => {
    const selectedDateStr = formatDateLocal(selectedDate)
    const selectedDateStart = new Date(selectedDateStr + 'T00:00:00')
    const selectedDateEnd = new Date(selectedDateStr + 'T23:59:59')

    const available = []
    const rented = []
    const maintenance = []

    scooters.forEach(scooter => {
      // Check if in maintenance
      if (scooter.status === 'maintenance') {
        maintenance.push({ scooter })
        return
      }

      // Find rental that covers the selected date
      const activeRental = rentals.find(rental => {
        if (rental.scooterId !== scooter.id) return false
        if (rental.status !== 'active' && rental.status !== 'pending') return false

        const rentalStart = new Date(rental.startDate + 'T00:00:00')
        const rentalEnd = new Date(rental.endDate + 'T23:59:59')

        return selectedDateStart <= rentalEnd && selectedDateEnd >= rentalStart
      })

      if (activeRental) {
        // Scooter is rented on this date
        const rentalEnd = new Date(activeRental.endDate + 'T00:00:00')
        const daysLeft = daysBetween(selectedDateStart, rentalEnd)

        rented.push({
          scooter,
          rental: activeRental,
          untilDate: rentalEnd,
          daysLeft: daysLeft
        })
      } else {
        // Scooter is available - find next booking
        const futureRentals = rentals
          .filter(rental =>
            rental.scooterId === scooter.id &&
            (rental.status === 'active' || rental.status === 'pending') &&
            new Date(rental.startDate + 'T00:00:00') > selectedDateStart
          )
          .sort((a, b) => new Date(a.startDate) - new Date(b.startDate))

        const nextRental = futureRentals[0]
        let nextBookingInfo = null

        if (nextRental) {
          const nextBookingDate = new Date(nextRental.startDate + 'T00:00:00')
          const daysUntil = daysBetween(selectedDateStart, nextBookingDate)
          nextBookingInfo = {
            date: nextBookingDate,
            daysUntil,
            customerName: nextRental.customerName
          }
        }

        available.push({
          scooter,
          nextBooking: nextBookingInfo
        })
      }
    })

    // Sort available by next booking (those with bookings first, by date)
    available.sort((a, b) => {
      if (!a.nextBooking && !b.nextBooking) return 0
      if (!a.nextBooking) return 1
      if (!b.nextBooking) return -1
      return a.nextBooking.daysUntil - b.nextBooking.daysUntil
    })

    // Sort rented by days left (ending soonest first)
    rented.sort((a, b) => a.daysLeft - b.daysLeft)

    return { available, rented, maintenance }
  }, [scooters, rentals, selectedDate])

  return (
    <div className="px-4 pb-4">
      {/* Date Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div className="flex items-center space-x-2">
          <Calendar className="h-5 w-5 text-blue-600" />
          <span className="text-sm font-medium text-gray-700">
            {isToday ? 'Today' : isTomorrow ? 'Tomorrow' : 'Status for'}:
          </span>
        </div>

        <div className="flex items-center space-x-2">
          {/* Quick buttons */}
          <div className="flex space-x-1">
            <button
              onClick={goToToday}
              className={`px-2 py-1 text-xs rounded-md transition-colors ${
                isToday
                  ? 'bg-blue-100 text-blue-700 font-medium'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Today
            </button>
            <button
              onClick={goToTomorrow}
              className={`px-2 py-1 text-xs rounded-md transition-colors ${
                isTomorrow
                  ? 'bg-blue-100 text-blue-700 font-medium'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Tomorrow
            </button>
          </div>

          {/* Date picker with navigation */}
          <div className="flex items-center space-x-1">
            <button
              onClick={goToPrevDay}
              className="p-1.5 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <input
              type="date"
              value={formatDateLocal(selectedDate)}
              onChange={(e) => setSelectedDate(new Date(e.target.value + 'T00:00:00'))}
              className="px-2 py-1 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />

            <button
              onClick={goToNextDay}
              className="p-1.5 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Date Display */}
      <div className="text-center mb-4">
        <h4 className="text-base sm:text-lg font-semibold text-gray-900">
          {formatDisplayDate(selectedDate)}
        </h4>
      </div>

      {/* Available Scooters Section */}
      <div className="mb-4">
        <h5 className="flex items-center text-sm font-medium text-green-800 mb-2">
          <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
          Available ({fleetStatus.available.length})
        </h5>

        {fleetStatus.available.length === 0 ? (
          <div className="text-sm text-gray-500 italic bg-gray-50 p-3 rounded-lg">
            No scooters available on this date
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {fleetStatus.available.map(({ scooter, nextBooking }) => (
              <div
                key={scooter.id}
                className="bg-green-50 border border-green-200 rounded-lg p-2 sm:p-3"
              >
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-green-500 flex-shrink-0"></div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-green-900 text-sm truncate">{scooter.color}</div>
                    <div className="text-xs text-green-700 truncate">{scooter.licensePlate}</div>
                  </div>
                </div>

                <div className="mt-2 pt-2 border-t border-green-200">
                  {nextBooking ? (
                    <div className="text-xs text-green-700">
                      <div className="flex items-center space-x-1">
                        <CalendarDays className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">Next booking:</span>
                      </div>
                      <div className="font-medium mt-0.5">{nextBooking.date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</div>
                    </div>
                  ) : (
                    <div className="text-xs text-green-600 flex items-center space-x-1">
                      <span>&#8734;</span>
                      <span className="truncate">No bookings</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Rented Scooters Section */}
      <div className="mb-4">
        <h5 className="flex items-center text-sm font-medium text-red-800 mb-2">
          <div className="w-2 h-2 rounded-full bg-red-500 mr-2"></div>
          Rented ({fleetStatus.rented.length})
        </h5>

        {fleetStatus.rented.length === 0 ? (
          <div className="text-sm text-gray-500 italic bg-gray-50 p-3 rounded-lg">
            No scooters rented on this date
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {fleetStatus.rented.map(({ scooter, rental, untilDate, daysLeft }) => (
              <div
                key={scooter.id}
                className="bg-red-50 border border-red-200 rounded-lg p-2 sm:p-3"
              >
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-red-500 flex-shrink-0"></div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-red-900 text-sm truncate">{scooter.color}</div>
                    <div className="text-xs text-red-700 truncate">{scooter.licensePlate}</div>
                  </div>
                </div>

                <div className="mt-2 pt-2 border-t border-red-200">
                  <div className="text-xs text-red-700 flex items-center space-x-1">
                    <Clock className="h-3 w-3 flex-shrink-0" />
                    <span className="truncate">Until: {untilDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</span>
                  </div>
                  <div className="text-xs text-red-800 mt-1 flex items-center space-x-1">
                    <User className="h-3 w-3 flex-shrink-0" />
                    <span className="truncate">{rental.customerName}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Maintenance Scooters Section */}
      {fleetStatus.maintenance.length > 0 && (
        <div>
          <h5 className="flex items-center text-sm font-medium text-gray-700 mb-2">
            <Wrench className="h-4 w-4 mr-2 text-gray-500" />
            In Maintenance ({fleetStatus.maintenance.length})
          </h5>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {fleetStatus.maintenance.map(({ scooter }) => (
              <div
                key={scooter.id}
                className="bg-gray-100 border border-gray-300 rounded-lg p-2 sm:p-3"
              >
                <div className="flex items-center space-x-2">
                  <Wrench className="h-3 w-3 sm:h-4 sm:w-4 text-gray-500 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-gray-900 text-sm truncate">{scooter.color}</div>
                    <div className="text-xs text-gray-600 truncate">{scooter.licensePlate}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default CurrentStatus
