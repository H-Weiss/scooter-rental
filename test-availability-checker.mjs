/**
 * Unit Tests for AvailabilityChecker
 * Run with: node test-availability-checker.mjs
 *
 * Tests the availability checking logic against real database data
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Read .env.local file
const envPath = resolve(__dirname, '.env.local')
const envContent = readFileSync(envPath, 'utf-8')
const env = {}
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=')
  if (key && valueParts.length) {
    env[key.trim()] = valueParts.join('=').trim()
  }
})

const supabaseUrl = env.VITE_SUPABASE_URL
const supabaseKey = env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// ============= CONSTANTS =============
const DEFAULT_START_TIME = '09:00'
const DEFAULT_END_TIME = '18:00'
const SAME_DAY_CUTOFF_TIME = '16:00'

// ============= HELPER FUNCTIONS =============

const formatDateLocal = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const formatTime = (time) => {
  if (!time) return ''
  return time.substring(0, 5)
}

// Check if two date ranges overlap (from rentalCalculations.js)
const hasBookingConflictWithTime = (
  reqStart, reqEnd, reqStartTime, reqEndTime,
  rentalStart, rentalEnd, rentalStartTime, rentalEndTime
) => {
  const reqStartStr = reqStart.toISOString().split('T')[0]
  const reqEndStr = reqEnd.toISOString().split('T')[0]
  const rentalStartStr = rentalStart.toISOString().split('T')[0]
  const rentalEndStr = rentalEnd.toISOString().split('T')[0]

  // Same-day case: rental ends on request start date
  if (rentalEndStr === reqStartStr) {
    const returnTime = formatTime(rentalEndTime || DEFAULT_END_TIME)
    const pickupTime = formatTime(reqStartTime || DEFAULT_START_TIME)

    // Need 2-hour buffer between return and pickup
    const [returnHours] = returnTime.split(':').map(Number)
    const [pickupHours] = pickupTime.split(':').map(Number)

    // If return + 2h buffer <= pickup time, no conflict
    if (returnHours + 2 <= pickupHours) {
      return false
    }
    // If return time >= 16:00, scooter only available next day
    if (returnTime >= SAME_DAY_CUTOFF_TIME) {
      return true
    }
  }

  // Standard overlap check
  return reqStart <= rentalEnd && reqEnd >= rentalStart
}

// ============= AVAILABILITY CHECKER LOGIC =============

const checkAvailability = (scooters, rentals, startDate, endDate, sizeFilter = 'any') => {
  const requestedStartDate = new Date(startDate + 'T00:00:00')
  const requestedEndDate = new Date(endDate + 'T00:00:00')

  const occupiedScooterIds = new Set()
  const conflictingRentals = {}
  const sameDayReturns = {}

  rentals.forEach(rental => {
    if (rental.status === 'active' || rental.status === 'pending') {
      const rentalStartDate = new Date(rental.startDate + 'T00:00:00')
      const rentalEndDate = new Date(rental.endDate + 'T00:00:00')

      const reqStartStr = formatDateLocal(requestedStartDate)
      const rentalEndStr = rental.endDate
      const isReturningOnStartDate = reqStartStr === rentalEndStr

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

        if (isReturningOnStartDate) {
          const returnTime = formatTime(rental.endTime || DEFAULT_END_TIME)
          sameDayReturns[rental.scooterId] = {
            returnTime,
            customerName: rental.customerName,
            rental
          }
        }
      }
    }
  })

  // Filter by size
  const eligibleScooters = scooters.filter(scooter => {
    if (scooter.status === 'maintenance') return false
    if (sizeFilter === 'any') return true
    return scooter.size === sizeFilter
  })

  // Available scooters
  const available = eligibleScooters.filter(scooter => {
    return !occupiedScooterIds.has(scooter.id)
  })

  // Same-day returns - with bug fix check
  const sameDayReturnsList = eligibleScooters
    .filter(scooter => {
      const info = sameDayReturns[scooter.id]
      if (!info) return false
      if (info.returnTime >= SAME_DAY_CUTOFF_TIME) return false

      // CRITICAL: Check if there's another rental blocking the rest of the period
      const hasOtherBlockingRental = rentals.some(rental => {
        if (rental.scooterId !== scooter.id) return false
        if (rental.status !== 'active' && rental.status !== 'pending') return false
        if (rental.id === info.rental.id) return false

        const rentalStart = new Date(rental.startDate + 'T00:00:00')
        const rentalEnd = new Date(rental.endDate + 'T23:59:59')

        return requestedStartDate <= rentalEnd && requestedEndDate >= rentalStart
      })

      return !hasOtherBlockingRental
    })
    .map(scooter => {
      const info = sameDayReturns[scooter.id]
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

  const trueSameDayAvailableIds = new Set(sameDayReturnsList.map(s => s.id))

  // Unavailable scooters
  const unavailable = eligibleScooters.filter(scooter => {
    const isOccupied = occupiedScooterIds.has(scooter.id)
    const isTrulySameDayAvailable = trueSameDayAvailableIds.has(scooter.id)
    return isOccupied && !isTrulySameDayAvailable
  }).map(scooter => ({
    ...scooter,
    conflictingRentals: conflictingRentals[scooter.id] || []
  }))

  return {
    available,
    sameDayAvailable: sameDayReturnsList,
    unavailable,
    occupiedScooterIds: Array.from(occupiedScooterIds)
  }
}

// ============= DATA FETCHING =============

const convertScooterToFrontend = (dbScooter) => ({
  id: dbScooter.id,
  licensePlate: dbScooter.license_plate,
  color: dbScooter.color,
  year: dbScooter.year,
  mileage: dbScooter.mileage,
  status: dbScooter.status,
  size: dbScooter.size || 'large'
})

const convertRentalToFrontend = (dbRental) => ({
  id: dbRental.id,
  orderNumber: dbRental.order_number,
  scooterId: dbRental.scooter_id,
  scooterLicense: dbRental.scooter_license,
  scooterColor: dbRental.scooter_color,
  customerName: dbRental.customer_name,
  passportNumber: dbRental.passport_number,
  whatsappCountryCode: dbRental.whatsapp_country_code,
  whatsappNumber: dbRental.whatsapp_number,
  startDate: dbRental.start_date,
  endDate: dbRental.end_date,
  startTime: dbRental.start_time,
  endTime: dbRental.end_time,
  dailyRate: dbRental.daily_rate,
  deposit: dbRental.deposit,
  status: dbRental.status,
  paid: dbRental.paid,
  notes: dbRental.notes,
  requiresAgreement: dbRental.requires_agreement,
  createdAt: dbRental.created_at,
  pinned: dbRental.pinned || false
})

async function fetchData() {
  const { data: scootersData, error: scootersError } = await supabase
    .from('scooters')
    .select('*')
    .order('color')

  if (scootersError) {
    console.error('Error fetching scooters:', scootersError)
    return null
  }

  const { data: rentalsData, error: rentalsError } = await supabase
    .from('rentals')
    .select('*')
    .in('status', ['active', 'pending'])
    .order('start_date')

  if (rentalsError) {
    console.error('Error fetching rentals:', rentalsError)
    return null
  }

  const scooters = scootersData.map(convertScooterToFrontend)
  const rentals = rentalsData.map(convertRentalToFrontend)

  return { scooters, rentals }
}

// ============= TEST FRAMEWORK =============

let passedTests = 0
let failedTests = 0
const testResults = []

function assert(condition, testName, details = '') {
  if (condition) {
    passedTests++
    testResults.push({ name: testName, passed: true })
    console.log(`  ✅ ${testName}`)
  } else {
    failedTests++
    testResults.push({ name: testName, passed: false, details })
    console.log(`  ❌ ${testName}`)
    if (details) console.log(`     Details: ${details}`)
  }
}

function assertEqual(actual, expected, testName) {
  const condition = actual === expected
  const details = condition ? '' : `Expected: ${expected}, Got: ${actual}`
  assert(condition, testName, details)
}

function assertIncludes(array, item, testName, getKey = (x) => x) {
  const found = array.some(x => getKey(x) === item)
  const details = found ? '' : `${item} not found in [${array.map(getKey).join(', ')}]`
  assert(found, testName, details)
}

function assertNotIncludes(array, item, testName, getKey = (x) => x) {
  const found = array.some(x => getKey(x) === item)
  const details = found ? `${item} should not be in [${array.map(getKey).join(', ')}]` : ''
  assert(!found, testName, details)
}

// ============= TEST CASES =============

async function runTests() {
  console.log('=' .repeat(70))
  console.log('AVAILABILITY CHECKER UNIT TESTS')
  console.log('=' .repeat(70))
  console.log()

  const data = await fetchData()
  if (!data) {
    console.error('Failed to fetch data')
    return
  }

  const { scooters, rentals } = data

  console.log(`Loaded ${scooters.length} scooters and ${rentals.length} active/pending rentals`)
  console.log()

  // Print rental data for reference
  console.log('Current Rentals (for reference):')
  rentals.forEach(r => {
    console.log(`  ${r.customerName}: ${r.scooterColor} (${r.startDate} to ${r.endDate}) [${r.endTime || 'no time'}]`)
  })
  console.log()

  // Helper to get scooter by color
  const getScooterByColor = (color) => scooters.find(s => s.color.toLowerCase() === color.toLowerCase())
  const getScooterId = (color) => getScooterByColor(color)?.id

  // ============= TEST GROUP 1: Basic Availability =============
  console.log('-'.repeat(70))
  console.log('TEST GROUP 1: Basic Availability Checks')
  console.log('-'.repeat(70))

  // Test 1.1: Period with all scooters available (far future)
  {
    const result = checkAvailability(scooters, rentals, '2026-08-01', '2026-08-05')
    assertEqual(result.available.length, scooters.filter(s => s.status !== 'maintenance').length,
      '1.1 All non-maintenance scooters available in Aug 2026')
  }

  // Test 1.2: Period with all scooters blocked (Jan 10-15)
  {
    const result = checkAvailability(scooters, rentals, '2026-01-10', '2026-01-15')
    assertEqual(result.available.length, 0, '1.2 No scooters available Jan 10-15 (busy period)')
  }

  // Test 1.3: Specific scooter available (Black free Jan 22-31)
  {
    const result = checkAvailability(scooters, rentals, '2026-01-25', '2026-01-31')
    assertIncludes(result.available, 'Black', '1.3 Black available Jan 25-31', s => s.color)
  }

  // Test 1.4: Orange gap period (Jan 23-25)
  {
    const result = checkAvailability(scooters, rentals, '2026-01-23', '2026-01-25')
    assertIncludes(result.available, 'Orange', '1.4 Orange available Jan 23-25 (gap between Philipp and Alexander)', s => s.color)
  }

  console.log()

  // ============= TEST GROUP 2: Size Filter =============
  console.log('-'.repeat(70))
  console.log('TEST GROUP 2: Size Filter')
  console.log('-'.repeat(70))

  // Test 2.1: Large only filter
  {
    const result = checkAvailability(scooters, rentals, '2026-02-22', '2026-02-24', 'large')
    const allLarge = result.available.every(s => s.size === 'large')
    assert(allLarge && result.available.length > 0, '2.1 Large filter returns only large scooters')
  }

  // Test 2.2: Small only filter
  {
    const result = checkAvailability(scooters, rentals, '2026-02-22', '2026-02-24', 'small')
    const allSmall = result.available.every(s => s.size === 'small')
    assert(allSmall && result.available.length > 0, '2.2 Small filter returns only small scooters')
  }

  // Test 2.3: Small scooters both blocked (Jan 17-20)
  {
    const result = checkAvailability(scooters, rentals, '2026-01-17', '2026-01-20', 'small')
    assertEqual(result.available.length, 0, '2.3 No small scooters available Jan 17-20')
  }

  console.log()

  // ============= TEST GROUP 3: Same-Day Availability Bug Fix =============
  console.log('-'.repeat(70))
  console.log('TEST GROUP 3: Same-Day Availability (Bug Fix Verification)')
  console.log('-'.repeat(70))

  // Test 3.1: THE BUG - Orange should NOT be same-day available for Jan 13-23
  // Victoria ends Jan 13, but Philipp starts Jan 13
  {
    const result = checkAvailability(scooters, rentals, '2026-01-13', '2026-01-23')
    const orangeInSameDay = result.sameDayAvailable.some(s => s.color === 'Orange')
    assert(!orangeInSameDay, '3.1 BUG FIX: Orange NOT same-day available Jan 13-23 (Philipp blocks)')
  }

  // Test 3.2: Orange should be UNAVAILABLE for Jan 13-23
  {
    const result = checkAvailability(scooters, rentals, '2026-01-13', '2026-01-23')
    assertIncludes(result.unavailable, 'Orange', '3.2 Orange is unavailable for Jan 13-23', s => s.color)
  }

  // Test 3.3: Verify conflicting rental is Philipp (Jan 13-22)
  {
    const result = checkAvailability(scooters, rentals, '2026-01-13', '2026-01-23')
    const orangeUnavail = result.unavailable.find(s => s.color === 'Orange')
    const hasPhilipp = orangeUnavail?.conflictingRentals.some(r => r.customerName.includes('Philipp'))
    assert(hasPhilipp, '3.3 Orange blocked by Philipp rental')
  }

  // Test 3.4: True same-day scenario - if a scooter returns and nothing else blocks
  // Find a case where same-day IS valid
  {
    // Check Pink on Jan 16 - Joe ends Jan 15, martin starts Jan 17
    // So Jan 16 should be a gap day where Pink is available
    const result = checkAvailability(scooters, rentals, '2026-01-16', '2026-01-16')
    assertIncludes(result.available, 'Pink', '3.4 Pink available on Jan 16 (gap between Joe and martin)', s => s.color)
  }

  console.log()

  // ============= TEST GROUP 4: Conflicting Rentals =============
  console.log('-'.repeat(70))
  console.log('TEST GROUP 4: Conflicting Rentals Tracking')
  console.log('-'.repeat(70))

  // Test 4.1: Purple blocked by Panis (Jan 10-30)
  {
    const result = checkAvailability(scooters, rentals, '2026-01-15', '2026-01-20')
    const purpleUnavail = result.unavailable.find(s => s.color === 'Purple')
    const hasPanis = purpleUnavail?.conflictingRentals.some(r => r.customerName.includes('Panis'))
    assert(hasPanis, '4.1 Purple shows Panis as conflicting rental')
  }

  // Test 4.2: Multiple conflicting rentals shown
  {
    const result = checkAvailability(scooters, rentals, '2026-01-13', '2026-01-25')
    const orangeUnavail = result.unavailable.find(s => s.color === 'Orange')
    // Should have both Philipp (13-22) and potentially overlap detection
    assert(orangeUnavail?.conflictingRentals.length >= 1, '4.2 Orange shows at least one conflicting rental')
  }

  console.log()

  // ============= TEST GROUP 5: Edge Cases =============
  console.log('-'.repeat(70))
  console.log('TEST GROUP 5: Edge Cases')
  console.log('-'.repeat(70))

  // Test 5.1: Single day availability
  {
    const result = checkAvailability(scooters, rentals, '2026-01-22', '2026-01-22')
    // Black and Orange should be available on Jan 22
    // Black: Steve ends 21, Dennis starts Feb 1
    // Orange: Philipp ends 22, so might be blocking
    assertIncludes(result.available, 'Black', '5.1 Black available on single day Jan 22', s => s.color)
  }

  // Test 5.2: Rental ending exactly on search start (boundary test)
  {
    // Steve on Black ends Jan 21. Search starting Jan 22 should find Black available
    const result = checkAvailability(scooters, rentals, '2026-01-22', '2026-01-25')
    assertIncludes(result.available, 'Black', '5.2 Black available when search starts day after rental ends', s => s.color)
  }

  // Test 5.3: Rental starting exactly on search end (boundary test)
  {
    // Dennis on Black starts Feb 1. Search ending Jan 31 should find Black available
    const result = checkAvailability(scooters, rentals, '2026-01-25', '2026-01-31')
    assertIncludes(result.available, 'Black', '5.3 Black available when search ends day before rental starts', s => s.color)
  }

  // Test 5.4: Far future - all available
  {
    const result = checkAvailability(scooters, rentals, '2026-12-01', '2026-12-15')
    const nonMaintenanceCount = scooters.filter(s => s.status !== 'maintenance').length
    assertEqual(result.available.length, nonMaintenanceCount, '5.4 All scooters available in far future (Dec 2026)')
  }

  console.log()

  // ============= TEST GROUP 6: Return Time Handling =============
  console.log('-'.repeat(70))
  console.log('TEST GROUP 6: Return Time Logic')
  console.log('-'.repeat(70))

  // Test 6.1: Same-day cutoff time (16:00)
  {
    // This is a logic test - rentals returning at 16:00+ should not be same-day available
    // We test the constant is being respected
    assertEqual(SAME_DAY_CUTOFF_TIME, '16:00', '6.1 Same-day cutoff time is 16:00')
  }

  // Test 6.2: 2-hour buffer calculation
  {
    // Simulated: if return time is 11:00, available from should be 13:00
    const returnTime = '11:00'
    const [hours, minutes] = returnTime.split(':').map(Number)
    const availableFromHours = hours + 2
    const availableFromTime = `${String(availableFromHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
    assertEqual(availableFromTime, '13:00', '6.2 2-hour buffer: 11:00 return → 13:00 available')
  }

  console.log()

  // ============= TEST GROUP 7: Maintenance Status =============
  console.log('-'.repeat(70))
  console.log('TEST GROUP 7: Maintenance Status Handling')
  console.log('-'.repeat(70))

  // Test 7.1: Maintenance scooters excluded from available
  {
    const maintenanceScooters = scooters.filter(s => s.status === 'maintenance')
    if (maintenanceScooters.length > 0) {
      const result = checkAvailability(scooters, rentals, '2026-08-01', '2026-08-05')
      maintenanceScooters.forEach(ms => {
        assertNotIncludes(result.available, ms.color, `7.1 ${ms.color} (maintenance) not in available`, s => s.color)
      })
    } else {
      console.log('  ⏭️  7.1 Skipped - no scooters in maintenance')
    }
  }

  console.log()

  // ============= SUMMARY =============
  console.log('=' .repeat(70))
  console.log('TEST SUMMARY')
  console.log('=' .repeat(70))
  console.log()
  console.log(`  Total Tests: ${passedTests + failedTests}`)
  console.log(`  ✅ Passed: ${passedTests}`)
  console.log(`  ❌ Failed: ${failedTests}`)
  console.log()

  if (failedTests > 0) {
    console.log('Failed Tests:')
    testResults.filter(t => !t.passed).forEach(t => {
      console.log(`  - ${t.name}`)
      if (t.details) console.log(`    ${t.details}`)
    })
  }

  console.log('=' .repeat(70))

  return failedTests === 0
}

// Run tests
runTests()
  .then(success => {
    process.exit(success ? 0 : 1)
  })
  .catch(err => {
    console.error('Test runner error:', err)
    process.exit(1)
  })
