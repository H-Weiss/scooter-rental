import { useState, useEffect } from 'react'
import { AlertCircle } from 'lucide-react'

const RentalForm = ({ onSubmit, onClose, availableScooters, initialData = null, isEditing = false }) => {
  const [formData, setFormData] = useState({
    scooterId: '',
    scooterLicense: '',
    customerName: '',
    passportNumber: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    dailyRate: 1200,
    deposit: 2000,
    notes: '',
    hasSignedAgreement: false
  })

  const [errors, setErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [originalEndDate, setOriginalEndDate] = useState(null)

  useEffect(() => {
    if (initialData) {
      const formattedData = {
        ...initialData,
        startDate: initialData.startDate.split('T')[0],
        endDate: initialData.endDate.split('T')[0]
      }
      setFormData(formattedData)
      setOriginalEndDate(formattedData.endDate)
    }
  }, [initialData])

  const calculateDailyRate = (days) => {
    if (days > 10) return 800
    if (days > 5) return 1000
    return 1200
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!validateForm()) return

    try {
      setIsSubmitting(true)
      await onSubmit(formData)
    } catch (error) {
      console.error('Error submitting rental:', error)
      setErrors(prev => ({
        ...prev,
        submit: 'Failed to save rental. Please try again.'
      }))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAgreementCheck = (e) => {
    if (e.target.checked) {
      alert("Please attach a copy of the passport to the rental agreement")
    }
    setFormData(prev => ({
      ...prev,
      hasSignedAgreement: e.target.checked
    }))
  }

  const validateForm = () => {
    const newErrors = {}

    if (!isEditing) {
      if (!formData.scooterId) {
        newErrors.scooterId = 'Please select a scooter'
      }
      if (!formData.hasSignedAgreement) {
        newErrors.agreement = 'Customer must sign the rental agreement'
      }
    }

    if (!formData.customerName.trim()) {
      newErrors.customerName = 'Customer name is required'
    }

    if (!formData.passportNumber.trim()) {
      newErrors.passportNumber = 'Passport number is required'
    }

    if (!formData.endDate) {
      newErrors.endDate = 'End date is required'
    } else {
      const startDate = new Date(formData.startDate)
      const endDate = new Date(formData.endDate)
      if (endDate <= startDate) {
        newErrors.endDate = 'End date must be after start date'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const calculateRentalDetails = () => {
    if (!formData.startDate || !formData.endDate) return null

    const start = new Date(formData.startDate)
    const end = new Date(formData.endDate)
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24))
    
    if (days <= 0) return null

    const calculatedDailyRate = calculateDailyRate(days)
    const totalAmount = days * calculatedDailyRate
    const originalAmount = days * 1200 // המחיר המקורי לפי התעריף הבסיסי

    // אם זו עריכה, חשב את ההפרש מהתאריך המקורי
    let daysExtended = 0
    if (isEditing && originalEndDate) {
      const originalEnd = new Date(originalEndDate)
      daysExtended = Math.ceil((end - originalEnd) / (1000 * 60 * 60 * 24))
    }

    const discount = originalAmount - totalAmount

    return {
      days,
      daysExtended,
      dailyRate: calculatedDailyRate,
      originalAmount: originalAmount,
      discountedAmount: totalAmount,
      discount: discount > 0 ? discount : 0,
      deposit: formData.deposit
    }
  }

  const rentalDetails = calculateRentalDetails()

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-medium mb-6">
          {isEditing ? 'Edit Rental' : 'New Rental'}
        </h3>
        {isEditing && (
          <div className="text-sm text-gray-500">
            Order #: {initialData.orderNumber}
          </div>
        )}        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Scooter Selection - רק בהוספה חדשה */}
            {!isEditing && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Scooter</label>
                <select
                  value={formData.scooterId}
                  onChange={(e) => setFormData({ ...formData, scooterId: e.target.value })}
                  className={`mt-1 block w-full rounded-md shadow-sm ${errors.scooterId ? 'border-red-300' : 'border-gray-300'}`}
                  required
                >
                  <option value="">Select a scooter</option>
                  {availableScooters?.map(scooter => (
                    <option key={scooter.id} value={scooter.id}>
                      {scooter.licensePlate} - {scooter.color}
                    </option>
                  ))}
                </select>
                {errors.scooterId && (
                  <p className="mt-1 text-sm text-red-600">{errors.scooterId}</p>
                )}
              </div>
            )}

            {/* Customer Details - לא ניתנים לעריכה בעריכה */}
            <div>
              <label className="block text-sm font-medium text-gray-700">Customer Name</label>
              <input
                type="text"
                value={formData.customerName}
                onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                disabled={isEditing}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Passport Number</label>
              <input
                type="text"
                value={formData.passportNumber}
                onChange={(e) => setFormData({ ...formData, passportNumber: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                disabled={isEditing}
                required
              />
            </div>

            {/* Daily Rate - ניתן לעריכה */}
            <div>
              <label className="block text-sm font-medium text-gray-700">Daily Rate (฿)</label>
              <input
                type="number"
                value={formData.dailyRate}
                onChange={(e) => setFormData({ ...formData, dailyRate: Number(e.target.value) })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                required
              />
            </div>

            {/* תאריכים */}
            <div>
              <label className="block text-sm font-medium text-gray-700">Start Date</label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                disabled={isEditing}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">End Date</label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className={`mt-1 block w-full rounded-md shadow-sm ${errors.endDate ? 'border-red-300' : 'border-gray-300'}`}
                min={formData.startDate}
                required
              />
              {errors.endDate && (
                <p className="mt-1 text-sm text-red-600">{errors.endDate}</p>
              )}
            </div>

            {/* Deposit - רק בהוספה חדשה */}
            {!isEditing && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Deposit Amount (฿)</label>
                <input
                  type="number"
                  value={formData.deposit}
                  onChange={(e) => setFormData({ ...formData, deposit: Number(e.target.value) })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                  required
                />
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
            />
          </div>

          {/* Agreement Checkbox - רק בהשכרה חדשה */}
          {!isEditing && (
            <div className="mt-4">
              <div className="flex items-start">
                <div className="flex items-center h-5">
                  <input
                    id="agreement"
                    name="agreement"
                    type="checkbox"
                    checked={formData.hasSignedAgreement}
                    onChange={handleAgreementCheck}
                    className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded"
                  />
                </div>
                <div className="ml-3">
                  <label htmlFor="agreement" className="font-medium text-gray-700">
                    Signed rental agreement
                  </label>
                  {errors.agreement && (
                    <p className="mt-1 text-sm text-red-600">{errors.agreement}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Rental Summary */}
          {rentalDetails && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">Rental Summary</h4>
              <div className="space-y-2">
                <div className="text-sm text-gray-600">
                  Duration: {rentalDetails.days} days
                </div>
                {isEditing && rentalDetails.daysExtended !== 0 && (
                  <div className="text-sm text-blue-600">
                    Extended by: {rentalDetails.daysExtended} days
                  </div>
                )}
                <div className="text-sm text-gray-600">
                  Base Daily Rate: ฿1,200
                </div>
                <div className="text-sm text-green-600">
                  Your Daily Rate: ฿{rentalDetails.dailyRate.toLocaleString()} 
                  {rentalDetails.dailyRate < 1200 && " (Discount Applied)"}
                </div>
                <div className="text-sm text-gray-600">
                  Original Amount: ฿{rentalDetails.originalAmount.toLocaleString()}
                </div>
                {rentalDetails.discount > 0 && (
                  <div className="text-sm text-green-600">
                    Total Discount: -฿{rentalDetails.discount.toLocaleString()}
                  </div>
                )}
                <div className="text-lg font-medium text-gray-900">
                  Final Amount: ฿{rentalDetails.discountedAmount.toLocaleString()}
                </div>
                {!isEditing && (
                  <div className="mt-2 text-sm text-gray-600">
                    Deposit Required: ฿{rentalDetails.deposit.toLocaleString()}
                  </div>
                )}
                {rentalDetails.days > 5 && (
                  <div className="mt-2 text-sm text-blue-600">
                    * Long-term rental discount applied
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="flex justify-end space-x-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
            >
              {isSubmitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Rental'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default RentalForm