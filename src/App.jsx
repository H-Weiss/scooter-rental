import { useState, useEffect } from 'react'
import { Bike, Users, Calendar, Wrench, AlertTriangle } from 'lucide-react'
import './index.css'
import ScooterManagement from './components/scooters/ScooterManagement'
import RentalManagement from './components/rentals/RentalManagement'
import RentalCalendar from './components/calendar/RentalCalendar'
import Header from './components/Header'
import LoginPage from './components/LoginPage'
import { StatisticsProvider, useStatistics } from './context/StatisticsContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import { clearDatabase, getScooters, getRentals } from './lib/database'

// Loading Screen Component
function LoadingScreen() {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading application...</p>
      </div>
    </div>
  )
}

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

  const financialStats = [
    {
      id: 'revenue',
      name: 'Total Revenue',
      value: statistics.isLoading ? '...' : `฿${statistics.totalRevenue.toLocaleString()}`,
      icon: ({ className }) => (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
        </svg>
      ),
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      id: 'unpaid',
      name: 'Unpaid Amount',
      value: statistics.isLoading ? '...' : `฿${statistics.unpaidAmount.toLocaleString()}`,
      icon: ({ className }) => (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: 'text-red-600',
      bgColor: 'bg-red-50'
    }
  ]

  return (
    <div className="space-y-4 sm:space-y-6 mb-4 sm:mb-6">
      {/* סטטיסטיקות כלליות */}
      <div className="grid grid-cols-2 gap-3 sm:gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.id} className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-3 sm:p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <stat.icon className={`h-5 w-5 sm:h-6 sm:w-6 ${stat.color}`} />
                </div>
                <div className="ml-3 sm:ml-5 w-0 flex-1">
                  <dt className="text-xs sm:text-sm font-medium text-gray-500 truncate">
                    {stat.name}
                  </dt>
                  <dd className="flex items-baseline">
                    <div className="text-base sm:text-lg font-semibold text-gray-900">
                      {statistics.isLoading ? (
                        <div className="animate-pulse bg-gray-200 h-4 sm:h-6 w-6 sm:w-8 rounded"></div>
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

      {/* סטטיסטיקות כספיות */}
      <div className="grid grid-cols-1 gap-3 sm:gap-5 sm:grid-cols-2">
        {financialStats.map((stat) => (
          <div key={stat.id} className={`${stat.bgColor} overflow-hidden shadow rounded-lg border-l-4 border-${stat.color.split('-')[1]}-500`}>
            <div className="p-3 sm:p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <stat.icon className={`h-6 w-6 sm:h-8 sm:w-8 ${stat.color}`} />
                </div>
                <div className="ml-3 sm:ml-5 w-0 flex-1">
                  <dt className="text-xs sm:text-sm font-medium text-gray-600 truncate">
                    {stat.name}
                  </dt>
                  <dd className="flex items-baseline">
                    <div className={`text-lg sm:text-2xl font-bold ${stat.color}`}>
                      {statistics.isLoading ? (
                        <div className="animate-pulse bg-gray-200 h-6 sm:h-8 w-16 sm:w-24 rounded"></div>
                      ) : (
                        <span className="break-all">{stat.value}</span>
                      )}
                    </div>
                  </dd>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Calendar Section Component
function CalendarSection({ refreshTrigger }) {
  const [rentals, setRentals] = useState([])
  const [scooters, setScooters] = useState([])
  const [showRentalForm, setShowRentalForm] = useState(false)
  const [selectedRental, setSelectedRental] = useState(null)
  const [prefilledDate, setPrefilledDate] = useState(null)

  const loadData = async () => {
    try {
      const [rentalsData, scootersData] = await Promise.all([
        getRentals(),
        getScooters()
      ])
      setRentals(rentalsData)
      setScooters(scootersData)
    } catch (error) {
      console.error('Error loading calendar data:', error)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // רענון כאשר refreshTrigger משתנה
  useEffect(() => {
    if (refreshTrigger > 0) {
      loadData()
    }
  }, [refreshTrigger])

  const handleNewRental = (dateInfo) => {
    setPrefilledDate(dateInfo)
    setShowRentalForm(true)
  }

  const handleViewRental = (rental) => {
    setSelectedRental(rental)
    console.log('View rental:', rental)
  }

  return (
    <div className="mb-6">
      <RentalCalendar
        rentals={rentals}
        scooters={scooters}
        onNewRental={handleNewRental}
        onViewRental={handleViewRental}
      />
    </div>
  )
}

// Main App Component (Protected)
function MainApp() {
  const [activeTab, setActiveTab] = useState('rentals')
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
  const [error, setError] = useState(null)
  const [calendarRefreshTrigger, setCalendarRefreshTrigger] = useState(0)

  const tabs = [
    { id: 'rentals', name: 'Rentals', icon: Calendar },
    { id: 'scooters', name: 'Scooters', icon: Bike },
    { id: 'customers', name: 'Customers', icon: Users },
    { id: 'maintenance', name: 'Maintenance', icon: Wrench }
  ]

  // פונקציה לרענון לוח השנה
  const refreshCalendar = () => {
    setCalendarRefreshTrigger(prev => prev + 1)
  }

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

  // יצירת פונקציות Wrapper בתוך הקומפוננט הראשי
  const ScooterManagementWrapper = () => {
    const { refreshStatistics } = useStatistics()
    return <ScooterManagement onUpdate={() => {
      refreshStatistics()
      refreshCalendar()
    }} />
  }

  const RentalManagementWrapper = () => {
    const { refreshStatistics } = useStatistics()
    return <RentalManagement onUpdate={() => {
      refreshStatistics()
      refreshCalendar()
    }} />
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <Header 
        onClearDatabase={() => setShowConfirmDialog(true)}
        isClearing={isClearing}
      />

      {/* Error Message */}
      {error && (
        <div className="w-full py-4 sm:py-8 px-4 sm:px-8">
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

      <main className="max-w-7xl mx-auto py-4 sm:py-6 px-4 sm:px-6 lg:px-8">
        {/* Dashboard Stats */}
        <Dashboard />

        {/* Calendar Section */}
        <CalendarSection refreshTrigger={calendarRefreshTrigger} />

        {/* Navigation - מותאם למובייל */}
        <div className="bg-white shadow mb-6 overflow-x-auto">
          <nav className="flex space-x-2 sm:space-x-4 px-4 min-w-max" aria-label="Tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  ${activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                  flex items-center px-3 py-2 border-b-2 text-sm font-medium whitespace-nowrap
                `}
              >
                <tab.icon className="h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">{tab.name}</span>
                <span className="sm:hidden">{tab.name.charAt(0)}</span>
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
  )
}

// Root App Component with Authentication
function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

// App Content with Authentication Check
function AppContent() {
  const { isAuthenticated, isLoading } = useAuth()

  // Show loading screen while checking authentication
  if (isLoading) {
    return <LoadingScreen />
  }

  // Show login page if not authenticated
  if (!isAuthenticated) {
    return <LoginPage />
  }

  // Show main app if authenticated
  return (
    <StatisticsProvider>
      <MainApp />
    </StatisticsProvider>
  )
}

export default App