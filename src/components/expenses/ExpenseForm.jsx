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
