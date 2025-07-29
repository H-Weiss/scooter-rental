import { supabase } from './supabase.js'

// Migration function to populate customers table from existing rentals
export const migrateCustomersFromRentals = async () => {
  try {
    console.log('🔄 Starting customer migration from rentals...')
    
    // Get all rentals
    const { data: rentals, error: rentalsError } = await supabase
      .from('rentals')
      .select('*')
      .order('created_at', { ascending: true })

    if (rentalsError) throw rentalsError

    console.log(`📊 Found ${rentals.length} rentals to process`)

    // Extract unique customers from rentals
    const customerMap = new Map()
    
    rentals.forEach(rental => {
      const passportNumber = rental.passport_number
      
      if (!customerMap.has(passportNumber)) {
        customerMap.set(passportNumber, {
          passport_number: passportNumber,
          name: rental.customer_name,
          whatsapp_country_code: rental.whatsapp_country_code || '+66',
          whatsapp_number: rental.whatsapp_number,
          email: null, // We don't have email in rentals
          notes: `Migrated from rental data. First rental: ${rental.order_number}`,
          // Use the earliest rental date as created_at
          created_at: rental.created_at
        })
      } else {
        // If customer exists, use the earliest rental date
        const existing = customerMap.get(passportNumber)
        if (new Date(rental.created_at) < new Date(existing.created_at)) {
          existing.created_at = rental.created_at
          existing.notes = `Migrated from rental data. First rental: ${rental.order_number}`
        }
      }
    })

    const uniqueCustomers = Array.from(customerMap.values())
    console.log(`👥 Found ${uniqueCustomers.length} unique customers`)

    // Check which customers already exist in the database
    const { data: existingCustomers, error: existingError } = await supabase
      .from('customers')
      .select('passport_number')

    if (existingError) throw existingError

    const existingPassports = new Set(existingCustomers.map(c => c.passport_number))
    const newCustomers = uniqueCustomers.filter(c => !existingPassports.has(c.passport_number))

    console.log(`✨ ${newCustomers.length} new customers to migrate`)
    console.log(`⏭️  ${existingPassports.size} customers already exist, skipping`)

    if (newCustomers.length === 0) {
      console.log('✅ No new customers to migrate')
      return {
        success: true,
        migrated: 0,
        skipped: existingPassports.size,
        total: uniqueCustomers.length
      }
    }

    // Insert new customers in batches (Supabase has limits)
    const batchSize = 100
    let migratedCount = 0
    
    for (let i = 0; i < newCustomers.length; i += batchSize) {
      const batch = newCustomers.slice(i, i + batchSize)
      
      console.log(`📤 Inserting batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(newCustomers.length/batchSize)} (${batch.length} customers)`)
      
      const { error: insertError } = await supabase
        .from('customers')
        .insert(batch)

      if (insertError) {
        console.error('❌ Error inserting batch:', insertError)
        throw insertError
      }

      migratedCount += batch.length
      console.log(`✅ Batch inserted successfully (${migratedCount}/${newCustomers.length} total)`)
    }

    console.log('🎉 Customer migration completed successfully!')
    
    return {
      success: true,
      migrated: migratedCount,
      skipped: existingPassports.size,
      total: uniqueCustomers.length,
      customers: newCustomers
    }

  } catch (error) {
    console.error('❌ Customer migration failed:', error)
    throw new Error(`Migration failed: ${error.message}`)
  }
}

// Function to preview what will be migrated (without actually inserting)
export const previewCustomerMigration = async () => {
  try {
    console.log('👀 Previewing customer migration...')
    
    // Get all rentals
    const { data: rentals, error: rentalsError } = await supabase
      .from('rentals')
      .select('passport_number, customer_name, whatsapp_country_code, whatsapp_number, order_number, created_at')
      .order('created_at', { ascending: true })

    if (rentalsError) throw rentalsError

    // Extract unique customers
    const customerMap = new Map()
    
    rentals.forEach(rental => {
      const passportNumber = rental.passport_number
      
      if (!customerMap.has(passportNumber)) {
        customerMap.set(passportNumber, {
          passport_number: passportNumber,
          name: rental.customer_name,
          whatsapp_country_code: rental.whatsapp_country_code || '+66',
          whatsapp_number: rental.whatsapp_number,
          first_rental: rental.order_number,
          first_rental_date: rental.created_at,
          rental_count: 1
        })
      } else {
        const existing = customerMap.get(passportNumber)
        existing.rental_count++
        if (new Date(rental.created_at) < new Date(existing.first_rental_date)) {
          existing.first_rental = rental.order_number
          existing.first_rental_date = rental.created_at
        }
      }
    })

    const uniqueCustomers = Array.from(customerMap.values())

    // Check existing customers
    const { data: existingCustomers, error: existingError } = await supabase
      .from('customers')
      .select('passport_number')

    if (existingError) throw existingError

    const existingPassports = new Set(existingCustomers.map(c => c.passport_number))
    const newCustomers = uniqueCustomers.filter(c => !existingPassports.has(c.passport_number))

    console.log('📋 Migration Preview:')
    console.log(`📊 Total rentals: ${rentals.length}`)
    console.log(`👥 Unique customers in rentals: ${uniqueCustomers.length}`)
    console.log(`✅ Customers already in database: ${existingPassports.size}`)
    console.log(`➕ New customers to migrate: ${newCustomers.length}`)

    return {
      totalRentals: rentals.length,
      uniqueCustomers: uniqueCustomers.length,
      existingCustomers: existingPassports.size,
      newCustomers: newCustomers.length,
      previewData: newCustomers.slice(0, 5) // Show first 5 as preview
    }

  } catch (error) {
    console.error('❌ Preview failed:', error)
    throw error
  }
}