import { useState, useEffect } from 'react'
import { Search, Calendar, Clock, Bike, AlertCircle, Check, X, CalendarDays, Users, TrendingUp, Trophy, Zap, Shuffle, Pin, ArrowRightLeft, Loader2 } from 'lucide-react'
import { hasBookingConflictWithTime } from '../../utils/rentalCalculations'
import { findOptimalAvailability, validateSwaps, applySwaps } from '../../utils/availabilityOptimizer'
import { updateRental } from '../../lib/database'
import useStatistics from '../../context/useStatistics'

// Default times for availability check (allows same-day bookings with 2h buffer)
const DEFAULT_START_TIME = '09:00'
const DEFAULT_END_TIME = '18:00'
// If return time is 16:00 or later, scooter is only available next day (2h buffer would exceed business hours)
const SAME_DAY_CUTOFF_TIME = '16:00'

// Helper to format time as HH:MM (removes seconds if present)
const formatTime = (time) => {
  if (!time) return ''
  return time.substring(0, 5)
}

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
  const [sameDayScooters, setSameDayScooters] = useState([])
  const [showResults, setShowResults] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [numberOfScooters, setNumberOfScooters] = useState(1)
  const [partialAvailability, setPartialAvailability] = useState(null)
  const [perScooterAvailability, setPerScooterAvailability] = useState(null)
  const [rentalDays, setRentalDays] = useState(1)
  const [sizeFilter, setSizeFilter] = useState('any')
  const [optimizationResult, setOptimizationResult] = useState(null)
  const [applyingSwapsFor, setApplyingSwapsFor] = useState(null) // scooter ID being processed
  const [swapSuccess, setSwapSuccess] = useState(null) // { scooterId, message } for success feedback

  const { refreshStatistics } = useStatistics()

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

    // בודק כל יום בטווח (including end date - scooter must be available through end date)
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
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

        // בנה רשימת ימים זמינים בטווח (including end date)
        const availableDays = []
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const currentDate = new Date(d)
          const currentDateStr = formatDateLocal(currentDate)
          const nextDate = new Date(d)
          nextDate.setDate(nextDate.getDate() + 1)

          const hasConflict = scooterRentals.some(rental => {
            const rentalStartStr = rental.startDate
            const rentalEndStr = rental.endDate
            const rentalStart = new Date(rentalStartStr + 'T00:00:00')
            const rentalEnd = new Date(rentalEndStr + 'T00:00:00')
            const returnTime = (rental.endTime || DEFAULT_END_TIME).substring(0, 5) // Handle "HH:MM:SS" format

            // If rental ends on current date, check if same-day availability applies
            if (rentalEndStr === currentDateStr) {
              // Same-day available only if return time < 16:00
              if (returnTime < SAME_DAY_CUTOFF_TIME) {
                return false // No conflict - same-day available
              }
              // Return >= 16:00, so this day is not available
              return nextDate > rentalStart
            }

            // Standard overlap check
            return currentDate <= rentalEnd && nextDate > rentalStart
          })

          if (!hasConflict) {
            availableDays.push(new Date(currentDate))
          }
        }

        // Helper to find rental ending on the day before a given date (or same day if before 16:00)
        const findReturningRental = (periodStartDate) => {
          const dayBefore = new Date(periodStartDate)
          dayBefore.setDate(dayBefore.getDate() - 1)
          const dayBeforeStr = formatDateLocal(dayBefore)
          const periodStartStr = formatDateLocal(periodStartDate)

          // First check for rental ending day before (always valid)
          let returningRental = scooterRentals.find(rental => {
            return rental.endDate === dayBeforeStr
          })

          // If not found, check for same-day return (only valid if return time < 16:00)
          if (!returningRental) {
            returningRental = scooterRentals.find(rental => {
              const returnTime = (rental.endTime || DEFAULT_END_TIME).substring(0, 5)
              // Same-day only valid if return before 16:00
              return rental.endDate === periodStartStr && returnTime < SAME_DAY_CUTOFF_TIME
            })
          }

          if (returningRental) {
            const returnTime = formatTime(returningRental.endTime || DEFAULT_END_TIME)
            const isSameDay = returningRental.endDate === periodStartStr

            // Only show available time for same-day returns
            if (isSameDay && returnTime < SAME_DAY_CUTOFF_TIME) {
              const [hours, minutes] = returnTime.split(':').map(Number)
              const availableFromHours = hours + 2
              const availableFromTime = `${String(availableFromHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`

              return {
                returnTime,
                availableFromTime,
                customerName: returningRental.customerName,
                endDate: returningRental.endDate,
                isSameDay: true
              }
            } else {
              // Day before return - available from start of day
              return {
                returnTime,
                availableFromTime: DEFAULT_START_TIME,
                customerName: returningRental.customerName,
                endDate: returningRental.endDate,
                isSameDay: false
              }
            }
          }
          return null
        }

        // מצא תקופות רציפות של זמינות
        const periods = []
        let currentPeriod = null

        for (let i = 0; i < availableDays.length; i++) {
          const day = availableDays[i]

          if (!currentPeriod) {
            currentPeriod = {
              startDate: new Date(day),
              endDate: new Date(day),
              returningRental: findReturningRental(day)
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
                endDate: new Date(day),
                returningRental: findReturningRental(day)
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
    setOptimizationResult(null)

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
      // Track scooters that become available on search start date (same-day availability)
      const sameDayAvailability = {}
      // Track scooters returning on search start date (for same-day options display)
      const sameDayReturns = {}

      rentals.forEach(rental => {
        // בודק רק השכרות פעילות ומוזמנות (לא completed)
        if (rental.status === 'active' || rental.status === 'pending') {
          const rentalStartDate = new Date(rental.startDate)
          const rentalEndDate = new Date(rental.endDate)

          // Check if rental ends on the requested start date
          const reqStartStr = requestedStartDate.toISOString().split('T')[0]
          const rentalEndStr = rentalEndDate.toISOString().split('T')[0]
          const isReturningOnStartDate = reqStartStr === rentalEndStr

          // בדיקת חפיפה בתאריכים עם התחשבות בשעות להזמנות באותו יום
          const hasConflict = hasBookingConflictWithTime(
            requestedStartDate, requestedEndDate,
            DEFAULT_START_TIME, DEFAULT_END_TIME,
            rentalStartDate, rentalEndDate,
            rental.startTime || DEFAULT_START_TIME,
            rental.endTime || DEFAULT_END_TIME
          )

          if (hasConflict) {
            occupiedScooterIds.add(rental.scooterId)
            if (!conflictingRentals[rental.scooterId]) {
              conflictingRentals[rental.scooterId] = []
            }
            conflictingRentals[rental.scooterId].push(rental)

            // If returning on start date, track for same-day options
            if (isReturningOnStartDate) {
              const returnTime = formatTime(rental.endTime || DEFAULT_END_TIME)
              sameDayReturns[rental.scooterId] = {
                returnTime,
                customerName: rental.customerName,
                rental
              }
            }
          } else {
            // No conflict - check if this is a same-day availability case
            if (isReturningOnStartDate) {
              // Rental ends on the requested start date - track the return time
              const returnTime = formatTime(rental.endTime || DEFAULT_END_TIME)
              sameDayAvailability[rental.scooterId] = {
                returnTime,
                customerName: rental.customerName,
                availableFrom: returnTime
              }
            }
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

        // Check if this scooter has same-day availability info
        const sameDayInfo = sameDayAvailability[scooter.id] || null

        return {
          ...scooter,
          availability,
          formattedAvailability,
          sameDayInfo
        }
      }).sort((a, b) => {
        // מיון לפי משך זמינות - ראשון הכי זמין לזמן רב
        if (a.availability.duration === 'indefinite' && b.availability.duration !== 'indefinite') return -1
        if (a.availability.duration !== 'indefinite' && b.availability.duration === 'indefinite') return 1
        if (a.availability.duration === 'indefinite' && b.availability.duration === 'indefinite') return 0
        
        return b.availability.daysAvailable - a.availability.daysAvailable
      })
      
      // Build same-day returns array (scooters returning on start date that could be available)
      // Only include if return time is before 16:00 (otherwise available next day)
      // AND no other rental blocks the scooter for the rest of the requested period
      const sameDayReturnsList = scooters
        .filter(scooter => {
          const info = sameDayReturns[scooter.id]
          if (!info || scooter.status === 'maintenance') return false
          // Exclude if return time is 16:00 or later
          if (info.returnTime >= SAME_DAY_CUTOFF_TIME) return false

          // CRITICAL FIX: Check if there's another rental that blocks the scooter
          // for the rest of the requested period (after the same-day return)
          const hasOtherBlockingRental = rentals.some(rental => {
            if (rental.scooterId !== scooter.id) return false
            if (rental.status !== 'active' && rental.status !== 'pending') return false
            // Skip the rental that's ending on start date (that's the one returning)
            if (rental.id === info.rental.id) return false

            // Check if this other rental overlaps with our requested period
            const rentalStart = new Date(rental.startDate + 'T00:00:00')
            const rentalEnd = new Date(rental.endDate + 'T23:59:59')

            return requestedStartDate <= rentalEnd && requestedEndDate >= rentalStart
          })

          // Only show as same-day available if no other rental blocks it
          return !hasOtherBlockingRental
        })
        .map(scooter => {
          const info = sameDayReturns[scooter.id]
          // Calculate available from time (return time + 2 hours)
          const [hours, minutes] = info.returnTime.split(':').map(Number)
          const availableFromHours = hours + 2
          const availableFromTime = `${String(availableFromHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`

          return {
            ...scooter,
            returnTime: info.returnTime,
            availableFromTime,
            customerName: info.customerName
          }
        })
        .sort((a, b) => a.returnTime.localeCompare(b.returnTime))

      // Create a set of scooter IDs that are truly same-day available (no other blocking rentals)
      const trueSameDayAvailableIds = new Set(sameDayReturnsList.map(s => s.id))

      const unavailable = scooters.filter(scooter => {
        const isOccupied = occupiedScooterIds.has(scooter.id)
        const isInMaintenance = scooter.status === 'maintenance'
        // Only exclude from unavailable if it's TRULY same-day available (verified in sameDayReturnsList)
        const isTrulySameDayAvailable = trueSameDayAvailableIds.has(scooter.id)
        // Exclude same-day returns that are truly available (they'll be shown separately)
        return (isOccupied && !isTrulySameDayAvailable) || isInMaintenance
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
      
      // Run optimization algorithm to find swap suggestions
      const optimization = findOptimalAvailability(
        startDate,
        endDate,
        sizeFilter,
        scooters,
        rentals
      )
      setOptimizationResult(optimization)

      setAvailableScooters(available)
      setUnavailableScooters(unavailable)
      setSameDayScooters(sameDayReturnsList)
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
    setSameDayScooters([])
    setPartialAvailability(null)
    setPerScooterAvailability(null)
    setOptimizationResult(null)
    setNumberOfScooters(1)
    setSizeFilter('any')
    setSwapSuccess(null)
  }

  // Handler for applying swaps to make a scooter available
  const handleApplySwaps = async (scooterId, swaps) => {
    if (applyingSwapsFor) return // Prevent double-click

    setApplyingSwapsFor(scooterId)
    setSwapSuccess(null)

    try {
      // SAFETY CHECK: Validate swaps before applying
      const validation = validateSwaps(swaps, rentals, scooters)
      if (!validation.valid) {
        alert('Cannot apply reassignments:\n\n' + validation.errors.join('\n'))
        setApplyingSwapsFor(null)
        return
      }

      // Apply all swaps using the optimizer's applySwaps function
      const result = await applySwaps(swaps, updateRental)

      if (!result.success) {
        alert('Some reassignments failed:\n\n' + result.errors.join('\n'))
      }

      // Show success message
      setSwapSuccess({
        scooterId,
        message: `${result.updatedRentals.length} rental${result.updatedRentals.length !== 1 ? 's' : ''} reassigned successfully!`
      })

      // Refresh data to reflect changes
      await refreshStatistics(true)

      // Re-run availability check to update results
      setTimeout(() => {
        checkAvailability()
      }, 500)

    } catch (error) {
      console.error('Error applying swaps:', error)
      alert('Failed to apply reassignments. Please try again.')
    } finally {
      setApplyingSwapsFor(null)
    }
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
            {/* 3+3 on mobile, 1x6 on desktop */}
            <div className="grid grid-cols-6 gap-x-1 gap-y-2 sm:gap-3">
              {/* תאריך התחלה */}
              <div className="col-span-3 sm:col-span-1 flex flex-col pr-2 sm:pr-0">
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
              <div className="col-span-3 sm:col-span-1 flex flex-col pl-2 sm:pl-0">
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
              <div className="col-span-2 sm:col-span-1 flex flex-col">
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
              <div className="col-span-2 sm:col-span-1 flex flex-col">
                <label className="text-xs font-medium text-gray-600 mb-1 flex items-center">
                  <Users className="h-3 w-3 mr-1" />
                  Qty
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

              {/* Size filter */}
              <div className="col-span-2 sm:col-span-1 flex flex-col">
                <label className="text-xs font-medium text-gray-600 mb-1 flex items-center">
                  <Bike className="h-3 w-3 mr-1" />
                  Size
                </label>
                <select
                  value={sizeFilter}
                  onChange={(e) => setSizeFilter(e.target.value)}
                  className="w-full px-1 py-2 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                >
                  <option value="any">Any</option>
                  <option value="large">Large</option>
                  <option value="small">Small</option>
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
          <div className="p-3 sm:p-4 space-y-4">

            {/* ===== SUMMARY BAR ===== */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-gray-200">
              <div className="flex flex-wrap items-center gap-3">
                {availableScooters.length > 0 && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                    <Check className="h-4 w-4" />
                    <span>{availableScooters.length} Ready</span>
                  </div>
                )}
                {sameDayScooters.length > 0 && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-100 text-amber-800 rounded-full text-sm font-medium">
                    <Clock className="h-4 w-4" />
                    <span>{sameDayScooters.length} Same-day</span>
                  </div>
                )}
                {optimizationResult?.availableWithSwaps.length > 0 && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium">
                    <Shuffle className="h-4 w-4" />
                    <span>{optimizationResult.availableWithSwaps.length} With swap</span>
                  </div>
                )}
                {unavailableScooters.length > 0 && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">
                    <X className="h-4 w-4" />
                    <span>{unavailableScooters.length} Unavailable</span>
                  </div>
                )}
              </div>
              <div className="text-sm text-gray-500 font-medium">
                {new Date(startDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} → {new Date(endDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} ({rentalDays}d)
              </div>
            </div>

            {/* ===== 1. READY TO BOOK - Green Section ===== */}
            {(availableScooters.length > 0 || sameDayScooters.length > 0) && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="flex items-center text-base font-semibold text-green-800 mb-3">
                  <Check className="h-5 w-5 mr-2" />
                  Ready to Book
                  <span className="ml-2 text-sm font-normal text-green-600">
                    ({availableScooters.length + sameDayScooters.length} scooter{availableScooters.length + sameDayScooters.length !== 1 ? 's' : ''})
                  </span>
                </h4>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {/* Directly available scooters */}
                  {availableScooters.map(scooter => (
                    <div key={scooter.id} className="bg-white border border-green-300 rounded-lg p-3 shadow-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                        <span className="font-semibold text-gray-900">{scooter.color}</span>
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                          scooter.size === 'small' ? 'bg-purple-100 text-purple-800' : 'bg-indigo-100 text-indigo-800'
                        }`}>
                          {scooter.size === 'small' ? 'S' : 'L'}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500">{scooter.licensePlate}</div>
                      {scooter.sameDayInfo && (
                        <div className="mt-2 pt-2 border-t border-green-200 text-xs text-green-700">
                          <Clock className="h-3 w-3 inline mr-1" />
                          From {scooter.sameDayInfo.returnTime} (+2h)
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Same-day scooters */}
                  {sameDayScooters.map(scooter => (
                    <div key={`sameday-${scooter.id}`} className="bg-amber-50 border border-amber-300 rounded-lg p-3 shadow-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                        <span className="font-semibold text-gray-900">{scooter.color}</span>
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                          scooter.size === 'small' ? 'bg-purple-100 text-purple-800' : 'bg-indigo-100 text-indigo-800'
                        }`}>
                          {scooter.size === 'small' ? 'S' : 'L'}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500">{scooter.licensePlate}</div>
                      <div className="mt-2 pt-2 border-t border-amber-200 text-xs">
                        <div className="text-amber-700">Returns: <strong>{scooter.returnTime}</strong></div>
                        <div className="text-green-700">Available: <strong>{scooter.availableFromTime}</strong></div>
                      </div>
                    </div>
                  ))}
                </div>

                {availableScooters.length < numberOfScooters && (
                  <div className="mt-3 p-2 bg-amber-100 border border-amber-300 rounded text-sm text-amber-800">
                    <AlertCircle className="h-4 w-4 inline mr-1" />
                    Only {availableScooters.length} of {numberOfScooters} requested scooters available
                  </div>
                )}
              </div>
            )}

            {/* ===== 2. AVAILABLE WITH SWAPS - Purple Section ===== */}
            {optimizationResult && optimizationResult.availableWithSwaps.length > 0 && (
              <div className="bg-purple-50 border-2 border-purple-300 rounded-lg p-4">
                <h4 className="flex items-center text-base font-semibold text-purple-800 mb-2">
                  <Shuffle className="h-5 w-5 mr-2" />
                  Can Be Made Available
                  <span className="ml-2 text-sm font-normal text-purple-600">
                    ({optimizationResult.availableWithSwaps.length} scooter{optimizationResult.availableWithSwaps.length !== 1 ? 's' : ''})
                  </span>
                </h4>
                <p className="text-sm text-purple-700 mb-4">
                  Move existing bookings to other scooters to free up these options:
                </p>

                <div className="space-y-3">
                  {optimizationResult.availableWithSwaps.map(({ scooter, swaps }) => (
                    <div key={scooter.id} className="bg-white border border-purple-200 rounded-lg p-4">
                      {/* Scooter header */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                          <span className="font-semibold text-gray-900 text-lg">{scooter.color}</span>
                          <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                            scooter.size === 'small' ? 'bg-purple-100 text-purple-800' : 'bg-indigo-100 text-indigo-800'
                          }`}>
                            {scooter.size === 'small' ? 'S' : 'L'}
                          </span>
                        </div>
                        <span className="text-xs text-gray-500">{scooter.licensePlate}</span>
                      </div>

                      {/* Swaps table */}
                      <div className="bg-gray-50 rounded-lg overflow-hidden mb-3">
                        <div className="px-3 py-2 bg-gray-100 border-b border-gray-200">
                          <span className="text-xs font-medium text-gray-600 uppercase">Required Moves ({swaps.length})</span>
                        </div>
                        <div className="divide-y divide-gray-200">
                          {swaps.map((swap, idx) => (
                            <div key={idx} className="px-3 py-2 flex items-center justify-between">
                              <div className="flex-1">
                                <div className="font-medium text-gray-900 text-sm">{swap.rental.customerName}</div>
                                <div className="text-xs text-gray-500">
                                  {new Date(swap.rental.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} - {new Date(swap.rental.endDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 text-sm">
                                <span className="font-medium text-red-600">{swap.fromScooter.color}</span>
                                <ArrowRightLeft className="h-4 w-4 text-gray-400" />
                                <span className="font-medium text-green-600">{swap.toScooter.color}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Apply button */}
                      {swapSuccess?.scooterId === scooter.id ? (
                        <div className="flex items-center justify-center gap-2 text-green-700 bg-green-100 py-2.5 px-4 rounded-lg">
                          <Check className="h-5 w-5" />
                          <span className="font-medium">{swapSuccess.message}</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleApplySwaps(scooter.id, swaps)}
                          disabled={applyingSwapsFor !== null}
                          className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white py-2.5 px-4 rounded-lg font-medium transition-colors"
                        >
                          {applyingSwapsFor === scooter.id ? (
                            <>
                              <Loader2 className="h-5 w-5 animate-spin" />
                              <span>Applying Changes...</span>
                            </>
                          ) : (
                            <>
                              <ArrowRightLeft className="h-5 w-5" />
                              <span>Apply {swaps.length} Move{swaps.length !== 1 ? 's' : ''} & Book {scooter.color}</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="mt-3 text-xs text-purple-600 flex items-start gap-1.5">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span>Only future bookings can be moved. Pinned bookings and active rentals stay in place.</span>
                </div>
              </div>
            )}

            {/* ===== 3. PARTIAL AVAILABILITY - Amber Section ===== */}
            {availableScooters.length === 0 && perScooterAvailability && perScooterAvailability.scooterOptions.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <h4 className="flex items-center text-base font-semibold text-amber-800 mb-3">
                  <TrendingUp className="h-5 w-5 mr-2" />
                  Partial Availability Options
                  <span className="ml-2 text-sm font-normal text-amber-600">
                    (no scooter available for full {perScooterAvailability.totalRequestedDays} days)
                  </span>
                </h4>

                {/* Best recommendation */}
                {perScooterAvailability.topPicks?.longest && (
                  <div className="bg-white border-2 border-amber-400 rounded-lg p-4 mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Trophy className="h-5 w-5 text-amber-600" />
                      <span className="font-bold text-gray-900">Best Option</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-gray-900">
                          {perScooterAvailability.topPicks.longest.scooter.color}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                          perScooterAvailability.topPicks.longest.scooter.size === 'small' ? 'bg-purple-100 text-purple-800' : 'bg-indigo-100 text-indigo-800'
                        }`}>
                          {perScooterAvailability.topPicks.longest.scooter.size === 'small' ? 'S' : 'L'}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-amber-700">
                          {perScooterAvailability.topPicks.longest.longestPeriod?.days} days
                        </div>
                        <div className="text-sm text-gray-600">
                          {perScooterAvailability.topPicks.longest.longestPeriod?.startDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} - {perScooterAvailability.topPicks.longest.longestPeriod?.endDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Other options */}
                <details className="group">
                  <summary className="flex items-center justify-between cursor-pointer text-sm text-amber-700 hover:text-amber-900">
                    <span>View all {perScooterAvailability.scooterOptions.length} partial options</span>
                    <span className="text-xs group-open:hidden">▼</span>
                    <span className="text-xs hidden group-open:inline">▲</span>
                  </summary>
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {perScooterAvailability.scooterOptions.map((option) => (
                      <div key={option.scooter.id} className="bg-white border border-amber-200 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-900">{option.scooter.color}</span>
                            <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                              option.scooter.size === 'small' ? 'bg-purple-100 text-purple-800' : 'bg-indigo-100 text-indigo-800'
                            }`}>
                              {option.scooter.size === 'small' ? 'S' : 'L'}
                            </span>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                            option.availabilityPercent >= 75 ? 'bg-green-100 text-green-800' :
                            option.availabilityPercent >= 50 ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {option.availabilityPercent}%
                          </span>
                        </div>
                        <div className="text-xs text-gray-600">
                          {option.allPeriods.slice(0, 2).map((period, i) => (
                            <div key={i}>
                              {period.days}d: {period.startDate.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' })} - {period.endDate.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' })}
                            </div>
                          ))}
                          {option.allPeriods.length > 2 && (
                            <div className="text-amber-600">+{option.allPeriods.length - 2} more periods</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              </div>
            )}

            {/* ===== 4. NOT AVAILABLE - Red Section (Collapsible) ===== */}
            {unavailableScooters.length > 0 && (
              <details className="group">
                <summary className="flex items-center justify-between cursor-pointer bg-red-50 border border-red-200 rounded-lg p-3 hover:bg-red-100 transition-colors">
                  <div className="flex items-center gap-2">
                    <X className="h-5 w-5 text-red-600" />
                    <span className="font-semibold text-red-800">Not Available</span>
                    <span className="text-sm text-red-600">({unavailableScooters.length})</span>
                  </div>
                  <span className="text-xs text-red-500 group-open:hidden">Click to expand</span>
                  <span className="text-xs text-red-500 hidden group-open:inline">Click to collapse</span>
                </summary>
                <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {unavailableScooters.map(scooter => (
                    <div key={scooter.id} className="bg-red-50 border border-red-200 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-3 h-3 rounded-full bg-red-500"></div>
                        <span className="font-semibold text-gray-900">{scooter.color}</span>
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                          scooter.size === 'small' ? 'bg-purple-100 text-purple-800' : 'bg-indigo-100 text-indigo-800'
                        }`}>
                          {scooter.size === 'small' ? 'S' : 'L'}
                        </span>
                        {scooter.reason === 'maintenance' && (
                          <span className="text-xs">🔧</span>
                        )}
                      </div>
                      {scooter.conflictingRentals?.length > 0 && (
                        <div className="text-xs text-red-600 space-y-1">
                          {scooter.conflictingRentals.slice(0, 2).map(rental => (
                            <div key={rental.id} className="truncate">
                              {rental.customerName} ({new Date(rental.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' })}-{new Date(rental.endDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' })})
                            </div>
                          ))}
                          {scooter.conflictingRentals.length > 2 && (
                            <div className="text-red-500">+{scooter.conflictingRentals.length - 2} more</div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </details>
            )}

            {/* ===== NO RESULTS MESSAGE ===== */}
            {availableScooters.length === 0 && sameDayScooters.length === 0 &&
             (!optimizationResult || optimizationResult.availableWithSwaps.length === 0) &&
             (!perScooterAvailability || perScooterAvailability.scooterOptions.length === 0) && (
              <div className="bg-gray-100 border border-gray-300 rounded-lg p-6 text-center">
                <AlertCircle className="h-10 w-10 text-gray-400 mx-auto mb-3" />
                <h4 className="text-lg font-semibold text-gray-700 mb-2">No Scooters Available</h4>
                <p className="text-sm text-gray-500">
                  No scooters are available for the selected dates. Try different dates or check partial availability options.
                </p>
              </div>
            )}
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