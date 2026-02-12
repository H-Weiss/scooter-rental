import { supabase } from './supabase.js'

// =============== WAITING LIST OPERATIONS ===============

const convertWaitingListToFrontend = (dbEntry) => ({
  id: dbEntry.id,
  customerName: dbEntry.customer_name,
  passportNumber: dbEntry.passport_number,
  whatsappCountryCode: dbEntry.whatsapp_country_code,
  whatsappNumber: dbEntry.whatsapp_number,
  startDate: dbEntry.start_date,
  endDate: dbEntry.end_date,
  sizePreference: dbEntry.size_preference,
  notes: dbEntry.notes,
  status: dbEntry.status,
  convertedRentalId: dbEntry.converted_rental_id,
  createdAt: dbEntry.created_at
})

export const getWaitingList = async () => {
  try {
    const { data, error } = await supabase
      .from('waiting_list')
      .select('*')
      .eq('status', 'waiting')
      .order('created_at', { ascending: true })

    if (error) throw error
    return (data || []).map(convertWaitingListToFrontend)
  } catch (error) {
    console.error('Error fetching waiting list:', error)
    if (error.code === '42P01') {
      return []
    }
    throw new Error(`Failed to fetch waiting list: ${error.message}`)
  }
}

export const addWaitingListEntry = async (entry) => {
  try {
    const { data, error } = await supabase
      .from('waiting_list')
      .insert([{
        customer_name: entry.customerName,
        passport_number: entry.passportNumber || '',
        whatsapp_country_code: entry.whatsappCountryCode,
        whatsapp_number: entry.whatsappNumber,
        start_date: entry.startDate,
        end_date: entry.endDate,
        size_preference: entry.sizePreference || 'any',
        notes: entry.notes || ''
      }])
      .select()
      .single()

    if (error) throw error
    return convertWaitingListToFrontend(data)
  } catch (error) {
    console.error('Error adding waiting list entry:', error)
    throw new Error(`Failed to add waiting list entry: ${error.message}`)
  }
}

export const updateWaitingListEntry = async (entry) => {
  try {
    const { data, error } = await supabase
      .from('waiting_list')
      .update({
        customer_name: entry.customerName,
        passport_number: entry.passportNumber,
        whatsapp_country_code: entry.whatsappCountryCode,
        whatsapp_number: entry.whatsappNumber,
        start_date: entry.startDate,
        end_date: entry.endDate,
        size_preference: entry.sizePreference || 'any',
        notes: entry.notes || ''
      })
      .eq('id', entry.id)
      .select()
      .single()

    if (error) throw error
    return convertWaitingListToFrontend(data)
  } catch (error) {
    console.error('Error updating waiting list entry:', error)
    throw new Error(`Failed to update waiting list entry: ${error.message}`)
  }
}

export const deleteWaitingListEntry = async (id) => {
  try {
    const { error } = await supabase
      .from('waiting_list')
      .delete()
      .eq('id', id)

    if (error) throw error
    return id
  } catch (error) {
    console.error('Error deleting waiting list entry:', error)
    throw new Error(`Failed to delete waiting list entry: ${error.message}`)
  }
}

export const convertWaitingListEntry = async (id, rentalId) => {
  try {
    const { data, error } = await supabase
      .from('waiting_list')
      .update({
        status: 'converted',
        converted_rental_id: rentalId
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return convertWaitingListToFrontend(data)
  } catch (error) {
    console.error('Error converting waiting list entry:', error)
    throw new Error(`Failed to convert waiting list entry: ${error.message}`)
  }
}

export const getWaitingListByDateRange = async (startDate, endDate, sizePreference) => {
  try {
    let query = supabase
      .from('waiting_list')
      .select('*')
      .eq('status', 'waiting')
      .lte('start_date', endDate)
      .gte('end_date', startDate)

    if (sizePreference && sizePreference !== 'any') {
      query = query.or(`size_preference.eq.${sizePreference},size_preference.eq.any`)
    }

    const { data, error } = await query.order('created_at', { ascending: true })

    if (error) throw error
    return (data || []).map(convertWaitingListToFrontend)
  } catch (error) {
    console.error('Error fetching waiting list by date range:', error)
    return []
  }
}
