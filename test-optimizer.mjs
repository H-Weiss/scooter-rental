/**
 * Test script for the availability optimizer
 * Run with: node test-optimizer.mjs
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

// ============= OPTIMIZER CODE (copied from availabilityOptimizer.js) =============

const formatDateLocal = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const datesOverlap = (start1, end1, start2, end2) => {
  const s1 = new Date(start1 + 'T00:00:00')
  const e1 = new Date(end1 + 'T23:59:59')
  const s2 = new Date(start2 + 'T00:00:00')
  const e2 = new Date(end2 + 'T23:59:59')
  return s1 <= e2 && s2 <= e1
}

const isScooterAvailableForPeriod = (
  scooterId,
  startDate,
  endDate,
  rentals,
  excludeRentalId = null,
  plannedSwaps = []
) => {
  const hasExistingConflict = rentals.some(rental => {
    if (rental.scooterId !== scooterId) return false
    if (rental.status !== 'active' && rental.status !== 'pending') return false
    if (excludeRentalId && rental.id === excludeRentalId) return false
    if (plannedSwaps.some(swap => swap.rentalId === rental.id && swap.fromScooterId === scooterId)) return false
    return datesOverlap(startDate, endDate, rental.startDate, rental.endDate)
  })

  if (hasExistingConflict) return false

  const hasPlannedConflict = plannedSwaps.some(swap => {
    if (swap.toScooterId !== scooterId) return false
    return datesOverlap(startDate, endDate, swap.startDate, swap.endDate)
  })

  return !hasPlannedConflict
}

const getBlockingRentals = (scooterId, startDate, endDate, rentals) => {
  return rentals.filter(rental => {
    if (rental.scooterId !== scooterId) return false
    if (rental.status !== 'active' && rental.status !== 'pending') return false
    return datesOverlap(startDate, endDate, rental.startDate, rental.endDate)
  })
}

const canRentalBeMoved = (rental) => {
  if (rental.pinned) return false
  if (rental.status === 'active') {
    const today = formatDateLocal(new Date())
    if (rental.startDate <= today) return false
  }
  return true
}

const findBestAlternative = (rental, scooters, allRentals, excludeScooterIds = [], plannedSwaps = []) => {
  const currentScooter = scooters.find(s => s.id === rental.scooterId)
  const requiredSize = currentScooter?.size || 'large'

  const alternatives = scooters.filter(scooter => {
    if (excludeScooterIds.includes(scooter.id)) return false
    if (scooter.id === rental.scooterId) return false
    if (scooter.status === 'maintenance') return false
    if (scooter.size !== requiredSize) return false

    return isScooterAvailableForPeriod(
      scooter.id,
      rental.startDate,
      rental.endDate,
      allRentals,
      rental.id,
      plannedSwaps
    )
  })

  return alternatives.length > 0 ? alternatives[0] : null
}

const findOptimalAvailability = (requestedStartDate, requestedEndDate, requestedSize, scooters, rentals) => {
  const result = {
    directlyAvailable: [],
    availableWithSwaps: [],
    unavailable: []
  }

  const eligibleScooters = scooters.filter(scooter => {
    if (scooter.status === 'maintenance') return false
    if (requestedSize === 'any') return true
    return scooter.size === requestedSize
  })

  const directlyAvailableIds = []

  eligibleScooters.forEach(scooter => {
    if (isScooterAvailableForPeriod(scooter.id, requestedStartDate, requestedEndDate, rentals)) {
      result.directlyAvailable.push({ scooter, swaps: [] })
      directlyAvailableIds.push(scooter.id)
    }
  })

  const globalPlannedSwaps = []

  eligibleScooters.forEach(scooter => {
    if (directlyAvailableIds.includes(scooter.id)) return

    const blockingRentals = getBlockingRentals(scooter.id, requestedStartDate, requestedEndDate, rentals)
    const proposedSwaps = []
    let canMakeAvailable = true
    let unavailableReason = ''

    for (const blockingRental of blockingRentals) {
      if (!canRentalBeMoved(blockingRental)) {
        canMakeAvailable = false
        unavailableReason = blockingRental.pinned ? 'Blocked by pinned rental' : 'Blocked by active rental in progress'
        break
      }

      const excludeIds = [scooter.id, ...directlyAvailableIds]
      const allPlannedSwaps = [...globalPlannedSwaps, ...proposedSwaps]
      const alternative = findBestAlternative(blockingRental, scooters, rentals, excludeIds, allPlannedSwaps)

      if (!alternative) {
        canMakeAvailable = false
        unavailableReason = 'No alternative scooter available for swap'
        break
      }

      proposedSwaps.push({
        rental: blockingRental,
        fromScooter: scooter,
        toScooter: alternative,
        rentalId: blockingRental.id,
        fromScooterId: scooter.id,
        toScooterId: alternative.id,
        startDate: blockingRental.startDate,
        endDate: blockingRental.endDate
      })
    }

    if (canMakeAvailable && proposedSwaps.length > 0) {
      result.availableWithSwaps.push({
        scooter,
        swaps: proposedSwaps.map(s => ({
          rental: s.rental,
          fromScooter: s.fromScooter,
          toScooter: s.toScooter
        }))
      })
      globalPlannedSwaps.push(...proposedSwaps)
    } else if (!canMakeAvailable) {
      result.unavailable.push({ scooter, reason: unavailableReason || 'Cannot be made available' })
    }
  })

  return result
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
  console.log('Fetching data from Supabase...\n')

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

// ============= TEST RUNNER =============

async function runTest() {
  console.log('=' .repeat(60))
  console.log('AVAILABILITY OPTIMIZER TEST')
  console.log('=' .repeat(60))
  console.log()

  const data = await fetchData()
  if (!data) {
    console.error('Failed to fetch data')
    return
  }

  const { scooters, rentals } = data

  console.log(`Found ${scooters.length} scooters:`)
  scooters.forEach(s => {
    console.log(`  - ${s.color} (${s.licensePlate}) [${s.size?.toUpperCase() || 'L'}] - ${s.status}`)
  })
  console.log()

  console.log(`Found ${rentals.length} active/pending rentals:`)
  rentals.forEach(r => {
    console.log(`  - ${r.customerName}: ${r.scooterColor} (${r.startDate} to ${r.endDate})${r.pinned ? ' [PINNED]' : ''}`)
  })
  console.log()

  // Analyze data to find swap opportunities
  console.log('-'.repeat(60))
  console.log('ANALYZING DATA FOR SWAP OPPORTUNITIES...')
  console.log('-'.repeat(60))
  console.log()

  // Group rentals by scooter
  const rentalsByScooter = {}
  scooters.forEach(s => { rentalsByScooter[s.id] = [] })
  rentals.forEach(r => {
    if (rentalsByScooter[r.scooterId]) {
      rentalsByScooter[r.scooterId].push(r)
    }
  })

  // Find gaps between rentals for each scooter
  console.log('Rental timeline per scooter:')
  scooters.forEach(scooter => {
    const scooterRentals = rentalsByScooter[scooter.id]
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
    console.log(`\n  ${scooter.color} [${scooter.size?.toUpperCase() || 'L'}]:`)
    scooterRentals.forEach(r => {
      console.log(`    ${r.startDate} to ${r.endDate}: ${r.customerName}${r.pinned ? ' [PINNED]' : ''}`)
    })

    // Find gaps
    for (let i = 0; i < scooterRentals.length - 1; i++) {
      const current = scooterRentals[i]
      const next = scooterRentals[i + 1]
      const gapStart = new Date(current.endDate + 'T00:00:00')
      gapStart.setDate(gapStart.getDate() + 1)
      const gapEnd = new Date(next.startDate + 'T00:00:00')
      gapEnd.setDate(gapEnd.getDate() - 1)
      if (gapStart <= gapEnd) {
        const gapDays = Math.ceil((gapEnd - gapStart) / (1000 * 60 * 60 * 24)) + 1
        console.log(`    GAP: ${formatDateLocal(gapStart)} to ${formatDateLocal(gapEnd)} (${gapDays} days)`)
      }
    }
  })
  console.log()

  // Test cases designed around the actual data
  const testCases = [
    // ============ SWAP-TRIGGERING TEST CASES ============
    // These dates are specifically chosen where swaps SHOULD be suggested

    // Alexander (26-28 on Orange) can move to Black (free 22-31), michal (02-14) can move to Purple (free 31-24)
    // Request spans both rentals, neither Black nor Purple directly available for full period
    { start: '2026-01-26', end: '2026-02-05', size: 'large', label: 'SWAP TEST: Orange via Alexander+michal swaps to Black+Purple' },

    // liran (25-28 on Purple) can move to Black/Green/Orange - all have Feb gaps
    // Request 25-28 where Purple is the ONLY one blocked (others free)
    // NOTE: This won't trigger swap because alternatives are directly available
    { start: '2026-02-25', end: '2026-02-28', size: 'large', label: 'SWAP TEST: Purple blocked by liran (but others directly available)' },

    // nicolas (09-13 on Blue) can move to Pink
    // For small scooters, check if Pink is NOT directly available but free for nicolas dates
    { start: '2026-03-09', end: '2026-03-15', size: 'small', label: 'SWAP TEST: Blue via nicolas swap to Pink' },

    // ============ ORIGINAL TEST CASES ============

    // Original screenshot test - should show Black available, Orange unavailable (no swap to Black)
    { start: '2026-01-25', end: '2026-01-31', size: 'any', label: 'Screenshot test (25/01 - 31/01) - Black should be available' },

    // Period where Black is free after Steve (ends 01-21)
    { start: '2026-01-22', end: '2026-01-25', size: 'any', label: 'Gap period (22/01 - 25/01) - Black, Orange, Pink should be available' },

    // Period between Philipp and Alexander on Orange
    { start: '2026-01-23', end: '2026-01-25', size: 'large', label: 'Orange gap (23/01 - 25/01) - Black, Orange free for Large' },

    // February gap - Purple free between Panis and liran
    { start: '2026-02-22', end: '2026-02-24', size: 'any', label: 'Feb gap (22/02 - 24/02) - Most scooters should be free' },

    // Small scooters both blocked
    { start: '2026-01-17', end: '2026-01-20', size: 'small', label: 'Small blocked (17/01 - 20/01) - Both Pink and Blue blocked' },

    // Period where Purple could potentially swap
    { start: '2026-02-26', end: '2026-02-28', size: 'large', label: 'Purple rental period (26/02 - 28/02)' },

    // March - more availability
    { start: '2026-03-06', end: '2026-03-08', size: 'any', label: 'March (06/03 - 08/03) - Before anri/nicolas' },

    // Test pinned behavior - if any rental is pinned
    { start: '2026-01-10', end: '2026-01-15', size: 'any', label: 'Busy period (10/01 - 15/01) - Multiple rentals' },
  ]

  // SWAP ANALYSIS - Explain why swaps aren't found
  console.log('-'.repeat(60))
  console.log('SWAP OPPORTUNITY ANALYSIS')
  console.log('-'.repeat(60))
  console.log()
  console.log('For a swap to be suggested, these conditions must be met:')
  console.log('  1. Scooter A is blocked by rental X')
  console.log('  2. Rental X can be moved (not pinned, not active-in-progress)')
  console.log('  3. There exists scooter B (same size) that:')
  console.log('     - Is NOT directly available for the requested dates')
  console.log('     - BUT IS available for rental X\'s dates')
  console.log()
  console.log('Checking each blocked scooter for swap potential...')
  console.log()

  // Analyze each blocking rental to see if it has alternatives
  const largeScooters = scooters.filter(s => s.size === 'large' && s.status !== 'maintenance')
  const smallScooters = scooters.filter(s => s.size === 'small' && s.status !== 'maintenance')

  console.log('Large scooters:', largeScooters.map(s => s.color).join(', '))
  console.log('Small scooters:', smallScooters.map(s => s.color).join(', '))
  console.log()

  // Check each rental for potential alternatives
  console.log('Rental swap potential (for each rental, which other same-size scooters are free?):')
  rentals.forEach(rental => {
    const scooter = scooters.find(s => s.id === rental.scooterId)
    if (!scooter) return

    const sameSize = scooter.size === 'small' ? smallScooters : largeScooters
    const alternatives = sameSize.filter(s => {
      if (s.id === rental.scooterId) return false
      return isScooterAvailableForPeriod(s.id, rental.startDate, rental.endDate, rentals, rental.id)
    })

    const status = rental.pinned ? '[PINNED]' : canRentalBeMoved(rental) ? '[MOVABLE]' : '[ACTIVE-IN-PROGRESS]'
    console.log(`  ${rental.customerName} (${rental.startDate} to ${rental.endDate}) on ${scooter.color} ${status}`)
    if (alternatives.length > 0) {
      console.log(`    -> Could move to: ${alternatives.map(s => s.color).join(', ')}`)
    } else {
      console.log(`    -> No alternatives (all same-size scooters blocked for these dates)`)
    }
  })
  console.log()

  for (const test of testCases) {
    console.log('-'.repeat(60))
    console.log(`TEST: ${test.label}`)
    console.log(`  Dates: ${test.start} to ${test.end}`)
    console.log(`  Size filter: ${test.size}`)
    console.log()

    const result = findOptimalAvailability(test.start, test.end, test.size, scooters, rentals)

    console.log(`  DIRECTLY AVAILABLE (${result.directlyAvailable.length}):`)
    if (result.directlyAvailable.length === 0) {
      console.log('    (none)')
    } else {
      result.directlyAvailable.forEach(({ scooter }) => {
        console.log(`    - ${scooter.color} [${scooter.size?.toUpperCase() || 'L'}]`)
      })
    }

    console.log()
    console.log(`  AVAILABLE WITH SWAPS (${result.availableWithSwaps.length}):`)
    if (result.availableWithSwaps.length === 0) {
      console.log('    (none)')
    } else {
      result.availableWithSwaps.forEach(({ scooter, swaps }) => {
        console.log(`    - ${scooter.color} [${scooter.size?.toUpperCase() || 'L'}] (${swaps.length} swap${swaps.length !== 1 ? 's' : ''} needed):`)
        swaps.forEach(swap => {
          console.log(`        Move "${swap.rental.customerName}" (${swap.rental.startDate} - ${swap.rental.endDate})`)
          console.log(`        From: ${swap.fromScooter.color} -> To: ${swap.toScooter.color}`)
        })
      })
    }

    console.log()
    console.log(`  UNAVAILABLE (${result.unavailable.length}):`)
    if (result.unavailable.length === 0) {
      console.log('    (none)')
    } else {
      result.unavailable.forEach(({ scooter, reason }) => {
        console.log(`    - ${scooter.color} [${scooter.size?.toUpperCase() || 'L'}]: ${reason}`)
      })
    }

    console.log()
  }

  console.log('=' .repeat(60))
  console.log('TEST COMPLETE')
  console.log('=' .repeat(60))
}

runTest().catch(console.error)
