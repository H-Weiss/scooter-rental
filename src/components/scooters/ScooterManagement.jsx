import { useEffect, useState } from 'react'
import { PlusCircle, CheckCircle, XCircle, PencilIcon, Trash2Icon } from 'lucide-react'
import RentalForm from '../rentals/RentalForm'
import { getRentals, addRental, updateRental, deleteRental, getScooters, updateScooter } from '../../lib/database'

const RentalManagement = ({ onUpdate }) => {
  const [rentals, setRentals] = useState([])
  const [availableScooters, setAvailableScooters] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('active')
  const [editingRental, setEditingRental] = useState(null)

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

  const fetchAvailableScooters = async () => {
    try {
      const scooters = await getScooters()
      const available = scooters.filter(scooter => scooter.status === 'available')
      setAvailableScooters(available)
      setError(null)
    } catch (error) {
      console.error('Error fetching available scooters:', error)
      setError('Failed to load available scooters')
    }
  }

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)
      await Promise.all([fetchRentals(), fetchAvailableScooters()])
      setIsLoading(false)
    }
    loadData()
  }, [])

  const handleCreateRental = async (formData) => {
    try {
      // מציאת הקטנוע הנבחר
      const selectedScooter = availableScooters.find(s => s.id === formData.scooterId)
      if (!selectedScooter) {
        throw new Error('Selected scooter not found')
      }
      
      // יצירת השכרה חדשה עם כל השדות החדשים
      const newRental = await addRental({
        ...formData,
        scooterLicense: selectedScooter.licensePlate,
        scooterColor: selectedScooter.color,
        createdAt: new Date().toISOString(),
        status: 'active'
      })
  
      // עדכון סטטוס הקטנוע תוך שמירה על כל השדות הקיימים
      await updateScooter({
        ...selectedScooter,
        status: 'rented',
        lastRentalId: newRental.id
      })
      
      setRentals(prev => [...prev, newRental])
      await fetchAvailableScooters()
      setShowForm(false)
      onUpdate?.()
    } catch (error) {
      console.error('Error creating rental:', error)
      setError('Failed to create rental')
    }
  }

  const handleEditRental = async (formData) => {
    try {
      const updatedRental = await updateRental({
        ...editingRental,
        ...formData,
        updatedAt: new Date().toISOString()
      })
      
      setRentals(prev => prev.map(r => r.id === updatedRental.id ? updatedRental : r))
      setShowForm(false)
      setEditingRental(null)
      onUpdate?.()
    } catch (error) {
      console.error('Error updating rental:', error)
      setError('Failed to update rental')
    }
  }

  const handleEdit = (rental) => {
    setEditingRental(rental)
    setShowForm(true)
  }

  const handleCompleteRental = async (rental) => {
    try {
      // עדכון השכרה
      const updatedRental = await updateRental({
        ...rental,
        status: 'completed',
        completedAt: new Date().toISOString()
      })
  
      // קבלת פרטי הקטנוע המלאים לפני העדכון
      const scooters = await getScooters()
      const scooter = scooters.find(s => s.id === rental.scooterId)
      
      if (!scooter) {
        throw new Error('Scooter not found')
      }
  
      // עדכון סטטוס הקטנוע תוך שמירה על כל השדות
      await updateScooter({
        ...scooter,
        status: 'available',
        lastRentalId: null
      })
      
      setRentals(prev => prev.map(r => r.id === updatedRental.id ? updatedRental : r))
      await fetchAvailableScooters()
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
        
        // אם ההשכרה הייתה פעילה, נשחרר את הקטנוע
        if (rental.status === 'active') {
          const scooters = await getScooters()
          const scooter = scooters.find(s => s.id === rental.scooterId)
          
          if (scooter) {
            await updateScooter({
              ...scooter,
              status: 'available'
            })
          }
        }
        
        // עדכון הממשק
        setRentals(prev => prev.filter(r => r.id !== rental.id))
        await fetchAvailableScooters()
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
      case 'overdue':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  // חישוב הסטטיסטיקות - אחרי הגדרת הפונקציות
  const stats = calculateStatistics()

  // מסנן את ההשכרות לפי הטאב הפעיל
  const filteredRentals = rentals.filter(rental => {
    if (activeTab === 'active') {
      return rental.status === 'active'
    }
    return rental.status === 'completed'
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Active Rentals</h3>
          <p className="text-2xl font-semibold text-gray-900">{stats.activeRentals}</p>
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
        <div className="flex space-x-4">
          <button
            onClick={() => setActiveTab('active')}
            className={`py-2 px-4 border-b-2 ${
              activeTab === 'active'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Active Rentals
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={`py-2 px-4 border-b-2 ${
              activeTab === 'completed'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Completed Rentals
          </button>
        </div>
        <button
          onClick={() => {
            setEditingRental(null)
            setShowForm(true)
          }}
          className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <PlusCircle className="h-4 w-4 mr-2" />
          New Rental
        </button>
      </div>

      {/* Rentals Display */}
      {filteredRentals.length === 0 ? (
        <div className="bg-white shadow overflow-hidden sm:rounded-lg p-6">
          <div className="text-center text-gray-500">
            {activeTab === 'active' ? 'No active rentals found.' : 'No completed rentals found.'}
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
                  const days = Math.ceil((new Date(rental.endDate) - new Date(rental.startDate)) / (1000 * 60 * 60 * 24))
                  const totalAmount = rental.dailyRate * days

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
                      
                      {/* Rental Amount */}
                      <td className="px-4 py-4 text-sm">
                        <div>฿{rental.dailyRate.toLocaleString()}/day</div>
                        <div className="text-xs text-gray-500">Total: ฿{totalAmount.toLocaleString()}</div>
                        <div className="text-xs text-blue-500">Deposit: ฿{(rental.deposit || 4000).toLocaleString()}</div>
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
              const days = Math.ceil((new Date(rental.endDate) - new Date(rental.startDate)) / (1000 * 60 * 60 * 24))
              const totalAmount = rental.dailyRate * days

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
                    <div>
                      <span className="text-gray-500">Daily Rate:</span>
                      <div className="font-medium">฿{rental.dailyRate.toLocaleString()}</div>
                    </div>
                    <div>
                      <span className="text-gray-500">Rental Total:</span>
                      <div className="font-medium text-lg">฿{totalAmount.toLocaleString()}</div>
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
          }}
          availableScooters={availableScooters}
          initialData={editingRental}
          isEditing={!!editingRental}
        />
      )}
    </div>
  )
}

export default RentalManagement