import { useState, useEffect } from 'react'
import { AlertCircle } from 'lucide-react'

const countryCodes = [
  { code: '+66', country: 'Thailand', flag: '\u{1F1F9}\u{1F1ED}' },
  { code: '+44', country: 'UK', flag: '\u{1F1EC}\u{1F1E7}' },
  { code: '+49', country: 'Germany', flag: '\u{1F1E9}\u{1F1EA}' },
  { code: '+33', country: 'France', flag: '\u{1F1EB}\u{1F1F7}' },
  { code: '+39', country: 'Italy', flag: '\u{1F1EE}\u{1F1F9}' },
  { code: '+34', country: 'Spain', flag: '\u{1F1EA}\u{1F1F8}' },
  { code: '+351', country: 'Portugal', flag: '\u{1F1F5}\u{1F1F9}' },
  { code: '+31', country: 'Netherlands', flag: '\u{1F1F3}\u{1F1F1}' },
  { code: '+46', country: 'Sweden', flag: '\u{1F1F8}\u{1F1EA}' },
  { code: '+47', country: 'Norway', flag: '\u{1F1F3}\u{1F1F4}' },
  { code: '+45', country: 'Denmark', flag: '\u{1F1E9}\u{1F1F0}' },
  { code: '+41', country: 'Switzerland', flag: '\u{1F1E8}\u{1F1ED}' },
  { code: '+43', country: 'Austria', flag: '\u{1F1E6}\u{1F1F9}' },
  { code: '+32', country: 'Belgium', flag: '\u{1F1E7}\u{1F1EA}' },
  { code: '+48', country: 'Poland', flag: '\u{1F1F5}\u{1F1F1}' },
  { code: '+420', country: 'Czech Republic', flag: '\u{1F1E8}\u{1F1FF}' },
  { code: '+36', country: 'Hungary', flag: '\u{1F1ED}\u{1F1FA}' },
  { code: '+358', country: 'Finland', flag: '\u{1F1EB}\u{1F1EE}' },
  { code: '+372', country: 'Estonia', flag: '\u{1F1EA}\u{1F1EA}' },
  { code: '+371', country: 'Latvia', flag: '\u{1F1F1}\u{1F1FB}' },
  { code: '+370', country: 'Lithuania', flag: '\u{1F1F1}\u{1F1F9}' },
  { code: '+1', country: 'USA/Canada', flag: '\u{1F1FA}\u{1F1F8}' },
  { code: '+61', country: 'Australia', flag: '\u{1F1E6}\u{1F1FA}' },
  { code: '+64', country: 'New Zealand', flag: '\u{1F1F3}\u{1F1FF}' },
  { code: '+81', country: 'Japan', flag: '\u{1F1EF}\u{1F1F5}' },
  { code: '+82', country: 'South Korea', flag: '\u{1F1F0}\u{1F1F7}' },
  { code: '+86', country: 'China', flag: '\u{1F1E8}\u{1F1F3}' },
  { code: '+91', country: 'India', flag: '\u{1F1EE}\u{1F1F3}' },
  { code: '+65', country: 'Singapore', flag: '\u{1F1F8}\u{1F1EC}' },
  { code: '+60', country: 'Malaysia', flag: '\u{1F1F2}\u{1F1FE}' },
  { code: '+84', country: 'Vietnam', flag: '\u{1F1FB}\u{1F1F3}' },
  { code: '+62', country: 'Indonesia', flag: '\u{1F1EE}\u{1F1E9}' },
  { code: '+63', country: 'Philippines', flag: '\u{1F1F5}\u{1F1ED}' },
  { code: '+855', country: 'Cambodia', flag: '\u{1F1F0}\u{1F1ED}' },
  { code: '+856', country: 'Laos', flag: '\u{1F1F1}\u{1F1E6}' },
  { code: '+95', country: 'Myanmar', flag: '\u{1F1F2}\u{1F1F2}' },
  { code: '+971', country: 'UAE', flag: '\u{1F1E6}\u{1F1EA}' },
  { code: '+972', country: 'Israel', flag: '\u{1F1EE}\u{1F1F1}' },
  { code: '+974', country: 'Qatar', flag: '\u{1F1F6}\u{1F1E6}' },
  { code: '+965', country: 'Kuwait', flag: '\u{1F1F0}\u{1F1FC}' },
  { code: '+973', country: 'Bahrain', flag: '\u{1F1E7}\u{1F1ED}' },
  { code: '+968', country: 'Oman', flag: '\u{1F1F4}\u{1F1F2}' },
  { code: '+966', country: 'Saudi Arabia', flag: '\u{1F1F8}\u{1F1E6}' },
  { code: '+962', country: 'Jordan', flag: '\u{1F1EF}\u{1F1F4}' },
  { code: '+961', country: 'Lebanon', flag: '\u{1F1F1}\u{1F1E7}' },
  { code: '+90', country: 'Turkey', flag: '\u{1F1F9}\u{1F1F7}' },
  { code: '+7', country: 'Russia', flag: '\u{1F1F7}\u{1F1FA}' },
  { code: '+27', country: 'South Africa', flag: '\u{1F1FF}\u{1F1E6}' },
  { code: '+55', country: 'Brazil', flag: '\u{1F1E7}\u{1F1F7}' },
  { code: '+52', country: 'Mexico', flag: '\u{1F1F2}\u{1F1FD}' },
  { code: '+54', country: 'Argentina', flag: '\u{1F1E6}\u{1F1F7}' },
  { code: '+56', country: 'Chile', flag: '\u{1F1E8}\u{1F1F1}' }
]

const WaitingListForm = ({ onSubmit, onClose, initialData = null, isEditing = false }) => {
  const [formData, setFormData] = useState({
    customerName: '',
    whatsappCountryCode: '+66',
    whatsappNumber: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    sizePreference: 'any',
    notes: ''
  })

  const [errors, setErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (initialData) {
      setFormData({
        ...initialData,
        startDate: initialData.startDate.split('T')[0],
        endDate: initialData.endDate.split('T')[0],
        whatsappCountryCode: initialData.whatsappCountryCode || '+66',
        whatsappNumber: initialData.whatsappNumber || '',
        sizePreference: initialData.sizePreference || 'any',
        notes: initialData.notes || ''
      })
    }
  }, [initialData])

  const handleStartDateChange = (newStartDate) => {
    setFormData(prev => {
      const updated = { ...prev, startDate: newStartDate }
      if (!prev.endDate || new Date(prev.endDate) <= new Date(newStartDate)) {
        const nextDay = new Date(newStartDate)
        nextDay.setDate(nextDay.getDate() + 1)
        updated.endDate = nextDay.toISOString().split('T')[0]
      }
      return updated
    })
  }

  const validateForm = () => {
    const newErrors = {}

    if (!formData.customerName.trim()) {
      newErrors.customerName = 'Customer name is required'
    }
    if (!formData.whatsappNumber.trim()) {
      newErrors.whatsappNumber = 'WhatsApp number is required'
    } else if (!/^\d+$/.test(formData.whatsappNumber.trim())) {
      newErrors.whatsappNumber = 'WhatsApp number must contain only digits'
    }
    if (!formData.startDate) {
      newErrors.startDate = 'Start date is required'
    }
    if (!formData.endDate) {
      newErrors.endDate = 'End date is required'
    } else if (new Date(formData.endDate) <= new Date(formData.startDate)) {
      newErrors.endDate = 'End date must be after start date'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validateForm()) return

    try {
      setIsSubmitting(true)
      await onSubmit(formData)
    } catch (error) {
      console.error('Error submitting waiting list entry:', error)
      setErrors(prev => ({
        ...prev,
        submit: 'Failed to save. Please try again.'
      }))
    } finally {
      setIsSubmitting(false)
    }
  }

  const calculateDays = () => {
    if (!formData.startDate || !formData.endDate) return null
    const start = new Date(formData.startDate)
    const end = new Date(formData.endDate)
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24))
    return days > 0 ? days : null
  }

  const days = calculateDays()

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-4 sm:p-8 w-full max-w-2xl max-h-[95vh] overflow-y-auto shadow-2xl relative z-60">
        <div className="flex justify-between items-center mb-4 sm:mb-6">
          <div>
            <h3 className="text-lg sm:text-xl font-medium">
              {isEditing ? 'Edit Waiting List Entry' : 'Add to Waiting List'}
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              Record customer interest for dates when no scooters are available
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl sm:hidden"
          >
            x
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Dates */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
                className={`mt-1 block w-full rounded-md shadow-sm text-base px-3 py-2 ${errors.startDate ? 'border-red-300' : 'border-gray-300'}`}
                required
              />
              {errors.startDate && (
                <p className="mt-1 text-sm text-red-600">{errors.startDate}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date *</label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                className={`mt-1 block w-full rounded-md shadow-sm text-base px-3 py-2 ${errors.endDate ? 'border-red-300' : 'border-gray-300'}`}
                min={formData.startDate}
                required
              />
              {errors.endDate && (
                <p className="mt-1 text-sm text-red-600">{errors.endDate}</p>
              )}
              {days && (
                <p className="mt-1 text-xs text-blue-600">{days} day{days !== 1 ? 's' : ''}</p>
              )}
            </div>

            {/* Size Preference */}
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Size Preference</label>
              <select
                value={formData.sizePreference}
                onChange={(e) => setFormData(prev => ({ ...prev, sizePreference: e.target.value }))}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm text-base px-3 py-2"
              >
                <option value="any">Any Size</option>
                <option value="large">Large</option>
                <option value="small">Small</option>
              </select>
            </div>

            {/* Customer Details */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name *</label>
              <input
                type="text"
                value={formData.customerName}
                onChange={(e) => setFormData(prev => ({ ...prev, customerName: e.target.value }))}
                className={`mt-1 block w-full rounded-md shadow-sm text-base px-3 py-2 ${errors.customerName ? 'border-red-300' : 'border-gray-300'}`}
                required
              />
              {errors.customerName && (
                <p className="mt-1 text-sm text-red-600">{errors.customerName}</p>
              )}
            </div>

            {/* WhatsApp */}
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp Number *</label>
              <div className="flex space-x-2">
                <select
                  value={formData.whatsappCountryCode}
                  onChange={(e) => setFormData(prev => ({ ...prev, whatsappCountryCode: e.target.value }))}
                  className="block w-1/3 rounded-md border-gray-300 shadow-sm text-base px-3 py-2"
                >
                  {countryCodes.map(country => (
                    <option key={country.code} value={country.code}>
                      {country.flag} {country.code} {country.country}
                    </option>
                  ))}
                </select>
                <input
                  type="tel"
                  value={formData.whatsappNumber}
                  onChange={(e) => setFormData(prev => ({ ...prev, whatsappNumber: e.target.value }))}
                  className={`flex-1 rounded-md shadow-sm text-base px-3 py-2 ${errors.whatsappNumber ? 'border-red-300' : 'border-gray-300'}`}
                  placeholder="123456789"
                  required
                />
              </div>
              {errors.whatsappNumber && (
                <p className="mt-1 text-sm text-red-600">{errors.whatsappNumber}</p>
              )}
              <p className="mt-1 text-xs text-gray-500">Enter WhatsApp number without country code</p>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              rows={3}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm text-base px-3 py-2"
              placeholder="Any special requirements or preferences..."
            />
          </div>

          {/* Error Message */}
          {errors.submit && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <div className="flex">
                <AlertCircle className="h-5 w-5 text-red-400" />
                <div className="ml-3">
                  <p className="text-sm text-red-700">{errors.submit}</p>
                </div>
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="flex flex-col sm:flex-row sm:justify-end space-y-3 sm:space-y-0 sm:space-x-3 mt-6 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-amber-600 border border-transparent rounded-md hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Add to Waiting List'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default WaitingListForm
