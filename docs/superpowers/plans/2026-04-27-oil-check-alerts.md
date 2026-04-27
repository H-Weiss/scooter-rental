# Oil Check Alerts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Alert users when scooters have been idle (no rental) beyond a configurable threshold, prompting an oil check with a dashboard card and toast notification.

**Architecture:** New `last_oil_check` column on `scooters` table, idle-days computation in `StatisticsProvider`, dashboard alert card component, reusable toast component, and rental activation trigger to reset the counter.

**Tech Stack:** React 18, Supabase (PostgreSQL), Tailwind CSS, Lucide React icons

**Spec:** `docs/superpowers/specs/2026-04-27-oil-check-alerts-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/lib/database.js:523-531` | Add `lastOilCheck` to `convertScooterToFrontend` + new `updateScooterOilCheck()` |
| Modify | `src/context/StatisticsProvider.jsx:25-87,160-168` | Compute `scootersNeedingOilCheck` + expose in context |
| Create | `src/components/dashboard/OilCheckAlert.jsx` | Dashboard card with scooter list, done buttons, threshold settings |
| Create | `src/components/notifications/Toast.jsx` | Reusable dismissable toast component |
| Modify | `src/App.jsx:30-99,271-278` | Add OilCheckAlert to Dashboard area + Toast trigger on load |
| Modify | `src/components/rentals/RentalManagement.jsx:316-336` | Call `updateScooterOilCheck` on rental activation |

---

### Task 1: SQL Migration

**Files:**
- Reference: `docs/superpowers/specs/2026-04-27-oil-check-alerts-design.md`

- [ ] **Step 1: Run SQL in Supabase SQL Editor**

```sql
ALTER TABLE scooters ADD COLUMN last_oil_check TIMESTAMPTZ DEFAULT now();
```

- [ ] **Step 2: Verify column exists**

In Supabase Dashboard → Table Editor, confirm `scooters` table has `last_oil_check` column.

---

### Task 2: Update `database.js`

**Files:**
- Modify: `src/lib/database.js:523-531`

- [ ] **Step 1: Add `lastOilCheck` to `convertScooterToFrontend` (line ~523-531)**

Change:
```javascript
const convertScooterToFrontend = (dbScooter) => ({
  id: dbScooter.id,
  licensePlate: dbScooter.license_plate,
  color: dbScooter.color,
  year: dbScooter.year,
  mileage: dbScooter.mileage,
  status: dbScooter.status,
  size: dbScooter.size || 'large'
})
```

To:
```javascript
const convertScooterToFrontend = (dbScooter) => ({
  id: dbScooter.id,
  licensePlate: dbScooter.license_plate,
  color: dbScooter.color,
  year: dbScooter.year,
  mileage: dbScooter.mileage,
  status: dbScooter.status,
  size: dbScooter.size || 'large',
  lastOilCheck: dbScooter.last_oil_check
})
```

- [ ] **Step 2: Add `updateScooterOilCheck` function**

Add near other scooter functions:

```javascript
export const updateScooterOilCheck = async (scooterId) => {
  try {
    const { data, error } = await supabase
      .from('scooters')
      .update({ last_oil_check: new Date().toISOString() })
      .eq('id', scooterId)
      .select()
      .single()

    if (error) throw error
    return convertScooterToFrontend(data)
  } catch (error) {
    console.error('Error updating oil check:', error)
    throw new Error(`Failed to update oil check: ${error.message}`)
  }
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/database.js
git commit -m "feat: Add lastOilCheck field and updateScooterOilCheck function"
```

---

### Task 3: Update `StatisticsProvider.jsx`

**Files:**
- Modify: `src/context/StatisticsProvider.jsx:25-87,160-168`

- [ ] **Step 1: Add oil check computation to `calculateStatisticsFromData` (line ~72, before `const result`)**

Add after `const totalExpenses = ...` line:

```javascript
// Oil check alert computation
const oilCheckThreshold = Number(localStorage.getItem('oilCheckThresholdDays')) || 14
const now = Date.now()

const scootersNeedingOilCheck = scooters
  .map(scooter => {
    const lastOilCheck = scooter.lastOilCheck ? new Date(scooter.lastOilCheck) : new Date(0)

    // Find the latest rental end date for this scooter
    const scooterRentalEnds = rentals
      .filter(r => r.scooterId === scooter.id && (r.status === 'active' || r.status === 'completed'))
      .map(r => new Date(r.endDate))

    const lastRentalEnd = scooterRentalEnds.length > 0
      ? new Date(Math.max(...scooterRentalEnds.map(d => d.getTime())))
      : new Date(0)

    const lastActiveDate = new Date(Math.max(lastOilCheck.getTime(), lastRentalEnd.getTime()))
    const idleDays = Math.floor((now - lastActiveDate.getTime()) / (1000 * 60 * 60 * 24))

    return { ...scooter, idleDays, lastActiveDate }
  })
  .filter(scooter => scooter.idleDays >= oilCheckThreshold)
  .sort((a, b) => b.idleDays - a.idleDays)
```

- [ ] **Step 2: Add `scootersNeedingOilCheck` to the returned `result` object (line ~74-82)**

Add `scootersNeedingOilCheck,` inside the `result` object, after `totalExpenses,` (line ~81):

```javascript
const result = {
  availableScooters,
  activeRentals,
  maintenanceScooters,
  totalCustomers: uniqueCustomers,
  currentlyRentedCount: currentlyRentedScooterIds.size,
  totalExpenses,
  scootersNeedingOilCheck,
  isLoading: false
}
```

- [ ] **Step 3: Update `contextValue` to expose `scootersNeedingOilCheck` (line ~160-168)**

Add `scootersNeedingOilCheck` to the statistics object. It's already there via the `result` object that gets set to `statistics` state, so it will be accessible via `statistics.scootersNeedingOilCheck`.

No change needed to `contextValue` — it already exposes `statistics` which will now include the new field.

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/context/StatisticsProvider.jsx
git commit -m "feat: Add scootersNeedingOilCheck computation to StatisticsProvider"
```

---

### Task 4: Create `Toast.jsx`

**Files:**
- Create: `src/components/notifications/Toast.jsx`

- [ ] **Step 1: Create directory**

```bash
mkdir -p src/components/notifications
```

- [ ] **Step 2: Create the reusable toast component**

```jsx
import { useState, useEffect } from 'react'
import { X } from 'lucide-react'

export default function Toast({ message, actionLabel, onAction, onDismiss }) {
  const [isVisible, setIsVisible] = useState(true)

  const handleDismiss = () => {
    setIsVisible(false)
    onDismiss?.()
  }

  const handleAction = () => {
    setIsVisible(false)
    onAction?.()
  }

  if (!isVisible) return null

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm w-full animate-slide-in">
      <div className="bg-amber-50 border border-amber-300 rounded-lg shadow-lg p-4">
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-900">{message}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {actionLabel && onAction && (
              <button
                onClick={handleAction}
                className="text-xs font-medium text-amber-700 hover:text-amber-900 px-2 py-1 rounded hover:bg-amber-100"
              >
                {actionLabel}
              </button>
            )}
            <button
              onClick={handleDismiss}
              className="text-amber-400 hover:text-amber-600 p-1 rounded hover:bg-amber-100"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Add slide-in animation to `src/index.css`**

Add at the end of `src/index.css`:

```css
@keyframes slide-in {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

.animate-slide-in {
  animation: slide-in 0.3s ease-out;
}
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/components/notifications/Toast.jsx src/index.css
git commit -m "feat: Add reusable Toast notification component"
```

---

### Task 5: Create `OilCheckAlert.jsx`

**Files:**
- Create: `src/components/dashboard/OilCheckAlert.jsx`

- [ ] **Step 1: Create directory**

```bash
mkdir -p src/components/dashboard
```

- [ ] **Step 2: Create the dashboard alert card component**

```jsx
import { useState } from 'react'
import { Droplets, Check, Settings } from 'lucide-react'
import { updateScooterOilCheck } from '../../lib/database'

const DEFAULT_OIL_CHECK_DAYS = 14

export default function OilCheckAlert({ scootersNeedingOilCheck, onDone, onThresholdChange }) {
  const [showSettings, setShowSettings] = useState(false)
  const [threshold, setThreshold] = useState(
    () => Number(localStorage.getItem('oilCheckThresholdDays')) || DEFAULT_OIL_CHECK_DAYS
  )
  const [dismissedIds, setDismissedIds] = useState([])

  const visibleScooters = scootersNeedingOilCheck.filter(s => !dismissedIds.includes(s.id))

  if (visibleScooters.length === 0) return null

  const handleDone = async (scooterId) => {
    try {
      setDismissedIds(prev => [...prev, scooterId])
      await updateScooterOilCheck(scooterId)
      onDone?.()
    } catch (error) {
      console.error('Error marking oil check done:', error)
      setDismissedIds(prev => prev.filter(id => id !== scooterId))
      alert('Failed to update oil check status')
    }
  }

  const handleThresholdChange = (value) => {
    const days = Math.max(1, Number(value) || DEFAULT_OIL_CHECK_DAYS)
    setThreshold(days)
    localStorage.setItem('oilCheckThresholdDays', days.toString())
    onThresholdChange?.()
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4 sm:mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Droplets className="h-5 w-5 text-amber-600" />
          <h3 className="text-sm sm:text-base font-semibold text-amber-900">
            Oil Check Required
          </h3>
          <span className="bg-amber-200 text-amber-800 text-xs font-medium px-2 py-0.5 rounded-full">
            {visibleScooters.length}
          </span>
        </div>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="text-amber-500 hover:text-amber-700 p-2 rounded hover:bg-amber-100"
          title="Settings"
        >
          <Settings size={16} />
        </button>
      </div>

      {showSettings && (
        <div className="flex items-center gap-2 mb-3 p-2 bg-amber-100 rounded">
          <label className="text-xs text-amber-800">Alert after</label>
          <input
            type="number"
            min="1"
            value={threshold}
            onChange={(e) => handleThresholdChange(e.target.value)}
            className="w-16 px-2 py-1 text-sm border border-amber-300 rounded focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
          <span className="text-xs text-amber-800">days idle</span>
        </div>
      )}

      <div className="space-y-2">
        {visibleScooters.map(scooter => (
          <div
            key={scooter.id}
            className="flex items-center justify-between bg-white rounded-md px-3 py-2 border border-amber-100"
          >
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-900">{scooter.licensePlate}</span>
              <span className="text-xs text-gray-500">{scooter.color}</span>
              <span className="text-xs text-amber-600 font-medium">{scooter.idleDays} days idle</span>
            </div>
            <button
              onClick={() => handleDone(scooter.id)}
              className="flex items-center gap-1 text-xs font-medium text-green-700 hover:text-green-900 px-2 py-1 rounded hover:bg-green-50 border border-green-200"
            >
              <Check size={14} />
              Done
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/OilCheckAlert.jsx
git commit -m "feat: Add OilCheckAlert dashboard card component"
```

---

### Task 6: Wire Up in `App.jsx`

**Files:**
- Modify: `src/App.jsx:1-15,30-99,271-278`

- [ ] **Step 1: Add imports at top of file**

Add alongside existing imports:

```javascript
import OilCheckAlert from './components/dashboard/OilCheckAlert'
import Toast from './components/notifications/Toast'
```

- [ ] **Step 2: Update `Dashboard` component (line ~30-99)**

Add `refreshStatistics` and `scootersNeedingOilCheck` to the Dashboard. Change the Dashboard function:

After `const { statistics } = useStatistics()` (line 31), change to:

```javascript
const { statistics, refreshStatistics } = useStatistics()
```

After the closing `</div>` of the stats grid (line 96, before the final `</div>` of Dashboard), add:

```jsx
      {!statistics.isLoading && statistics.scootersNeedingOilCheck?.length > 0 && (
        <OilCheckAlert
          scootersNeedingOilCheck={statistics.scootersNeedingOilCheck}
          onDone={() => refreshStatistics(true)}
          onThresholdChange={() => refreshStatistics(false)}
        />
      )}
```

- [ ] **Step 3: Add Toast notification to `MainApp` (line ~222)**

Inside the `MainApp` function, add state for toast:

```javascript
const [showOilCheckToast, setShowOilCheckToast] = useState(true)
const { statistics } = useStatistics()
```

In the JSX return of `MainApp`, add the Toast before `<Header />` (line ~272):

```jsx
      {showOilCheckToast && !statistics.isLoading && statistics.scootersNeedingOilCheck?.length > 0 && (
        <Toast
          message={`${statistics.scootersNeedingOilCheck.length} scooter${statistics.scootersNeedingOilCheck.length > 1 ? 's' : ''} need an oil check`}
          actionLabel="Show"
          onAction={() => {
            setShowOilCheckToast(false)
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }}
          onDismiss={() => setShowOilCheckToast(false)}
        />
      )}
```

- [ ] **Step 4: Verify the dashboard card and toast appear**

Run: `npm run dev`
Expected: If any scooter has been idle for 14+ days, the amber alert card appears in the dashboard and a toast notification shows in the top-right corner.

- [ ] **Step 5: Test the "Done" button**

1. Click "Done ✓" on a scooter in the alert card
2. Verify it disappears from the list immediately
3. Refresh the page — verify it stays gone (DB was updated)

- [ ] **Step 6: Test threshold settings**

1. Click ⚙️ on the alert card
2. Change threshold to a different value
3. Verify the list updates (some scooters may appear/disappear)

- [ ] **Step 7: Test toast**

1. Refresh the page — toast should appear
2. Click "Show" — page scrolls to top, toast disappears
3. Toast should not reappear during this session

- [ ] **Step 8: Commit**

```bash
git add src/App.jsx
git commit -m "feat: Wire OilCheckAlert and Toast into main app"
```

---

### Task 7: Add Oil Check Reset on Rental Activation

**Files:**
- Modify: `src/components/rentals/RentalManagement.jsx:316-336`

- [ ] **Step 1: Add `updateScooterOilCheck` to the existing database import**

The file already has an import from `'../../lib/database'` (line ~7). Add `updateScooterOilCheck` to that existing import. For example, if the current import is:

```javascript
import { getRentals, updateRental, ... } from '../../lib/database'
```

Add `updateScooterOilCheck` to the destructured imports.

- [ ] **Step 2: Add oil check reset to `handleActivateReservation` (line ~316-336)**

After the `await updateScooterStatusSmart(rental.scooterId)` call (line ~326), add:

```javascript
        await updateScooterOilCheck(rental.scooterId)
```

So the full function becomes:
```javascript
  const handleActivateReservation = async (rental) => {
    if (window.confirm(`Activate reservation #${rental.orderNumber}? This will require agreement signing.`)) {
      try {
        const updatedRental = await updateRental({
          ...rental,
          status: 'active',
          activatedAt: new Date().toISOString()
        })
        
        setRentals(prev => prev.map(r => r.id === updatedRental.id ? updatedRental : r))
        await updateScooterStatusSmart(rental.scooterId)
        await updateScooterOilCheck(rental.scooterId)
        
        onUpdate?.()
        alert(`Reservation #${rental.orderNumber} has been activated! Don't forget to:\n• Get signed rental agreement\n• Take passport copy\n• Collect deposit`)
        
      } catch (error) {
        console.error('Error activating reservation:', error)
        setError('Failed to activate reservation')
      }
    }
  }
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/components/rentals/RentalManagement.jsx
git commit -m "feat: Reset oil check counter on rental activation"
```

---

### Task 8: Final Verification

- [ ] **Step 1: Run production build**

Run: `npm run build`
Expected: Clean build with no errors

- [ ] **Step 2: End-to-end manual test**

1. Verify dashboard shows oil check alert card for idle scooters
2. Click "Done" on a scooter — verify it disappears and stays gone after refresh
3. Change threshold via ⚙️ — verify list updates
4. Toast appears on page load when alerts exist
5. Click "Show" on toast — scrolls to top, toast disappears
6. Click X on toast — toast disappears
7. Toast does not reappear after dismissal (same session)
8. Activate a pending reservation — verify the scooter's oil check resets
9. Verify all existing functionality still works (dashboard stats, calendar, rentals, scooters, expenses, reports, customers)

- [ ] **Step 3: Final commit if any cleanup needed**

```bash
git add -A
git commit -m "chore: Final cleanup for oil check alerts"
```
