import { useState, useEffect } from 'react'
import { Bike, Users, Calendar, Wrench } from 'lucide-react'
import './index.css'
import ScooterManagement from './components/scooters/ScooterManagement'
import RentalManagement from './components/rentals/RentalManagement'
import RentalCalendar from './components/calendar/RentalCalendar'
import Header from './components/Header'
import LoginPage from './components/LoginPage'
import StatisticsProvider from './context/StatisticsProvider'
import useStatistics from './context/useStatistics'
import { AuthProvider, useAuth } from './context/AuthContext'
import { getScooters, getRentals } from './lib/database'

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
    <div className="space-y-4 sm:space-y-6 mb-4 sm:mb-6">
      {/* סטטיסטיקות כלליות - 4 קלפים בלבד */}
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
    </div>
  )
}

// Calendar Section Component - תיקון העברת הנתונים
function CalendarSection({ refreshTrigger }) {
  const [rentals, setRentals] = useState([])
  const [scooters, setScooters] = useState([])
  const [showRentalForm, setShowRentalForm] = useState(false)
  const [selectedRental, setSelectedRental] = useState(null)
  const [prefilledDate, setPrefilledDate] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  const loadData = async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      console.log('=== CalendarSection: Loading data ===')
      
      const [rentalsData, scootersData] = await Promise.all([
        getRentals(),
        getScooters()
      ])
      
      console.log('CalendarSection: Rentals loaded:', rentalsData)
      console.log('CalendarSection: Scooters loaded:', scootersData)
      
      setRentals(rentalsData || [])
      setScooters(scootersData || [])
    } catch (error) {
      console.error('Error loading calendar data:', error)
      setError('Failed to load calendar data')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // רענון כאשר refreshTrigger משתנה
  useEffect(() => {
    if (refreshTrigger > 0) {
      console.log('CalendarSection: Refresh triggered')
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

  if (isLoading) {
    return (
      <div className="mb-6 bg-white rounded-lg shadow-lg p-6">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Loading calendar...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mb-6 bg-white rounded-lg shadow-lg p-6">
        <div className="text-center text-red-600">
          <p>Error: {error}</p>
          <button 
            onClick={loadData}
            className="mt-3 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    )
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
      {/* Header - ללא כפתור מחיקה */}
      <Header />

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