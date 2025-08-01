import { useState, useEffect } from 'react'
import { AlertCircle, Calendar, Clock, User } from 'lucide-react'
import { getCustomerByPassport } from '../../lib/database'

const RentalForm = ({ onSubmit, onClose, availableScooters, initialData = null, isEditing = false, reservationMode = false }) => {
  const [formData, setFormData] = useState({
    scooterId: '',
    scooterLicense: '',
    customerName: '',
    passportNumber: '',
    whatsappCountryCode: '+66', // ברירת מחדל תאילנד
    whatsappNumber: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    startTime: '09:00',
    endTime: '18:00',
    dailyRate: 1200,
    deposit: 4000, // Deposit קבוע 4000 THB
    notes: '',
    hasSignedAgreement: false,
    isReservation: reservationMode // האם זו הזמנה עתידית
  })

  const [errors, setErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [originalEndDate, setOriginalEndDate] = useState(null)
  const [filteredScooters, setFilteredScooters] = useState([])
  const [isLoadingScooters, setIsLoadingScooters] = useState(false)
  const [customerLookupStatus, setCustomerLookupStatus] = useState('')
  const [isLookingUpCustomer, setIsLookingUpCustomer] = useState(false)

  // קידומות מדינות נפוצות
  const countryCodes = [
    // תאילנד - ברירת מחדל
    { code: '+66', country: 'Thailand', flag: '🇹🇭' },
    
    // אירופה
    { code: '+44', country: 'UK', flag: '🇬🇧' },
    { code: '+49', country: 'Germany', flag: '🇩🇪' },
    { code: '+33', country: 'France', flag: '🇫🇷' },
    { code: '+39', country: 'Italy', flag: '🇮🇹' },
    { code: '+34', country: 'Spain', flag: '🇪🇸' },
    { code: '+351', country: 'Portugal', flag: '🇵🇹' },
    { code: '+31', country: 'Netherlands', flag: '🇳🇱' },
    { code: '+46', country: 'Sweden', flag: '🇸🇪' },
    { code: '+47', country: 'Norway', flag: '🇳🇴' },
    { code: '+45', country: 'Denmark', flag: '🇩🇰' },
    { code: '+41', country: 'Switzerland', flag: '🇨🇭' },
    { code: '+43', country: 'Austria', flag: '🇦🇹' },
    { code: '+32', country: 'Belgium', flag: '🇧🇪' },
    { code: '+48', country: 'Poland', flag: '🇵🇱' },
    { code: '+420', country: 'Czech Republic', flag: '🇨🇿' },
    { code: '+36', country: 'Hungary', flag: '🇭🇺' },
    { code: '+358', country: 'Finland', flag: '🇫🇮' },
    { code: '+372', country: 'Estonia', flag: '🇪🇪' },
    { code: '+371', country: 'Latvia', flag: '🇱🇻' },
    { code: '+370', country: 'Lithuania', flag: '🇱🇹' },
    
    // צפון אמריקה
    { code: '+1', country: 'USA/Canada', flag: '🇺🇸' },
    
    // אוקיאניה
    { code: '+61', country: 'Australia', flag: '🇦🇺' },
    { code: '+64', country: 'New Zealand', flag: '🇳🇿' },
    
    // אסיה
    { code: '+81', country: 'Japan', flag: '🇯🇵' },
    { code: '+82', country: 'South Korea', flag: '🇰🇷' },
    { code: '+86', country: 'China', flag: '🇨🇳' },
    { code: '+91', country: 'India', flag: '🇮🇳' },
    { code: '+65', country: 'Singapore', flag: '🇸🇬' },
    { code: '+60', country: 'Malaysia', flag: '🇲🇾' },
    { code: '+84', country: 'Vietnam', flag: '🇻🇳' },
    { code: '+62', country: 'Indonesia', flag: '🇮🇩' },
    { code: '+63', country: 'Philippines', flag: '🇵🇭' },
    { code: '+855', country: 'Cambodia', flag: '🇰🇭' },
    { code: '+856', country: 'Laos', flag: '🇱🇦' },
    { code: '+95', country: 'Myanmar', flag: '🇲🇲' },
    
    // המזרח התיכון
    { code: '+971', country: 'UAE', flag: '🇦🇪' },
    { code: '+972', country: 'Israel', flag: '🇮🇱' },
    { code: '+974', country: 'Qatar', flag: '🇶🇦' },
    { code: '+965', country: 'Kuwait', flag: '🇰🇼' },
    { code: '+973', country: 'Bahrain', flag: '🇧🇭' },
    { code: '+968', country: 'Oman', flag: '🇴🇲' },
    { code: '+966', country: 'Saudi Arabia', flag: '🇸🇦' },
    { code: '+962', country: 'Jordan', flag: '🇯🇴' },
    { code: '+961', country: 'Lebanon', flag: '🇱🇧' },
    { code: '+90', country: 'Turkey', flag: '🇹🇷' },
    
    // אחרות
    { code: '+7', country: 'Russia', flag: '🇷🇺' },
    { code: '+27', country: 'South Africa', flag: '🇿🇦' },
    { code: '+55', country: 'Brazil', flag: '🇧🇷' },
    { code: '+52', country: 'Mexico', flag: '🇲🇽' },
    { code: '+54', country: 'Argentina', flag: '🇦🇷' },
    { code: '+56', country: 'Chile', flag: '🇨🇱' }
  ]

  // שעות זמינות (9:00 עד 18:00)
  const timeOptions = []
  for (let hour = 9; hour <= 18; hour++) {
    const timeString = `${hour.toString().padStart(2, '0')}:00`
    timeOptions.push(timeString)
  }

  // פונקציה לחישוב מחיר יומי לפי כמות ימים (זהה לזו ב-RentalManagement)
  const calculateDailyRate = (days) => {
    if (days > 10) return 800
    if (days > 5) return 1000
    return 1200
  }

  useEffect(() => {
    if (initialData) {
      const formattedData = {
        ...initialData,
        startDate: initialData.startDate.split('T')[0],
        endDate: initialData.endDate.split('T')[0],
        whatsappCountryCode: initialData.whatsappCountryCode || '+66',
        whatsappNumber: initialData.whatsappNumber || '',
        startTime: initialData.startTime || '09:00',
        endTime: initialData.endTime || '18:00',
        isReservation: initialData.status === 'pending'
      }
      setFormData(formattedData)
      setOriginalEndDate(formattedData.endDate)
    }
  }, [initialData])

  // 🔥 NEW: עדכון אוטומטי של מחיר יומי כאשר התאריכים משתנים
  useEffect(() => {
    if (formData.startDate && formData.endDate) {
      const startDate = new Date(formData.startDate)
      const endDate = new Date(formData.endDate)
      const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24))
      
      if (days > 0) {
        const calculatedRate = calculateDailyRate(days)
        
        // עדכן רק אם זה לא במצב עריכה או אם המחיר השתנה
        if (!isEditing || formData.dailyRate !== calculatedRate) {
          setFormData(prev => ({
            ...prev,
            dailyRate: calculatedRate
          }))
        }
      }
    }
  }, [formData.startDate, formData.endDate, isEditing])

  // פילטור אופנועים זמינים לפי תאריכים - לכל סוגי ההזמנות
  useEffect(() => {
    if (formData.startDate && formData.endDate) {
      filterAvailableScooters()
    } else if (!formData.startDate && !formData.endDate) {
      // אם אין תאריכים, הצג את כל הקטנועים
      setFilteredScooters(availableScooters || [])
    }
  }, [formData.startDate, formData.endDate, availableScooters, isEditing])

  const filterAvailableScooters = async () => {
    if (!formData.startDate || !formData.endDate) {
      setFilteredScooters([])
      return
    }

    setIsLoadingScooters(true)
    try {
      // מביא את כל הרנטלים והאופנועים
      const { getRentals, getScooters } = await import('../../lib/database')
      const [allRentals, allScooters] = await Promise.all([
        getRentals(),
        getScooters()
      ])
      
      const requestedStartDate = new Date(formData.startDate)
      const requestedEndDate = new Date(formData.endDate)
      
      console.log('=== Checking availability by DATES (FIXED) ===')
      console.log('Requested period:', {
        start: requestedStartDate.toDateString(),
        end: requestedEndDate.toDateString()
      })
      
      // מוצא אופנועים שתפוסים בתקופה הנבחרת (רק בדיקת תאריכים)
      const occupiedScooterIds = new Set()
      
      allRentals.forEach(rental => {
        // דילוג על הרנטל הנוכחי במצב עריכה
        if (isEditing && initialData && rental.id === initialData.id) {
          return
        }
        
        // בודק רק השכרות פעילות ומוזמנות (לא completed)
        if (rental.status === 'active' || rental.status === 'pending') {
          const rentalStartDate = new Date(rental.startDate)
          const rentalEndDate = new Date(rental.endDate)
          
          console.log(`Checking rental ${rental.orderNumber}:`, {
            scooter: rental.scooterLicense,
            status: rental.status,
            period: `${rentalStartDate.toDateString()} - ${rentalEndDate.toDateString()}`
          })
          
          // בדיקת חפיפה בתאריכים בלבד
          const hasDateConflict = (
            requestedStartDate < rentalEndDate && 
            requestedEndDate > rentalStartDate
          )
          
          if (hasDateConflict) {
            console.log(`❌ DATE Conflict found for scooter ${rental.scooterLicense} (${rental.status})`)
            occupiedScooterIds.add(rental.scooterId)
          } else {
            console.log(`✅ No date conflict for scooter ${rental.scooterLicense}`)
          }
        }
      })
      
      // כעת נבדק איזה אופנועים זמינים - רק לפי תאריכים!
      const availableScooters = allScooters.filter(scooter => {
        // במצב עריכה - האופנוע הנוכחי תמיד זמין לבחירה
        const isCurrentScooter = isEditing && initialData && scooter.id === initialData.scooterId
        
        // בדיקה שהאופנוע לא תפוס בתאריכים הנבחרים
        const isNotOccupiedInDates = !occupiedScooterIds.has(scooter.id)
        
        // אופנוע זמין אם:
        // 1. זה האופנוע הנוכחי (במצב עריכה) OR
        // 2. אין לו חפיפה בתאריכים עם השכרות אחרות AND הוא לא במצב maintenance
        return isCurrentScooter || (isNotOccupiedInDates && scooter.status !== 'maintenance')
      })
      
      console.log('Available scooters (by dates):', availableScooters.map(s => `${s.licensePlate} (${s.status})`))
      console.log('Occupied by dates:', Array.from(occupiedScooterIds))
      
      setFilteredScooters(availableScooters)
      
      // במצב עריכה, וודא שהאופנוע הנוכחי נבחר
      if (isEditing && initialData && !formData.scooterId) {
        setFormData(prev => ({ ...prev, scooterId: initialData.scooterId }))
      }
      
    } catch (error) {
      console.error('Error filtering scooters:', error)
      setFilteredScooters(availableScooters || [])
    } finally {
      setIsLoadingScooters(false)
    }
  }

  // עדכון תאריך סיום אוטומטי (מינימום יום אחד) + בדיקה אוטומטית לhazמנה עתידית
  // Helper function to check if a date is Sunday
  const isSunday = (dateString) => {
    if (!dateString) return false
    const date = new Date(dateString)
    return date.getDay() === 0 // 0 is Sunday
  }

  const handleStartDateChange = (newStartDate) => {
    setFormData(prev => {
      const updated = { ...prev, startDate: newStartDate }
      
      // אם אין תאריך סיום או שהוא קודם לתאריך התחלה, קבע אותו ליום אחרי
      if (!prev.endDate || new Date(prev.endDate) <= new Date(newStartDate)) {
        const nextDay = new Date(newStartDate)
        nextDay.setDate(nextDay.getDate() + 1)
        updated.endDate = nextDay.toISOString().split('T')[0]
      }
      
      // בדיקה אוטומטית אם זו הזמנה עתידית
      const today = new Date().toISOString().split('T')[0]
      const isFutureDate = newStartDate > today
      
      // אם התאריך עתידי - הפוך להזמנה עתידית אוטומטית
      if (isFutureDate && !isEditing) {
        updated.isReservation = true
      }
      // אם התאריך היום או אתמול - הפוך להשכרה מיידית
      else if (!isFutureDate && !isEditing) {
        updated.isReservation = false
      }
      
      return updated
    })
  }

  // עדכון בחירת האופנוע כולל פרטיו
  const handleScooterChange = (scooterId) => {
    const selectedScooter = filteredScooters.find(s => s.id === scooterId)
    setFormData(prev => ({
      ...prev,
      scooterId,
      scooterLicense: selectedScooter?.licensePlate || '',
      scooterColor: selectedScooter?.color || ''
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!validateForm()) return

    try {
      setIsSubmitting(true)
      await onSubmit({
        ...formData,
        status: formData.isReservation ? 'pending' : 'active',
        requiresAgreement: !formData.isReservation // רק השכרות פעילות דורשות חוזה
      })
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

  // Customer lookup function
  const lookupCustomerByPassport = async (passportNumber) => {
    if (!passportNumber.trim()) return

    try {
      setIsLookingUpCustomer(true)
      setCustomerLookupStatus('')
      
      const customer = await getCustomerByPassport(passportNumber.trim())
      
      if (customer) {
        // Auto-fill customer details
        setFormData(prev => ({
          ...prev,
          customerName: customer.name,
          whatsappCountryCode: customer.whatsapp_country_code,
          whatsappNumber: customer.whatsapp_number
        }))
        setCustomerLookupStatus('Customer found and details auto-filled!')
      } else {
        setCustomerLookupStatus('Customer not found. Please enter details manually.')
      }
    } catch (error) {
      console.error('Error looking up customer:', error)
      setCustomerLookupStatus('Error looking up customer. Please enter details manually.')
    } finally {
      setIsLookingUpCustomer(false)
    }
  }

  // Handle passport number change with debounced lookup
  const handlePassportNumberChange = (value) => {
    setFormData(prev => ({ ...prev, passportNumber: value }))
    
    // Clear previous status
    setCustomerLookupStatus('')
    
    // Debounce the lookup
    const timeoutId = setTimeout(() => {
      if (value.trim().length >= 3) {
        lookupCustomerByPassport(value)
      }
    }, 1000)

    return () => clearTimeout(timeoutId)
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

    // תמיד נדרש לבחור אופנוע
    if (!formData.scooterId) {
      newErrors.scooterId = 'Please select a scooter'
    }
    
    // רק השכרות פעילות דורשות חתימה על חוזה
    if (!formData.isReservation && !formData.hasSignedAgreement) {
      newErrors.agreement = 'Customer must sign the rental agreement'
    }

    if (!formData.customerName.trim()) {
      newErrors.customerName = 'Customer name is required'
    }

    if (!formData.passportNumber.trim()) {
      newErrors.passportNumber = 'Passport number is required'
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
    } else {
      const startDate = new Date(formData.startDate)
      const endDate = new Date(formData.endDate)
      if (endDate <= startDate) {
        newErrors.endDate = 'End date must be after start date'
      }
    }

    // אזהרה על השכרה מיידית לתאריך עתידי
    if (!isEditing && !formData.isReservation && formData.startDate) {
      const today = new Date().toISOString().split('T')[0]
      const isFutureDate = formData.startDate > today
      
      if (isFutureDate) {
        newErrors.futureImmediate = 'Future dates should be reservations, not immediate rentals. Please switch to "Future Reservation" or choose today\'s date.'
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

    // 🔥 UPDATED: השתמש במחיר שכבר מחושב בטופס
    const calculatedDailyRate = calculateDailyRate(days)
    const actualDailyRate = formData.dailyRate
    const totalAmount = days * actualDailyRate
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
      dailyRate: actualDailyRate,
      calculatedRate: calculatedDailyRate,
      originalAmount: originalAmount,
      discountedAmount: totalAmount,
      discount: discount > 0 ? discount : 0,
      deposit: formData.deposit,
      hasAutoDiscount: actualDailyRate < 1200
    }
  }

  const rentalDetails = calculateRentalDetails()

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-4 sm:p-8 w-full max-w-4xl max-h-[95vh] overflow-y-auto shadow-2xl relative z-60">
        <div className="flex justify-between items-center mb-4 sm:mb-6">
          <div>
            <h3 className="text-lg sm:text-xl font-medium">
              {isEditing ? 'Edit Rental' : formData.isReservation ? 'New Reservation' : 'New Rental'}
            </h3>
            {formData.isReservation && (
              <p className="text-sm text-blue-600 mt-1 flex items-center">
                <Calendar className="w-4 h-4 mr-1" />
                Future reservation - no agreement required yet
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl sm:hidden"
          >
            ×
          </button>
        </div>
        
        {isEditing && initialData && (
          <div className="text-sm text-gray-500 mb-4">
            Order #: {initialData.orderNumber}
          </div>
        )}

        {/* Automatic Future Reservation Detection */}
        {!isEditing && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="text-sm font-medium text-gray-700 mb-3">
              Booking Type 
              {formData.startDate && (
                <span className="ml-2 text-xs text-gray-500">
                  (Auto-detected based on start date)
                </span>
              )}
            </h4>
            <div className="space-y-2">
              {/* Current automatic selection */}
              <div className={`p-3 rounded-lg border-2 ${
                formData.isReservation 
                  ? 'border-blue-300 bg-blue-50' 
                  : 'border-green-300 bg-green-50'
              }`}>
                <div className="flex items-center">
                  {formData.isReservation ? (
                    <Calendar className="w-4 h-4 mr-2 text-blue-600" />
                  ) : (
                    <Clock className="w-4 h-4 mr-2 text-green-600" />
                  )}
                  <span className="text-sm font-medium">
                    {formData.isReservation ? 'Future Reservation' : 'Immediate Rental'}
                  </span>
                  {formData.startDate && (
                    <span className="ml-2 text-xs text-gray-500">
                      (Start date: {new Date(formData.startDate).toLocaleDateString()})
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-600 mt-1 ml-6">
                  {formData.isReservation 
                    ? 'Future dates automatically create reservations - no agreement needed until activation'
                    : 'Today/past dates create immediate rentals - requires signed agreement'
                  }
                </p>
              </div>
              
              {/* Manual override option */}
              <div className="pt-2 border-t border-gray-200">
                <p className="text-xs text-gray-500 mb-2">Manual override (if needed):</p>
                <div className="flex space-x-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="bookingType"
                      checked={!formData.isReservation}
                      onChange={() => setFormData(prev => ({ ...prev, isReservation: false }))}
                      className="mr-2"
                    />
                    <div className="flex items-center">
                      <Clock className="w-4 h-4 mr-1 text-green-600" />
                      <span className="text-sm">Immediate Rental</span>
                    </div>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="bookingType"
                      checked={formData.isReservation}
                      onChange={() => setFormData(prev => ({ ...prev, isReservation: true }))}
                      className="mr-2"
                    />
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 mr-1 text-blue-600" />
                      <span className="text-sm">Future Reservation</span>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}        
        
        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* תאריכים - קודם כל */}
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
              {isSunday(formData.startDate) && (
                <p className="mt-1 text-sm text-yellow-600 flex items-center">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  Note: Start date is a Sunday
                </p>
              )}
            </div>
  
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date *</label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className={`mt-1 block w-full rounded-md shadow-sm text-base px-3 py-2 ${errors.endDate ? 'border-red-300' : 'border-gray-300'}`}
                min={formData.startDate}
                required
              />
              {errors.endDate && (
                <p className="mt-1 text-sm text-red-600">{errors.endDate}</p>
              )}
              {isSunday(formData.endDate) && (
                <p className="mt-1 text-sm text-yellow-600 flex items-center">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  Note: End date is a Sunday
                </p>
              )}
            </div>

            {/* Scooter Selection - תמיד מוצג, גם בעריכה */}
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Scooter *
                {isLoadingScooters && (
                  <span className="ml-2 text-xs text-blue-600">Checking availability...</span>
                )}
              </label>
              <select
                value={formData.scooterId}
                onChange={(e) => handleScooterChange(e.target.value)}
                className={`mt-1 block w-full rounded-md shadow-sm text-base px-3 py-2 ${errors.scooterId ? 'border-red-300' : 'border-gray-300'}`}
                required
                disabled={!formData.startDate || !formData.endDate || isLoadingScooters}
              >
                <option value="">
                  {!formData.startDate || !formData.endDate 
                    ? 'Please select dates first' 
                    : isLoadingScooters 
                    ? 'Checking availability...'
                    : 'Select a scooter'
                  }
                </option>
                {filteredScooters?.map(scooter => (
                  <option key={scooter.id} value={scooter.id}>
                    {scooter.licensePlate} - {scooter.color}
                    {isEditing && initialData && scooter.id === initialData.scooterId ? ' (Current)' : ''}
                  </option>
                ))}
              </select>
              {errors.scooterId && (
                <p className="mt-1 text-sm text-red-600">{errors.scooterId}</p>
              )}
              {formData.startDate && formData.endDate && !isLoadingScooters && filteredScooters.length === 0 && (
                <p className="mt-1 text-sm text-orange-600">No scooters available for the selected dates</p>
              )}
              {formData.startDate && formData.endDate && !isLoadingScooters && filteredScooters.length > 0 && (
                <p className="mt-1 text-sm text-green-600">{filteredScooters.length} scooter(s) available for these dates</p>
              )}
            </div>
  
            {/* Customer Details - כל השדות ניתנים לעריכה */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name *</label>
              <input
                type="text"
                value={formData.customerName}
                onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                className={`mt-1 block w-full rounded-md shadow-sm text-base px-3 py-2 ${errors.customerName ? 'border-red-300' : 'border-gray-300'}`}
                required
              />
              {errors.customerName && (
                <p className="mt-1 text-sm text-red-600">{errors.customerName}</p>
              )}
            </div>
  
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <User className="w-4 h-4 inline mr-1" />
                Passport Number *
                {isLookingUpCustomer && (
                  <span className="ml-2 text-xs text-blue-600">Looking up customer...</span>
                )}
                {isEditing && (
                  <span className="ml-2 text-xs text-gray-500">(Change to look up another customer)</span>
                )}
              </label>
              <input
                type="text"
                value={formData.passportNumber}
                onChange={(e) => handlePassportNumberChange(e.target.value)}
                className={`mt-1 block w-full rounded-md shadow-sm text-base px-3 py-2 ${errors.passportNumber ? 'border-red-300' : 'border-gray-300'}`}
                placeholder="Enter passport number to auto-fill customer details"
                required
              />
              {errors.passportNumber && (
                <p className="mt-1 text-sm text-red-600">{errors.passportNumber}</p>
              )}
              {customerLookupStatus && (
                <p className={`mt-1 text-sm ${
                  customerLookupStatus.includes('found') ? 'text-green-600' : 'text-orange-600'
                }`}>
                  {customerLookupStatus}
                </p>
              )}
            </div>

            {/* WhatsApp Number */}
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp Number *</label>
              <div className="flex space-x-2">
                <select
                  value={formData.whatsappCountryCode}
                  onChange={(e) => setFormData({ ...formData, whatsappCountryCode: e.target.value })}
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
                  onChange={(e) => setFormData({ ...formData, whatsappNumber: e.target.value })}
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
  
            {/* Daily Rate */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Daily Rate (฿)
                {rentalDetails && rentalDetails.hasAutoDiscount && (
                  <span className="ml-2 text-xs text-green-600">
                    (Auto-discount applied)
                  </span>
                )}
              </label>
              <input
                type="number"
                value={formData.dailyRate}
                onChange={(e) => setFormData({ ...formData, dailyRate: Number(e.target.value) })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm text-base px-3 py-2"
                required
              />
              {rentalDetails && rentalDetails.calculatedRate !== formData.dailyRate && (
                <p className="mt-1 text-xs text-blue-600">
                  Suggested rate for {rentalDetails.days} days: ฿{rentalDetails.calculatedRate}
                </p>
              )}
            </div>

            {/* Deposit - רק בהוספה חדשה ושלא reservation */}
            {!isEditing && !formData.isReservation && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Deposit Amount (฿)</label>
                <input
                  type="number"
                  value={formData.deposit}
                  onChange={(e) => setFormData({ ...formData, deposit: Number(e.target.value) })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm text-base px-3 py-2"
                  required
                />
              </div>
            )}

            {/* שעות */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pickup Time</label>
              <select
                value={formData.startTime}
                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm text-base px-3 py-2"
                required
              >
                {timeOptions.map(time => (
                  <option key={time} value={time}>{time}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Return Time</label>
              <select
                value={formData.endTime}
                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm text-base px-3 py-2"
                required
              >
                {timeOptions.map(time => (
                  <option key={time} value={time}>{time}</option>
                ))}
              </select>
            </div>
          </div>
  
          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm text-base px-3 py-2"
            />
          </div>
  
          {/* Agreement Checkbox - רק בהשכרה מיידית */}
          {!formData.isReservation && (
            <div className="mt-4">
              <div className="flex items-start">
                <div className="flex items-center h-5">
                  <input
                    id="agreement"
                    name="agreement"
                    type="checkbox"
                    checked={formData.hasSignedAgreement}
                    onChange={handleAgreementCheck}
                    className={`focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded ${errors.agreement ? 'border-red-300' : ''}`}
                  />
                </div>
                <div className="ml-3">
                  <label htmlFor="agreement" className="font-medium text-gray-700 text-sm sm:text-base">
                    Signed rental agreement & passport copy attached
                  </label>
                  {errors.agreement && (
                    <p className="mt-1 text-sm text-red-600">{errors.agreement}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Info about reservation */}
          {formData.isReservation && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <Calendar className="w-4 h-4 inline mr-1" />
                This reservation will block the scooter only for the selected dates. Agreement signing and passport copy will be required when activating the rental.
              </p>
            </div>
          )}
  
          {/* Rental Summary */}
          {rentalDetails && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">
                {formData.isReservation ? 'Reservation' : 'Rental'} Summary
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Duration:</span>
                  <span className="font-medium">{rentalDetails.days} days</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Pickup Time:</span>
                  <span className="font-medium">{formData.startTime}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Return Time:</span>
                  <span className="font-medium">{formData.endTime}</span>
                </div>
                {isEditing && rentalDetails.daysExtended !== 0 && (
                  <div className="flex justify-between text-blue-600">
                    <span>Extended by:</span>
                    <span className="font-medium">{rentalDetails.daysExtended} days</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-600">Base Daily Rate:</span>
                  <span>฿1,200</span>
                </div>
                <div className="flex justify-between text-green-600">
                  <span>Your Daily Rate:</span>
                  <span className="font-medium">
                    ฿{rentalDetails.dailyRate.toLocaleString()} 
                    {rentalDetails.hasAutoDiscount && " (Auto-discount)"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Original Amount:</span>
                  <span>฿{rentalDetails.originalAmount.toLocaleString()}</span>
                </div>
                {rentalDetails.discount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Total Discount:</span>
                    <span className="font-medium">-฿{rentalDetails.discount.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-medium text-gray-900 pt-2 border-t border-gray-200">
                  <span>{formData.isReservation ? 'Reservation' : 'Rental'} Total:</span>
                  <span>฿{rentalDetails.discountedAmount.toLocaleString()}</span>
                </div>
                {!isEditing && !formData.isReservation && (
                  <div className="flex justify-between mt-2 text-gray-600 border-t border-gray-200 pt-2">
                    <span>Deposit (separate):</span>
                    <span className="font-medium">฿{rentalDetails.deposit.toLocaleString()}</span>
                  </div>
                )}
                {formData.isReservation && (
                  <div className="mt-2 text-blue-600 text-center text-xs">
                    * Deposit will be collected when rental is activated
                  </div>
                )}
                {rentalDetails.days > 5 && (
                  <div className="mt-2 text-blue-600 text-center">
                    * Long-term rental discount applied
                  </div>
                )}
              </div>
            </div>
          )}

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

          {/* Future Date Warning */}
          {errors.futureImmediate && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
              <div className="flex">
                <AlertCircle className="h-5 w-5 text-yellow-400" />
                <div className="ml-3">
                  <p className="text-sm text-yellow-700">{errors.futureImmediate}</p>
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
              disabled={isSubmitting || (!formData.scooterId || (!formData.isReservation && !formData.hasSignedAgreement))}
              className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Saving...' : isEditing ? 'Save Changes' : formData.isReservation ? 'Create Reservation' : 'Create Rental'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default RentalForm