import { useEffect, useState } from 'react'
import { PlusCircle, Pencil, Trash2 } from 'lucide-react'
import ScooterForm from './ScooterForm'
import { getScooters, addScooter, updateScooter, deleteScooter } from '../../lib/database'

const ScooterManagement = ({ onUpdate }) => {
  const [scooters, setScooters] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editingScooter, setEditingScooter] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  const handleUpdateStatus = async (scooter, newStatus) => {
    try {
      const updatedScooter = await updateScooter({
        ...scooter, // שמירה על כל השדות הקיימים
        status: newStatus
      })
      
      setScooters(prev => prev.map(s => 
        s.id === updatedScooter.id ? updatedScooter : s
      ))
      onUpdate?.()
    } catch (error) {
      console.error('Error updating scooter:', error)
      setError('Failed to update scooter')
    }
  }

  const fetchScooters = async () => {
    try {
      setIsLoading(true)
      const data = await getScooters()
      // וידוא שכל השדות הנדרשים קיימים
      const validScooters = data.map(scooter => ({
        id: scooter.id || '',
        licensePlate: scooter.licensePlate || '',
        color: scooter.color || '',
        year: scooter.year || new Date().getFullYear(),
        mileage: scooter.mileage || 0,
        status: scooter.status || 'available'
      }))
      setScooters(validScooters)
      setError(null)
    } catch (error) {
      console.error('Error fetching scooters:', error)
      setError('Failed to load scooters')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchScooters()
  }, [])

  const handleAdd = async (formData) => {
    try {
      const newScooter = await addScooter(formData)
      setScooters(prev => [...prev, newScooter])
      setShowForm(false)
      onUpdate?.()  // קריאה עם optional chaining
    } catch (error) {
      console.error('Error adding scooter:', error)
      setError('Failed to add scooter')
    }
  }

  const handleEdit = (scooter) => {
    setEditingScooter(scooter)
    setShowForm(true)
  }

  const handleUpdate = async (formData) => {
    try {
      const updatedScooter = await updateScooter({ ...formData, id: editingScooter.id })
      setScooters(scooters.map(s => (s.id === updatedScooter.id ? updatedScooter : s)))
      setShowForm(false)
      setEditingScooter(null)
      onUpdate?.()  // קריאה עם optional chaining
    } catch (error) {
      console.error('Error updating scooter:', error)
      setError('Failed to update scooter')
    }
  }

  const handleDelete = async (scooterId) => {
    if (window.confirm('Are you sure you want to delete this scooter?')) {
      try {
        await deleteScooter(scooterId)
        setScooters(scooters.filter(s => s.id !== scooterId))
        onUpdate?.()  // קריאה עם optional chaining
      } catch (error) {
        console.error('Error deleting scooter:', error)
        setError('Failed to delete scooter')
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

  const needsMaintenance = (mileage) => {
    // וידוא שהקילומטראז' הוא מספר
    const safeMillage = Number(mileage) || 0
    return safeMillage % 10000 >= 9000
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
      <div className="p-4 bg-red-50 text-red-700 rounded-lg">
        {error}
      </div>
    )
  }

  return (
    <div className="space-y-4 p-4">
      {/* Header with Add Button */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-medium">Scooter List</h2>
        <button
          onClick={() => {
            setEditingScooter(null)
            setShowForm(true)
          }}
          className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <PlusCircle className="h-4 w-4 mr-2" />
          Add Scooter
        </button>
      </div>

      {/* Scooters Table */}
      {scooters.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No scooters found. Add your first scooter to get started.
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-8 py-4 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">
                  License Plate
                </th>
                <th scope="col" className="px-8 py-4 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">
                  color
                </th>
                <th scope="col" className="px-8 py-4 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">
                  Year
                </th>
                <th scope="col" className="px-8 py-4 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">
                  Mileage (km)
                </th>
                <th scope="col" className="px-8 py-4 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th scope="col" className="px-8 py-4 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {scooters.map((scooter) => (
                <tr 
                  key={scooter.id} 
                  className={needsMaintenance(scooter.mileage) ? 'bg-red-50' : ''}
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {scooter.licensePlate}
                  </td>
                  <td className="px-8 py-4 text-base whitespace-nowrap">
                    {scooter.color}
                  </td>
                  <td className="px-8 py-4 text-base whitespace-nowrap">
                    {scooter.year}
                  </td>
                  <td className="px-8 py-4 text-base whitespace-nowrap">
                    <span className={needsMaintenance(scooter.mileage) ? 'text-red-600 font-medium' : ''}>
                      {typeof scooter.mileage === 'number' ? scooter.mileage.toLocaleString() : '0'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(scooter.status)}`}>
                      {scooter.status ? scooter.status.charAt(0).toUpperCase() + scooter.status.slice(1) : 'Unknown'}
                    </span>
                  </td>
                  <td className="px-8 py-4 text-base whitespace-nowrap">
                    <div className="flex space-x-2">
                      <button 
                        onClick={() => handleEdit(scooter)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(scooter.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Form Modal */}
      {showForm && (
        <ScooterForm
          onSubmit={editingScooter ? handleUpdate : handleAdd}
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