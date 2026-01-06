import { useState, useEffect } from 'react'
import { Search, Calendar, Clock, Bike, AlertCircle, Check, X, CalendarDays, Users, TrendingUp, Trophy, Zap } from 'lucide-react'

// Helper to format date as YYYY-MM-DD in local timezone (avoids UTC shift issues)
const formatDateLocal = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const AvailabilityChecker = ({ scooters = [], rentals = [], isEmbedded = false }) => {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [isChecking, setIsChecking] = useState(false)
  const [availableScooters, setAvailableScooters] = useState([])
  const [unavailableScooters, setUnavailableScooters] = useState([])
  const [showResults, setShowResults] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [numberOfScooters, setNumberOfScooters] = useState(1)
  const [partialAvailability, setPartialAvailability] = useState(null)
  const [perScooterAvailability, setPerScooterAvailability] = useState(null)
  const [rentalDays, setRentalDays] = useState(1)

  // אוטו-מילוי תאריך התחלה להיום ותאריך סיום למחר
  useEffect(() => {
    if (!startDate) {
      const today = new Date()
      setStartDate(formatDateLocal(today))
      // Set initial end date to tomorrow
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      setEndDate(formatDateLocal(tomorrow))
    }
  }, [])

  // כשמשנים תאריך התחלה - מחשבים מחדש תאריך סיום לפי מספר הימים
  const handleStartDateChange = (newStartDate) => {
    setStartDate(newStartDate)
    if (newStartDate && rentalDays > 0) {
      const newEndDate = new Date(newStartDate + 'T00:00:00')
      newEndDate.setDate(newEndDate.getDate() + rentalDays)
      setEndDate(formatDateLocal(newEndDate))
    }
  }

  // כשמשנים מספר ימים - מחשבים מחדש תאריך סיום
  const handleDaysChange = (newDays) => {
    const days = Math.max(1, parseInt(newDays) || 1)
    setRentalDays(days)
    if (startDate) {
      const newEndDate = new Date(startDate + 'T00:00:00')
      newEndDate.setDate(newEndDate.getDate() + days)
      setEndDate(formatDateLocal(newEndDate))
    }
  }

  // כשמשנים תאריך סיום - מחשבים מחדש מספר ימים
  const handleEndDateChange = (newEndDate) => {
    setEndDate(newEndDate)
    if (startDate && newEndDate) {
      // Use local midnight to avoid timezone issues, Math.ceil to match RentalForm
      const start = new Date(startDate + 'T00:00:00')
      const end = new Date(newEndDate + 'T00:00:00')
      const diffDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24))
      if (diffDays > 0) {
        setRentalDays(diffDays)
      }
    }
  }

  // פונקציה למציאת תקופות זמינות חלקיות
  const findPartialAvailability = (scooters, rentals, requestedStartDate, requestedEndDate, numScooters) => {
    // Normalize dates to midnight to avoid timezone issues
    const start = new Date(requestedStartDate.toISOString().split('T')[0] + 'T00:00:00')
    const end = new Date(requestedEndDate.toISOString().split('T')[0] + 'T00:00:00')
    const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24))
    const availability = []

    // בודק כל יום בטווח
    for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
      const currentDate = new Date(d)
      const nextDate = new Date(d)
      nextDate.setDate(nextDate.getDate() + 1)

      // סופר כמה קטנועים זמינים באותו יום
      const availableOnDay = scooters.filter(scooter => {
        if (scooter.status === 'maintenance') return false

        const hasConflict = rentals.some(rental => {
          if (rental.scooterId !== scooter.id) return false
          if (rental.status !== 'active' && rental.status !== 'pending') return false

          const rentalStart = new Date(rental.startDate)
          const rentalEnd = new Date(rental.endDate)

          return currentDate <= rentalEnd && nextDate > rentalStart
        })

        return !hasConflict
      })

      availability.push({
        date: new Date(d),
        availableCount: availableOnDay.length,
        availableScooters: availableOnDay
      })
    }

    // מוצא תקופות רציפות של זמינות
    const periods = []
    let currentPeriod = null

    for (let i = 0; i < availability.length; i++) {
      const day = availability[i]

      if (day.availableCount >= numScooters) {
        if (!currentPeriod) {
          currentPeriod = {
            startDate: new Date(day.date),
            endDate: new Date(day.date),
            scooters: day.availableScooters.slice(0, numScooters)
          }
        } else {
          currentPeriod.endDate = new Date(day.date)
        }
      } else {
        if (currentPeriod) {
          // Calculate rental duration (same as RentalForm)
          currentPeriod.days = Math.ceil((currentPeriod.endDate - currentPeriod.startDate) / (1000 * 60 * 60 * 24))
          periods.push(currentPeriod)
          currentPeriod = null
        }
      }
    }

    if (currentPeriod) {
      // Calculate rental duration (same as RentalForm)
      currentPeriod.days = Math.ceil((currentPeriod.endDate - currentPeriod.startDate) / (1000 * 60 * 60 * 24))
      periods.push(currentPeriod)
    }

    // מיון לפי אורך התקופה (הארוכה ביותר קודם)
    periods.sort((a, b) => b.days - a.days)

    return {
      totalRequestedDays: totalDays,
      availablePeriods: periods,
      bestOption: periods[0] || null,
      hasFullAvailability: periods.length === 1 && periods[0]?.days === totalDays
    }
  }

  // NEW: פונקציה לחישוב זמינות חלקית של כל קטנוע בטווח התאריכים המבוקש
  const findPerScooterAvailability = (scooters, rentals, requestedStartDate, requestedEndDate) => {
    // Normalize dates to midnight to avoid timezone issues
    const start = new Date(requestedStartDate.toISOString().split('T')[0] + 'T00:00:00')
    const end = new Date(requestedEndDate.toISOString().split('T')[0] + 'T00:00:00')
    const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24))

    const scooterAvailability = scooters
      .filter(scooter => scooter.status !== 'maintenance')
      .map(scooter => {
        // מצא את כל ההשכרות של הקטנוע הזה שחופפות לטווח המבוקש
        const scooterRentals = rentals.filter(rental =>
          rental.scooterId === scooter.id &&
          (rental.status === 'active' || rental.status === 'pending')
        )

        // בנה רשימת ימים זמינים בטווח
        const availableDays = []
        for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
          const currentDate = new Date(d)
          const nextDate = new Date(d)
          nextDate.setDate(nextDate.getDate() + 1)

          const hasConflict = scooterRentals.some(rental => {
            const rentalStart = new Date(rental.startDate)
            const rentalEnd = new Date(rental.endDate)
            return currentDate <= rentalEnd && nextDate > rentalStart
          })

          if (!hasConflict) {
            availableDays.push(new Date(currentDate))
          }
        }

        // מצא תקופות רציפות של זמינות
        const periods = []
        let currentPeriod = null

        for (let i = 0; i < availableDays.length; i++) {
          const day = availableDays[i]

          if (!currentPeriod) {
            currentPeriod = {
              startDate: new Date(day),
              endDate: new Date(day)
            }
          } else {
            const expectedNext = new Date(currentPeriod.endDate)
            expectedNext.setDate(expectedNext.getDate() + 1)

            if (day.getTime() === expectedNext.getTime()) {
              currentPeriod.endDate = new Date(day)
            } else {
              // Calculate rental duration (same as RentalForm)
              currentPeriod.days = Math.ceil((currentPeriod.endDate - currentPeriod.startDate) / (1000 * 60 * 60 * 24))
              periods.push(currentPeriod)
              currentPeriod = {
                startDate: new Date(day),
                endDate: new Date(day)
              }
            }
          }
        }

        if (currentPeriod) {
          // Calculate rental duration (same as RentalForm)
          currentPeriod.days = Math.ceil((currentPeriod.endDate - currentPeriod.startDate) / (1000 * 60 * 60 * 24))
          periods.push(currentPeriod)
        }

        // מיין תקופות לפי אורך (הארוכה ביותר ראשונה)
        periods.sort((a, b) => b.days - a.days)

        const longestPeriod = periods[0] || null
        const totalAvailableDays = availableDays.length
        const isFullyAvailable = totalAvailableDays === totalDays

        // מצא את התקופה הראשונה (המוקדמת ביותר)
        const earliestPeriod = periods.length > 0
          ? periods.reduce((earliest, p) =>
              p.startDate < earliest.startDate ? p : earliest
            , periods[0])
          : null

        return {
          scooter,
          totalAvailableDays,
          totalRequestedDays: totalDays,
          availabilityPercent: Math.round((totalAvailableDays / totalDays) * 100),
          isFullyAvailable,
          longestPeriod,
          earliestPeriod,
          allPeriods: periods
        }
      })
      // סנן רק קטנועים עם לפחות יום אחד זמין
      .filter(item => item.totalAvailableDays > 0)

    // מיין לפי התקופה הרציפה הארוכה ביותר
    const sortedByLongest = [...scooterAvailability].sort((a, b) => {
      const aLongest = a.longestPeriod?.days || 0
      const bLongest = b.longestPeriod?.days || 0
      if (bLongest !== aLongest) return bLongest - aLongest
      return b.totalAvailableDays - a.totalAvailableDays
    })

    // מיין לפי התקופה המוקדמת ביותר
    const sortedByEarliest = [...scooterAvailability].sort((a, b) => {
      const aEarliest = a.earliestPeriod?.startDate || new Date('9999-12-31')
      const bEarliest = b.earliestPeriod?.startDate || new Date('9999-12-31')
      if (aEarliest < bEarliest) return -1
      if (aEarliest > bEarliest) return 1
      // אם אותו תאריך התחלה, העדף את התקופה הארוכה יותר
      return (b.earliestPeriod?.days || 0) - (a.earliestPeriod?.days || 0)
    })

    // מצא את ה-top picks
    const longestOption = sortedByLongest[0] || null
    const earliestOption = sortedByEarliest[0] || null

    return {
      totalRequestedDays: totalDays,
      scooterOptions: sortedByLongest,
      hasFullyAvailableScooter: scooterAvailability.some(s => s.isFullyAvailable),
      topPicks: {
        longest: longestOption,
        earliest: earliestOption,
        // בדוק אם הם אותו קטנוע
        isSameScooter: longestOption?.scooter.id === earliestOption?.scooter.id
      }
    }
  }

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
    const nextBookingDate = new Date(nextBooking.startDate + 'T00:00:00')
    const startNormalized = new Date(requestedStartDate.toISOString().split('T')[0] + 'T00:00:00')
    const daysBetween = Math.ceil((nextBookingDate - startNormalized) / (1000 * 60 * 60 * 24))

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
    setPartialAvailability(null)
    setPerScooterAvailability(null)

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
            requestedStartDate <= rentalEndDate &&
            requestedEndDate >= rentalStartDate
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
      
      // בדיקת זמינות חלקית אם אין מספיק קטנועים זמינים
      if (available.length < numberOfScooters) {
        const partial = findPartialAvailability(
          scooters,
          rentals,
          requestedStartDate,
          requestedEndDate,
          numberOfScooters
        )
        setPartialAvailability(partial)

        // NEW: חישוב זמינות חלקית לכל קטנוע
        const perScooter = findPerScooterAvailability(
          scooters,
          rentals,
          requestedStartDate,
          requestedEndDate
        )
        setPerScooterAvailability(perScooter)
      } else {
        setPartialAvailability(null)
        setPerScooterAvailability(null)
      }
      
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
    setPartialAvailability(null)
    setPerScooterAvailability(null)
    setNumberOfScooters(1)
  }

  // Helper function to check if a date is Sunday
  const isSunday = (dateString) => {
    if (!dateString) return false
    const date = new Date(dateString)
    return date.getDay() === 0 // 0 is Sunday
  }

  const content = (
    <>
      {/* Header - תמיד גלוי */}
      <div className={isEmbedded ? "px-4 pb-4" : "p-4"}>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          {!isEmbedded && (
            <div className="flex items-center space-x-2">
              <Search className="h-5 w-5 text-blue-600" />
              <h3 className="text-lg font-medium text-gray-900">Quick Availability Check</h3>
            </div>
          )}
          
          <div className="flex-1">
            {/* 2x2 grid on mobile, 1x4 on desktop */}
            <div className="grid grid-cols-4 gap-x-1 gap-y-2 sm:gap-3">
              {/* תאריך התחלה */}
              <div className="col-span-2 sm:col-span-1 flex flex-col pr-2 sm:pr-0">
                <label className="text-xs font-medium text-gray-600 mb-1 flex items-center">
                  <Calendar className="h-3 w-3 mr-1" />
                  From
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  className="w-full px-1 py-2 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  min={formatDateLocal(new Date())}
                />
                {isSunday(startDate) && (
                  <p className="mt-1 text-xs text-yellow-600 flex items-center bg-yellow-50 px-1 py-0.5 rounded">
                    <AlertCircle className="w-3 h-3 mr-1 flex-shrink-0" />
                    Sunday!
                  </p>
                )}
              </div>

              {/* מספר ימים */}
              <div className="col-span-2 sm:col-span-1 flex flex-col pl-2 sm:pl-0">
                <label className="text-xs font-medium text-gray-600 mb-1 flex items-center">
                  <Clock className="h-3 w-3 mr-1" />
                  Days
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={rentalDays}
                  onChange={(e) => {
                    const val = e.target.value
                    if (val === '' || /^\d+$/.test(val)) {
                      setRentalDays(val === '' ? '' : parseInt(val))
                      if (val !== '' && startDate) {
                        const days = parseInt(val)
                        if (days > 0) {
                          const start = new Date(startDate + 'T00:00:00')
                          start.setDate(start.getDate() + days)
                          setEndDate(formatDateLocal(start))
                        }
                      }
                    }
                  }}
                  onBlur={(e) => {
                    // Reset to 1 if empty or invalid on blur
                    if (e.target.value === '' || parseInt(e.target.value) < 1) {
                      handleDaysChange(1)
                    }
                  }}
                  className="w-full px-1 py-2 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center bg-white"
                />
              </div>

              {/* תאריך סיום */}
              <div className="col-span-2 sm:col-span-1 flex flex-col pr-2 sm:pr-0">
                <label className="text-xs font-medium text-gray-600 mb-1 flex items-center">
                  <Calendar className="h-3 w-3 mr-1" />
                  To
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => handleEndDateChange(e.target.value)}
                  className="w-full px-1 py-2 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  min={startDate || formatDateLocal(new Date())}
                />
                {isSunday(endDate) && (
                  <p className="mt-1 text-xs text-yellow-600 flex items-center bg-yellow-50 px-1 py-0.5 rounded">
                    <AlertCircle className="w-3 h-3 mr-1 flex-shrink-0" />
                    Sunday!
                  </p>
                )}
              </div>

              {/* מספר קטנועים */}
              <div className="col-span-2 sm:col-span-1 flex flex-col pl-2 sm:pl-0">
                <label className="text-xs font-medium text-gray-600 mb-1 flex items-center">
                  <Users className="h-3 w-3 mr-1" />
                  Scooters
                </label>
                <select
                  value={numberOfScooters}
                  onChange={(e) => setNumberOfScooters(parseInt(e.target.value))}
                  className="w-full px-1 py-2 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                >
                  {[1, 2, 3, 4, 5].map(num => (
                    <option key={num} value={num}>{num}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* כפתורי פעולה */}
          <div className="flex items-center space-x-2 mt-3 sm:mt-0">
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
        <div className="border-t border-blue-200 bg-white rounded-b-lg">
          <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
            {/* הודעת זמינות חלקית - מציג אופציות לפי קטנוע */}
            {availableScooters.length === 0 && perScooterAvailability && perScooterAvailability.scooterOptions.length > 0 && (
              <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-3 sm:p-4 mb-3 sm:mb-4">
                <div className="flex items-start space-x-2 sm:space-x-3">
                  <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <h4 className="text-sm font-bold text-amber-900 mb-1 sm:mb-2">
                      No scooter available for all {perScooterAvailability.totalRequestedDays} days
                    </h4>
                    <p className="text-xs sm:text-sm text-amber-800 mb-2 sm:mb-3">
                      Here's what we can offer:
                    </p>

                    {/* TOP RECOMMENDATIONS */}
                    {perScooterAvailability.topPicks && (
                      <div className="bg-white border-2 border-blue-300 rounded-lg p-3 mb-4">
                        <h5 className="text-xs font-bold text-blue-800 uppercase tracking-wide mb-3">
                          Top Recommendations
                        </h5>
                        <div className={`flex flex-col gap-3 ${perScooterAvailability.topPicks.isSameScooter ? '' : 'sm:flex-row'}`}>
                          {/* Longest Option */}
                          {perScooterAvailability.topPicks.longest && (
                            <div className="flex-1 bg-gradient-to-r from-purple-50 to-purple-100 border-2 border-purple-300 rounded-lg p-3">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center space-x-2">
                                  <Trophy className="h-5 w-5 text-purple-600" />
                                  <span className="text-sm font-bold text-purple-900">Longest</span>
                                </div>
                                <div className="flex items-center space-x-1 bg-white px-2 py-1 rounded-full">
                                  <Bike className="h-4 w-4 text-purple-600" />
                                  <span className="text-sm font-semibold text-purple-900">
                                    {perScooterAvailability.topPicks.longest.scooter.color}
                                  </span>
                                </div>
                              </div>
                              <div className="text-base text-purple-800 font-bold">
                                {perScooterAvailability.topPicks.longest.longestPeriod?.days} {perScooterAvailability.topPicks.longest.longestPeriod?.days === 1 ? 'day' : 'days'} in a row
                              </div>
                              <div className="text-sm text-purple-700 mt-1">
                                {perScooterAvailability.topPicks.longest.longestPeriod?.startDate.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })} → {perScooterAvailability.topPicks.longest.longestPeriod?.endDate.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                              </div>
                            </div>
                          )}

                          {/* Earliest Option - only show if different from longest */}
                          {perScooterAvailability.topPicks.earliest && !perScooterAvailability.topPicks.isSameScooter && (
                            <div className="flex-1 bg-gradient-to-r from-green-50 to-green-100 border-2 border-green-300 rounded-lg p-3">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center space-x-2">
                                  <Zap className="h-5 w-5 text-green-600" />
                                  <span className="text-sm font-bold text-green-900">Earliest</span>
                                </div>
                                <div className="flex items-center space-x-1 bg-white px-2 py-1 rounded-full">
                                  <Bike className="h-4 w-4 text-green-600" />
                                  <span className="text-sm font-semibold text-green-900">
                                    {perScooterAvailability.topPicks.earliest.scooter.color}
                                  </span>
                                </div>
                              </div>
                              <div className="text-base text-green-800 font-bold">
                                {perScooterAvailability.topPicks.earliest.earliestPeriod?.days} {perScooterAvailability.topPicks.earliest.earliestPeriod?.days === 1 ? 'day' : 'days'} available
                              </div>
                              <div className="text-sm text-green-700 mt-1">
                                {perScooterAvailability.topPicks.earliest.earliestPeriod?.startDate.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })} → {perScooterAvailability.topPicks.earliest.earliestPeriod?.endDate.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                              </div>
                            </div>
                          )}

                          {/* If same scooter, show combined message */}
                          {perScooterAvailability.topPicks.isSameScooter && (
                            <div className="text-xs text-blue-700 mt-1 bg-blue-50 p-2 rounded">
                              This scooter has both the longest availability and the earliest start date.
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* ALL OPTIONS */}
                    <div>
                      <h5 className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">
                        All Options
                      </h5>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {perScooterAvailability.scooterOptions.map((option, index) => (
                          <div
                            key={option.scooter.id}
                            className="bg-white border border-amber-200 rounded-lg p-2 sm:p-3"
                          >
                            <div className="flex items-center justify-between mb-1 sm:mb-2">
                              <div className="flex items-center space-x-2">
                                <Bike className="h-4 w-4 text-amber-600 flex-shrink-0" />
                                <span className="font-medium text-gray-900 text-sm">{option.scooter.color}</span>
                              </div>
                              <span className={`px-1.5 sm:px-2 py-0.5 rounded text-xs font-medium ${
                                option.availabilityPercent >= 75 ? 'bg-green-100 text-green-800' :
                                option.availabilityPercent >= 50 ? 'bg-yellow-100 text-yellow-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {option.availabilityPercent}%
                              </span>
                            </div>

                            {/* כל התקופות הזמינות */}
                            <div className="text-xs text-gray-700 space-y-0.5">
                              {option.allPeriods.map((period, i) => (
                                <div key={i} className="flex flex-wrap items-center gap-x-1">
                                  <span className="font-medium">{period.days}d:</span>
                                  <span className="text-gray-600">
                                    {period.startDate.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' })} - {period.endDate.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' })}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* הודעת זמינות חלקית למספר קטנועים */}
            {partialAvailability && !partialAvailability.hasFullAvailability && availableScooters.length > 0 && availableScooters.length < numberOfScooters && (
              <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-4 mb-4">
                <div className="flex items-start space-x-3">
                  <TrendingUp className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <h4 className="text-sm font-bold text-amber-900 mb-2">
                      Only {availableScooters.length} scooter{availableScooters.length !== 1 ? 's' : ''} available for the full period ({numberOfScooters} requested)
                    </h4>

                    {partialAvailability.availablePeriods.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-sm text-amber-800 font-medium">Periods where {numberOfScooters} scooters are available:</p>
                        {partialAvailability.availablePeriods.slice(0, 3).map((period, index) => (
                          <div key={index} className="bg-white border border-amber-200 rounded p-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <span className="text-sm font-bold text-amber-900">
                                  {period.days} day{period.days !== 1 ? 's' : ''} available
                                </span>
                                <span className="text-xs text-gray-600 ml-2">
                                  ({Math.round((period.days / partialAvailability.totalRequestedDays) * 100)}% of requested period)
                                </span>
                              </div>
                              {index === 0 && (
                                <span className="px-2 py-1 bg-amber-100 text-amber-800 text-xs font-medium rounded">
                                  Best Option
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-700 mt-1">
                              <strong>Dates:</strong> {period.startDate.toLocaleDateString()} - {period.endDate.toLocaleDateString()}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-amber-800">
                        No period with {numberOfScooters} scooter{numberOfScooters !== 1 ? 's' : ''} available.
                        Try reducing the number of scooters or selecting different dates.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            {/* סיכום תוצאות */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex items-center space-x-3 sm:space-x-4">
                <div className="flex items-center space-x-1 sm:space-x-2">
                  <Check className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
                  <span className="text-xs sm:text-sm font-medium text-green-800">
                    {availableScooters.length} Available
                  </span>
                </div>
                <div className="flex items-center space-x-1 sm:space-x-2">
                  <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-red-600" />
                  <span className="text-xs sm:text-sm font-medium text-red-800">
                    {unavailableScooters.length} Unavailable
                  </span>
                </div>
              </div>
              <div className="text-xs text-gray-500">
                {new Date(startDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' })} - {new Date(endDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' })} ({rentalDays}d)
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
              {/* אופנועים זמינים עם משך זמינות */}
              <div className="space-y-2">
                <h4 className="flex items-center text-sm font-medium text-green-800">
                  <Check className="h-4 w-4 mr-2" />
                  Available Scooters ({availableScooters.length}{numberOfScooters > 1 && availableScooters.length >= numberOfScooters ? ` - ${numberOfScooters} needed` : ''})
                </h4>
                {availableScooters.length === 0 ? (
                  <div className="text-sm text-gray-500 italic bg-gray-50 p-3 rounded">
                    No scooters available for these dates
                  </div>
                ) : availableScooters.length < numberOfScooters ? (
                  <div className="text-sm text-amber-600 bg-amber-50 p-3 rounded border border-amber-200">
                    <strong>Not enough scooters:</strong> Only {availableScooters.length} available, but {numberOfScooters} requested.
                    {partialAvailability?.bestOption && (
                      <span className="block mt-1">
                        See partial availability options above.
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {availableScooters.map(scooter => (
                      <div key={scooter.id} className="bg-green-50 border border-green-200 rounded p-2 sm:p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <Bike className="h-4 w-4 text-green-600 flex-shrink-0" />
                            <div>
                              <div className="font-medium text-green-900 text-sm">{scooter.color}</div>
                              <div className="text-xs text-green-700">{scooter.licensePlate}</div>
                            </div>
                          </div>
                          <div className="px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                            ✓ {rentalDays}d
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
                      <div key={scooter.id} className="bg-red-50 border border-red-200 rounded p-2 sm:p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <Bike className="h-4 w-4 text-red-600 flex-shrink-0" />
                            <div>
                              <div className="font-medium text-red-900 text-sm">{scooter.color}</div>
                              <div className="text-xs text-red-700">{scooter.licensePlate}</div>
                            </div>
                          </div>
                          <div className="text-xs text-red-600 font-medium">
                            {scooter.reason === 'maintenance' ? '🔧' : '📅'}
                          </div>
                        </div>

                        {/* פרטי השכרות מתנגשות */}
                        {scooter.conflictingRentals && scooter.conflictingRentals.length > 0 && (
                          <div className="mt-1 pt-1 border-t border-red-200">
                            <div className="text-xs text-red-600 space-y-0.5">
                              {scooter.conflictingRentals.map(rental => (
                                <div key={rental.id} className="flex flex-wrap justify-between gap-x-2">
                                  <span className="truncate max-w-[100px] sm:max-w-none">{rental.customerName}</span>
                                  <span className="text-red-500">
                                    {new Date(rental.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' })} - {new Date(rental.endDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' })}
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
            <div className="bg-blue-50 border border-blue-200 rounded p-2 sm:p-3">
              <div className="flex items-start space-x-2">
                <CalendarDays className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-blue-800">
                  <span className="hidden sm:inline"><strong>Tip:</strong> </span>Search for multiple scooters and get recommendations when full availability isn't possible.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )

  // If embedded, return just the content without wrapper
  if (isEmbedded) {
    return content
  }

  // Otherwise, wrap in the styled container
  return (
    <div className={`bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 transition-all duration-300 ${isExpanded ? 'mb-6' : 'mb-4'}`}>
      {content}
    </div>
  )
}

export default AvailabilityChecker