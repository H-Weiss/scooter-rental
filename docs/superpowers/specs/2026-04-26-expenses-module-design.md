# Expenses Module — Design Spec

## Overview

Add an expense tracking module to the Scooter Rental Management System. Expenses can be either scooter-specific (linked to a scooter) or general business expenses. The module includes a dedicated management tab and integrates into existing reports.

## Database Schema

### Table: `expenses`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, auto-generated | Unique identifier |
| date | DATE | NOT NULL | Expense date |
| amount | DECIMAL | NOT NULL | Expense amount (THB) |
| category | TEXT | NOT NULL | Category (autocomplete from existing + defaults) |
| description | TEXT | | Free-text description |
| scooter_id | UUID | FK → scooters.id, NULLABLE | Link to scooter (null = general expense) |
| created_at | TIMESTAMPTZ | DEFAULT now() | Record creation timestamp |

### SQL Migration

```sql
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  amount DECIMAL NOT NULL CHECK (amount > 0),
  category TEXT NOT NULL,
  description TEXT,
  scooter_id UUID REFERENCES scooters(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_expenses_date ON expenses(date);
CREATE INDEX idx_expenses_scooter_id ON expenses(scooter_id);
```

### Field Naming Convention

Following existing project convention:
- `scooter_id` (DB) ↔ `scooterId` (frontend)
- `created_at` (DB) ↔ `createdAt` (frontend)

### Default Categories

```javascript
const DEFAULT_CATEGORIES = [
  'fuel', 'repair', 'insurance', 'registration',
  'rent', 'marketing', 'equipment', 'utilities', 'other'
]
```

Autocomplete pulls all distinct categories from the `expenses` table and merges with defaults. No separate categories table.

## UI Design

### Expenses Tab

- New top-level tab "Expenses" in the main navigation (alongside Rentals, Scooters, Reports, Customers)
- Full-width table layout with filters at the top
- "+ Add Expense" button opens a modal form

#### Table Columns

| Column | Description |
|--------|-------------|
| Date | Expense date |
| Category | Expense category |
| Scooter | License plate (or "—" for general expenses) |
| Description | Free-text description |
| Amount | Formatted with ฿ symbol, red color |
| Actions | Edit / Delete buttons |

#### Filters

- **Category**: Dropdown of all used categories
- **Date Range**: Same preset system as existing reports (week, month, 3 months, 6 months, custom)

#### Add/Edit Modal (ExpenseForm)

Fields:
1. Date (date picker, defaults to today)
2. Amount (number input)
3. Category (autocomplete input — typed text matched against existing categories + defaults)
4. Scooter (optional dropdown — list of all scooters by license plate, with "None" option for general expenses)
5. Description (text input)

### Reports Integration

#### New Expenses Section in Reports (Inline)

Added inline within the existing `ReportManagement.jsx` — no sub-tab refactor needed. The expenses section appears below the existing income report when data is loaded.

- Same date range filtering as existing reports (shared presets)
- Summary by category: table with category name, count, total amount
- Summary by scooter: table with scooter license plate, total expenses
- Grand total expenses for the period
- CSV export

#### Existing Income Report Enhancement

- New row: "Total Expenses" — sum of all expenses in the selected date range
- New row: "Net Profit" = Total Income - Total Expenses
- Green color for positive profit, red for loss
- Expenses included in CSV export

## File Structure

```
src/components/expenses/
├── ExpenseManagement.jsx    — Main tab component (table, filters, CRUD orchestration)
├── ExpenseForm.jsx          — Modal form for add/edit
└── CategoryAutocomplete.jsx — Autocomplete input for categories

src/lib/expensesDatabase.js   — Expense CRUD functions + convertExpenseToFrontend()
src/components/reports/ReportManagement.jsx — Add expenses section + profit/loss rows inline
src/App.jsx                  — Add Expenses tab + ExpenseManagementWrapper
```

## Data Layer

### New File: `src/lib/expensesDatabase.js`

Following the `waitingListDatabase.js` precedent, expense DB functions live in their own file.

- `getExpenses()` — fetch all expenses, sorted by date descending. Filtering by date range is done client-side (consistent with existing pattern)
- `addExpense(expense)` — insert new expense
- `updateExpense(id, expense)` — update existing expense
- `deleteExpense(id)` — delete expense
- `getExpenseCategories()` — fetch distinct categories from expenses table
- `convertExpenseToFrontend(expense)` — snake_case → camelCase conversion

### StatisticsProvider

- Add `expenses` to `rawData` cache
- Add `totalExpenses` to computed statistics
- Refresh expenses on CRUD operations via `refreshStatistics(true)`

## Business Rules

- Amount must be a positive number
- Date is required
- Category is required (must select from autocomplete or type new)
- Scooter assignment is optional
- Deleting a scooter that has linked expenses: expenses remain with `scooter_id` set to null via `ON DELETE SET NULL` (UI shows "—" for these)
- All expenses are considered paid at entry time — no pending/unpaid status
- Report calculations use prorated logic only for income; expenses use full amount if the expense date falls within the selected range. This distinction should be noted in the Net Profit section of the report
- Default sort order: by date descending (newest first)
- `ExpenseManagementWrapper` in `App.jsx` connects `refreshStatistics` to the expense component (same pattern as `ScooterManagementWrapper`)

## Out of Scope

- Receipt image uploads
- Supplier/vendor tracking
- Payment method tracking
- Recurring/scheduled expenses
- Budget limits or alerts
- Multi-currency support
