import { useState, useEffect } from 'react'
import { Search, Calendar, Clock, Bike, AlertCircle, Check, X, CalendarDays } from 'lucide-react'

const AvailabilityChecker = ({ scooters = [], rentals = [] }) => {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [isChecking, setIsChecking] = useState(false)
  const [availableScooters, setAvailableScooters] = useState([])
  const [unavailableScooters, setUnavailableScooters] = useState([])
  const [showResults, setShowResults] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)

  // אוטו-מילוי תאריך התחלה להיום
  useEffect(() => {
    if (!startDate) {
      setStartDate(new Date().toISOString().split('T')[0])
    }
  }, [])

  // אוטו-מילוי תאריך סיום כשמוגדר תאריך התחלה
  useEffect(() => {
    if (startDate && !endDate) {
      const nextDay = new Date(startDate)
      nextDay.setDate(nextDay.getDate() + 1)
      setEndDate(nextDay.toISOString().split('T')[0])
    }
  }, [startDate])

  // 🔥 NEW: פונקציה לחישוב משך הזמינות של קטנוע
  const calculateAvailabilityDuration = (scooter, requestedStartDate) => {
    // מצא את כל ההשכרות העתידיות של הקטנוע הזה
    const futureRentals = rentals
      .filter(rental => 
        rental.scooterId === scooter.id && 
        (rental.status === 'active' || rental.status === 'pending') &&
        new Date(rental.startDate) > requestedStartDate
      )
      .sort((a, b) => new Date(a.startDate) - new Date(b.startDate))

    if (futureRentals.length === 0) {
      return {
        duration: 'indefinite',
        nextBooking: null,
        availableUntil: null,
        daysAvailable: null
      }
    }

    // הזמנה הבאה הכי קרובה
    const nextBooking = futureRentals[0]
    const nextBookingDate = new Date(nextBooking.startDate)
    const daysBetween = Math.ceil((nextBookingDate - requestedStartDate) / (1000 * 60 * 60 * 24))

    return {
      duration: 'limited',
      nextBooking,
      availableUntil: nextBookingDate,
      daysAvailable: daysBetween
    }
  }

  // 🔥 NEW: פונקציה לפורמט תצוגת זמינות
  const formatAvailabilityDuration = (availability) => {
    if (availability.duration === 'indefinite') {
      return {
        text: 'Available indefinitely',
        subtext: 'No future bookings',
        color: 'text-green-700',
        bgColor: 'bg-green-100',
        icon: '∞'
      }
    }

    const { daysAvailable, availableUntil, nextBooking } = availability
    const untilDate = availableUntil.toLocaleDateString()

    if (daysAvailable === 1) {
      return {
        text: 'Available for 1 day',
        subtext: `Until ${untilDate}`,
        color: 'text-orange-700',
        bgColor: 'bg-orange-100',
        icon: '1'
      }
    } else if (daysAvailable <= 7) {
      return {
        text: `Available for ${daysAvailable} days`,
        subtext: `Until ${untilDate}`,
        color: 'text-yellow-700',
        bgColor: 'bg-yellow-100',
        icon: daysAvailable.toString()
      }
    } else if (daysAvailable <= 30) {
      return {
        text: `Available for ${daysAvailable} days`,
        subtext: `Until ${untilDate}`,
        color: 'text-blue-700',
        bgColor: 'bg-blue-100',
        icon: daysAvailable.toString()
      }
    } else {
      return {
        text: `Available for ${daysAvailable} days`,
        subtext: `Until ${untilDate}`,
        color: 'text-green-700',
        bgColor: 'bg-green-100',
        icon: '30+'
      }
    }
  }

  const checkAvailability = async () => {
    if (!startDate || !endDate) {
      alert('Please select both start and end dates')
      return
    }

    if (new Date(endDate) <= new Date(startDate)) {
      alert('End date must be after start date')
      return
    }

    setIsChecking(true)
    setShowResults(false)

    try {
      // סימולציה של זמן טעינה קצר
      await new Promise(resolve => setTimeout(resolve, 300))

      const requestedStartDate = new Date(startDate)
      const requestedEndDate = new Date(endDate)
      
      console.log('=== Checking Availability with Duration ===')
      console.log('Period:', {
        start: requestedStartDate.toDateString(),
        end: requestedEndDate.toDateString()
      })
      
      // מוצא אופנועים שתפוסים בתקופה הנבחרת
      const occupiedScooterIds = new Set()
      const conflictingRentals = {}
      
      rentals.forEach(rental => {
        // בודק רק השכרות פעילות ומוזמנות (לא completed)
        if (rental.status === 'active' || rental.status === 'pending') {
          const rentalStartDate = new Date(rental.startDate)
          const rentalEndDate = new Date(rental.endDate)
          
          // בדיקת חפיפה בתאריכים
          const hasDateConflict = (
            requestedStartDate < rentalEndDate && 
            requestedEndDate > rentalStartDate
          )
          
          if (hasDateConflict) {
            occupiedScooterIds.add(rental.scooterId)
            if (!conflictingRentals[rental.scooterId]) {
              conflictingRentals[rental.scooterId] = []
            }
            conflictingRentals[rental.scooterId].push(rental)
          }
        }
      })
      
      // חלוקת האופנועים לזמינים ולא זמינים עם חישוב משך זמינות
      const available = scooters.filter(scooter => {
        const isNotOccupied = !occupiedScooterIds.has(scooter.id)
        const isNotInMaintenance = scooter.status !== 'maintenance'
        return isNotOccupied && isNotInMaintenance
      }).map(scooter => {
        // 🔥 NEW: חישוב משך הזמינות לכל קטנוע זמין
        const availability = calculateAvailabilityDuration(scooter, requestedStartDate)
        const formattedAvailability = formatAvailabilityDuration(availability)
        
        return {
          ...scooter,
          availability,
          formattedAvailability
        }
      }).sort((a, b) => {
        // מיון לפי משך זמינות - ראשון הכי זמין לזמן רב
        if (a.availability.duration === 'indefinite' && b.availability.duration !== 'indefinite') return -1
        if (a.availability.duration !== 'indefinite' && b.availability.duration === 'indefinite') return 1
        if (a.availability.duration === 'indefinite' && b.availability.duration === 'indefinite') return 0
        
        return b.availability.daysAvailable - a.availability.daysAvailable
      })
      
      const unavailable = scooters.filter(scooter => {
        const isOccupied = occupiedScooterIds.has(scooter.id)
        const isInMaintenance = scooter.status === 'maintenance'
        return isOccupied || isInMaintenance
      }).map(scooter => ({
        ...scooter,
        conflictingRentals: conflictingRentals[scooter.id] || [],
        reason: scooter.status === 'maintenance' ? 'maintenance' : 'rented'
      }))
      
      setAvailableScooters(available)
      setUnavailableScooters(unavailable)
      setShowResults(true)
      setIsExpanded(true)
      
    } catch (error) {
      console.error('Error checking availability:', error)
      alert('Error checking availability')
    } finally {
      setIsChecking(false)
    }
  }

  const clearSearch = () => {
    setShowResults(false)
    setIsExpanded(false)
    setAvailableScooters([])
    setUnavailableScooters([])
  }

  const calculateDays = () => {
    if (!startDate || !endDate) return 0
    const start = new Date(startDate)
    const end = new Date(endDate)
    return Math.ceil((end - start) / (1000 * 60 * 60 * 24))
  }

  const days = calculateDays()

  // Helper function to check if a date is Sunday
  const isSunday = (dateString) => {
    if (!dateString) return false
    const date = new Date(dateString)
    return date.getDay() === 0 // 0 is Sunday
  }

  return (
    <div className={`bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 transition-all duration-300 ${isExpanded ? 'mb-6' : 'mb-4'}`}>
      {/* Header - תמיד גלוי */}
      <div className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center space-x-2">
            <Search className="h-5 w-5 text-blue-600" />
            <h3 className="text-lg font-medium text-gray-900">Quick Availability Check</h3>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 flex-1">
            {/* תאריך התחלה */}
            <div className="flex flex-col">
              <div className="flex items-center space-x-2">
                <Calendar className="h-4 w-4 text-gray-500" />
                <label className="text-sm font-medium text-gray-600">From:</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
              {isSunday(startDate) && (
                <p className="mt-1 text-xs text-yellow-600 flex items-center ml-20">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  Note: Start date is a Sunday
                </p>
              )}
            </div>
            
            {/* תאריך סיום */}
            <div className="flex flex-col">
              <div className="flex items-center space-x-2">
                <Calendar className="h-4 w-4 text-gray-500" />
                <label className="text-sm font-medium text-gray-600">To:</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  min={startDate || new Date().toISOString().split('T')[0]}
                />
              </div>
              {isSunday(endDate) && (
                <p className="mt-1 text-xs text-yellow-600 flex items-center ml-16">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  Note: End date is a Sunday
                </p>
              )}
            </div>
            
            {/* מידע על משך השכרה */}
            {days > 0 && (
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <Clock className="h-4 w-4" />
                <span>{days} day{days !== 1 ? 's' : ''}</span>
              </div>
            )}
          </div>
          
          {/* כפתורי פעולה */}
          <div className="flex items-center space-x-2">
            <button
              onClick={checkAvailability}
              disabled={isChecking || !startDate || !endDate}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isChecking ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Checking...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" />
                  Check
                </>
              )}
            </button>
            
            {showResults && (
              <button
                onClick={clearSearch}
                className="inline-flex items-center px-3 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                <X className="h-4 w-4 mr-1" />
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* תוצאות - מוצג רק כשיש חיפוש */}
      {showResults && (
        <div className="border-t border-blue-200 bg-white">
          <div className="p-4 space-y-4">
            {/* סיכום תוצאות */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Check className="h-5 w-5 text-green-600" />
                  <span className="text-sm font-medium text-green-800">
                    {availableScooters.length} Available
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  <span className="text-sm font-medium text-red-800">
                    {unavailableScooters.length} Unavailable
                  </span>
                </div>
              </div>
              <div className="text-xs text-gray-500">
                {new Date(startDate).toLocaleDateString()} - {new Date(endDate).toLocaleDateString()}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* אופנועים זמינים עם משך זמינות */}
              <div className="space-y-2">
                <h4 className="flex items-center text-sm font-medium text-green-800">
                  <Check className="h-4 w-4 mr-2" />
                  Available Scooters ({availableScooters.length})
                </h4>
                {availableScooters.length === 0 ? (
                  <div className="text-sm text-gray-500 italic bg-gray-50 p-3 rounded">
                    No scooters available for these dates
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {availableScooters.map(scooter => (
                      <div key={scooter.id} className="bg-green-50 border border-green-200 rounded p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-3">
                            <Bike className="h-4 w-4 text-green-600" />
                            <div>
                              <div className="font-medium text-green-900">{scooter.licensePlate}</div>
                              <div className="text-xs text-green-700">{scooter.color} • {scooter.year}</div>
                            </div>
                          </div>
                          <div className="text-xs text-green-600 font-medium">✓ Available</div>
                        </div>
                        
                        {/* 🔥 NEW: תצוגת משך הזמינות */}
                        <div className={`mt-2 p-2 rounded-md ${scooter.formattedAvailability.bgColor} border border-opacity-30`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <div className={`w-6 h-6 rounded-full ${scooter.formattedAvailability.bgColor} border flex items-center justify-center text-xs font-bold ${scooter.formattedAvailability.color}`}>
                                {scooter.formattedAvailability.icon}
                              </div>
                              <div>
                                <div className={`text-xs font-medium ${scooter.formattedAvailability.color}`}>
                                  {scooter.formattedAvailability.text}
                                </div>
                                <div className="text-xs text-gray-600">
                                  {scooter.formattedAvailability.subtext}
                                </div>
                              </div>
                            </div>
                            {scooter.availability.nextBooking && (
                              <div className="text-xs text-gray-500">
                                Next: {scooter.availability.nextBooking.customerName}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* אופנועים לא זמינים */}
              <div className="space-y-2">
                <h4 className="flex items-center text-sm font-medium text-red-800">
                  <AlertCircle className="h-4 w-4 mr-2" />
                  Unavailable Scooters ({unavailableScooters.length})
                </h4>
                {unavailableScooters.length === 0 ? (
                  <div className="text-sm text-gray-500 italic bg-gray-50 p-3 rounded">
                    All scooters are available!
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {unavailableScooters.map(scooter => (
                      <div key={scooter.id} className="bg-red-50 border border-red-200 rounded p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-3">
                            <Bike className="h-4 w-4 text-red-600" />
                            <div>
                              <div className="font-medium text-red-900">{scooter.licensePlate}</div>
                              <div className="text-xs text-red-700">{scooter.color} • {scooter.year}</div>
                            </div>
                          </div>
                          <div className="text-xs text-red-600 font-medium">
                            {scooter.reason === 'maintenance' ? '🔧 Maintenance' : '📅 Rented'}
                          </div>
                        </div>
                        
                        {/* פרטי השכרות מתנגשות */}
                        {scooter.conflictingRentals && scooter.conflictingRentals.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-red-200">
                            <div className="text-xs text-red-600 space-y-1">
                              {scooter.conflictingRentals.map(rental => (
                                <div key={rental.id} className="flex justify-between">
                                  <span>{rental.customerName}</span>
                                  <span>
                                    {new Date(rental.startDate).toLocaleDateString()} - {new Date(rental.endDate).toLocaleDateString()}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* הודעת עזרה משופרת */}
            <div className="bg-blue-50 border border-blue-200 rounded p-3">
              <div className="flex items-start space-x-2">
                <CalendarDays className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-blue-800">
                  <strong>Enhanced availability info:</strong> Available scooters now show how long they remain free. 
                  Green indicates long-term availability, while yellow/orange shows shorter availability windows. 
                  Plan your bookings accordingly!
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AvailabilityChecker