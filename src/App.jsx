import { useState } from 'react'
import { Bike, Users, Calendar, Wrench, AlertTriangle } from 'lucide-react'
import './index.css'
import ScooterManagement from './components/scooters/ScooterManagement'
import RentalManagement from './components/rentals/RentalManagement'
import { StatisticsProvider, useStatistics } from './context/StatisticsContext'
import { clearDatabase } from './lib/database'
import logo from './assets/logo.jpg'

// Dialog Component for Confirmation
function ConfirmDialog({ isOpen, onClose, onConfirm, title, message }) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg max-w-sm w-full">
        <div className="flex items-center mb-4">
          <AlertTriangle className="h-6 w-6 text-red-500 mr-2" />
          <h3 className="text-lg font-medium text-gray-900">{title}</h3>
        </div>
        <p className="text-sm text-gray-500 mb-4">{message}</p>
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700"
          >
            Delete All Data
          </button>
        </div>
      </div>
    </div>
  )
}

// Dashboard Component
function Dashboard() {
  const { statistics } = useStatistics()
  
  const stats = [
    { 
      id: 'available', 
      name: 'Available Scooters', 
      value: statistics.isLoading ? '...' : statistics.availableScooters.toString(), 
      icon: Bike, 
      color: 'text-blue-500' 
    },
    { 
      id: 'rented', 
      name: 'Active Rentals', 
      value: statistics.isLoading ? '...' : statistics.activeRentals.toString(), 
      icon: Calendar, 
      color: 'text-green-500' 
    },
    { 
      id: 'maintenance', 
      name: 'In Maintenance', 
      value: statistics.isLoading ? '...' : statistics.maintenanceScooters.toString(), 
      icon: Wrench, 
      color: 'text-yellow-500' 
    },
    { 
      id: 'customers', 
      name: 'Total Customers', 
      value: statistics.isLoading ? '...' : statistics.totalCustomers.toString(), 
      icon: Users, 
      color: 'text-purple-500' 
    }
  ]

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-6">
      {stats.map((stat) => (
        <div key={stat.id} className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <stat.icon className={`h-6 w-6 ${stat.color}`} />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dt className="text-sm font-medium text-gray-500 truncate">
                  {stat.name}
                </dt>
                <dd className="flex items-baseline">
                  <div className="text-lg font-semibold text-gray-900">
                    {statistics.isLoading ? (
                      <div className="animate-pulse bg-gray-200 h-6 w-8 rounded"></div>
                    ) : (
                      stat.value
                    )}
                  </div>
                </dd>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function ScooterManagementWrapper() {
  const { refreshStatistics } = useStatistics()
  return <ScooterManagement onUpdate={refreshStatistics} />
}

function RentalManagementWrapper() {
  const { refreshStatistics } = useStatistics()
  return <RentalManagement onUpdate={refreshStatistics} />
}

function App() {
  const [activeTab, setActiveTab] = useState('scooters')
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
  const [error, setError] = useState(null)

  const tabs = [
    { id: 'rentals', name: 'Rentals', icon: Calendar },
    { id: 'scooters', name: 'Scooters', icon: Bike },
    { id: 'customers', name: 'Customers', icon: Users },
    { id: 'maintenance', name: 'Maintenance', icon: Wrench }
  ]

  const handleClearDatabase = async () => {
    try {
      setIsClearing(true)
      await clearDatabase()
      // רענון הדף אחרי מחיקת הנתונים
      window.location.reload()
    } catch (error) {
      console.error('Error clearing database:', error)
      setError('Failed to clear database')
    } finally {
      setIsClearing(false)
      setShowConfirmDialog(false)
    }
  }

  return (
    <StatisticsProvider>
      <div className="min-h-screen bg-gray-100">
        {/* Header */}
        <header className="bg-white shadow">
        <div className="w-full py-4 px-8 flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <img 
              src={logo} 
              alt="Chapo-Samoui Logo" 
              className="h-20 w-auto object-contain"
            />
            <h1 className="text-3xl font-bold text-gray-800">
              Chapo-Samui Scooter Rental Management
            </h1>
          </div>
          <button
            onClick={() => setShowConfirmDialog(true)}
            className="px-6 py-3 text-base font-medium text-white bg-red-600 hover:bg-red-700 rounded-md"
            disabled={isClearing}
          >
            {isClearing ? 'Clearing...' : 'Clear All Data'}
          </button>
        </div>
      </header>

        {/* Error Message */}
        {error && (
          <div className="w-full py-8 px-8">
            <div className="bg-red-50 border-l-4 border-red-400 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <AlertTriangle className="h-5 w-5 text-red-400" />
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          {/* Dashboard Stats */}
          <Dashboard />

          {/* Navigation */}
          <div className="bg-white shadow mb-6">
            <nav className="flex space-x-4 px-4" aria-label="Tabs">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    ${activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                    flex items-center px-3 py-2 border-b-2 text-sm font-medium
                  `}
                >
                  <tab.icon className="h-5 w-5 mr-2" />
                  {tab.name}
                </button>
              ))}
            </nav>
          </div>

          {/* Content Area */}
          <div className="bg-white shadow rounded-lg">
            {activeTab === 'scooters' ? (
              <ScooterManagementWrapper />
            ) : activeTab === 'rentals' ? (
              <RentalManagementWrapper />
            ) : (
              <div className="p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">
                  {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Management
                </h2>
                <p className="text-gray-500">
                  This section will display the {activeTab} management interface.
                </p>
              </div>
            )}
          </div>
        </main>

        {/* Confirm Dialog */}
        <ConfirmDialog
          isOpen={showConfirmDialog}
          onClose={() => setShowConfirmDialog(false)}
          onConfirm={handleClearDatabase}
          title="Clear All Data"
          message="Are you sure you want to delete all data? This action cannot be undone."
        />
      </div>
    </StatisticsProvider>
  )
}

export default App