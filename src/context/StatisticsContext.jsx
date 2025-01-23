// src/context/StatisticsContext.jsx
import { createContext, useContext, useState, useEffect } from 'react'
import { getScooters, getRentals } from '../lib/database'

const StatisticsContext = createContext()

export function StatisticsProvider({ children }) {
  const [statistics, setStatistics] = useState({
    availableScooters: 0,
    activeRentals: 0,
    maintenanceScooters: 0,
    totalCustomers: 0,
    isLoading: true,
    error: null
  })

  const fetchStatistics = async () => {
    try {
      const [scooters, rentals] = await Promise.all([
        getScooters(),
        getRentals()
      ])

      // חישוב סטטיסטיקות קטנועים
      const availableScooters = scooters.filter(s => s.status === 'available').length
      const maintenanceScooters = scooters.filter(s => s.status === 'maintenance').length

      // חישוב סטטיסטיקות השכרות
      const activeRentals = rentals.filter(r => r.status === 'active').length

      // חישוב מספר לקוחות ייחודיים
      const uniqueCustomers = new Set(rentals.map(r => r.customerName)).size

      setStatistics({
        availableScooters,
        activeRentals,
        maintenanceScooters,
        totalCustomers: uniqueCustomers,
        isLoading: false,
        error: null
      })
    } catch (error) {
      console.error('Error fetching statistics:', error)
      setStatistics(prev => ({
        ...prev,
        isLoading: false,
        error: 'Failed to load statistics'
      }))
    }
  }

  // טעינה ראשונית
  useEffect(() => {
    fetchStatistics()
  }, [])

  return (
    <StatisticsContext.Provider value={{ statistics, refreshStatistics: fetchStatistics }}>
      {children}
    </StatisticsContext.Provider>
  )
}

export function useStatistics() {
  const context = useContext(StatisticsContext)
  if (context === undefined) {
    throw new Error('useStatistics must be used within a StatisticsProvider')
  }
  return context
}