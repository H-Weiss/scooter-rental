import { describe, it, expect } from 'vitest'
import {
  formatDateLocal,
  calculateRentalDays,
  calculateEndDate,
  hasBookingConflict,
  timeToMinutes,
  hasTimeBuffer,
  hasBookingConflictWithTime,
  isDayAvailable,
  findAvailableWindow,
  calculateDailyRate,
  isSunday,
  getAvailableDays,
  findConsecutivePeriods
} from './rentalCalculations'

// ============================================================================
// formatDateLocal Tests
// ============================================================================
describe('formatDateLocal', () => {
  describe('basic formatting', () => {
    it('formats date as YYYY-MM-DD', () => {
      const date = new Date(2025, 11, 30) // Dec 30, 2025
      expect(formatDateLocal(date)).toBe('2025-12-30')
    })

    it('pads single digit months', () => {
      const date = new Date(2025, 0, 15) // Jan 15, 2025
      expect(formatDateLocal(date)).toBe('2025-01-15')
    })

    it('pads single digit days', () => {
      const date = new Date(2025, 11, 5) // Dec 5, 2025
      expect(formatDateLocal(date)).toBe('2025-12-05')
    })

    it('pads both single digit month and day', () => {
      const date = new Date(2025, 0, 5) // Jan 5, 2025
      expect(formatDateLocal(date)).toBe('2025-01-05')
    })
  })

  describe('edge cases', () => {
    it('handles year boundary', () => {
      const date = new Date(2026, 0, 1) // Jan 1, 2026
      expect(formatDateLocal(date)).toBe('2026-01-01')
    })

    it('handles last day of year', () => {
      const date = new Date(2025, 11, 31) // Dec 31, 2025
      expect(formatDateLocal(date)).toBe('2025-12-31')
    })

    it('handles leap year Feb 29', () => {
      const date = new Date(2024, 1, 29) // Feb 29, 2024
      expect(formatDateLocal(date)).toBe('2024-02-29')
    })

    it('handles all months correctly', () => {
      for (let month = 0; month < 12; month++) {
        const date = new Date(2025, month, 15)
        const formatted = formatDateLocal(date)
        const expectedMonth = String(month + 1).padStart(2, '0')
        expect(formatted).toBe(`2025-${expectedMonth}-15`)
      }
    })
  })
})

// ============================================================================
// calculateRentalDays Tests
// ============================================================================
describe('calculateRentalDays', () => {
  describe('basic calculations', () => {
    it('calculates 1 day rental', () => {
      expect(calculateRentalDays('2025-12-30', '2025-12-31')).toBe(1)
    })

    it('calculates 3 day rental', () => {
      expect(calculateRentalDays('2025-12-29', '2026-01-01')).toBe(3)
    })

    it('calculates 5 day rental', () => {
      expect(calculateRentalDays('2025-12-31', '2026-01-05')).toBe(5)
    })

    it('calculates 7 day rental (weekly)', () => {
      expect(calculateRentalDays('2025-12-29', '2026-01-05')).toBe(7)
    })

    it('calculates 14 day rental (bi-weekly)', () => {
      expect(calculateRentalDays('2025-12-29', '2026-01-12')).toBe(14)
    })

    it('calculates 30 day rental (monthly)', () => {
      expect(calculateRentalDays('2025-12-01', '2025-12-31')).toBe(30)
    })
  })

  describe('edge cases', () => {
    it('returns 0 for same date', () => {
      expect(calculateRentalDays('2025-12-30', '2025-12-30')).toBe(0)
    })

    it('handles year boundary correctly', () => {
      expect(calculateRentalDays('2025-12-31', '2026-01-03')).toBe(3)
    })

    it('handles month boundary correctly', () => {
      expect(calculateRentalDays('2025-01-30', '2025-02-02')).toBe(3)
    })

    it('handles February in leap year', () => {
      expect(calculateRentalDays('2024-02-28', '2024-03-01')).toBe(2)
    })

    it('handles February in non-leap year', () => {
      expect(calculateRentalDays('2025-02-28', '2025-03-01')).toBe(1)
    })

    it('works with Date objects', () => {
      const start = new Date('2025-12-29T00:00:00')
      const end = new Date('2026-01-01T00:00:00')
      expect(calculateRentalDays(start, end)).toBe(3)
    })

    it('handles mixed string and Date inputs', () => {
      const start = '2025-12-29'
      const end = new Date('2026-01-01T00:00:00')
      expect(calculateRentalDays(start, end)).toBe(3)
    })
  })

  describe('long-term rentals', () => {
    it('calculates 60 day rental', () => {
      expect(calculateRentalDays('2025-01-01', '2025-03-02')).toBe(60)
    })

    it('calculates 90 day rental', () => {
      expect(calculateRentalDays('2025-01-01', '2025-04-01')).toBe(90)
    })
  })
})

// ============================================================================
// calculateEndDate Tests
// ============================================================================
describe('calculateEndDate', () => {
  describe('basic calculations', () => {
    it('calculates end date for 1 day rental', () => {
      expect(calculateEndDate('2025-12-30', 1)).toBe('2025-12-31')
    })

    it('calculates end date for 3 day rental', () => {
      expect(calculateEndDate('2025-12-29', 3)).toBe('2026-01-01')
    })

    it('calculates end date for 7 day rental', () => {
      expect(calculateEndDate('2025-12-29', 7)).toBe('2026-01-05')
    })

    it('calculates end date for 14 day rental', () => {
      expect(calculateEndDate('2025-12-29', 14)).toBe('2026-01-12')
    })

    it('calculates end date for 30 day rental', () => {
      expect(calculateEndDate('2025-12-01', 30)).toBe('2025-12-31')
    })
  })

  describe('edge cases', () => {
    it('handles year boundary', () => {
      expect(calculateEndDate('2025-12-31', 5)).toBe('2026-01-05')
    })

    it('handles month boundary', () => {
      expect(calculateEndDate('2025-01-30', 3)).toBe('2025-02-02')
    })

    it('handles leap year February', () => {
      expect(calculateEndDate('2024-02-28', 2)).toBe('2024-03-01')
    })

    it('handles non-leap year February', () => {
      expect(calculateEndDate('2025-02-28', 1)).toBe('2025-03-01')
    })
  })

  describe('inverse relationship with calculateRentalDays', () => {
    it('is inverse of calculateRentalDays for various durations', () => {
      const testCases = [
        { start: '2025-12-29', days: 1 },
        { start: '2025-12-29', days: 3 },
        { start: '2025-12-29', days: 7 },
        { start: '2025-12-29', days: 14 },
        { start: '2025-12-29', days: 30 },
        { start: '2025-12-31', days: 5 }, // year boundary
        { start: '2024-02-28', days: 3 }, // leap year
      ]

      testCases.forEach(({ start, days }) => {
        const end = calculateEndDate(start, days)
        expect(calculateRentalDays(start, end)).toBe(days)
      })
    })
  })
})

// ============================================================================
// hasBookingConflict Tests (Main Availability Check - uses >=)
// ============================================================================
describe('hasBookingConflict', () => {
  describe('no conflict cases', () => {
    it('no conflict when request is entirely before rental', () => {
      const requestedStart = new Date('2025-12-25T00:00:00')
      const requestedEnd = new Date('2025-12-28T00:00:00')
      const rentalStart = new Date('2025-12-31T00:00:00')
      const rentalEnd = new Date('2026-01-03T00:00:00')

      expect(hasBookingConflict(requestedStart, requestedEnd, rentalStart, rentalEnd)).toBe(false)
    })

    it('no conflict when request is entirely after rental', () => {
      const requestedStart = new Date('2026-01-05T00:00:00')
      const requestedEnd = new Date('2026-01-10T00:00:00')
      const rentalStart = new Date('2025-12-31T00:00:00')
      const rentalEnd = new Date('2026-01-03T00:00:00')

      expect(hasBookingConflict(requestedStart, requestedEnd, rentalStart, rentalEnd)).toBe(false)
    })

    it('no conflict when end date is one day before start date', () => {
      const requestedStart = new Date('2025-12-29T00:00:00')
      const requestedEnd = new Date('2025-12-30T00:00:00')
      const rentalStart = new Date('2025-12-31T00:00:00')
      const rentalEnd = new Date('2026-01-03T00:00:00')

      expect(hasBookingConflict(requestedStart, requestedEnd, rentalStart, rentalEnd)).toBe(false)
    })

    it('no conflict when start date is one day after end date', () => {
      const requestedStart = new Date('2026-01-04T00:00:00')
      const requestedEnd = new Date('2026-01-07T00:00:00')
      const rentalStart = new Date('2025-12-31T00:00:00')
      const rentalEnd = new Date('2026-01-03T00:00:00')

      expect(hasBookingConflict(requestedStart, requestedEnd, rentalStart, rentalEnd)).toBe(false)
    })
  })

  describe('conflict cases', () => {
    it('conflict when end date equals start date (business rule)', () => {
      const requestedStart = new Date('2025-12-30T00:00:00')
      const requestedEnd = new Date('2025-12-31T00:00:00')
      const rentalStart = new Date('2025-12-31T00:00:00')
      const rentalEnd = new Date('2026-01-03T00:00:00')

      expect(hasBookingConflict(requestedStart, requestedEnd, rentalStart, rentalEnd)).toBe(true)
    })

    it('conflict when start date equals end date', () => {
      const requestedStart = new Date('2026-01-03T00:00:00')
      const requestedEnd = new Date('2026-01-05T00:00:00')
      const rentalStart = new Date('2025-12-31T00:00:00')
      const rentalEnd = new Date('2026-01-03T00:00:00')

      expect(hasBookingConflict(requestedStart, requestedEnd, rentalStart, rentalEnd)).toBe(true)
    })

    it('conflict when ranges overlap partially', () => {
      const requestedStart = new Date('2026-01-01T00:00:00')
      const requestedEnd = new Date('2026-01-05T00:00:00')
      const rentalStart = new Date('2025-12-31T00:00:00')
      const rentalEnd = new Date('2026-01-03T00:00:00')

      expect(hasBookingConflict(requestedStart, requestedEnd, rentalStart, rentalEnd)).toBe(true)
    })

    it('conflict when request contains rental', () => {
      const requestedStart = new Date('2025-12-29T00:00:00')
      const requestedEnd = new Date('2026-01-10T00:00:00')
      const rentalStart = new Date('2025-12-31T00:00:00')
      const rentalEnd = new Date('2026-01-03T00:00:00')

      expect(hasBookingConflict(requestedStart, requestedEnd, rentalStart, rentalEnd)).toBe(true)
    })

    it('conflict when rental contains request', () => {
      const requestedStart = new Date('2026-01-01T00:00:00')
      const requestedEnd = new Date('2026-01-02T00:00:00')
      const rentalStart = new Date('2025-12-31T00:00:00')
      const rentalEnd = new Date('2026-01-03T00:00:00')

      expect(hasBookingConflict(requestedStart, requestedEnd, rentalStart, rentalEnd)).toBe(true)
    })

    it('conflict when ranges are identical', () => {
      const requestedStart = new Date('2025-12-31T00:00:00')
      const requestedEnd = new Date('2026-01-03T00:00:00')
      const rentalStart = new Date('2025-12-31T00:00:00')
      const rentalEnd = new Date('2026-01-03T00:00:00')

      expect(hasBookingConflict(requestedStart, requestedEnd, rentalStart, rentalEnd)).toBe(true)
    })
  })
})

// ============================================================================
// timeToMinutes Tests
// ============================================================================
describe('timeToMinutes', () => {
  it('converts HH:MM to minutes', () => {
    expect(timeToMinutes('00:00')).toBe(0)
    expect(timeToMinutes('01:00')).toBe(60)
    expect(timeToMinutes('09:00')).toBe(540)
    expect(timeToMinutes('12:00')).toBe(720)
    expect(timeToMinutes('18:00')).toBe(1080)
    expect(timeToMinutes('23:59')).toBe(1439)
  })

  it('handles times with minutes', () => {
    expect(timeToMinutes('09:30')).toBe(570)
    expect(timeToMinutes('14:45')).toBe(885)
  })

  it('returns 0 for null/undefined', () => {
    expect(timeToMinutes(null)).toBe(0)
    expect(timeToMinutes(undefined)).toBe(0)
    expect(timeToMinutes('')).toBe(0)
  })
})

// ============================================================================
// hasTimeBuffer Tests
// ============================================================================
describe('hasTimeBuffer', () => {
  describe('with 2-hour default buffer', () => {
    it('returns true when start is exactly 2 hours after end', () => {
      expect(hasTimeBuffer('10:00', '12:00')).toBe(true)
      expect(hasTimeBuffer('14:00', '16:00')).toBe(true)
    })

    it('returns true when start is more than 2 hours after end', () => {
      expect(hasTimeBuffer('10:00', '13:00')).toBe(true)
      expect(hasTimeBuffer('09:00', '18:00')).toBe(true)
    })

    it('returns false when start is less than 2 hours after end', () => {
      expect(hasTimeBuffer('10:00', '11:00')).toBe(false)
      expect(hasTimeBuffer('10:00', '11:59')).toBe(false)
      expect(hasTimeBuffer('14:00', '15:30')).toBe(false)
    })

    it('returns false when start is before or equal to end', () => {
      expect(hasTimeBuffer('12:00', '10:00')).toBe(false)
      expect(hasTimeBuffer('12:00', '12:00')).toBe(false)
    })
  })

  describe('with custom buffer', () => {
    it('works with 1-hour buffer', () => {
      expect(hasTimeBuffer('10:00', '11:00', 1)).toBe(true)
      expect(hasTimeBuffer('10:00', '10:59', 1)).toBe(false)
    })

    it('works with 3-hour buffer', () => {
      expect(hasTimeBuffer('10:00', '13:00', 3)).toBe(true)
      expect(hasTimeBuffer('10:00', '12:59', 3)).toBe(false)
    })
  })
})

// ============================================================================
// hasBookingConflictWithTime Tests (Same-Day Booking Logic)
// ============================================================================
describe('hasBookingConflictWithTime', () => {
  describe('no date overlap - no conflict regardless of times', () => {
    it('no conflict when dates dont overlap at all', () => {
      const result = hasBookingConflictWithTime(
        new Date('2026-01-05'), new Date('2026-01-08'), '09:00', '18:00',
        new Date('2026-01-10'), new Date('2026-01-15'), '09:00', '18:00'
      )
      expect(result).toBe(false)
    })
  })

  describe('full date overlap - conflict regardless of times', () => {
    it('conflict when dates fully overlap', () => {
      const result = hasBookingConflictWithTime(
        new Date('2026-01-05'), new Date('2026-01-10'), '09:00', '18:00',
        new Date('2026-01-07'), new Date('2026-01-12'), '09:00', '18:00'
      )
      expect(result).toBe(true)
    })

    it('conflict when one range contains the other', () => {
      const result = hasBookingConflictWithTime(
        new Date('2026-01-01'), new Date('2026-01-31'), '09:00', '18:00',
        new Date('2026-01-10'), new Date('2026-01-15'), '09:00', '18:00'
      )
      expect(result).toBe(true)
    })
  })

  describe('same-day booking: new starts on day existing ends', () => {
    // Existing rental: Jan 5-10, returns at 12:00
    // New booking: Jan 10-15
    const existingStart = new Date('2026-01-05')
    const existingEnd = new Date('2026-01-10')
    const existingEndTime = '12:00'
    const newStart = new Date('2026-01-10')
    const newEnd = new Date('2026-01-15')

    it('no conflict when pickup is 2+ hours after return', () => {
      expect(hasBookingConflictWithTime(
        newStart, newEnd, '14:00', '18:00',  // Pickup at 14:00
        existingStart, existingEnd, '09:00', existingEndTime
      )).toBe(false)

      expect(hasBookingConflictWithTime(
        newStart, newEnd, '15:00', '18:00',  // Pickup at 15:00
        existingStart, existingEnd, '09:00', existingEndTime
      )).toBe(false)
    })

    it('conflict when pickup is less than 2 hours after return', () => {
      expect(hasBookingConflictWithTime(
        newStart, newEnd, '13:00', '18:00',  // Pickup at 13:00 (only 1h after 12:00)
        existingStart, existingEnd, '09:00', existingEndTime
      )).toBe(true)

      expect(hasBookingConflictWithTime(
        newStart, newEnd, '12:00', '18:00',  // Pickup at same time
        existingStart, existingEnd, '09:00', existingEndTime
      )).toBe(true)

      expect(hasBookingConflictWithTime(
        newStart, newEnd, '10:00', '18:00',  // Pickup before return
        existingStart, existingEnd, '09:00', existingEndTime
      )).toBe(true)
    })

    it('exactly 2 hours buffer is acceptable', () => {
      expect(hasBookingConflictWithTime(
        newStart, newEnd, '14:00', '18:00',  // Exactly 2h after 12:00
        existingStart, existingEnd, '09:00', '12:00'
      )).toBe(false)
    })
  })

  describe('same-day booking: new ends on day existing starts', () => {
    // Existing rental: Jan 10-15, starts at 14:00
    // New booking: Jan 5-10
    const existingStart = new Date('2026-01-10')
    const existingEnd = new Date('2026-01-15')
    const existingStartTime = '14:00'
    const newStart = new Date('2026-01-05')
    const newEnd = new Date('2026-01-10')

    it('no conflict when return is 2+ hours before pickup', () => {
      expect(hasBookingConflictWithTime(
        newStart, newEnd, '09:00', '12:00',  // Return at 12:00, 2h before 14:00
        existingStart, existingEnd, existingStartTime, '18:00'
      )).toBe(false)

      expect(hasBookingConflictWithTime(
        newStart, newEnd, '09:00', '10:00',  // Return at 10:00, 4h before 14:00
        existingStart, existingEnd, existingStartTime, '18:00'
      )).toBe(false)
    })

    it('conflict when return is less than 2 hours before pickup', () => {
      expect(hasBookingConflictWithTime(
        newStart, newEnd, '09:00', '13:00',  // Return at 13:00 (only 1h before 14:00)
        existingStart, existingEnd, existingStartTime, '18:00'
      )).toBe(true)

      expect(hasBookingConflictWithTime(
        newStart, newEnd, '09:00', '14:00',  // Return at same time
        existingStart, existingEnd, existingStartTime, '18:00'
      )).toBe(true)

      expect(hasBookingConflictWithTime(
        newStart, newEnd, '09:00', '16:00',  // Return after pickup
        existingStart, existingEnd, existingStartTime, '18:00'
      )).toBe(true)
    })
  })

  describe('default times handling', () => {
    it('uses default times when not provided', () => {
      // Default: 09:00 start, 18:00 end
      // If existing ends at 18:00 (default) and new starts at 09:00 (default)
      // 09:00 is NOT 2h after 18:00 (previous day logic doesn't apply to same day)
      const result = hasBookingConflictWithTime(
        new Date('2026-01-10'), new Date('2026-01-15'), null, null,
        new Date('2026-01-05'), new Date('2026-01-10'), null, null
      )
      // With defaults: new pickup 09:00, existing return 18:00
      // 09:00 is not >= 18:00 + 2h (20:00), so conflict
      expect(result).toBe(true)
    })
  })

  describe('real-world scenarios', () => {
    it('morning return allows afternoon pickup same day', () => {
      // Scooter returns at 10:00, new customer picks up at 14:00
      expect(hasBookingConflictWithTime(
        new Date('2026-01-10'), new Date('2026-01-15'), '14:00', '18:00',
        new Date('2026-01-05'), new Date('2026-01-10'), '09:00', '10:00'
      )).toBe(false)
    })

    it('late return blocks same-day pickup', () => {
      // Scooter returns at 16:00, new customer wants 17:00 pickup
      expect(hasBookingConflictWithTime(
        new Date('2026-01-10'), new Date('2026-01-15'), '17:00', '18:00',
        new Date('2026-01-05'), new Date('2026-01-10'), '09:00', '16:00'
      )).toBe(true)
    })

    it('early morning pickup allows same-day return before next booking', () => {
      // New booking returns at 10:00, existing booking starts at 14:00
      expect(hasBookingConflictWithTime(
        new Date('2026-01-05'), new Date('2026-01-10'), '09:00', '10:00',
        new Date('2026-01-10'), new Date('2026-01-15'), '14:00', '18:00'
      )).toBe(false)
    })
  })
})

// ============================================================================
// isDayAvailable Tests (Per-Day Check - uses >)
// ============================================================================
describe('isDayAvailable', () => {
  describe('start constraint: available FROM end date + 1', () => {
    const rentalStart = new Date('2025-12-31T00:00:00')
    const rentalEnd = new Date('2026-01-03T00:00:00')

    it('day during rental is NOT available', () => {
      expect(isDayAvailable(new Date('2026-01-01T00:00:00'), rentalStart, rentalEnd)).toBe(false)
      expect(isDayAvailable(new Date('2026-01-02T00:00:00'), rentalStart, rentalEnd)).toBe(false)
    })

    it('day of rental start is NOT available', () => {
      expect(isDayAvailable(new Date('2025-12-31T00:00:00'), rentalStart, rentalEnd)).toBe(false)
    })

    it('day of rental end is NOT available', () => {
      expect(isDayAvailable(new Date('2026-01-03T00:00:00'), rentalStart, rentalEnd)).toBe(false)
    })

    it('day after rental end IS available', () => {
      expect(isDayAvailable(new Date('2026-01-04T00:00:00'), rentalStart, rentalEnd)).toBe(true)
    })

    it('two days after rental end IS available', () => {
      expect(isDayAvailable(new Date('2026-01-05T00:00:00'), rentalStart, rentalEnd)).toBe(true)
    })

    it('day before rental start IS available', () => {
      expect(isDayAvailable(new Date('2025-12-30T00:00:00'), rentalStart, rentalEnd)).toBe(true)
    })
  })

  describe('end constraint: available UNTIL day before next rental', () => {
    const rentalStart = new Date('2026-01-10T00:00:00')
    const rentalEnd = new Date('2026-01-15T00:00:00')

    it('day before rental start IS available', () => {
      expect(isDayAvailable(new Date('2026-01-09T00:00:00'), rentalStart, rentalEnd)).toBe(true)
    })

    it('two days before rental start IS available', () => {
      expect(isDayAvailable(new Date('2026-01-08T00:00:00'), rentalStart, rentalEnd)).toBe(true)
    })

    it('day of rental start is NOT available', () => {
      expect(isDayAvailable(new Date('2026-01-10T00:00:00'), rentalStart, rentalEnd)).toBe(false)
    })

    it('day after rental start is NOT available', () => {
      expect(isDayAvailable(new Date('2026-01-11T00:00:00'), rentalStart, rentalEnd)).toBe(false)
    })
  })

  describe('combined scenario: gap between rentals', () => {
    // Rental 1: Dec 31 - Jan 3
    // Rental 2: Jan 10 - Jan 15
    // Available window: Jan 4 - Jan 9

    const rental1Start = new Date('2025-12-31T00:00:00')
    const rental1End = new Date('2026-01-03T00:00:00')
    const rental2Start = new Date('2026-01-10T00:00:00')
    const rental2End = new Date('2026-01-15T00:00:00')

    const checkBothRentals = (day) => {
      return isDayAvailable(day, rental1Start, rental1End) &&
             isDayAvailable(day, rental2Start, rental2End)
    }

    it('Jan 3 is NOT available (rental 1 ends)', () => {
      expect(checkBothRentals(new Date('2026-01-03T00:00:00'))).toBe(false)
    })

    it('Jan 4 IS available', () => {
      expect(checkBothRentals(new Date('2026-01-04T00:00:00'))).toBe(true)
    })

    it('Jan 5 IS available', () => {
      expect(checkBothRentals(new Date('2026-01-05T00:00:00'))).toBe(true)
    })

    it('Jan 6 IS available', () => {
      expect(checkBothRentals(new Date('2026-01-06T00:00:00'))).toBe(true)
    })

    it('Jan 7 IS available', () => {
      expect(checkBothRentals(new Date('2026-01-07T00:00:00'))).toBe(true)
    })

    it('Jan 8 IS available', () => {
      expect(checkBothRentals(new Date('2026-01-08T00:00:00'))).toBe(true)
    })

    it('Jan 9 IS available (day before rental 2)', () => {
      expect(checkBothRentals(new Date('2026-01-09T00:00:00'))).toBe(true)
    })

    it('Jan 10 is NOT available (rental 2 starts)', () => {
      expect(checkBothRentals(new Date('2026-01-10T00:00:00'))).toBe(false)
    })
  })

  describe('edge case: back-to-back rentals', () => {
    // Rental 1 ends Jan 3, Rental 2 starts Jan 4
    // Available window: Jan 4 only? No - Jan 4 is start of rental 2

    const rental1Start = new Date('2025-12-31T00:00:00')
    const rental1End = new Date('2026-01-03T00:00:00')
    const rental2Start = new Date('2026-01-04T00:00:00')
    const rental2End = new Date('2026-01-07T00:00:00')

    const checkBothRentals = (day) => {
      return isDayAvailable(day, rental1Start, rental1End) &&
             isDayAvailable(day, rental2Start, rental2End)
    }

    it('Jan 3 is NOT available (rental 1 ends)', () => {
      expect(checkBothRentals(new Date('2026-01-03T00:00:00'))).toBe(false)
    })

    it('Jan 4 is NOT available (rental 2 starts)', () => {
      expect(checkBothRentals(new Date('2026-01-04T00:00:00'))).toBe(false)
    })

    it('no gap between back-to-back rentals', () => {
      // There's no available day between these rentals
      const availableDays = []
      for (let d = 1; d <= 7; d++) {
        const day = new Date(`2026-01-0${d}T00:00:00`)
        if (checkBothRentals(day)) {
          availableDays.push(d)
        }
      }
      expect(availableDays).toEqual([]) // No days available in Jan 1-7
    })
  })
})

// ============================================================================
// findAvailableWindow Tests
// ============================================================================
describe('findAvailableWindow', () => {
  describe('valid windows', () => {
    it('calculates correct window with good gap', () => {
      // Rental 1 ends Jan 3, Rental 2 starts Jan 10
      // Available: Jan 4 to Jan 9 (5 days)
      const window = findAvailableWindow('2026-01-03', '2026-01-10')

      expect(formatDateLocal(window.startDate)).toBe('2026-01-04')
      expect(formatDateLocal(window.endDate)).toBe('2026-01-09')
      expect(window.days).toBe(5)
    })

    it('calculates minimum valid window (1 day rental)', () => {
      // Rental 1 ends Jan 3, Rental 2 starts Jan 6
      // Available: Jan 4 to Jan 5 (1 day rental)
      const window = findAvailableWindow('2026-01-03', '2026-01-06')

      expect(formatDateLocal(window.startDate)).toBe('2026-01-04')
      expect(formatDateLocal(window.endDate)).toBe('2026-01-05')
      expect(window.days).toBe(1)
    })

    it('calculates 2 day window', () => {
      // Rental 1 ends Jan 3, Rental 2 starts Jan 7
      // Available: Jan 4 to Jan 6 (2 days)
      const window = findAvailableWindow('2026-01-03', '2026-01-07')

      expect(formatDateLocal(window.startDate)).toBe('2026-01-04')
      expect(formatDateLocal(window.endDate)).toBe('2026-01-06')
      expect(window.days).toBe(2)
    })

    it('calculates week-long window', () => {
      // Rental 1 ends Jan 1, Rental 2 starts Jan 10
      // Available: Jan 2 to Jan 9 (7 days)
      const window = findAvailableWindow('2026-01-01', '2026-01-10')

      expect(formatDateLocal(window.startDate)).toBe('2026-01-02')
      expect(formatDateLocal(window.endDate)).toBe('2026-01-09')
      expect(window.days).toBe(7)
    })
  })

  describe('invalid/no windows', () => {
    it('returns null when no gap (back-to-back)', () => {
      // Rental 1 ends Jan 3, Rental 2 starts Jan 4
      const window = findAvailableWindow('2026-01-03', '2026-01-04')
      expect(window).toBeNull()
    })

    it('returns null when rentals overlap', () => {
      // Rental 1 ends Jan 5, Rental 2 starts Jan 3
      const window = findAvailableWindow('2026-01-05', '2026-01-03')
      expect(window).toBeNull()
    })

    it('returns null when gap is only 1 day (0 rental days)', () => {
      // Rental 1 ends Jan 3, Rental 2 starts Jan 5
      // Available: Jan 4 only = 0 rental days
      const window = findAvailableWindow('2026-01-03', '2026-01-05')
      expect(window).toBeNull()
    })

    it('returns null when same dates', () => {
      const window = findAvailableWindow('2026-01-03', '2026-01-03')
      expect(window).toBeNull()
    })
  })

  describe('with Date objects', () => {
    it('works with Date objects', () => {
      const end1 = new Date('2026-01-03T00:00:00')
      const start2 = new Date('2026-01-10T00:00:00')
      const window = findAvailableWindow(end1, start2)

      expect(window.days).toBe(5)
    })
  })
})

// ============================================================================
// calculateDailyRate Tests
// ============================================================================
describe('calculateDailyRate', () => {
  describe('no discount (1-4 days)', () => {
    it('1 day rental - base rate', () => {
      const result = calculateDailyRate(1)
      expect(result.dailyRate).toBe(1200)
      expect(result.total).toBe(1200)
      expect(result.hasDiscount).toBe(false)
    })

    it('3 days rental - base rate', () => {
      const result = calculateDailyRate(3)
      expect(result.dailyRate).toBe(1200)
      expect(result.total).toBe(3600)
      expect(result.hasDiscount).toBe(false)
    })

    it('4 days rental - base rate (boundary)', () => {
      const result = calculateDailyRate(4)
      expect(result.dailyRate).toBe(1200)
      expect(result.total).toBe(4800)
      expect(result.hasDiscount).toBe(false)
    })
  })

  describe('5-6 days discount', () => {
    it('5 days rental - 1000/day (boundary)', () => {
      const result = calculateDailyRate(5)
      expect(result.dailyRate).toBe(1000)
      expect(result.total).toBe(5000)
      expect(result.hasDiscount).toBe(true)
    })

    it('6 days rental - 1000/day', () => {
      const result = calculateDailyRate(6)
      expect(result.dailyRate).toBe(1000)
      expect(result.total).toBe(6000)
      expect(result.hasDiscount).toBe(true)
    })
  })

  describe('7-13 days discount', () => {
    it('7 days rental - 900/day (boundary)', () => {
      const result = calculateDailyRate(7)
      expect(result.dailyRate).toBe(900)
      expect(result.total).toBe(6300)
      expect(result.hasDiscount).toBe(true)
    })

    it('10 days rental - 900/day', () => {
      const result = calculateDailyRate(10)
      expect(result.dailyRate).toBe(900)
      expect(result.total).toBe(9000)
      expect(result.hasDiscount).toBe(true)
    })

    it('13 days rental - 900/day (boundary)', () => {
      const result = calculateDailyRate(13)
      expect(result.dailyRate).toBe(900)
      expect(result.total).toBe(11700)
      expect(result.hasDiscount).toBe(true)
    })
  })

  describe('14-29 days discount', () => {
    it('14 days rental - 800/day (boundary)', () => {
      const result = calculateDailyRate(14)
      expect(result.dailyRate).toBe(800)
      expect(result.total).toBe(11200)
      expect(result.hasDiscount).toBe(true)
    })

    it('21 days rental - 800/day', () => {
      const result = calculateDailyRate(21)
      expect(result.dailyRate).toBe(800)
      expect(result.total).toBe(16800)
      expect(result.hasDiscount).toBe(true)
    })

    it('29 days rental - 800/day (boundary)', () => {
      const result = calculateDailyRate(29)
      expect(result.dailyRate).toBe(800)
      expect(result.total).toBe(23200)
      expect(result.hasDiscount).toBe(true)
    })
  })

  describe('30+ days discount', () => {
    it('30 days rental - 700/day (boundary)', () => {
      const result = calculateDailyRate(30)
      expect(result.dailyRate).toBe(700)
      expect(result.total).toBe(21000)
      expect(result.hasDiscount).toBe(true)
    })

    it('60 days rental - 700/day', () => {
      const result = calculateDailyRate(60)
      expect(result.dailyRate).toBe(700)
      expect(result.total).toBe(42000)
      expect(result.hasDiscount).toBe(true)
    })

    it('90 days rental - 700/day', () => {
      const result = calculateDailyRate(90)
      expect(result.dailyRate).toBe(700)
      expect(result.total).toBe(63000)
      expect(result.hasDiscount).toBe(true)
    })
  })

  describe('custom base rate', () => {
    it('uses custom base rate for short rentals', () => {
      const result = calculateDailyRate(3, 1500)
      expect(result.dailyRate).toBe(1500)
      expect(result.total).toBe(4500)
      expect(result.hasDiscount).toBe(false)
    })

    it('discounts are based on standard rates, not custom', () => {
      // The discount rates are fixed (700, 800, 900, 1000), not percentages
      const result = calculateDailyRate(30, 1500)
      expect(result.dailyRate).toBe(700) // Fixed rate, not % of custom
      expect(result.total).toBe(21000)
      expect(result.hasDiscount).toBe(true)
    })
  })

  describe('edge cases', () => {
    it('handles 0 days', () => {
      const result = calculateDailyRate(0)
      expect(result.dailyRate).toBe(1200)
      expect(result.total).toBe(0)
    })
  })
})

// ============================================================================
// isSunday Tests
// ============================================================================
describe('isSunday', () => {
  describe('identifies Sundays correctly', () => {
    it('Dec 28, 2025 is Sunday', () => {
      expect(isSunday('2025-12-28')).toBe(true)
    })

    it('Jan 4, 2026 is Sunday', () => {
      expect(isSunday('2026-01-04')).toBe(true)
    })

    it('Jan 11, 2026 is Sunday', () => {
      expect(isSunday('2026-01-11')).toBe(true)
    })
  })

  describe('identifies non-Sundays correctly', () => {
    it('Dec 29, 2025 is Monday', () => {
      expect(isSunday('2025-12-29')).toBe(false)
    })

    it('Dec 30, 2025 is Tuesday', () => {
      expect(isSunday('2025-12-30')).toBe(false)
    })

    it('Dec 31, 2025 is Wednesday', () => {
      expect(isSunday('2025-12-31')).toBe(false)
    })

    it('Jan 1, 2026 is Thursday', () => {
      expect(isSunday('2026-01-01')).toBe(false)
    })

    it('Jan 2, 2026 is Friday', () => {
      expect(isSunday('2026-01-02')).toBe(false)
    })

    it('Jan 3, 2026 is Saturday', () => {
      expect(isSunday('2026-01-03')).toBe(false)
    })
  })

  describe('handles invalid inputs', () => {
    it('returns false for empty string', () => {
      expect(isSunday('')).toBe(false)
    })

    it('returns false for null', () => {
      expect(isSunday(null)).toBe(false)
    })

    it('returns false for undefined', () => {
      expect(isSunday(undefined)).toBe(false)
    })
  })
})

// ============================================================================
// getAvailableDays Tests
// ============================================================================
describe('getAvailableDays', () => {
  describe('no rentals', () => {
    it('returns all days when no rentals exist', () => {
      const rangeStart = new Date('2026-01-01T00:00:00')
      const rangeEnd = new Date('2026-01-05T00:00:00')
      const rentals = []

      const available = getAvailableDays(rentals, rangeStart, rangeEnd)
      expect(available.length).toBe(5) // Jan 1, 2, 3, 4, 5 (including end date)
    })

    it('returns correct dates', () => {
      const rangeStart = new Date('2026-01-01T00:00:00')
      const rangeEnd = new Date('2026-01-04T00:00:00')
      const rentals = []

      const available = getAvailableDays(rentals, rangeStart, rangeEnd)
      const dates = available.map(d => formatDateLocal(d))

      expect(dates).toContain('2026-01-01')
      expect(dates).toContain('2026-01-02')
      expect(dates).toContain('2026-01-03')
      expect(dates).toContain('2026-01-04') // End date now included
    })
  })

  describe('with active rentals', () => {
    it('excludes days during rental', () => {
      const rangeStart = new Date('2026-01-01T00:00:00')
      const rangeEnd = new Date('2026-01-10T00:00:00')
      const rentals = [{
        startDate: '2026-01-03',
        endDate: '2026-01-06',
        status: 'active'
      }]

      const available = getAvailableDays(rentals, rangeStart, rangeEnd)
      const dates = available.map(d => formatDateLocal(d))

      // Before rental
      expect(dates).toContain('2026-01-01')
      expect(dates).toContain('2026-01-02')

      // During rental - NOT available
      expect(dates).not.toContain('2026-01-03')
      expect(dates).not.toContain('2026-01-04')
      expect(dates).not.toContain('2026-01-05')
      expect(dates).not.toContain('2026-01-06')

      // After rental
      expect(dates).toContain('2026-01-07')
      expect(dates).toContain('2026-01-08')
      expect(dates).toContain('2026-01-09')
    })

    it('handles pending rentals same as active', () => {
      const rangeStart = new Date('2026-01-01T00:00:00')
      const rangeEnd = new Date('2026-01-10T00:00:00')
      const rentals = [{
        startDate: '2026-01-03',
        endDate: '2026-01-06',
        status: 'pending'
      }]

      const available = getAvailableDays(rentals, rangeStart, rangeEnd)
      const dates = available.map(d => formatDateLocal(d))

      expect(dates).not.toContain('2026-01-03')
      expect(dates).not.toContain('2026-01-06')
    })
  })

  describe('ignores non-blocking rentals', () => {
    it('ignores completed rentals', () => {
      const rangeStart = new Date('2026-01-01T00:00:00')
      const rangeEnd = new Date('2026-01-05T00:00:00')
      const rentals = [{
        startDate: '2026-01-02',
        endDate: '2026-01-04',
        status: 'completed'
      }]

      const available = getAvailableDays(rentals, rangeStart, rangeEnd)
      expect(available.length).toBe(5) // All days available (including end date)
    })

    it('ignores cancelled rentals', () => {
      const rangeStart = new Date('2026-01-01T00:00:00')
      const rangeEnd = new Date('2026-01-05T00:00:00')
      const rentals = [{
        startDate: '2026-01-02',
        endDate: '2026-01-04',
        status: 'cancelled'
      }]

      const available = getAvailableDays(rentals, rangeStart, rangeEnd)
      expect(available.length).toBe(5) // All days available (including end date)
    })
  })

  describe('multiple rentals', () => {
    it('handles multiple non-overlapping rentals', () => {
      const rangeStart = new Date('2026-01-01T00:00:00')
      const rangeEnd = new Date('2026-01-20T00:00:00')
      const rentals = [
        { startDate: '2026-01-03', endDate: '2026-01-05', status: 'active' },
        { startDate: '2026-01-10', endDate: '2026-01-12', status: 'pending' }
      ]

      const available = getAvailableDays(rentals, rangeStart, rangeEnd)
      const dates = available.map(d => formatDateLocal(d))

      // Gap between rentals
      expect(dates).toContain('2026-01-06')
      expect(dates).toContain('2026-01-07')
      expect(dates).toContain('2026-01-08')
      expect(dates).toContain('2026-01-09')

      // Not during rentals
      expect(dates).not.toContain('2026-01-03')
      expect(dates).not.toContain('2026-01-10')
    })
  })
})

// ============================================================================
// findConsecutivePeriods Tests
// ============================================================================
describe('findConsecutivePeriods', () => {
  describe('basic functionality', () => {
    it('returns empty array for no days', () => {
      expect(findConsecutivePeriods([])).toEqual([])
    })

    it('creates single period for consecutive days', () => {
      const days = [
        new Date('2026-01-04T00:00:00'),
        new Date('2026-01-05T00:00:00'),
        new Date('2026-01-06T00:00:00')
      ]

      const periods = findConsecutivePeriods(days)

      expect(periods.length).toBe(1)
      expect(formatDateLocal(periods[0].startDate)).toBe('2026-01-04')
      expect(formatDateLocal(periods[0].endDate)).toBe('2026-01-06')
      expect(periods[0].days).toBe(2) // Jan 4 to Jan 6 = 2 days rental
    })

    it('creates multiple periods for non-consecutive days', () => {
      const days = [
        new Date('2026-01-04T00:00:00'),
        new Date('2026-01-05T00:00:00'),
        // Gap
        new Date('2026-01-08T00:00:00'),
        new Date('2026-01-09T00:00:00')
      ]

      const periods = findConsecutivePeriods(days)

      expect(periods.length).toBe(2)

      // First period
      expect(formatDateLocal(periods[0].startDate)).toBe('2026-01-04')
      expect(formatDateLocal(periods[0].endDate)).toBe('2026-01-05')
      expect(periods[0].days).toBe(1)

      // Second period
      expect(formatDateLocal(periods[1].startDate)).toBe('2026-01-08')
      expect(formatDateLocal(periods[1].endDate)).toBe('2026-01-09')
      expect(periods[1].days).toBe(1)
    })
  })

  describe('edge cases', () => {
    it('handles single day', () => {
      const days = [new Date('2026-01-05T00:00:00')]

      const periods = findConsecutivePeriods(days)

      expect(periods.length).toBe(1)
      expect(formatDateLocal(periods[0].startDate)).toBe('2026-01-05')
      expect(formatDateLocal(periods[0].endDate)).toBe('2026-01-05')
      expect(periods[0].days).toBe(0) // Same day = 0 rental days
    })

    it('handles many separate single days', () => {
      const days = [
        new Date('2026-01-01T00:00:00'),
        new Date('2026-01-03T00:00:00'),
        new Date('2026-01-05T00:00:00'),
        new Date('2026-01-07T00:00:00')
      ]

      const periods = findConsecutivePeriods(days)

      expect(periods.length).toBe(4)
      periods.forEach(p => expect(p.days).toBe(0)) // Each is a single day
    })

    it('handles long consecutive period', () => {
      const days = []
      for (let i = 1; i <= 10; i++) {
        days.push(new Date(`2026-01-${String(i).padStart(2, '0')}T00:00:00`))
      }

      const periods = findConsecutivePeriods(days)

      expect(periods.length).toBe(1)
      expect(formatDateLocal(periods[0].startDate)).toBe('2026-01-01')
      expect(formatDateLocal(periods[0].endDate)).toBe('2026-01-10')
      expect(periods[0].days).toBe(9) // Jan 1 to Jan 10 = 9 days
    })
  })

  describe('period days calculation', () => {
    it('calculates rental days correctly (not calendar days)', () => {
      // Available: Jan 4, 5, 6, 7, 8, 9 (6 calendar days)
      // But rental from Jan 4 to Jan 9 = 5 rental days
      const days = [
        new Date('2026-01-04T00:00:00'),
        new Date('2026-01-05T00:00:00'),
        new Date('2026-01-06T00:00:00'),
        new Date('2026-01-07T00:00:00'),
        new Date('2026-01-08T00:00:00'),
        new Date('2026-01-09T00:00:00')
      ]

      const periods = findConsecutivePeriods(days)

      expect(periods[0].days).toBe(5) // NOT 6
    })
  })
})

// ============================================================================
// Integration Tests: Real-World Scenarios
// ============================================================================
describe('Integration: Real-World Scenarios', () => {
  describe('Purple scooter scenario (user reported bug)', () => {
    // Purple has reservation from Dec 31 to Jan 3
    // Purple has another reservation from Jan 10 to Jan 15
    // User searches Jan 3 to Jan 9
    // Expected available: Jan 4 to Jan 9 (5 days)

    const rental1 = {
      startDate: '2025-12-31',
      endDate: '2026-01-03',
      status: 'pending'
    }
    const rental2 = {
      startDate: '2026-01-10',
      endDate: '2026-01-15',
      status: 'pending'
    }

    it('correctly identifies available window between rentals', () => {
      const window = findAvailableWindow(rental1.endDate, rental2.startDate)

      expect(formatDateLocal(window.startDate)).toBe('2026-01-04')
      expect(formatDateLocal(window.endDate)).toBe('2026-01-09')
      expect(window.days).toBe(5)
    })

    it('Jan 4 to Jan 9 booking has no conflict with either rental', () => {
      const requestedStart = new Date('2026-01-04T00:00:00')
      const requestedEnd = new Date('2026-01-09T00:00:00')

      const rental1Start = new Date(rental1.startDate + 'T00:00:00')
      const rental1End = new Date(rental1.endDate + 'T00:00:00')
      const rental2Start = new Date(rental2.startDate + 'T00:00:00')
      const rental2End = new Date(rental2.endDate + 'T00:00:00')

      expect(hasBookingConflict(requestedStart, requestedEnd, rental1Start, rental1End)).toBe(false)
      expect(hasBookingConflict(requestedStart, requestedEnd, rental2Start, rental2End)).toBe(false)
    })

    it('Jan 3 to Jan 9 booking conflicts (starts on rental 1 end date)', () => {
      const requestedStart = new Date('2026-01-03T00:00:00')
      const requestedEnd = new Date('2026-01-09T00:00:00')
      const rental1Start = new Date(rental1.startDate + 'T00:00:00')
      const rental1End = new Date(rental1.endDate + 'T00:00:00')

      expect(hasBookingConflict(requestedStart, requestedEnd, rental1Start, rental1End)).toBe(true)
    })

    it('Jan 4 to Jan 10 booking conflicts (ends on rental 2 start date)', () => {
      const requestedStart = new Date('2026-01-04T00:00:00')
      const requestedEnd = new Date('2026-01-10T00:00:00')
      const rental2Start = new Date(rental2.startDate + 'T00:00:00')
      const rental2End = new Date(rental2.endDate + 'T00:00:00')

      expect(hasBookingConflict(requestedStart, requestedEnd, rental2Start, rental2End)).toBe(true)
    })

    it('getAvailableDays returns correct days', () => {
      const rangeStart = new Date('2026-01-01T00:00:00')
      const rangeEnd = new Date('2026-01-15T00:00:00')
      const rentals = [rental1, rental2]

      const available = getAvailableDays(rentals, rangeStart, rangeEnd)
      const dates = available.map(d => formatDateLocal(d))

      // Should be available: Jan 4, 5, 6, 7, 8, 9
      expect(dates).toContain('2026-01-04')
      expect(dates).toContain('2026-01-05')
      expect(dates).toContain('2026-01-06')
      expect(dates).toContain('2026-01-07')
      expect(dates).toContain('2026-01-08')
      expect(dates).toContain('2026-01-09')

      // Should NOT be available
      expect(dates).not.toContain('2026-01-01') // During rental 1
      expect(dates).not.toContain('2026-01-03') // Rental 1 end
      expect(dates).not.toContain('2026-01-10') // Rental 2 start
    })
  })

  describe('Dec 30 to Dec 31 bug (original issue)', () => {
    // User searches Dec 30 to Dec 31 (1 day)
    // Existing rental starts Dec 31
    // Should detect conflict

    it('detects conflict when booking ends same day rental starts', () => {
      const requestedStart = new Date('2025-12-30T00:00:00')
      const requestedEnd = new Date('2025-12-31T00:00:00')
      const rentalStart = new Date('2025-12-31T00:00:00')
      const rentalEnd = new Date('2026-01-03T00:00:00')

      expect(hasBookingConflict(requestedStart, requestedEnd, rentalStart, rentalEnd)).toBe(true)
    })

    it('Dec 30 IS available (before rental)', () => {
      const rentalStart = new Date('2025-12-31T00:00:00')
      const rentalEnd = new Date('2026-01-03T00:00:00')

      expect(isDayAvailable(new Date('2025-12-30T00:00:00'), rentalStart, rentalEnd)).toBe(true)
    })

    it('Dec 31 is NOT available (rental starts)', () => {
      const rentalStart = new Date('2025-12-31T00:00:00')
      const rentalEnd = new Date('2026-01-03T00:00:00')

      expect(isDayAvailable(new Date('2025-12-31T00:00:00'), rentalStart, rentalEnd)).toBe(false)
    })
  })

  describe('Multiple scooters availability', () => {
    it('can find available scooter among multiple', () => {
      const scooter1Rentals = [
        { startDate: '2026-01-01', endDate: '2026-01-05', status: 'active' }
      ]
      const scooter2Rentals = [
        { startDate: '2026-01-03', endDate: '2026-01-07', status: 'active' }
      ]
      const scooter3Rentals = [] // No rentals

      const rangeStart = new Date('2026-01-02T00:00:00')
      const rangeEnd = new Date('2026-01-04T00:00:00')

      const scooter1Available = getAvailableDays(scooter1Rentals, rangeStart, rangeEnd)
      const scooter2Available = getAvailableDays(scooter2Rentals, rangeStart, rangeEnd)
      const scooter3Available = getAvailableDays(scooter3Rentals, rangeStart, rangeEnd)

      expect(scooter1Available.length).toBe(0) // All days during rental
      expect(scooter2Available.length).toBe(1) // Only Jan 2 available
      expect(scooter3Available.length).toBe(3) // All days available (Jan 2, 3, 4 - including end date)
    })
  })

  describe('Pricing integration', () => {
    it('calculates correct price for availability window', () => {
      // Window from Jan 4 to Jan 9 = 5 days
      const window = findAvailableWindow('2026-01-03', '2026-01-10')
      const pricing = calculateDailyRate(window.days)

      expect(window.days).toBe(5)
      expect(pricing.dailyRate).toBe(1000) // 5+ day discount
      expect(pricing.total).toBe(5000)
      expect(pricing.hasDiscount).toBe(true)
    })

    it('calculates price for long rental', () => {
      // 30 day rental
      const days = calculateRentalDays('2026-01-01', '2026-01-31')
      const pricing = calculateDailyRate(days)

      expect(days).toBe(30)
      expect(pricing.dailyRate).toBe(700)
      expect(pricing.total).toBe(21000)
    })
  })
})

// ============================================================================
// Edge Cases and Boundary Tests
// ============================================================================
describe('Edge Cases and Boundaries', () => {
  describe('Year transitions', () => {
    it('handles booking across year boundary', () => {
      const days = calculateRentalDays('2025-12-29', '2026-01-05')
      expect(days).toBe(7)
    })

    it('checks availability across year boundary', () => {
      const rangeStart = new Date('2025-12-28T00:00:00')
      const rangeEnd = new Date('2026-01-05T00:00:00')
      const rentals = [{
        startDate: '2025-12-31',
        endDate: '2026-01-02',
        status: 'active'
      }]

      const available = getAvailableDays(rentals, rangeStart, rangeEnd)
      const dates = available.map(d => formatDateLocal(d))

      expect(dates).toContain('2025-12-28')
      expect(dates).toContain('2025-12-29')
      expect(dates).toContain('2025-12-30')
      expect(dates).not.toContain('2025-12-31')
      expect(dates).not.toContain('2026-01-01')
      expect(dates).not.toContain('2026-01-02')
      expect(dates).toContain('2026-01-03')
      expect(dates).toContain('2026-01-04')
    })
  })

  describe('Month transitions', () => {
    it('handles 31-day to 28-day month transition', () => {
      const days = calculateRentalDays('2025-01-30', '2025-02-02')
      expect(days).toBe(3)
    })

    it('handles leap year February', () => {
      const days = calculateRentalDays('2024-02-28', '2024-03-02')
      expect(days).toBe(3) // Feb 28, 29, Mar 1
    })
  })

  describe('Long rentals', () => {
    it('handles 90-day rental calculation', () => {
      const endDate = calculateEndDate('2026-01-01', 90)
      expect(endDate).toBe('2026-04-01')
    })

    it('handles 180-day rental calculation', () => {
      const endDate = calculateEndDate('2026-01-01', 180)
      expect(endDate).toBe('2026-06-30')
    })
  })

  describe('Same-day scenarios', () => {
    it('same start and end date = 0 days', () => {
      expect(calculateRentalDays('2026-01-01', '2026-01-01')).toBe(0)
    })

    it('end date cannot be before start date (negative days)', () => {
      const days = calculateRentalDays('2026-01-05', '2026-01-01')
      expect(days).toBeLessThan(0)
    })
  })
})
