import { createContext, useState, useEffect } from 'react'
import { getScooters, getRentals } from '../lib/database'

export const StatisticsContext = createContext()

export default function StatisticsProvider({ children }) {
  const [statistics, setStatistics] = useState({
    availableScooters: 0,
    activeRentals: 0,
    maintenanceScooters: 0,
    totalCustomers: 0,
    isLoading: true
  })

  const calculateStatistics = async () => {
    try {
      const [scooters, rentals] = await Promise.all([
        getScooters(),
        getRentals()
      ])

      // סטטיסטיקות אופנועים
      const availableScooters = scooters.filter(s => s.status === 'available').length
      const maintenanceScooters = scooters.filter(s => s.status === 'maintenance').length

      // סטטיסטיקות השכרות
      const activeRentals = rentals.filter(r => r.status === 'active').length
      
      // לקוחות ייחודיים (לפי מספר דרכון)
      const uniqueCustomers = new Set(rentals.map(r => r.passportNumber)).size

      setStatistics({
        availableScooters,
        activeRentals,
        maintenanceScooters,
        totalCustomers: uniqueCustomers,
        isLoading: false
      })
    } catch (error) {
      console.error('Error calculating statistics:', error)
      setStatistics(prev => ({ ...prev, isLoading: false }))
    }
  }

  const refreshStatistics = () => {
    calculateStatistics()
  }

  useEffect(() => {
    calculateStatistics()
  }, [])

  return (
    <StatisticsContext.Provider value={{
      statistics,
      refreshStatistics
    }}>
      {children}
    </StatisticsContext.Provider>
  )
}