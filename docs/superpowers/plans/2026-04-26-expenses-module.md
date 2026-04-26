# Expenses Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an expense tracking module with a dedicated tab, CRUD operations, category autocomplete, and reports integration (expenses breakdown + net profit).

**Architecture:** New `expensesDatabase.js` for data access (following `waitingListDatabase.js` pattern), three new components under `src/components/expenses/`, inline modal for add/edit, and integration into existing `ReportManagement.jsx` and `StatisticsProvider.jsx`.

**Tech Stack:** React 18, Supabase (PostgreSQL), Tailwind CSS, Lucide React icons

**Spec:** `docs/superpowers/specs/2026-04-26-expenses-module-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/lib/expensesDatabase.js` | Supabase CRUD + field conversion for expenses |
| Create | `src/components/expenses/ExpenseManagement.jsx` | Main tab: table, filters, CRUD orchestration |
| Create | `src/components/expenses/ExpenseForm.jsx` | Modal form for add/edit expense |
| Create | `src/components/expenses/CategoryAutocomplete.jsx` | Autocomplete input for category field |
| Modify | `src/context/StatisticsProvider.jsx:16-20,85-124` | Add expenses to rawData + totalExpenses stat |
| Modify | `src/App.jsx:229-235,243-257,295-312` | Add Expenses tab + ExpenseManagementWrapper |
| Modify | `src/components/reports/ReportManagement.jsx:110-124,559-575,212-281` | Expenses section + net profit + CSV |

---

### Task 1: Create SQL Migration & Run in Supabase

**Files:**
- Reference: `docs/superpowers/specs/2026-04-26-expenses-module-design.md` (SQL Migration section)

- [ ] **Step 1: Run the SQL migration in Supabase SQL Editor**

Go to Supabase Dashboard → SQL Editor and run:

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

- [ ] **Step 2: Verify table was created**

In Supabase Dashboard → Table Editor, confirm `expenses` table appears with all columns.

---

### Task 2: Create `expensesDatabase.js`

**Files:**
- Create: `src/lib/expensesDatabase.js`
- Reference: `src/lib/waitingListDatabase.js` (same structure)
- Reference: `src/lib/supabase.js` (supabase client import)

- [ ] **Step 1: Create the file with imports and conversion function**

```javascript
import { supabase } from './supabase.js'

const convertExpenseToFrontend = (dbExpense) => ({
  id: dbExpense.id,
  date: dbExpense.date,
  amount: dbExpense.amount,
  category: dbExpense.category,
  description: dbExpense.description,
  scooterId: dbExpense.scooter_id,
  createdAt: dbExpense.created_at
})
```

- [ ] **Step 2: Add `getExpenses` function**

```javascript
export const getExpenses = async () => {
  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .order('date', { ascending: false })

  if (error) {
    console.error('Error fetching expenses:', error)
    throw new Error(`Failed to fetch expenses: ${error.message}`)
  }

  return (data || []).map(convertExpenseToFrontend)
}
```

- [ ] **Step 3: Add `addExpense` function**

```javascript
export const addExpense = async (expense) => {
  const insertData = {
    date: expense.date,
    amount: expense.amount,
    category: expense.category,
    description: expense.description || null,
    scooter_id: expense.scooterId || null
  }

  const { data, error } = await supabase
    .from('expenses')
    .insert([insertData])
    .select()
    .single()

  if (error) {
    console.error('Error adding expense:', error)
    throw new Error(`Failed to add expense: ${error.message}`)
  }

  return convertExpenseToFrontend(data)
}
```

- [ ] **Step 4: Add `updateExpense` function**

```javascript
export const updateExpense = async (id, expense) => {
  const updateData = {
    date: expense.date,
    amount: expense.amount,
    category: expense.category,
    description: expense.description || null,
    scooter_id: expense.scooterId || null
  }

  const { data, error } = await supabase
    .from('expenses')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating expense:', error)
    throw new Error(`Failed to update expense: ${error.message}`)
  }

  return convertExpenseToFrontend(data)
}
```

- [ ] **Step 5: Add `deleteExpense` function**

```javascript
export const deleteExpense = async (id) => {
  const { error } = await supabase
    .from('expenses')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting expense:', error)
    throw new Error(`Failed to delete expense: ${error.message}`)
  }
}
```

- [ ] **Step 6: Add `getExpenseCategories` function and export**

```javascript
export const getExpenseCategories = async () => {
  const { data, error } = await supabase
    .from('expenses')
    .select('category')

  if (error) {
    console.error('Error fetching expense categories:', error)
    throw new Error(`Failed to fetch expense categories: ${error.message}`)
  }

  const dbCategories = [...new Set((data || []).map(d => d.category))]
  const defaultCategories = [
    'fuel', 'repair', 'insurance', 'registration',
    'rent', 'marketing', 'equipment', 'utilities', 'other'
  ]

  return [...new Set([...defaultCategories, ...dbCategories])].sort()
}
```

- [ ] **Step 7: Verify the file compiles**

Run: `npm run build`
Expected: No errors related to expensesDatabase.js

- [ ] **Step 8: Commit**

```bash
git add src/lib/expensesDatabase.js
git commit -m "feat: Add expenses database layer with CRUD operations"
```

---

### Task 3: Update `StatisticsProvider.jsx`

**Files:**
- Modify: `src/context/StatisticsProvider.jsx:16-20,85-124,23-82`
- Reference: `src/lib/expensesDatabase.js`

- [ ] **Step 1: Add import at top of file**

Add after existing imports:

```javascript
import { getExpenses } from '../lib/expensesDatabase'
```

- [ ] **Step 2: Add `expenses` to rawData initial state (line ~16-20)**

Change rawData initial state from:

```javascript
const [rawData, setRawData] = useState({
  scooters: [],
  rentals: [],
  isDataLoaded: false
})
```

To:

```javascript
const [rawData, setRawData] = useState({
  scooters: [],
  rentals: [],
  expenses: [],
  isDataLoaded: false
})
```

- [ ] **Step 3: Update `calculateStatisticsFromData` function signature (line ~23)**

The function currently takes `(scooters, rentals)`. Update to accept expenses:

```javascript
const calculateStatisticsFromData = (scooters, rentals, expenses) => {
```

Add inside the function body before the return:

```javascript
const totalExpenses = (expenses || []).reduce((sum, expense) => sum + Number(expense.amount), 0)
```

Add `totalExpenses` to the returned statistics object.

- [ ] **Step 4: Add expenses fetch to loadData (line ~85-124)**

In the `loadData` function, add `getExpenses()` to the `Promise.all` call:

```javascript
const [scootersResult, rentalsResult, expensesResult] = await Promise.all([
  getScooters(),
  getRentals(),
  getExpenses()
])
```

Add `expenses: expensesResult` to the `newRawData` object. Update the `calculateStatisticsFromData` call to pass expenses as third argument:

```javascript
calculateStatisticsFromData(scootersResult, rentalsResult, expensesResult)
```

- [ ] **Step 5: Update contextValue to expose expenses in rawData**

Find the `contextValue` object (line ~150-158) where `rawData` is explicitly constructed. Add `expenses` to the exposed `rawData`:

```javascript
rawData: {
  scooters: rawData.scooters,
  rentals: rawData.rentals,
  expenses: rawData.expenses,
  isDataLoaded: rawData.isDataLoaded
}
```

- [ ] **Step 6: Update refreshStatistics call sites**

Find `refreshStatistics` / recalculate paths that call `calculateStatisticsFromData`. Ensure all call sites pass `rawData.expenses` as the third argument.

- [ ] **Step 7: Verify app still loads**

Run: `npm run dev`
Expected: Dashboard loads without errors. Check browser console for no new errors.

- [ ] **Step 8: Commit**

```bash
git add src/context/StatisticsProvider.jsx
git commit -m "feat: Add expenses to StatisticsProvider data layer"
```

---

### Task 4: Create `CategoryAutocomplete.jsx`

**Files:**
- Create: `src/components/expenses/CategoryAutocomplete.jsx`

- [ ] **Step 1: Create the component**

```jsx
import { useState, useRef, useEffect } from 'react'

export default function CategoryAutocomplete({ value, onChange, categories }) {
  const [isOpen, setIsOpen] = useState(false)
  const [inputValue, setInputValue] = useState(value || '')
  const wrapperRef = useRef(null)

  useEffect(() => {
    setInputValue(value || '')
  }, [value])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filtered = categories.filter(cat =>
    cat.toLowerCase().includes(inputValue.toLowerCase())
  )

  const handleInputChange = (e) => {
    setInputValue(e.target.value)
    onChange(e.target.value)
    setIsOpen(true)
  }

  const handleSelect = (category) => {
    setInputValue(category)
    onChange(category)
    setIsOpen(false)
  }

  return (
    <div ref={wrapperRef} className="relative">
      <input
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onFocus={() => setIsOpen(true)}
        placeholder="Type or select category..."
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {isOpen && filtered.length > 0 && (
        <ul className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto">
          {filtered.map(category => (
            <li
              key={category}
              onClick={() => handleSelect(category)}
              className="px-3 py-2 cursor-pointer hover:bg-blue-50 text-sm"
            >
              {category}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `npm run build`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/expenses/CategoryAutocomplete.jsx
git commit -m "feat: Add CategoryAutocomplete component for expense categories"
```

---

### Task 5: Create `ExpenseForm.jsx`

**Files:**
- Create: `src/components/expenses/ExpenseForm.jsx`
- Reference: `src/components/rentals/WaitingListMatchModal.jsx:18-93` (modal pattern)
- Reference: `src/components/expenses/CategoryAutocomplete.jsx`

- [ ] **Step 1: Create the modal form component**

```jsx
import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import CategoryAutocomplete from './CategoryAutocomplete'

export default function ExpenseForm({ expense, scooters, categories, onSave, onClose }) {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    amount: '',
    category: '',
    scooterId: '',
    description: ''
  })

  useEffect(() => {
    if (expense) {
      setFormData({
        date: expense.date || new Date().toISOString().split('T')[0],
        amount: expense.amount || '',
        category: expense.category || '',
        scooterId: expense.scooterId || '',
        description: expense.description || ''
      })
    }
  }, [expense])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!formData.date || !formData.amount || !formData.category) return

    onSave({
      ...formData,
      amount: Number(formData.amount),
      scooterId: formData.scooterId || null
    })
  }

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">
            {expense ? 'Edit Expense' : 'Add Expense'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => handleChange('date', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount (฿) *</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={formData.amount}
              onChange={(e) => handleChange('amount', e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
            <CategoryAutocomplete
              value={formData.category}
              onChange={(val) => handleChange('category', val)}
              categories={categories}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Scooter (optional)</label>
            <select
              value={formData.scooterId}
              onChange={(e) => handleChange('scooterId', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">None (general expense)</option>
              {scooters.map(scooter => (
                <option key={scooter.id} value={scooter.id}>
                  {scooter.licensePlate} - {scooter.color}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Optional description..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              {expense ? 'Update' : 'Add Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `npm run build`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/expenses/ExpenseForm.jsx
git commit -m "feat: Add ExpenseForm modal component"
```

---

### Task 6: Create `ExpenseManagement.jsx`

**Files:**
- Create: `src/components/expenses/ExpenseManagement.jsx`
- Reference: `src/lib/expensesDatabase.js`
- Reference: `src/components/expenses/ExpenseForm.jsx`

- [ ] **Step 1: Create the main expense management component**

```jsx
import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { getExpenses, addExpense, updateExpense, deleteExpense, getExpenseCategories } from '../../lib/expensesDatabase'
import ExpenseForm from './ExpenseForm'

export default function ExpenseManagement({ onUpdate, scooters = [] }) {
  const [expenses, setExpenses] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingExpense, setEditingExpense] = useState(null)
  const [filterCategory, setFilterCategory] = useState('')
  const [dateRange, setDateRange] = useState({ start: '', end: '' })

  const setQuickDateRange = (preset) => {
    const now = new Date()
    const end = now.toISOString().split('T')[0]
    let start
    switch (preset) {
      case 'week':
        start = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        break
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()).toISOString().split('T')[0]
        break
      case '3months':
        start = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()).toISOString().split('T')[0]
        break
      case '6months':
        start = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate()).toISOString().split('T')[0]
        break
      default:
        return
    }
    setDateRange({ start, end })
  }

  const loadExpenses = useCallback(async () => {
    try {
      setLoading(true)
      const [expensesData, categoriesData] = await Promise.all([
        getExpenses(),
        getExpenseCategories()
      ])
      setExpenses(expensesData)
      setCategories(categoriesData)
    } catch (error) {
      console.error('Error loading expenses:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadExpenses()
  }, [loadExpenses])

  const handleSave = async (formData) => {
    try {
      if (editingExpense) {
        await updateExpense(editingExpense.id, formData)
      } else {
        await addExpense(formData)
      }
      setShowForm(false)
      setEditingExpense(null)
      await loadExpenses()
      onUpdate?.()
    } catch (error) {
      console.error('Error saving expense:', error)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this expense?')) return
    try {
      await deleteExpense(id)
      await loadExpenses()
      onUpdate?.()
    } catch (error) {
      console.error('Error deleting expense:', error)
    }
  }

  const handleEdit = (expense) => {
    setEditingExpense(expense)
    setShowForm(true)
  }

  const handleClose = () => {
    setShowForm(false)
    setEditingExpense(null)
  }

  const filteredExpenses = expenses.filter(expense => {
    if (filterCategory && expense.category !== filterCategory) return false
    if (dateRange.start && expense.date < dateRange.start) return false
    if (dateRange.end && expense.date > dateRange.end) return false
    return true
  })

  const totalFiltered = filteredExpenses.reduce((sum, e) => sum + Number(e.amount), 0)

  const getScooterLabel = (scooterId) => {
    if (!scooterId) return '—'
    const scooter = scooters.find(s => s.id === scooterId)
    return scooter ? scooter.licensePlate : '—'
  }

  if (loading) {
    return <div className="p-6 text-center text-gray-500">Loading expenses...</div>
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-800">Expenses</h2>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          <Plus size={16} />
          Add Expense
        </button>
      </div>

      {/* Quick Date Presets */}
      <div className="flex gap-2 mb-3 flex-wrap">
        {[
          { label: 'Last Week', value: 'week' },
          { label: 'Last Month', value: 'month' },
          { label: 'Last 3 Months', value: '3months' },
          { label: 'Last 6 Months', value: '6months' }
        ].map(preset => (
          <button
            key={preset.value}
            onClick={() => setQuickDateRange(preset.value)}
            className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-4 flex-wrap">
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm"
        >
          <option value="">All Categories</option>
          {categories.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        <input
          type="date"
          value={dateRange.start}
          onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm"
          placeholder="From"
        />
        <input
          type="date"
          value={dateRange.end}
          onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm"
          placeholder="To"
        />
        {(filterCategory || dateRange.start || dateRange.end) && (
          <button
            onClick={() => { setFilterCategory(''); setDateRange({ start: '', end: '' }) }}
            className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Summary */}
      <div className="bg-red-50 p-3 rounded-lg mb-4 inline-block">
        <span className="text-sm text-red-600 font-medium">Total: </span>
        <span className="text-lg font-bold text-red-900">฿{totalFiltered.toLocaleString()}</span>
        <span className="text-sm text-red-400 ml-2">({filteredExpenses.length} expenses)</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Scooter</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredExpenses.length === 0 ? (
              <tr>
                <td colSpan="6" className="px-4 py-8 text-center text-gray-400">
                  No expenses found
                </td>
              </tr>
            ) : (
              filteredExpenses.map(expense => (
                <tr key={expense.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-900">{expense.date}</td>
                  <td className="px-4 py-3 text-sm text-gray-900 capitalize">{expense.category}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{getScooterLabel(expense.scooterId)}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{expense.description || '—'}</td>
                  <td className="px-4 py-3 text-sm text-red-600 font-medium text-right">
                    ฿{Number(expense.amount).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleEdit(expense)}
                      className="text-blue-500 hover:text-blue-700 mx-1"
                      title="Edit"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(expense.id)}
                      className="text-red-500 hover:text-red-700 mx-1"
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showForm && (
        <ExpenseForm
          expense={editingExpense}
          scooters={scooters}
          categories={categories}
          onSave={handleSave}
          onClose={handleClose}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `npm run build`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/expenses/ExpenseManagement.jsx
git commit -m "feat: Add ExpenseManagement component with table, filters, and CRUD"
```

---

### Task 7: Wire Up in `App.jsx`

**Files:**
- Modify: `src/App.jsx:229-235,243-257,295-312`

- [ ] **Step 1: Add import at top of file**

Add alongside existing component imports:

```javascript
import ExpenseManagement from './components/expenses/ExpenseManagement'
```

Add the icon import — add `DollarSign` to the existing Lucide import:

```javascript
import { Calendar, Bike, FileText, Users, Wrench, DollarSign } from 'lucide-react'
```

- [ ] **Step 2: Add "Expenses" to tabs array (line ~229-235)**

Add after the `reports` tab entry:

```javascript
{ id: 'expenses', name: 'Expenses', icon: DollarSign },
```

- [ ] **Step 3: Add ExpenseManagementWrapper (line ~243-257)**

Add alongside existing wrappers:

```javascript
const ExpenseManagementWrapper = () => {
  const { refreshStatistics, rawData } = useStatistics()
  return <ExpenseManagement
    scooters={rawData.scooters}
    onUpdate={() => {
      refreshStatistics(true)
    }}
  />
}
```

- [ ] **Step 4: Add tab rendering (line ~295-312)**

Add a new condition in the tab rendering chain. Before the maintenance fallback `(` add:

```javascript
) : activeTab === 'expenses' ? (
  <ExpenseManagementWrapper />
```

- [ ] **Step 5: Verify the tab appears and works**

Run: `npm run dev`
Expected: New "Expenses" tab appears in navigation. Clicking it shows the expenses table (empty). Click "+ Add Expense" to verify the modal opens.

- [ ] **Step 6: Test full CRUD flow**

1. Add an expense (fill all fields, select a scooter)
2. Add a general expense (no scooter)
3. Edit an expense
4. Delete an expense
5. Verify filters work (category dropdown, date range)

- [ ] **Step 7: Commit**

```bash
git add src/App.jsx
git commit -m "feat: Wire Expenses tab into main app navigation"
```

---

### Task 8: Add Expenses to Reports

**Files:**
- Modify: `src/components/reports/ReportManagement.jsx:110-124,559-575,212-281`
- Reference: `src/lib/expensesDatabase.js`

- [ ] **Step 1: Add import**

Add at top of file:

```javascript
import { getExpenses } from '../../lib/expensesDatabase'
```

- [ ] **Step 2: Add expenses state and fetch in `generateReport`**

Add a state variable near the existing report state:

```javascript
const [expensesData, setExpensesData] = useState([])
```

In the `generateReport` function (line ~90), fetch expenses alongside existing data:

```javascript
const allExpenses = await getExpenses()
```

Filter expenses by the same date range (`start`/`end`) used for rentals:

```javascript
const filteredExpenses = allExpenses.filter(expense => {
  const expDate = new Date(expense.date)
  return expDate >= start && expDate <= end
})
setExpensesData(filteredExpenses)
```

- [ ] **Step 3: Compute expense summaries in `generateReport`**

After filtering expenses, compute the summary data and add it to the `reportData` object:

```javascript
// Group expenses by category
const expensesByCategory = {}
filteredExpenses.forEach(expense => {
  if (!expensesByCategory[expense.category]) {
    expensesByCategory[expense.category] = { count: 0, total: 0 }
  }
  expensesByCategory[expense.category].count += 1
  expensesByCategory[expense.category].total += Number(expense.amount)
})

// Group expenses by scooter
const expensesByScooter = {}
filteredExpenses.forEach(expense => {
  if (expense.scooterId) {
    const scooter = scooters.find(s => s.id === expense.scooterId)
    const label = scooter ? scooter.licensePlate : 'Unknown'
    if (!expensesByScooter[label]) {
      expensesByScooter[label] = 0
    }
    expensesByScooter[label] += Number(expense.amount)
  }
})

const totalExpenses = filteredExpenses.reduce((sum, e) => sum + Number(e.amount), 0)
const netProfit = totalIncome - totalExpenses
```

Add these to the `reportData` object that gets set to state: `expensesByCategory`, `expensesByScooter`, `totalExpenses`, `netProfit`.

- [ ] **Step 4: Add expenses summary section in the report JSX**

After the existing income summary grid (line ~559-575), add:

```jsx
{/* Expenses Summary */}
{reportData && (
  <div className="mt-8">
    <h3 className="text-lg font-semibold text-gray-800 mb-4">Expenses Summary</h3>

    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <div className="bg-red-50 p-4 rounded-lg summary-box">
        <p className="text-sm text-red-600 font-medium summary-label">Total Expenses</p>
        <p className="text-2xl font-bold text-red-900 summary-value">
          ฿{reportData.totalExpenses.toLocaleString()}
        </p>
      </div>
      <div className={`p-4 rounded-lg summary-box ${reportData.netProfit >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
        <p className={`text-sm font-medium summary-label ${reportData.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          Net Profit
        </p>
        <p className={`text-2xl font-bold summary-value ${reportData.netProfit >= 0 ? 'text-green-900' : 'text-red-900'}`}>
          ฿{reportData.netProfit.toLocaleString()}
        </p>
      </div>
    </div>

    {/* By Category table */}
    <h4 className="text-md font-semibold text-gray-700 mb-2">By Category</h4>
    <table className="w-full mb-6">
      <thead className="bg-gray-50">
        <tr>
          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Count</th>
          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-200">
        {Object.entries(reportData.expensesByCategory).map(([category, data]) => (
          <tr key={category}>
            <td className="px-4 py-2 text-sm capitalize">{category}</td>
            <td className="px-4 py-2 text-sm text-right">{data.count}</td>
            <td className="px-4 py-2 text-sm text-right text-red-600">฿{data.total.toLocaleString()}</td>
          </tr>
        ))}
      </tbody>
    </table>

    {/* By Scooter table */}
    {Object.keys(reportData.expensesByScooter).length > 0 && (
      <>
        <h4 className="text-md font-semibold text-gray-700 mb-2">By Scooter</h4>
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Scooter</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total Expenses</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {Object.entries(reportData.expensesByScooter).map(([license, total]) => (
              <tr key={license}>
                <td className="px-4 py-2 text-sm">{license}</td>
                <td className="px-4 py-2 text-sm text-right text-red-600">฿{total.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </>
    )}
  </div>
)}
```

- [ ] **Step 5: Update CSV export (line ~212-281)**

In the `exportToCSV` function, after the existing scooter summary section, add:

```javascript
// Expenses section
csv += '\nExpenses Summary\n'
csv += 'Category,Count,Total\n'
Object.entries(reportData.expensesByCategory).forEach(([category, data]) => {
  csv += `${category},${data.count},${data.total}\n`
})
csv += `\nTotal Expenses,,${reportData.totalExpenses}\n`
csv += `Net Profit,,${reportData.netProfit}\n`
```

- [ ] **Step 6: Verify reports**

Run: `npm run dev`
1. Add a few expenses with different categories and scooter assignments
2. Go to Reports tab
3. Verify expenses summary appears below income
4. Verify Net Profit calculation is correct
5. Verify CSV export includes expenses

- [ ] **Step 7: Commit**

```bash
git add src/components/reports/ReportManagement.jsx
git commit -m "feat: Add expenses summary and net profit to reports"
```

---

### Task 9: Final Verification & Cleanup

- [ ] **Step 1: Run production build**

Run: `npm run build`
Expected: Clean build with no errors or warnings

- [ ] **Step 2: End-to-end manual test**

1. Add 3+ expenses (mix of scooter-linked and general)
2. Verify category autocomplete suggests existing categories
3. Verify filters work on Expenses tab
4. Verify Reports show expenses breakdown + net profit
5. Verify CSV export includes all data
6. Delete a scooter that has linked expenses — verify expense shows "—"
7. Verify dashboard stats still work correctly

- [ ] **Step 3: Final commit if any cleanup needed**

```bash
git add -A
git commit -m "chore: Final cleanup for expenses module"
```
