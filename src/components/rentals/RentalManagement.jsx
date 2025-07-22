import { useEffect, useState } from 'react'
import { PlusCircle, CheckCircle, XCircle, PencilIcon, Trash2Icon, Calendar, Clock, PlayCircle } from 'lucide-react'
import RentalForm from '../rentals/RentalForm'
import { getRentals, addRental, updateRental, deleteRental, getScooters, updateScooter } from '../../lib/database'

const RentalManagement = ({ onUpdate }) => {
  const [rentals, setRentals] = useState([])
  const [allScooters, setAllScooters] = useState([]) // שינוי: כל האופנועים במקום רק הזמינים
  const [showForm, setShowForm] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('active')
  const [editingRental, setEditingRental] = useState(null)
  const [reservationMode, setReservationMode] = useState(false)

  // פונקציה לחישוב מחיר יומי לפי כמות ימים
  const calculateDailyRate = (days) => {
    if (days > 10) return 800
    if (days > 5) return 1000
    return 1200
  }

  // פונקציה לחישוב פרטי השכרה כולל הנחות
  const calculateRentalPricing = (rental) => {
    const startDate = new Date(rental.startDate)
    const endDate = new Date(rental.endDate)
    const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24))
    
    if (days <= 0) return {
      days: 0,
      originalDailyRate: 1200,
      calculatedDailyRate: rental.dailyRate || 1200,
      actualDailyRate: rental.dailyRate || 1200,
      originalTotal: 0,
      actualTotal: 0,
      hasDiscount: false,
      discount: 0
    }

    // המחיר המקורי (בסיס)
    const originalDailyRate = 1200
    const originalTotal = days * originalDailyRate
    
    // המחיר המחושב לפי כמות הימים
    const calculatedDailyRate = calculateDailyRate(days)
    
    // המחיר בפועל (מה שנשמר בדאטבייס)
    const actualDailyRate = rental.dailyRate || calculatedDailyRate
    const actualTotal = days * actualDailyRate
    
    // בדיקה אם יש הנחה
    const hasDiscount = actualDailyRate < originalDailyRate
    const discount = originalTotal - actualTotal

    return {
      days,
      originalDailyRate,
      calculatedDailyRate,
      actualDailyRate,
      originalTotal,
      actualTotal,
      hasDiscount,
      discount
    }
  }

  const fetchRentals = async () => {
    try {
      const data = await getRentals()
      setRentals(data || [])
      setError(null)
    } catch (error) {
      console.error('Error fetching rentals:', error)
      setError('Failed to load rentals')
    }
  }

  // שינוי: מביא את כל האופנועים במקום רק הזמינים
  const fetchAllScooters = async () => {
    try {
      const scooters = await getScooters()
      setAllScooters(scooters || [])
      setError(null)
    } catch (error) {
      console.error('Error fetching scooters:', error)
      setError('Failed to load scooters')
    }
  }

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)
      await Promise.all([fetchRentals(), fetchAllScooters()])
      setIsLoading(false)
    }
    loadData()
  }, [])
  
  // 🔥 NEW: עדכון סטטוס כל האופנועים אחרי טעינת הנתונים
  useEffect(() => {
    if (allScooters.length > 0 && rentals.length >= 0) {
      console.log('Data loaded, updating all scooters status...')
      updateAllScootersStatus()
    }
  }, [allScooters.length, rentals.length])

  const updateAllScootersStatus = async () => {
    try {
      console.log('=== Updating all scooters status ===')
      
      for (const scooter of allScooters) {
        await updateScooterStatusSmart(scooter.id)
      }
      
      console.log('=== Finished updating all scooters status ===')
    } catch (error) {
      console.error('Error updating all scooters status:', error)
    }
  }

  // פונקציה לעדכון חכם של סטטוס אופנוע לפי תאריכי השכרות
  const updateScooterStatusSmart = async (scooterId) => {
    try {
      const scooter = allScooters.find(s => s.id === scooterId)
      if (!scooter) return

      // מצא את כל ההשכרות של האופנוע הזה
      const scooterRentals = rentals.filter(r => 
        r.scooterId === scooterId && 
        (r.status === 'active' || r.status === 'pending')
      )

      const today = new Date()
      today.setHours(0, 0, 0, 0)

      // 🔥 FIX: בדוק אם יש השכרה פעילה שכוללת את היום הנוכחי
      const currentRental = scooterRentals.find(r => {
        const startDate = new Date(r.startDate)
        const endDate = new Date(r.endDate)
        startDate.setHours(0, 0, 0, 0)
        endDate.setHours(23, 59, 59, 999)
        
        // 🔥 FIX: השכרה פעילה אם היום בין תאריך ההתחלה והסיום
        const isActivePeriod = today >= startDate && today <= endDate
        const isActiveStatus = r.status === 'active'
        
        return isActivePeriod && isActiveStatus
      })

      let newStatus = 'available'
      let lastRentalId = null

      if (currentRental) {
        newStatus = 'rented'
        lastRentalId = currentRental.id
        console.log(`Scooter ${scooter.licensePlate} set to RENTED due to active rental:`, currentRental.orderNumber)
      } else {
        // 🔥 FIX: בדוק אם יש השכרות עתידיות (pending) שמתחילות בעתיד
        const futureRentals = scooterRentals.filter(r => {
          const startDate = new Date(r.startDate)
          startDate.setHours(0, 0, 0, 0)
          return startDate > today && r.status === 'pending'
        })
        
        if (futureRentals.length > 0) {
          newStatus = 'available' // זמין עד להשכרה עתידית
          console.log(`Scooter ${scooter.licensePlate} set to AVAILABLE (has future reservations)`)
        } else {
          newStatus = 'available'
          console.log(`Scooter ${scooter.licensePlate} set to AVAILABLE (no active rentals)`)
        }
      }

      // עדכן את הסטטוס רק אם השתנה
      if (scooter.status !== newStatus) {
        console.log(`Updating scooter ${scooter.licensePlate} status from ${scooter.status} to ${newStatus}`)
        
        await updateScooter({
          ...scooter,
          status: newStatus,
          lastRentalId
        })
        
        // עדכן גם את המערך המקומי
        setAllScooters(prev => prev.map(s => 
          s.id === scooterId 
            ? { ...s, status: newStatus, lastRentalId }
            : s
        ))
      } else {
        console.log(`Scooter ${scooter.licensePlate} status unchanged: ${newStatus}`)
      }
    } catch (error) {
      console.error('Error updating scooter status:', error)
    }
  }

  const handleCreateRental = async (formData) => {
    try {
      // מציאת הקטנוע הנבחר
      const selectedScooter = allScooters.find(s => s.id === formData.scooterId)
      if (!selectedScooter) {
        throw new Error('Selected scooter not found')
      }
      
      // יצירת השכרה חדשה עם כל השדות החדשים
      const newRental = await addRental({
        ...formData,
        scooterLicense: selectedScooter.licensePlate,
        scooterColor: selectedScooter.color,
        createdAt: new Date().toISOString(),
        status: formData.status || (formData.isReservation ? 'pending' : 'active')
      })
  
      setRentals(prev => [...prev, newRental])
      
      // עדכון חכם של סטטוס האופנוע
      await updateScooterStatusSmart(selectedScooter.id)
      await fetchAllScooters()
      
      setShowForm(false)
      setReservationMode(false)
      onUpdate?.()
    } catch (error) {
      console.error('Error creating rental:', error)
      setError('Failed to create rental')
    }
  }

  const handleEditRental = async (formData) => {
    try {
      const originalRental = editingRental
      
      // בדיקה אם השתנה האופנוע
      const scooterChanged = originalRental.scooterId !== formData.scooterId
      
      console.log('=== Edit Rental Debug ===')
      console.log('Original scooter ID:', originalRental.scooterId)
      console.log('New scooter ID:', formData.scooterId)
      console.log('Scooter changed:', scooterChanged)
      
      // עדכון ההשכרה עם כל הנתונים החדשים
      const updatedRental = await updateRental({
        ...originalRental,
        ...formData,
        updatedAt: new Date().toISOString()
      })
      
      console.log('Updated rental:', updatedRental)
      
      setRentals(prev => prev.map(r => r.id === updatedRental.id ? updatedRental : r))
      
      // עדכון חכם של סטטוס האופנועים הרלוונטיים
      if (scooterChanged) {
        // עדכן את שני האופנועים
        await updateScooterStatusSmart(originalRental.scooterId)
        await updateScooterStatusSmart(formData.scooterId)
      } else {
        // עדכן רק את האופנוע הנוכחי
        await updateScooterStatusSmart(formData.scooterId)
      }
      
      await fetchAllScooters()
      setShowForm(false)
      setEditingRental(null)
      onUpdate?.()
    } catch (error) {
      console.error('Error updating rental:', error)
      setError('Failed to update rental: ' + error.message)
    }
  }

  const handleEdit = (rental) => {
    setEditingRental(rental)
    setReservationMode(rental.status === 'pending')
    setShowForm(true)
  }

  // פונקציה חדשה להפעלת הזמנה עתידית
  const handleActivateReservation = async (rental) => {
    if (window.confirm(`Activate reservation #${rental.orderNumber}? This will require agreement signing.`)) {
      try {
        // עדכון ההזמנה לפעילה
        const updatedRental = await updateRental({
          ...rental,
          status: 'active',
          activatedAt: new Date().toISOString()
        })
        
        setRentals(prev => prev.map(r => r.id === updatedRental.id ? updatedRental : r))
        
        // עדכון חכם של סטטוס האופנוע
        await updateScooterStatusSmart(rental.scooterId)
        await fetchAllScooters()
        
        onUpdate?.()
        
        alert(`Reservation #${rental.orderNumber} has been activated! Don't forget to:\n• Get signed rental agreement\n• Take passport copy\n• Collect deposit`)
        
      } catch (error) {
        console.error('Error activating reservation:', error)
        setError('Failed to activate reservation')
      }
    }
  }

  const handleCompleteRental = async (rental) => {
    try {
      // עדכון השכרה
      const updatedRental = await updateRental({
        ...rental,
        status: 'completed',
        completedAt: new Date().toISOString()
      })
      
      setRentals(prev => prev.map(r => r.id === updatedRental.id ? updatedRental : r))
      
      // עדכון חכם של סטטוס האופנוע
      await updateScooterStatusSmart(rental.scooterId)
      await fetchAllScooters()
      
      onUpdate?.()
    } catch (error) {
      console.error('Error completing rental:', error)
      setError('Failed to complete rental')
    }
  }

  const handleDeleteRental = async (rental) => {
    if (window.confirm(`Are you sure you want to delete rental #${rental.orderNumber}?`)) {
      try {
        await deleteRental(rental.id)
        
        // עדכון הממשק
        setRentals(prev => prev.filter(r => r.id !== rental.id))
        
        // עדכון חכם של סטטוס האופנוע
        await updateScooterStatusSmart(rental.scooterId)
        await fetchAllScooters()
        
        onUpdate?.()
      } catch (error) {
        console.error('Error deleting rental:', error)
        setError('Failed to delete rental')
      }
    }
  }

  const handleUpdatePaymentStatus = async (rental) => {
    try {
      const updatedRental = await updateRental({
        ...rental,
        paid: !rental.paid,
        paidAt: !rental.paid ? new Date().toISOString() : null
      })
      
      setRentals(prev => prev.map(r => r.id === rental.id ? updatedRental : r))
      setError(null)
      onUpdate?.()
    } catch (error) {
      console.error('Error updating payment status:', error)
      setError('Failed to update payment status')
    }
  }

  const calculateStatistics = () => {
    const pendingReservations = rentals.filter(r => r.status === 'pending').length
    const activeRentals = rentals.filter(r => r.status === 'active').length
    const completedRentals = rentals.filter(r => r.status === 'completed').length
    const overdueRentals = rentals.filter(r => {
      if (r.status === 'active') {
        const endDate = new Date(r.endDate)
        return endDate < new Date()
      }
      return false
    }).length

    return {
      pendingReservations,
      activeRentals,
      completedRentals,
      overdueRentals
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800'
      case 'completed':
        return 'bg-blue-100 text-blue-800'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'overdue':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  // Calculate statistics - moved BEFORE it's used
  const stats = calculateStatistics()

  // Filter rentals by active tab - עם מיון לפי תאריך
  const filteredRentals = rentals
    .filter(rental => {
      if (activeTab === 'pending') {
        return rental.status === 'pending'
      } else if (activeTab === 'active') {
        return rental.status === 'active'
      }
      return rental.status === 'completed'
    })
    .sort((a, b) => {
      // מיון לפי תאריך תחילת ההשכרה
      if (activeTab === 'pending') {
        // עבור הזמנות עתידיות - מהקרוב ביותר לרחוק ביותר
        return new Date(a.startDate) - new Date(b.startDate)
      } else if (activeTab === 'active') {
        // עבור השכרות פעילות - מהקרוב ביותר לסיום (לפי endDate)
        return new Date(a.endDate) - new Date(b.endDate)
      } else {
        // עבור השכרות שהושלמו - מהאחרון ביותר לראשון (לפי completedAt או createdAt)
        const aDate = new Date(a.completedAt || a.createdAt)
        const bDate = new Date(b.completedAt || b.createdAt)
        return bDate - aDate
      }
    })

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <XCircle className="h-5 w-5 text-red-400" />
          </div>
          <div className="ml-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      {/* Statistics Dashboard */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Active Rentals</h3>
          <p className="text-2xl font-semibold text-green-600">{stats.activeRentals}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Pending Reservations</h3>
          <p className="text-2xl font-semibold text-blue-600">{stats.pendingReservations}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Completed Rentals</h3>
          <p className="text-2xl font-semibold text-gray-900">{stats.completedRentals}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Overdue Rentals</h3>
          <p className="text-2xl font-semibold text-red-600">{stats.overdueRentals}</p>
        </div>
      </div>

      {/* Header with Tabs and Add Button */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 border-b border-gray-200 pb-4">
        <div className="flex space-x-4 overflow-x-auto">
          <button
            onClick={() => setActiveTab('active')}
            className={`py-2 px-4 border-b-2 whitespace-nowrap ${
              activeTab === 'active'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Clock className="h-4 w-4 inline mr-1" />
            Active Rentals ({stats.activeRentals})
          </button>
          <button
            onClick={() => setActiveTab('pending')}
            className={`py-2 px-4 border-b-2 whitespace-nowrap ${
              activeTab === 'pending'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Calendar className="h-4 w-4 inline mr-1" />
            Pending Reservations ({stats.pendingReservations})
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={`py-2 px-4 border-b-2 whitespace-nowrap ${
              activeTab === 'completed'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <CheckCircle className="h-4 w-4 inline mr-1" />
            Completed Rentals ({stats.completedRentals})
          </button>
        </div>
        
        <div className="flex items-center space-x-2">
        <button
    onClick={updateAllScootersStatus}
    className="inline-flex items-center justify-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
    title="Update all scooter statuses"
  >
    🔄 Sync Status
          </button>
          <button
            onClick={() => {
              setEditingRental(null)
              setReservationMode(false) // השאר false - הטופס יחליט אוטומטית
              setShowForm(true)
            }}
            className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <PlusCircle className="h-4 w-4 mr-2" />
            New Booking
          </button>
        </div>
      </div>

      {/* Rentals Display */}
      {filteredRentals.length === 0 ? (
        <div className="bg-white shadow overflow-hidden sm:rounded-lg p-6">
          <div className="text-center text-gray-500">
            {activeTab === 'pending' ? 'No pending reservations found.' : 
             activeTab === 'active' ? 'No active rentals found.' : 
             'No completed rentals found.'}
          </div>
        </div>
      ) : (
        <>
          {/* Desktop Table - Hidden on mobile */}
          <div className="hidden lg:block bg-white shadow overflow-hidden sm:rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Order #
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Scooter
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Customer
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contact
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Dates & Times
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rental Amount
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Payment
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredRentals.map((rental) => {
                  const isOverdue = new Date(rental.endDate) < new Date() && rental.status === 'active'
                  const displayStatus = isOverdue ? 'overdue' : rental.status
                  
                  // תיקון: שימוש בפונקציה החדשה לחישוב מחירים
                  const pricing = calculateRentalPricing(rental)

                  return (
                    <tr key={rental.id}>
                      {/* Order Number */}
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {rental.orderNumber}
                      </td>
                      
                      {/* Scooter */}
                      <td className="px-4 py-4 whitespace-nowrap text-sm">
                        <div className="font-medium text-gray-900">{rental.scooterLicense}</div>
                        <div className="text-xs text-gray-500">{rental.scooterColor}</div>
                      </td>
                      
                      {/* Customer */}
                      <td className="px-4 py-4 text-sm">
                        <div className="font-medium text-gray-900">{rental.customerName}</div>
                        <div className="text-xs text-gray-500">{rental.passportNumber}</div>
                      </td>
                      
                      {/* Contact (WhatsApp) */}
                      <td className="px-4 py-4 text-sm">
                        {rental.whatsappNumber ? (
                          <>
                            <div className="text-xs text-gray-900">
                              {rental.whatsappCountryCode} {rental.whatsappNumber}
                            </div>
                            <div className="text-xs text-gray-500">WhatsApp</div>
                          </>
                        ) : (
                          <div className="text-xs text-gray-400">No WhatsApp</div>
                        )}
                      </td>
                      
                      {/* Dates & Times */}
                      <td className="px-4 py-4 text-sm">
                        <div>{new Date(rental.startDate).toLocaleDateString()} {rental.startTime || '09:00'}</div>
                        <div>{new Date(rental.endDate).toLocaleDateString()} {rental.endTime || '18:00'}</div>
                      </td>
                      
                      {/* Rental Amount - תיקון: מחירים נכונים עם הנחות */}
                      <td className="px-4 py-4 text-sm">
                        <div className="space-y-1">
                          {/* מחיר יומי עם הנחה אם יש */}
                          <div className="flex items-center">
                            <span className="font-medium text-gray-900">
                              ฿{pricing.actualDailyRate.toLocaleString()}/day
                            </span>
                            {pricing.hasDiscount && (
                              <span className="ml-1 text-xs text-green-600">(Discounted)</span>
                            )}
                          </div>
                          
                          {/* אם יש הנחה, הצג גם המחיר המקורי */}
                          {pricing.hasDiscount && (
                            <div className="text-xs text-gray-400 line-through">
                              ฿{pricing.originalDailyRate.toLocaleString()}/day
                            </div>
                          )}
                          
                          {/* סכום כולל */}
                          <div className="text-sm font-medium text-gray-900">
                            Total: ฿{pricing.actualTotal.toLocaleString()}
                          </div>
                          
                          {/* הנחה בסכום */}
                          {pricing.hasDiscount && pricing.discount > 0 && (
                            <div className="text-xs text-green-600">
                              Save: ฿{pricing.discount.toLocaleString()}
                            </div>
                          )}
                          
                          {/* פיקדון */}
                          <div className="text-xs text-blue-500">
                            Deposit: ฿{(rental.deposit || 4000).toLocaleString()}
                          </div>
                        </div>
                      </td>
                      
                      {/* Status */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(displayStatus)}`}>
                          {displayStatus.charAt(0).toUpperCase() + displayStatus.slice(1)}
                        </span>
                      </td>
                      
                      {/* Payment Status */}
                      <td className="px-4 py-4 whitespace-nowrap text-sm">
                        <button 
                          onClick={() => handleUpdatePaymentStatus(rental)}
                          className="flex items-center"
                          title={rental.paid ? 'Mark as Unpaid' : 'Mark as Paid'}
                        >
                          {rental.paid ? (
                            <span className="text-green-600">
                              <CheckCircle className="h-5 w-5" />
                            </span>
                          ) : (
                            <span className="text-red-600">
                              <XCircle className="h-5 w-5" />
                            </span>
                          )}
                        </button>
                      </td>
                      
                      {/* Actions */}
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <button 
                            className="text-blue-600 hover:text-blue-900"
                            onClick={() => handleEdit(rental)}
                            title="Edit Rental"
                          >
                            <PencilIcon className="h-4 w-4" />
                          </button>
                          <button 
                            className="text-red-600 hover:text-red-900"
                            onClick={() => handleDeleteRental(rental)}
                            title="Delete Rental"
                          >
                            <Trash2Icon className="h-4 w-4" />
                          </button>
                          {rental.status === 'pending' && (
                            <button 
                              className="text-green-600 hover:text-green-900 text-xs px-2 py-1 border border-green-300 rounded flex items-center"
                              onClick={() => handleActivateReservation(rental)}
                              title="Activate Reservation"
                            >
                              <PlayCircle className="h-3 w-3 mr-1" />
                              Activate
                            </button>
                          )}
                          {rental.status === 'active' && (
                            <button 
                              className="text-green-600 hover:text-green-900 text-xs px-2 py-1 border border-green-300 rounded"
                              onClick={() => handleCompleteRental(rental)}
                              title="Complete Rental"
                            >
                              Complete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards - Visible on mobile and tablet */}
          <div className="lg:hidden space-y-4">
            {filteredRentals.map((rental) => {
              const isOverdue = new Date(rental.endDate) < new Date() && rental.status === 'active'
              const displayStatus = isOverdue ? 'overdue' : rental.status
              
              // תיקון: שימוש בפונקציה החדשה לחישוב מחירים
              const pricing = calculateRentalPricing(rental)

              return (
                <div key={rental.id} className="bg-white shadow rounded-lg p-4 border-l-4 border-blue-500">
                  {/* Header */}
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">
                        #{rental.orderNumber}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {rental.scooterLicense} • {rental.scooterColor}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(displayStatus)}`}>
                        {displayStatus.charAt(0).toUpperCase() + displayStatus.slice(1)}
                      </span>
                      <button 
                        onClick={() => handleUpdatePaymentStatus(rental)}
                        className="p-1"
                      >
                        {rental.paid ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-600" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Customer Info */}
                  <div className="mb-3 pb-3 border-b border-gray-200">
                    <h4 className="font-medium text-gray-900">{rental.customerName}</h4>
                    <p className="text-sm text-gray-500">{rental.passportNumber}</p>
                    {rental.whatsappNumber && (
                      <p className="text-sm text-blue-600">
                        WhatsApp: {rental.whatsappCountryCode} {rental.whatsappNumber}
                      </p>
                    )}
                  </div>

                  {/* Rental Details */}
                  <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                    <div>
                      <span className="text-gray-500">Start:</span>
                      <div className="font-medium">{new Date(rental.startDate).toLocaleDateString()}</div>
                      <div className="text-xs text-gray-500">{rental.startTime || '09:00'}</div>
                    </div>
                    <div>
                      <span className="text-gray-500">End:</span>
                      <div className="font-medium">{new Date(rental.endDate).toLocaleDateString()}</div>
                      <div className="text-xs text-gray-500">{rental.endTime || '18:00'}</div>
                    </div>
                    
                    {/* מחיר יומי - תיקון */}
                    <div>
                      <span className="text-gray-500">Daily Rate:</span>
                      <div className="space-y-1">
                        <div className="font-medium text-green-600">
                          ฿{pricing.actualDailyRate.toLocaleString()}
                          {pricing.hasDiscount && (
                            <span className="text-xs ml-1">(Discounted)</span>
                          )}
                        </div>
                        {pricing.hasDiscount && (
                          <div className="text-xs text-gray-400 line-through">
                            Was: ฿{pricing.originalDailyRate.toLocaleString()}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* סכום כולל - תיקון */}
                    <div>
                      <span className="text-gray-500">Rental Total:</span>
                      <div className="space-y-1">
                        <div className="font-medium text-lg text-gray-900">
                          ฿{pricing.actualTotal.toLocaleString()}
                        </div>
                        {pricing.hasDiscount && pricing.discount > 0 && (
                          <div className="text-xs text-green-600">
                            Saved: ฿{pricing.discount.toLocaleString()}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="col-span-2">
                      <span className="text-gray-500">Deposit:</span>
                      <div className="font-medium text-blue-600">฿{(rental.deposit || 4000).toLocaleString()}</div>
                    </div>
                  </div>

                  {/* Notes if available */}
                  {rental.notes && (
                    <div className="mb-3 pb-3 border-b border-gray-200">
                      <span className="text-gray-500 text-sm">Notes:</span>
                      <p className="text-sm text-gray-700 mt-1">{rental.notes}</p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2">
                    <button 
                      onClick={() => handleEdit(rental)}
                      className="inline-flex items-center px-3 py-1 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                    >
                      <PencilIcon className="h-4 w-4 mr-1" />
                      Edit
                    </button>
                    <button 
                      onClick={() => handleDeleteRental(rental)}
                      className="inline-flex items-center px-3 py-1 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50"
                    >
                      <Trash2Icon className="h-4 w-4 mr-1" />
                      Delete
                    </button>
                    {rental.status === 'pending' && (
                      <button 
                        onClick={() => handleActivateReservation(rental)}
                        className="inline-flex items-center px-3 py-1 border border-green-300 text-sm font-medium rounded-md text-green-700 bg-white hover:bg-green-50"
                      >
                        <PlayCircle className="h-4 w-4 mr-1" />
                        Activate
                      </button>
                    )}
                    {rental.status === 'active' && (
                      <button 
                        onClick={() => handleCompleteRental(rental)}
                        className="inline-flex items-center px-3 py-1 border border-green-300 text-sm font-medium rounded-md text-green-700 bg-white hover:bg-green-50"
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Complete
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Rental Form Modal */}
      {showForm && (
        <RentalForm
          onSubmit={editingRental ? handleEditRental : handleCreateRental}
          onClose={() => {
            setShowForm(false)
            setEditingRental(null)
            setReservationMode(false)
          }}
          availableScooters={allScooters} // מעביר את כל האופנועים
          initialData={editingRental}
          isEditing={!!editingRental}
          reservationMode={reservationMode}
        />
      )}
    </div>
  )
}

export default RentalManagement