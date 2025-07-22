import { useEffect, useState } from 'react'
import { PlusCircle, CheckCircle, XCircle, PencilIcon, Trash2Icon, Calendar, Clock, PlayCircle } from 'lucide-react'
import RentalForm from '../rentals/RentalForm'
import { getRentals, addRental, updateRental, deleteRental, getScooters, updateScooter } from '../../lib/database'
import useStatistics from '../../context/useStatistics'

const RentalManagement = ({ onUpdate }) => {
  const [rentals, setRentals] = useState([])
  const [allScooters, setAllScooters] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('active')
  const [editingRental, setEditingRental] = useState(null)
  const [reservationMode, setReservationMode] = useState(false)

  // גישה לנתונים מ-StatisticsProvider
  const { rawData } = useStatistics()

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

    const originalDailyRate = 1200
    const originalTotal = days * originalDailyRate
    const calculatedDailyRate = calculateDailyRate(days)
    const actualDailyRate = rental.dailyRate || calculatedDailyRate
    const actualTotal = days * actualDailyRate
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

  const fetchRentals = async (useCache = false) => {
    try {
      let rentalsData

      if (useCache && rawData?.isDataLoaded) {
        console.log('RentalManagement: Using cached rentals data')
        rentalsData = rawData.rentals
      } else {
        console.log('RentalManagement: Fetching fresh rentals data')
        rentalsData = await getRentals()
      }

      setRentals(rentalsData || [])
      setError(null)
    } catch (error) {
      console.error('Error fetching rentals:', error)
      setError('Failed to load rentals')
    }
  }

  const fetchAllScooters = async (useCache = false) => {
    try {
      let scootersData

      if (useCache && rawData?.isDataLoaded) {
        console.log('RentalManagement: Using cached scooters data')
        scootersData = rawData.scooters
      } else {
        console.log('RentalManagement: Fetching fresh scooters data')
        scootersData = await getScooters()
      }

      setAllScooters(scootersData || [])
      setError(null)
    } catch (error) {
      console.error('Error fetching scooters:', error)
      setError('Failed to load scooters')
    }
  }

  // טעינה ראשונית בלבד
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)
      await Promise.all([fetchRentals(true), fetchAllScooters(true)])
      setIsLoading(false)
    }
    loadData()
  }, [])

  // שימוש בנתונים מ-cache רק בטעינה הראשונית
  useEffect(() => {
    if (isLoading && rawData?.isDataLoaded && rentals.length === 0 && allScooters.length === 0) {
      console.log('RentalManagement: Using StatisticsProvider cache for initial load')
      setRentals(rawData.rentals || [])
      setAllScooters(rawData.scooters || [])
      setIsLoading(false)
    }
  }, [rawData, isLoading, rentals.length, allScooters.length])

  // פונקציה לעדכון חכם של סטטוס אופנוע לפי תאריכי השכרות
  const updateScooterStatusSmart = async (scooterId) => {
    try {
      const scooter = allScooters.find(s => s.id === scooterId)
      if (!scooter) return

      const scooterRentals = rentals.filter(r => 
        r.scooterId === scooterId && 
        (r.status === 'active' || r.status === 'pending')
      )

      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const currentRental = scooterRentals.find(r => {
        const startDate = new Date(r.startDate)
        const endDate = new Date(r.endDate)
        startDate.setHours(0, 0, 0, 0)
        endDate.setHours(23, 59, 59, 999)
        
        const isActivePeriod = today >= startDate && today <= endDate
        const isActiveStatus = r.status === 'active'
        
        return isActivePeriod && isActiveStatus
      })

      let newStatus = 'available'
      let lastRentalId = null

      if (currentRental) {
        newStatus = 'rented'
        lastRentalId = currentRental.id
      } else if (scooter.status === 'maintenance') {
        newStatus = 'maintenance'
      }

      if (scooter.status !== newStatus) {
        await updateScooter({
          ...scooter,
          status: newStatus,
          lastRentalId
        })
        
        setAllScooters(prev => prev.map(s => 
          s.id === scooterId 
            ? { ...s, status: newStatus, lastRentalId }
            : s
        ))
      }
    } catch (error) {
      console.error('Error updating scooter status:', error)
    }
  }

  const handleCreateRental = async (formData) => {
    try {
      const selectedScooter = allScooters.find(s => s.id === formData.scooterId)
      if (!selectedScooter) {
        throw new Error('Selected scooter not found')
      }
      
      const newRental = await addRental({
        ...formData,
        scooterLicense: selectedScooter.licensePlate,
        scooterColor: selectedScooter.color,
        createdAt: new Date().toISOString(),
        status: formData.status || (formData.isReservation ? 'pending' : 'active')
      })
  
      setRentals(prev => [...prev, newRental])
      await updateScooterStatusSmart(selectedScooter.id)
      
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
      const scooterChanged = originalRental.scooterId !== formData.scooterId
      
      const updatedRental = await updateRental({
        ...originalRental,
        ...formData,
        updatedAt: new Date().toISOString()
      })
      
      setRentals(prev => prev.map(r => r.id === updatedRental.id ? updatedRental : r))
      
      if (scooterChanged) {
        await updateScooterStatusSmart(originalRental.scooterId)
        await updateScooterStatusSmart(formData.scooterId)
      } else {
        await updateScooterStatusSmart(formData.scooterId)
      }
      
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
      const updatedRental = await updateRental({
        ...rental,
        status: 'completed',
        completedAt: new Date().toISOString()
      })
      
      setRentals(prev => prev.map(r => r.id === updatedRental.id ? updatedRental : r))
      await updateScooterStatusSmart(rental.scooterId)
      
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
        setRentals(prev => prev.filter(r => r.id !== rental.id))
        await updateScooterStatusSmart(rental.scooterId)
        
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

  const stats = calculateStatistics()

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
      if (activeTab === 'pending') {
        return new Date(a.startDate) - new Date(b.startDate)
      } else if (activeTab === 'active') {
        return new Date(a.endDate) - new Date(b.endDate)
      } else {
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
            onClick={() => {
              setEditingRental(null)
              setReservationMode(false)
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
                  const pricing = calculateRentalPricing(rental)

                  return (
                    <tr key={rental.id}>
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {rental.orderNumber}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm">
                        <div className="font-medium text-gray-900">{rental.scooterLicense}</div>
                        <div className="text-xs text-gray-500">{rental.scooterColor}</div>
                      </td>
                      <td className="px-4 py-4 text-sm">
                        <div className="font-medium text-gray-900">{rental.customerName}</div>
                        <div className="text-xs text-gray-500">{rental.passportNumber}</div>
                      </td>
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
                      <td className="px-4 py-4 text-sm">
                        <div>{new Date(rental.startDate).toLocaleDateString()} {rental.startTime || '09:00'}</div>
                        <div>{new Date(rental.endDate).toLocaleDateString()} {rental.endTime || '18:00'}</div>
                      </td>
                      <td className="px-4 py-4 text-sm">
                        <div className="space-y-1">
                          <div className="flex items-center">
                            <span className="font-medium text-gray-900">
                              ฿{pricing.actualDailyRate.toLocaleString()}/day
                            </span>
                            {pricing.hasDiscount && (
                              <span className="ml-1 text-xs text-green-600">(Discounted)</span>
                            )}
                          </div>
                          {pricing.hasDiscount && (
                            <div className="text-xs text-gray-400 line-through">
                              ฿{pricing.originalDailyRate.toLocaleString()}/day
                            </div>
                          )}
                          <div className="text-sm font-medium text-gray-900">
                            Total: ฿{pricing.actualTotal.toLocaleString()}
                          </div>
                          {pricing.hasDiscount && pricing.discount > 0 && (
                            <div className="text-xs text-green-600">
                              Save: ฿{pricing.discount.toLocaleString()}
                            </div>
                          )}
                          <div className="text-xs text-blue-500">
                            Deposit: ฿{(rental.deposit || 4000).toLocaleString()}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(displayStatus)}`}>
                          {displayStatus.charAt(0).toUpperCase() + displayStatus.slice(1)}
                        </span>
                      </td>
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
              const pricing = calculateRentalPricing(rental)

              return (
                <div key={rental.id} className="bg-white shadow rounded-lg p-4 border-l-4 border-blue-500">
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

                  <div className="mb-3 pb-3 border-b border-gray-200">
                    <h4 className="font-medium text-gray-900">{rental.customerName}</h4>
                    <p className="text-sm text-gray-500">{rental.passportNumber}</p>
                    {rental.whatsappNumber && (
                      <p className="text-sm text-blue-600">
                        WhatsApp: {rental.whatsappCountryCode} {rental.whatsappNumber}
                      </p>
                    )}
                  </div>

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

                  {rental.notes && (
                    <div className="mb-3 pb-3 border-b border-gray-200">
                      <span className="text-gray-500 text-sm">Notes:</span>
                      <p className="text-sm text-gray-700 mt-1">{rental.notes}</p>
                    </div>
                  )}

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
          availableScooters={allScooters}
          initialData={editingRental}
          isEditing={!!editingRental}
          reservationMode={reservationMode}
        />
      )}
    </div>
  )
}

export default RentalManagement