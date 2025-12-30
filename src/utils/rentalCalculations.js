/**
 * Core business logic utilities for rental calculations
 *
 * Business Rules:
 * 1. Rental days = ceil((endDate - startDate) / msPerDay)
 * 2. A scooter is available FROM: end date + 1 (day after previous rental ends)
 * 3. A scooter is available UNTIL: day before next rental starts
 * 4. Can't book ending on the same day another rental starts
 */

const MS_PER_DAY = 1000 * 60 * 60 * 24

/**
 * Format date as YYYY-MM-DD in local timezone (avoids UTC shift issues)
 * @param {Date} date
 * @returns {string} Date string in YYYY-MM-DD format
 */
export const formatDateLocal = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Calculate rental duration in days
 * @param {Date|string} startDate - Rental start date
 * @param {Date|string} endDate - Rental end date
 * @returns {number} Number of rental days
 */
export const calculateRentalDays = (startDate, endDate) => {
  const start = typeof startDate === 'string' ? new Date(startDate + 'T00:00:00') : startDate
  const end = typeof endDate === 'string' ? new Date(endDate + 'T00:00:00') : endDate
  return Math.ceil((end - start) / MS_PER_DAY)
}

/**
 * Calculate end date given start date and number of days
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {number} days - Number of rental days
 * @returns {string} End date in YYYY-MM-DD format
 */
export const calculateEndDate = (startDate, days) => {
  const start = new Date(startDate + 'T00:00:00')
  start.setDate(start.getDate() + days)
  return formatDateLocal(start)
}

/**
 * Check if two date ranges have a booking conflict
 * Used for main availability check - uses >= for start date comparison
 * @param {Date} requestedStart - Requested booking start
 * @param {Date} requestedEnd - Requested booking end
 * @param {Date} rentalStart - Existing rental start
 * @param {Date} rentalEnd - Existing rental end
 * @returns {boolean} True if there's a conflict
 */
export const hasBookingConflict = (requestedStart, requestedEnd, rentalStart, rentalEnd) => {
  return requestedStart <= rentalEnd && requestedEnd >= rentalStart
}

/**
 * Check if a single day is available (not occupied by any rental)
 * Used for per-day availability - uses > for start date comparison
 * @param {Date} day - The day to check
 * @param {Date} rentalStart - Existing rental start
 * @param {Date} rentalEnd - Existing rental end
 * @returns {boolean} True if the day is available
 */
export const isDayAvailable = (day, rentalStart, rentalEnd) => {
  const nextDay = new Date(day)
  nextDay.setDate(nextDay.getDate() + 1)

  // Day is NOT available if: day <= rentalEnd AND nextDay > rentalStart
  const hasConflict = day <= rentalEnd && nextDay > rentalStart
  return !hasConflict
}

/**
 * Find the available window between two rentals
 * @param {Date|string} rental1End - End date of first rental
 * @param {Date|string} rental2Start - Start date of second rental
 * @returns {{ startDate: Date, endDate: Date, days: number } | null} Available window or null
 */
export const findAvailableWindow = (rental1End, rental2Start) => {
  const end1 = typeof rental1End === 'string' ? new Date(rental1End + 'T00:00:00') : new Date(rental1End)
  const start2 = typeof rental2Start === 'string' ? new Date(rental2Start + 'T00:00:00') : new Date(rental2Start)

  // Available from: end date + 1
  const availableStart = new Date(end1)
  availableStart.setDate(availableStart.getDate() + 1)

  // Available until: day before next rental (the last bookable end date)
  const availableEnd = new Date(start2)
  availableEnd.setDate(availableEnd.getDate() - 1)

  // Calculate days
  const days = calculateRentalDays(availableStart, availableEnd)

  if (days <= 0) return null

  return {
    startDate: availableStart,
    endDate: availableEnd,
    days
  }
}

/**
 * Calculate rental pricing based on duration
 * @param {number} days - Number of rental days
 * @param {number} baseRate - Base daily rate (default 1200)
 * @returns {{ dailyRate: number, total: number, hasDiscount: boolean }}
 */
export const calculateDailyRate = (days, baseRate = 1200) => {
  let dailyRate = baseRate

  if (days >= 30) {
    dailyRate = 700
  } else if (days >= 14) {
    dailyRate = 800
  } else if (days >= 7) {
    dailyRate = 900
  } else if (days >= 5) {
    dailyRate = 1000
  }

  return {
    dailyRate,
    total: days * dailyRate,
    hasDiscount: dailyRate < baseRate
  }
}

/**
 * Check if a date is a Sunday
 * @param {string} dateString - Date in YYYY-MM-DD format
 * @returns {boolean} True if Sunday
 */
export const isSunday = (dateString) => {
  if (!dateString) return false
  const date = new Date(dateString + 'T00:00:00')
  return date.getDay() === 0
}

/**
 * Get all available days for a scooter within a date range
 * @param {Array} rentals - Array of rentals for this scooter
 * @param {Date} rangeStart - Start of range to check
 * @param {Date} rangeEnd - End of range to check
 * @returns {Date[]} Array of available dates
 */
export const getAvailableDays = (rentals, rangeStart, rangeEnd) => {
  const availableDays = []
  const activeRentals = rentals.filter(r => r.status === 'active' || r.status === 'pending')

  for (let d = new Date(rangeStart); d < rangeEnd; d.setDate(d.getDate() + 1)) {
    const currentDate = new Date(d)

    const isAvailable = activeRentals.every(rental => {
      const rentalStart = new Date(rental.startDate + 'T00:00:00')
      const rentalEnd = new Date(rental.endDate + 'T00:00:00')
      return isDayAvailable(currentDate, rentalStart, rentalEnd)
    })

    if (isAvailable) {
      availableDays.push(new Date(currentDate))
    }
  }

  return availableDays
}

/**
 * Find consecutive periods from a list of available days
 * @param {Date[]} availableDays - Array of available dates
 * @returns {Array<{ startDate: Date, endDate: Date, days: number }>} Array of periods
 */
export const findConsecutivePeriods = (availableDays) => {
  if (availableDays.length === 0) return []

  const periods = []
  let currentPeriod = null

  for (const day of availableDays) {
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
        currentPeriod.days = calculateRentalDays(currentPeriod.startDate, currentPeriod.endDate)
        periods.push(currentPeriod)
        currentPeriod = {
          startDate: new Date(day),
          endDate: new Date(day)
        }
      }
    }
  }

  if (currentPeriod) {
    currentPeriod.days = calculateRentalDays(currentPeriod.startDate, currentPeriod.endDate)
    periods.push(currentPeriod)
  }

  return periods
}
