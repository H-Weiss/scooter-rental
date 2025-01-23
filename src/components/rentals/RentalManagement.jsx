import { useEffect, useState } from 'react'
import { PlusCircle, CheckCircle, XCircle, PencilIcon, Trash2Icon } from 'lucide-react'
import RentalForm from './RentalForm'
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
      
      // יצירת השכרה חדשה
      const newRental = await addRental({
        ...formData,
        scooterLicense: selectedScooter.licensePlate,
        scootercolor: selectedScooter.color,
        createdAt: new Date().toISOString(),
        status: 'active'
      })
  
      // עדכון סטטוס הקטנוע תוך שמירה על כל השדות הקיימים
      await updateScooter({
        ...selectedScooter,          // שמירה על כל השדות הקיימים
        status: 'rented',            // עדכון הסטטוס בלבד
        lastRentalId: newRental.id   // אופציונלי: שמירת מזהה ההשכרה האחרונה
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
        ...scooter,           // שמירה על כל השדות הקיימים
        status: 'available',  // עדכון הסטטוס בלבד
        lastRentalId: null    // אופציונלי: ניקוי מזהה ההשכרה האחרונה
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
          await updateScooter({
            id: rental.scooterId,
            status: 'available'
          })
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

    const totalRevenue = rentals.reduce((sum, rental) => {
      if (rental.paid) {
        const start = new Date(rental.startDate)
        const end = rental.completedAt ? new Date(rental.completedAt) : new Date(rental.endDate)
        const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24))
        return sum + (days * rental.dailyRate)
      }
      return sum
    }, 0)

    const unpaidAmount = rentals.reduce((sum, rental) => {
      if (!rental.paid && rental.status === 'completed') {
        const start = new Date(rental.startDate)
        const end = new Date(rental.completedAt || rental.endDate)
        const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24))
        return sum + (days * rental.dailyRate)
      }
      return sum
    }, 0)

    return {
      activeRentals,
      completedRentals,
      overdueRentals,
      totalRevenue,
      unpaidAmount
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

  // מסנן את ההשכרות לפי הטאב הפעיל
  const filteredRentals = rentals.filter(rental => {
    if (activeTab === 'active') {
      return rental.status === 'active'
    }
    return rental.status === 'completed'
  })

  const stats = calculateStatistics()

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
    <div className="space-y-4 p-4">
      {/* Statistics Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
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
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Total Revenue</h3>
          <p className="text-2xl font-semibold text-green-600">฿{stats.totalRevenue.toLocaleString()}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Unpaid Amount</h3>
          <p className="text-2xl font-semibold text-orange-600">฿{stats.unpaidAmount.toLocaleString()}</p>
        </div>
      </div>

      {/* Header with Tabs and Add Button */}
      <div className="flex justify-between items-center border-b border-gray-200">
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
          className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <PlusCircle className="h-4 w-4 mr-2" />
          New Rental
        </button>
      </div>

      {/* Rentals Table */}
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-8 py-4 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">
              Order Number
             </th>
              <th scope="col" className="px-8 py-4 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">
                Scooter
              </th>
              <th scope="col" className="px-8 py-4 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">
                Customer
              </th>
              <th scope="col" className="px-8 py-4 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">
                Dates
              </th>
              <th scope="col" className="px-8 py-4 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">
                Amount
              </th>
              <th scope="col" className="px-8 py-4 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th scope="col" className="px-8 py-4 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">
                Payment
              </th>
              <th scope="col" className="px-8 py-4 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
              {filteredRentals.map((rental) => {
              const isOverdue = new Date(rental.endDate) < new Date() && rental.status === 'active'
              const displayStatus = isOverdue ? 'overdue' : rental.status

              return (
                <tr key={rental.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {rental.orderNumber}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {rental.scooterLicense}
                    <div className="text-xs text-gray-500">{rental.scootercolor}</div>
                  </td>
                  <td className="px-8 py-4 text-base whitespace-nowrap">
                    <div>{rental.customerName}</div>
                    <div className="text-xs text-gray-400">{rental.passportNumber}</div>
                  </td>
                  <td className="px-8 py-4 text-base whitespace-nowrap">
                    <div>Start: {new Date(rental.startDate).toLocaleDateString()}</div>
                    <div>End: {new Date(rental.endDate).toLocaleDateString()}</div>
                  </td>
                  <td className="px-8 py-4 text-base whitespace-nowrap">
                    <div>฿{rental.dailyRate.toLocaleString()}/day</div>
                    <div>Total: ฿{(rental.dailyRate * Math.ceil((new Date(rental.endDate) - new Date(rental.startDate)) / (1000 * 60 * 60 * 24))).toLocaleString()}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(displayStatus)}`}>
                      {displayStatus.charAt(0).toUpperCase() + displayStatus.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button 
                      onClick={() => handleUpdatePaymentStatus(rental)}
                      className="flex items-center"
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
                  <td className="px-8 py-4 text-base whitespace-nowrap">
                    <div className="flex space-x-2">
                      <button 
                        className="text-blue-600 hover:text-blue-900"
                        onClick={() => handleEdit(rental)}
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                      <button 
                        className="text-red-600 hover:text-red-900"
                        onClick={() => handleDeleteRental(rental)}
                      >
                        <Trash2Icon className="h-4 w-4" />
                      </button>
                      {rental.status === 'active' && (
                        <button 
                          className="text-blue-600 hover:text-blue-900 font-medium"
                          onClick={() => handleCompleteRental(rental)}
                        >
                          Complete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
            {filteredRentals.length === 0 && (
              <tr>
                <td colSpan="7" className="px-6 py-8 text-center text-gray-500">
                  {activeTab === 'active' ? 'No active rentals found.' : 'No completed rentals found.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

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