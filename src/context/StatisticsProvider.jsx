import { createContext, useState, useEffect, useCallback } from 'react'
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
  
  // נתונים גולמיים שנשמרים ב-state
  const [rawData, setRawData] = useState({
    scooters: [],
    rentals: [],
    isDataLoaded: false
  })

  // פונקציה לחישוב סטטיסטיקות מהנתונים הגולמיים
  const calculateStatisticsFromData = useCallback((scooters, rentals) => {
    console.log('=== Calculating Statistics ===')
    console.log('Scooters data:', scooters)
    console.log('Rentals data:', rentals)

    if (!Array.isArray(scooters) || !Array.isArray(rentals)) {
      console.warn('Invalid data types:', { scooters: typeof scooters, rentals: typeof rentals })
      return {
        availableScooters: 0,
        activeRentals: 0,
        maintenanceScooters: 0,
        totalCustomers: 0,
        isLoading: false
      }
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // מצא את כל האופנועים שתפוסים כרגע (לפי השכרות פעילות שכוללות את היום)
    const currentlyRentedScooterIds = new Set()
    rentals.forEach(rental => {
      if (rental.status === 'active' || rental.status === 'pending') {
        const startDate = new Date(rental.startDate)
        const endDate = new Date(rental.endDate)
        startDate.setHours(0, 0, 0, 0)
        endDate.setHours(23, 59, 59, 999)

        // אם היום בטווח ההשכרה, האופנוע תפוס
        if (today >= startDate && today <= endDate) {
          currentlyRentedScooterIds.add(rental.scooterId)
        }
      }
    })

    // סטטיסטיקות אופנועים - מחשב דינמית לפי השכרות
    const maintenanceScooters = scooters.filter(s => s.status === 'maintenance').length
    const availableScooters = scooters.filter(s =>
      s.status !== 'maintenance' && !currentlyRentedScooterIds.has(s.id)
    ).length

    // סטטיסטיקות השכרות - רק active (לא pending)
    const activeRentals = rentals.filter(r => r.status === 'active').length

    // לקוחות ייחודיים (לפי מספר דרכון)
    const uniqueCustomers = new Set(rentals.map(r => r.passportNumber)).size

    const result = {
      availableScooters,
      activeRentals,
      maintenanceScooters,
      totalCustomers: uniqueCustomers,
      currentlyRentedCount: currentlyRentedScooterIds.size,
      isLoading: false
    }

    console.log('Calculated statistics:', result)
    console.log('Currently rented scooter IDs:', Array.from(currentlyRentedScooterIds))
    return result
  }, [])

  // פונקציה לטעינת הנתונים מהדאטבייס
  const loadData = useCallback(async () => {
    try {
      console.log('=== Loading data for statistics ===')
      setStatistics(prev => ({ ...prev, isLoading: true }))
      
      const [scootersData, rentalsData] = await Promise.all([
        getScooters(),
        getRentals()
      ])

      console.log('Raw data loaded:', { 
        scooters: scootersData?.length || 0, 
        rentals: rentalsData?.length || 0 
      })

      // שמירת הנתונים הגולמיים
      const newRawData = {
        scooters: scootersData || [],
        rentals: rentalsData || [],
        isDataLoaded: true
      }
      
      setRawData(newRawData)

      // חישוב סטטיסטיקות חדשות
      const newStatistics = calculateStatisticsFromData(
        newRawData.scooters, 
        newRawData.rentals
      )
      
      setStatistics(newStatistics)

    } catch (error) {
      console.error('Error loading statistics data:', error)
      setStatistics(prev => ({ 
        ...prev, 
        isLoading: false 
      }))
    }
  }, [calculateStatisticsFromData])

  // פונקציה לרענון הסטטיסטיקות (מהנתונים הקיימים או טעינה מחדש)
  const refreshStatistics = useCallback(async (forceReload = false) => {
    console.log('=== Refreshing statistics ===', { forceReload })
    
    if (forceReload || !rawData.isDataLoaded) {
      // טעינה מלאה מהדאטבייס
      await loadData()
    } else {
      // חישוב מחדש מהנתונים הקיימים
      console.log('Recalculating from existing data')
      const newStatistics = calculateStatisticsFromData(
        rawData.scooters, 
        rawData.rentals
      )
      setStatistics(newStatistics)
    }
  }, [rawData, loadData, calculateStatisticsFromData])

  // טעינה ראשונית בלבד
  useEffect(() => {
    console.log('=== StatisticsProvider mounted - loading initial data ===')
    loadData()
  }, [loadData])

  const contextValue = {
    statistics,
    refreshStatistics,
    rawData: {
      scooters: rawData.scooters,
      rentals: rawData.rentals,
      isDataLoaded: rawData.isDataLoaded
    }
  }

  return (
    <StatisticsContext.Provider value={contextValue}>
      {children}
    </StatisticsContext.Provider>
  )
}