# Oil Check Alerts — Design Spec

## Overview

Add automatic alerts for scooters that have been parked (idle, with no rental) for a configurable number of consecutive days. When a scooter sits idle too long, the system alerts the user to perform an oil check. The user can mark the check as done, which resets the counter.

## Database Schema

### Alter Table: `scooters`

```sql
ALTER TABLE scooters ADD COLUMN last_oil_check TIMESTAMPTZ DEFAULT now();
```

New column `last_oil_check` tracks when the scooter last had an oil check or was last actively used. Defaults to `now()` so existing and new scooters start with a clean slate.

### Field Naming Convention

- `last_oil_check` (DB) ↔ `lastOilCheck` (frontend)

## Threshold Configuration

- Default threshold: **14 days**
- Stored in `localStorage` under key `oilCheckThresholdDays`
- Configurable via a settings button on the dashboard alert card
- Constant in code: `const DEFAULT_OIL_CHECK_DAYS = 14`

## Idle Days Calculation

For each scooter, compute the **last active date** as the latest of:

1. `lastOilCheck` — when oil check was last marked as done
2. `endDate` of the most recent completed/active rental for that scooter

If `today - lastActiveDate >= threshold` → scooter needs an oil check.

### What Resets the Counter

- **User clicks "Done"** on the alert → updates `last_oil_check` to `now()`
- **New rental starts** for the scooter → updates `last_oil_check` to `now()`

Scooters in `maintenance` status are **included** in the check (they're still parked).

## UI Design

### Dashboard Alert Card

- **Visibility:** Only shown when there are scooters needing an oil check
- **Position:** In the dashboard area at the top of the main page, below existing stats
- **Style:** Orange/amber background (consistent with existing warning patterns like waiting list demand)
- **Content:**
  - Header: oil drop icon + "Oil Check Required" + count badge
  - Settings button (⚙️) in the header — opens inline input to change threshold days (saved to localStorage)
  - List of scooters needing check, each row showing:
    - License plate
    - Color
    - Number of idle days
    - "Done ✓" button — marks oil check as completed, resets counter

### Toast Notification

- **Trigger:** On app load, if there are scooters needing oil check, show a toast once per session
- **Content:** "X scooters need an oil check"
- **Actions:**
  - "Show" button — scrolls to the dashboard alert card
  - "X" button — dismisses the toast
- **Behavior:** Does not re-appear after dismissal (tracked in React state, not persisted)
- **Position:** Top-right corner, fixed position
- **Auto-dismiss:** No — requires user action (click X or Show)

## File Structure

```
src/components/dashboard/OilCheckAlert.jsx  — Dashboard alert card with scooter list + done buttons
src/components/notifications/Toast.jsx      — Reusable toast notification component
src/lib/database.js                         — Add updateScooterOilCheck() function
src/context/StatisticsProvider.jsx          — Add oil check computation to statistics
src/App.jsx                                 — Add Toast + trigger logic inside MainApp (has StatisticsProvider context)
```

## Data Layer

### New Function in `database.js`

- `updateScooterOilCheck(scooterId)` — updates `last_oil_check` to `now()` for the given scooter

### Update `convertScooterToFrontend()` in `database.js`

Add `lastOilCheck: dbScooter.last_oil_check` to the conversion.

### StatisticsProvider Changes

Add to `calculateStatisticsFromData`:

```javascript
const oilCheckThreshold = Number(localStorage.getItem('oilCheckThresholdDays')) || 14

const scootersNeedingOilCheck = scooters.filter(scooter => {
  const lastOilCheck = new Date(scooter.lastOilCheck)

  // Find the latest rental end date for this scooter
  const scooterRentals = rentals
    .filter(r => r.scooterId === scooter.id && (r.status === 'active' || r.status === 'completed'))
    .map(r => new Date(r.endDate))

  const lastRentalEnd = scooterRentals.length > 0 ? new Date(Math.max(...scooterRentals)) : new Date(0)
  const lastActiveDate = new Date(Math.max(lastOilCheck.getTime(), lastRentalEnd.getTime()))

  const idleDays = Math.floor((Date.now() - lastActiveDate.getTime()) / (1000 * 60 * 60 * 24))
  return idleDays >= oilCheckThreshold
})
```

Expose `scootersNeedingOilCheck` (array with scooter + idleDays) in statistics.

### Rental Start Trigger

When a rental is activated (status changes to `active`), call `updateScooterOilCheck(scooterId)` to reset the counter. This happens in the existing rental activation flow in `RentalManagement.jsx`.

## Business Rules

- Threshold must be a positive integer (minimum 1 day)
- All scooters are checked regardless of status (available, rented, maintenance)
- Scooters currently rented won't trigger the alert because their rental end date hasn't passed yet (they're active)
- Toast shows once per app session (page load), not once per navigation
- The "Done" action immediately removes the scooter from the alert list (optimistic UI + DB update + `refreshStatistics(true)` to sync context)
- If localStorage has no threshold, default to 14 days

## Out of Scope

- Oil check history / log
- Push notifications or email alerts
- Per-scooter custom thresholds
- Automatic scheduling of maintenance
- Mileage-based oil check triggers
