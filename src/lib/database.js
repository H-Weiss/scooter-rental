import { supabase } from './supabase.js'

// =============== SCOOTER OPERATIONS ===============

export const getScooters = async () => {
  try {
    const { data, error } = await supabase
      .from('scooters')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    
    console.log('=== DEBUG: Raw scooters from DB ===', data)
    
    const converted = (data || []).map(convertScooterToFrontend)
    console.log('=== DEBUG: Converted scooters ===', converted)
    
    return converted
  } catch (error) {
    console.error('Error fetching scooters:', error)
    throw new Error(`Failed to fetch scooters: ${error.message}`)
  }
}

export const addScooter = async (scooter) => {
  try {
    console.log('=== DEBUG: Adding scooter to database ===')
    console.log('Input scooter data:', scooter)
    
    const insertData = {
      license_plate: scooter.licensePlate,
      color: scooter.color,
      year: scooter.year,
      mileage: scooter.mileage || 0,
      status: scooter.status || 'available'
    }
    
    console.log('Database insert data:', insertData)
    
    const { data, error } = await supabase
      .from('scooters')
      .insert([insertData])
      .select()
      .single()

    if (error) {
      console.error('Supabase error:', error)
      throw error
    }
    
    console.log('Data returned from Supabase:', data)
    
    // Convert back to frontend format
    const result = convertScooterToFrontend(data)
    console.log('Converted result:', result)
    
    return result
  } catch (error) {
    console.error('Error adding scooter:', error)
    if (error.code === '23505') {
      throw new Error('A scooter with this license plate already exists')
    }
    throw new Error(`Failed to add scooter: ${error.message}`)
  }
}

export const updateScooter = async (scooter) => {
  try {
    const { data, error } = await supabase
      .from('scooters')
      .update({
        license_plate: scooter.licensePlate,
        color: scooter.color,
        year: scooter.year,
        mileage: scooter.mileage,
        status: scooter.status
      })
      .eq('id', scooter.id)
      .select()
      .single()

    if (error) throw error
    return convertScooterToFrontend(data)
  } catch (error) {
    console.error('Error updating scooter:', error)
    throw new Error(`Failed to update scooter: ${error.message}`)
  }
}

export const deleteScooter = async (id) => {
  try {
    const { error } = await supabase
      .from('scooters')
      .delete()
      .eq('id', id)

    if (error) throw error
    return id
  } catch (error) {
    console.error('Error deleting scooter:', error)
    throw new Error(`Failed to delete scooter: ${error.message}`)
  }
}

// =============== RENTAL OPERATIONS ===============

export const getRentals = async () => {
  try {
    const { data, error } = await supabase
      .from('rentals')
      .select('*')
      .order('start_date', { ascending: true }) // מיון לפי תאריך התחלה מהקרוב לרחוק
      .order('created_at', { ascending: false }) // מיון משני לפי תאריך יצירה

    if (error) throw error
    return (data || []).map(convertRentalToFrontend)
  } catch (error) {
    console.error('Error fetching rentals:', error)
    throw new Error(`Failed to fetch rentals: ${error.message}`)
  }
}

export const addRental = async (rental) => {
  try {
    // Generate order number
    const orderNumber = await generateOrderNumber()
    
    const insertData = {
      order_number: orderNumber,
      scooter_id: rental.scooterId,
      scooter_license: rental.scooterLicense,
      scooter_color: rental.scooterColor,
      customer_name: rental.customerName,
      passport_number: rental.passportNumber,
      whatsapp_country_code: rental.whatsappCountryCode,
      whatsapp_number: rental.whatsappNumber,
      start_date: rental.startDate,
      end_date: rental.endDate,
      start_time: rental.startTime || '09:00',
      end_time: rental.endTime || '18:00',
      daily_rate: rental.dailyRate,
      deposit: rental.deposit || 4000,
      status: rental.status || 'active', // 'pending', 'active', או 'completed'
      notes: rental.notes || '',
      requires_agreement: rental.requiresAgreement || false
    }

    const { data, error } = await supabase
      .from('rentals')
      .insert([insertData])
      .select()
      .single()

    if (error) throw error
    return convertRentalToFrontend(data)
  } catch (error) {
    console.error('Error adding rental:', error)
    throw new Error(`Failed to add rental: ${error.message}`)
  }
}

export const updateRental = async (rental) => {
  try {
    console.log('=== updateRental Debug ===')
    console.log('Rental data received:', rental)
    
    const updateData = {
      // פרטי אופנוע (יכולים להשתנות בעריכה)
      scooter_id: rental.scooterId,
      scooter_license: rental.scooterLicense,
      scooter_color: rental.scooterColor,
      
      // פרטי לקוח
      customer_name: rental.customerName,
      passport_number: rental.passportNumber,
      whatsapp_country_code: rental.whatsappCountryCode,
      whatsapp_number: rental.whatsappNumber,
      
      // תאריכים ושעות
      start_date: rental.startDate,
      end_date: rental.endDate,
      start_time: rental.startTime || '09:00',
      end_time: rental.endTime || '18:00',
      
      // מחיר וסטטוס
      daily_rate: rental.dailyRate,
      status: rental.status,
      paid: rental.paid,
      notes: rental.notes || ''
    }

    // Add optional fields if they exist
    if (rental.paidAt) updateData.paid_at = rental.paidAt
    if (rental.completedAt) updateData.completed_at = rental.completedAt
    if (rental.activatedAt) updateData.activated_at = rental.activatedAt
    if (rental.requiresAgreement !== undefined) updateData.requires_agreement = rental.requiresAgreement
    if (rental.updatedAt) updateData.updated_at = rental.updatedAt

    console.log('Update data for database:', updateData)

    const { data, error } = await supabase
      .from('rentals')
      .update(updateData)
      .eq('id', rental.id)
      .select()
      .single()

    if (error) {
      console.error('Supabase update error:', error)
      throw error
    }
    
    console.log('Updated rental from database:', data)
    const result = convertRentalToFrontend(data)
    console.log('Converted result:', result)
    
    return result
  } catch (error) {
    console.error('Error updating rental:', error)
    throw new Error(`Failed to update rental: ${error.message}`)
  }
}

export const deleteRental = async (id) => {
  try {
    const { error } = await supabase
      .from('rentals')
      .delete()
      .eq('id', id)

    if (error) throw error
    return id
  } catch (error) {
    console.error('Error deleting rental:', error)
    throw new Error(`Failed to delete rental: ${error.message}`)
  }
}

// =============== DATABASE MANAGEMENT ===============

export const clearDatabase = async () => {
  try {
    // Delete all rentals first (due to foreign key constraints)
    const { error: rentalsError } = await supabase
      .from('rentals')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all rows

    if (rentalsError) throw rentalsError

    // Then delete all scooters
    const { error: scootersError } = await supabase
      .from('scooters')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all rows

    if (scootersError) throw scootersError

    console.log('✅ Database cleared successfully')
    return { success: true }
  } catch (error) {
    console.error('Error clearing database:', error)
    throw new Error(`Failed to clear database: ${error.message}`)
  }
}

// =============== HELPER FUNCTIONS ===============

// Convert database format to frontend format
const convertScooterToFrontend = (dbScooter) => ({
  id: dbScooter.id,
  licensePlate: dbScooter.license_plate,
  color: dbScooter.color,
  year: dbScooter.year,
  mileage: dbScooter.mileage,
  status: dbScooter.status
})

const convertRentalToFrontend = (dbRental) => ({
  id: dbRental.id,
  orderNumber: dbRental.order_number,
  scooterId: dbRental.scooter_id,
  scooterLicense: dbRental.scooter_license,
  scooterColor: dbRental.scooter_color,
  customerName: dbRental.customer_name,
  passportNumber: dbRental.passport_number,
  whatsappCountryCode: dbRental.whatsapp_country_code,
  whatsappNumber: dbRental.whatsapp_number,
  startDate: dbRental.start_date,
  endDate: dbRental.end_date,
  startTime: dbRental.start_time,
  endTime: dbRental.end_time,
  dailyRate: dbRental.daily_rate,
  deposit: dbRental.deposit,
  status: dbRental.status, // 'pending', 'active', או 'completed'
  paid: dbRental.paid,
  paidAt: dbRental.paid_at,
  completedAt: dbRental.completed_at,
  activatedAt: dbRental.activated_at, // מתי הופעלה הזמנה עתידית
  notes: dbRental.notes,
  createdAt: dbRental.created_at,
  requiresAgreement: dbRental.requires_agreement
})

// Generate order number
const generateOrderNumber = async () => {
  const now = new Date()
  const year = now.getFullYear().toString().slice(-2)
  const month = (now.getMonth() + 1).toString().padStart(2, '0')
  const day = now.getDate().toString().padStart(2, '0')
  const today = `${year}${month}${day}`

  try {
    // Get today's rentals count
    const { count, error } = await supabase
      .from('rentals')
      .select('*', { count: 'exact', head: true })
      .like('order_number', `${today}%`)

    if (error) throw error

    const sequence = ((count || 0) + 1).toString().padStart(3, '0')
    return `${today}${sequence}`
  } catch (error) {
    console.error('Error generating order number:', error)
    // Fallback to timestamp-based number
    return `${today}${Date.now().toString().slice(-3)}`
  }
}