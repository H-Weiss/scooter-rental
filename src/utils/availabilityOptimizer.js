/**
 * Availability Optimizer
 *
 * This module provides smart scooter assignment optimization.
 * It treats scooters as interchangeable pools by size and suggests
 * reassignments to maximize availability.
 *
 * SAFETY GUARANTEE: This algorithm will NEVER suggest a swap that would
 * leave any existing rental without a valid scooter.
 */

// Helper to format date as YYYY-MM-DD in local timezone
const formatDateLocal = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Check if two date ranges overlap
const datesOverlap = (start1, end1, start2, end2) => {
  const s1 = new Date(start1 + 'T00:00:00')
  const e1 = new Date(end1 + 'T23:59:59')
  const s2 = new Date(start2 + 'T00:00:00')
  const e2 = new Date(end2 + 'T23:59:59')
  return s1 <= e2 && s2 <= e1
}

// Check if a scooter is available for a given period
// Takes into account both existing rentals AND planned swaps
const isScooterAvailableForPeriod = (
  scooterId,
  startDate,
  endDate,
  rentals,
  excludeRentalId = null,
  plannedSwaps = [] // Array of { rentalId, toScooterId, startDate, endDate }
) => {
  // Check against existing rentals
  const hasExistingConflict = rentals.some(rental => {
    if (rental.scooterId !== scooterId) return false
    if (rental.status !== 'active' && rental.status !== 'pending') return false
    if (excludeRentalId && rental.id === excludeRentalId) return false
    // Skip rentals that are being moved away from this scooter
    if (plannedSwaps.some(swap => swap.rentalId === rental.id && swap.fromScooterId === scooterId)) return false

    return datesOverlap(startDate, endDate, rental.startDate, rental.endDate)
  })

  if (hasExistingConflict) return false

  // Check against planned swaps (rentals being moved TO this scooter)
  const hasPlannedConflict = plannedSwaps.some(swap => {
    if (swap.toScooterId !== scooterId) return false
    return datesOverlap(startDate, endDate, swap.startDate, swap.endDate)
  })

  return !hasPlannedConflict
}

// Get all rentals that block a scooter for a given period
const getBlockingRentals = (scooterId, startDate, endDate, rentals) => {
  return rentals.filter(rental => {
    if (rental.scooterId !== scooterId) return false
    if (rental.status !== 'active' && rental.status !== 'pending') return false

    return datesOverlap(startDate, endDate, rental.startDate, rental.endDate)
  })
}

// Check if a rental can be moved (not pinned, not active-in-progress)
const canRentalBeMoved = (rental) => {
  // Can't move pinned rentals
  if (rental.pinned) return false

  // Can't move active rentals that have already started
  if (rental.status === 'active') {
    const today = formatDateLocal(new Date())
    if (rental.startDate <= today) return false
  }

  return true
}

// Find the best alternative scooter for a rental
// Returns null if no valid alternative exists
const findBestAlternative = (
  rental,
  scooters,
  allRentals,
  excludeScooterIds = [],
  plannedSwaps = []
) => {
  // Get the size of the current scooter
  const currentScooter = scooters.find(s => s.id === rental.scooterId)
  const requiredSize = currentScooter?.size || 'large'

  // Find all valid alternatives
  const alternatives = scooters.filter(scooter => {
    // Skip excluded scooters
    if (excludeScooterIds.includes(scooter.id)) return false
    // Skip the current scooter
    if (scooter.id === rental.scooterId) return false
    // Skip maintenance scooters
    if (scooter.status === 'maintenance') return false
    // Must be same size
    if (scooter.size !== requiredSize) return false

    // Check if available for the rental's period (considering planned swaps)
    return isScooterAvailableForPeriod(
      scooter.id,
      rental.startDate,
      rental.endDate,
      allRentals,
      rental.id,
      plannedSwaps
    )
  })

  // Return the first valid alternative (could be enhanced to pick "best" one)
  return alternatives.length > 0 ? alternatives[0] : null
}

/**
 * Main optimization function
 *
 * @param {string} requestedStartDate - Start date for requested rental (YYYY-MM-DD)
 * @param {string} requestedEndDate - End date for requested rental (YYYY-MM-DD)
 * @param {string} requestedSize - Size preference: 'small', 'large', or 'any'
 * @param {Array} scooters - All scooters
 * @param {Array} rentals - All rentals
 * @returns {Object} Optimization result with available scooters and suggested swaps
 */
export const findOptimalAvailability = (
  requestedStartDate,
  requestedEndDate,
  requestedSize,
  scooters,
  rentals
) => {
  const result = {
    directlyAvailable: [], // Scooters available without any changes
    availableWithSwaps: [], // Scooters that become available if we swap rentals
    unavailable: [] // Scooters that can't be made available
  }

  // Filter scooters by size preference
  const eligibleScooters = scooters.filter(scooter => {
    if (scooter.status === 'maintenance') return false
    if (requestedSize === 'any') return true
    return scooter.size === requestedSize
  })

  // FIRST PASS: Find all directly available scooters
  // These should NOT be used as swap targets (we don't want to make them unavailable)
  const directlyAvailableIds = []

  eligibleScooters.forEach(scooter => {
    if (isScooterAvailableForPeriod(scooter.id, requestedStartDate, requestedEndDate, rentals)) {
      result.directlyAvailable.push({
        scooter,
        swaps: []
      })
      directlyAvailableIds.push(scooter.id)
    }
  })

  // SECOND PASS: Find scooters that can be made available with swaps
  // We track all planned swaps globally to prevent conflicts
  const globalPlannedSwaps = []

  eligibleScooters.forEach(scooter => {
    // Skip if already directly available
    if (directlyAvailableIds.includes(scooter.id)) {
      return
    }

    // Get blocking rentals for this scooter
    const blockingRentals = getBlockingRentals(scooter.id, requestedStartDate, requestedEndDate, rentals)

    // Check if all blocking rentals can be moved
    const proposedSwaps = []
    let canMakeAvailable = true
    let unavailableReason = ''

    for (const blockingRental of blockingRentals) {
      // Check if rental can be moved at all
      if (!canRentalBeMoved(blockingRental)) {
        canMakeAvailable = false
        unavailableReason = blockingRental.pinned
          ? 'Blocked by pinned rental'
          : 'Blocked by active rental in progress'
        break
      }

      // Find alternative scooter
      // Exclude: the scooter we're freeing up + directly available scooters
      const excludeIds = [scooter.id, ...directlyAvailableIds]

      // Consider both global planned swaps AND our proposed swaps for this scooter
      const allPlannedSwaps = [...globalPlannedSwaps, ...proposedSwaps]

      const alternative = findBestAlternative(
        blockingRental,
        scooters,
        rentals,
        excludeIds,
        allPlannedSwaps
      )

      if (!alternative) {
        canMakeAvailable = false
        unavailableReason = 'No alternative scooter available for swap'
        break
      }

      // Record this proposed swap
      proposedSwaps.push({
        rental: blockingRental,
        fromScooter: scooter,
        toScooter: alternative,
        // For tracking conflicts
        rentalId: blockingRental.id,
        fromScooterId: scooter.id,
        toScooterId: alternative.id,
        startDate: blockingRental.startDate,
        endDate: blockingRental.endDate
      })
    }

    if (canMakeAvailable && proposedSwaps.length > 0) {
      // Add to result
      result.availableWithSwaps.push({
        scooter,
        swaps: proposedSwaps.map(s => ({
          rental: s.rental,
          fromScooter: s.fromScooter,
          toScooter: s.toScooter
        }))
      })

      // Add to global planned swaps so other scooters don't conflict
      globalPlannedSwaps.push(...proposedSwaps)
    } else if (!canMakeAvailable) {
      result.unavailable.push({
        scooter,
        reason: unavailableReason || 'Cannot be made available'
      })
    }
  })

  return result
}

/**
 * Validate that applying swaps won't leave any rental without a scooter
 * This is a safety check before actually applying swaps
 *
 * @param {Array} swaps - Array of swap objects
 * @param {Array} rentals - All current rentals
 * @param {Array} scooters - All scooters
 * @returns {Object} { valid: boolean, errors: string[] }
 */
export const validateSwaps = (swaps, rentals, scooters) => {
  const errors = []
  const plannedMoves = []

  for (const swap of swaps) {
    const { rental, toScooter } = swap

    // Check target scooter exists and is same size
    const targetScooter = scooters.find(s => s.id === toScooter.id)
    if (!targetScooter) {
      errors.push(`Target scooter ${toScooter.id} not found`)
      continue
    }

    const sourceScooter = scooters.find(s => s.id === rental.scooterId)
    if (targetScooter.size !== (sourceScooter?.size || 'large')) {
      errors.push(`Size mismatch: cannot move rental to different size scooter`)
      continue
    }

    // Check target scooter is available for the rental period
    // Consider existing rentals and other planned moves
    const isAvailable = isScooterAvailableForPeriod(
      toScooter.id,
      rental.startDate,
      rental.endDate,
      rentals,
      rental.id,
      plannedMoves
    )

    if (!isAvailable) {
      errors.push(`Scooter ${toScooter.color} is not available for ${rental.customerName}'s rental dates`)
      continue
    }

    // Record this move for subsequent checks
    plannedMoves.push({
      rentalId: rental.id,
      fromScooterId: rental.scooterId,
      toScooterId: toScooter.id,
      startDate: rental.startDate,
      endDate: rental.endDate
    })
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Apply the suggested swaps to the database
 * Includes validation before applying
 *
 * @param {Array} swaps - Array of swap objects from optimization result
 * @param {Function} updateRental - Function to update a rental in the database
 * @returns {Promise<Object>} { success: boolean, updatedRentals: Array, errors: Array }
 */
export const applySwaps = async (swaps, updateRental) => {
  const updatedRentals = []
  const errors = []

  for (const swap of swaps) {
    try {
      const updatedRental = await updateRental({
        ...swap.rental,
        scooterId: swap.toScooter.id,
        scooterLicense: swap.toScooter.licensePlate,
        scooterColor: swap.toScooter.color
      })
      updatedRentals.push(updatedRental)
    } catch (error) {
      errors.push(`Failed to move ${swap.rental.customerName}'s rental: ${error.message}`)
    }
  }

  return {
    success: errors.length === 0,
    updatedRentals,
    errors
  }
}

export default {
  findOptimalAvailability,
  validateSwaps,
  applySwaps
}
