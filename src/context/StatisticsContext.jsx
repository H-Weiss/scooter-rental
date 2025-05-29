import { createContext, useContext, useState, useEffect } from 'react'
import { getScooters, getRentals } from '../lib/database'

const StatisticsContext = createContext()

export const useStatistics = () => {
  const context = useContext(StatisticsContext)
  if (!context) {
    throw new Error('useStatistics must be used within a StatisticsProvider')
  }
  return context
}

export const StatisticsProvider = ({ children }) => {
  const [statistics, setStatistics] = useState({
    availableScooters: 0,
    activeRentals: 0,
    maintenanceScooters: 0,
    totalCustomers: 0,
    totalRevenue: 0,
    unpaidAmount: 0,
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

      // חישוב ימים להשכרה
      const calculateRentalDays = (rental) => {
        const start = new Date(rental.startDate)
        let end
        
        if (rental.status === 'completed' && rental.completedAt) {
          end = new Date(rental.completedAt)
        } else {
          end = new Date(rental.endDate)
        }
        
        return Math.ceil((end - start) / (1000 * 60 * 60 * 24))
      }

      // Total Revenue - כל ההזמנות ששולמו
      const totalRevenue = rentals.reduce((sum, rental) => {
        if (rental.paid) {
          const days = calculateRentalDays(rental)
          return sum + (days * rental.dailyRate)
        }
        return sum
      }, 0)

      // Unpaid Amount - כל ההשכרות שלא שולמו (הסתיימו או לא הסתיימו)
      const unpaidAmount = rentals.reduce((sum, rental) => {
        if (!rental.paid) {
          const days = calculateRentalDays(rental)
          return sum + (days * rental.dailyRate)
        }
        return sum
      }, 0)

      setStatistics({
        availableScooters,
        activeRentals,
        maintenanceScooters,
        totalCustomers: uniqueCustomers,
        totalRevenue,
        unpaidAmount,
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