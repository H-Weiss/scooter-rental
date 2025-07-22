import { useEffect, useState } from 'react'
import { PlusCircle, PencilIcon, Trash2Icon, Settings, RefreshCw } from 'lucide-react'
import ScooterForm from './ScooterForm'
import { getScooters, addScooter, updateScooter, deleteScooter, getRentals } from '../../lib/database'
import useStatistics from '../../context/useStatistics'

const ScooterManagement = ({ onUpdate }) => {
  const [scooters, setScooters] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editingScooter, setEditingScooter] = useState(null)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)

  // גישה לנתונים מ-StatisticsProvider
  const { rawData, refreshStatistics } = useStatistics()

  // פונקציה לעדכון חכם של סטטוס אופנוע לפי תאריכי השכרות
  const updateScooterStatusSmart = async (scooterId, allRentals) => {
    try {
      const scooter = scooters.find(s => s.id === scooterId)
      if (!scooter) return scooter

      // מצא את כל ההשכרות של האופנוע הזה
      const scooterRentals = allRentals.filter(r => 
        r.scooterId === scooterId && 
        (r.status === 'active' || r.status === 'pending')
      )

      const today = new Date()
      today.setHours(0, 0, 0, 0)

      // בדוק אם יש השכרה פעילה שכוללת את היום הנוכחי
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

      if (currentRental) {
        newStatus = 'rented'
        console.log(`Scooter ${scooter.licensePlate} set to RENTED due to active rental:`, currentRental.orderNumber)
      } else {
        // בדוק אם האופנוע במצב maintenance
        if (scooter.status === 'maintenance') {
          newStatus = 'maintenance' // שמור על maintenance אם זה הוגדר ידנית
        } else {
          newStatus = 'available'
        }
        console.log(`Scooter ${scooter.licensePlate} set to ${newStatus.toUpperCase()}`)
      }

      // עדכן את הסטטוס רק אם השתנה
      if (scooter.status !== newStatus) {
        console.log(`Updating scooter ${scooter.licensePlate} status from ${scooter.status} to ${newStatus}`)
        
        const updatedScooter = await updateScooter({
          ...scooter,
          status: newStatus
        })
        
        return updatedScooter
      }
      
      return scooter
    } catch (error) {
      console.error('Error updating scooter status:', error)
      return scooter
    }
  }

  // פונקציה לעדכון כל סטטוסי האופנועים
  const updateAllScootersStatus = async () => {
    try {
      setIsUpdatingStatus(true)
      console.log('=== Updating all scooters status in ScooterManagement ===')
      
      // השתמש בנתונים מ-cache אם זמינים, אחרת טען מחדש
      let allRentals
      if (rawData?.isDataLoaded) {
        allRentals = rawData.rentals
        console.log('Using cached rentals data for status update')
      } else {
        allRentals = await getRentals()
        console.log('Fetched fresh rentals data for status update')
      }
      
      const updatedScooters = []
      
      for (const scooter of scooters) {
        const updatedScooter = await updateScooterStatusSmart(scooter.id, allRentals)
        updatedScooters.push(updatedScooter)
      }
      
      setScooters(updatedScooters)
      console.log('=== Finished updating all scooters status ===')
      
      // רענן את הסטטיסטיקות גם
      await refreshStatistics(true)
      
    } catch (error) {
      console.error('Error updating all scooters status:', error)
      setError('Failed to update scooters status')
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  const fetchScooters = async (useCache = false) => {
    try {
      setIsLoading(true)
      setError(null)
      
      let scootersData
      
      // נסה להשתמש בנתונים מ-cache אם זמינים
      if (useCache && rawData?.isDataLoaded) {
        console.log('ScooterManagement: Using cached scooters data')
        scootersData = rawData.scooters
      } else {
        console.log('ScooterManagement: Fetching fresh scooters data')
        scootersData = await getScooters()
      }
      
      setScooters(scootersData || [])
      console.log('ScooterManagement: Scooters loaded:', scootersData?.length || 0)
      
    } catch (error) {
      console.error('Error fetching scooters:', error)
      setError('Failed to load scooters')
    } finally {
      setIsLoading(false)
    }
  }

  // טעינה ראשונית בלבד
  useEffect(() => {
    fetchScooters(true) // נסה קודם cache
  }, [])

  // שימוש בנתונים מ-cache רק בטעינה הראשונית
  useEffect(() => {
    if (isLoading && rawData?.isDataLoaded && scooters.length === 0) {
      console.log('ScooterManagement: Using StatisticsProvider cache for initial load')
      setScooters(rawData.scooters || [])
      setIsLoading(false)
    }
  }, [rawData, isLoading, scooters.length])

  const handleCreateScooter = async (formData) => {
    try {
      const newScooter = await addScooter(formData)
      setScooters(prev => [newScooter, ...prev])
      setShowForm(false)
      
      // רענן סטטיסטיקות
      await refreshStatistics(true)
      onUpdate?.()
    } catch (error) {
      console.error('Error creating scooter:', error)
      setError('Failed to create scooter: ' + error.message)
    }
  }

  const handleEditScooter = async (formData) => {
    try {
      const updatedScooter = await updateScooter({
        ...editingScooter,
        ...formData
      })
      
      setScooters(prev => prev.map(s => s.id === updatedScooter.id ? updatedScooter : s))
      setShowForm(false)
      setEditingScooter(null)
      
      // רענן סטטיסטיקות
      await refreshStatistics(true)
      onUpdate?.()
    } catch (error) {
      console.error('Error updating scooter:', error)
      setError('Failed to update scooter: ' + error.message)
    }
  }

  const handleEdit = (scooter) => {
    setEditingScooter(scooter)
    setShowForm(true)
  }

  const handleDeleteScooter = async (scooter) => {
    if (window.confirm(`Are you sure you want to delete scooter ${scooter.licensePlate}?`)) {
      try {
        await deleteScooter(scooter.id)
        setScooters(prev => prev.filter(s => s.id !== scooter.id))
        
        // רענן סטטיסטיקות
        await refreshStatistics(true)
        onUpdate?.()
      } catch (error) {
        console.error('Error deleting scooter:', error)
        setError('Failed to delete scooter: ' + error.message)
      }
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'available':
        return 'bg-green-100 text-green-800'
      case 'rented':
        return 'bg-blue-100 text-blue-800'
      case 'maintenance':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'available':
        return '✓'
      case 'rented':
        return '🚀'
      case 'maintenance':
        return '🔧'
      default:
        return '?'
    }
  }

  // חישוב סטטיסטיקות מקומיות
  const localStats = {
    total: scooters.length,
    available: scooters.filter(s => s.status === 'available').length,
    rented: scooters.filter(s => s.status === 'rented').length,
    maintenance: scooters.filter(s => s.status === 'maintenance').length
  }

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
            <div className="h-5 w-5 text-red-400">⚠️</div>
          </div>
          <div className="ml-3">
            <p className="text-sm text-red-700">{error}</p>
            <button 
              onClick={() => {
                setError(null)
                fetchScooters(false)
              }}
              className="mt-2 text-sm text-red-600 underline hover:text-red-800"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header with Stats */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 border-b border-gray-200 pb-4">
        <div>
          <h2 className="text-lg font-medium text-gray-900">Scooter Management</h2>
          <div className="flex items-center space-x-4 mt-2 text-sm text-gray-600">
            <span>Total: {localStats.total}</span>
            <span className="text-green-600">Available: {localStats.available}</span>
            <span className="text-blue-600">Rented: {localStats.rented}</span>
            <span className="text-yellow-600">Maintenance: {localStats.maintenance}</span>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => {
              fetchScooters(false) // טעינה מחדש ידנית
              updateAllScootersStatus()
            }}
            disabled={isUpdatingStatus}
            className="inline-flex items-center justify-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            title="Refresh scooters and update statuses"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isUpdatingStatus ? 'animate-spin' : ''}`} />
            {isUpdatingStatus ? 'Updating...' : 'Refresh'}
          </button>
          
          <button
            onClick={() => {
              setEditingScooter(null)
              setShowForm(true)
            }}
            className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <PlusCircle className="h-4 w-4 mr-2" />
            Add Scooter
          </button>
        </div>
      </div>

      {/* Scooters Display */}
      {scooters.length === 0 ? (
        <div className="bg-white shadow overflow-hidden sm:rounded-lg p-6">
          <div className="text-center text-gray-500">
            No scooters found. Add your first scooter to get started.
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
                    License Plate
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Color
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Year
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Mileage
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {scooters.map((scooter) => (
                  <tr key={scooter.id}>
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {scooter.licensePlate}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                      {scooter.color}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                      {scooter.year}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                      {scooter.mileage?.toLocaleString()} km
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(scooter.status)}`}>
                        <span className="mr-1">{getStatusIcon(scooter.status)}</span>
                        {scooter.status.charAt(0).toUpperCase() + scooter.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button 
                          className="text-blue-600 hover:text-blue-900"
                          onClick={() => handleEdit(scooter)}
                          title="Edit Scooter"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <button 
                          className="text-red-600 hover:text-red-900"
                          onClick={() => handleDeleteScooter(scooter)}
                          title="Delete Scooter"
                        >
                          <Trash2Icon className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards - Visible on mobile and tablet */}
          <div className="lg:hidden space-y-4">
            {scooters.map((scooter) => (
              <div key={scooter.id} className="bg-white shadow rounded-lg p-4 border-l-4 border-blue-500">
                {/* Header */}
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">
                      {scooter.licensePlate}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {scooter.color} • {scooter.year}
                    </p>
                  </div>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(scooter.status)}`}>
                    <span className="mr-1">{getStatusIcon(scooter.status)}</span>
                    {scooter.status.charAt(0).toUpperCase() + scooter.status.slice(1)}
                  </span>
                </div>

                {/* Details */}
                <div className="mb-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Mileage:</span>
                    <span className="font-medium">{scooter.mileage?.toLocaleString()} km</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2">
                  <button 
                    onClick={() => handleEdit(scooter)}
                    className="inline-flex items-center px-3 py-1 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  >
                    <PencilIcon className="h-4 w-4 mr-1" />
                    Edit
                  </button>
                  <button 
                    onClick={() => handleDeleteScooter(scooter)}
                    className="inline-flex items-center px-3 py-1 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50"
                  >
                    <Trash2Icon className="h-4 w-4 mr-1" />
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Scooter Form Modal */}
      {showForm && (
        <ScooterForm
          onSubmit={editingScooter ? handleEditScooter : handleCreateScooter}
          onClose={() => {
            setShowForm(false)
            setEditingScooter(null)
          }}
          initialData={editingScooter}
        />
      )}
    </div>
  )
}

export default ScooterManagement