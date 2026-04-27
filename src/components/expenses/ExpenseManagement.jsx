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
        <span className="text-lg font-bold text-red-900">&#3647;{totalFiltered.toLocaleString()}</span>
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
                    &#3647;{Number(expense.amount).toLocaleString()}
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
