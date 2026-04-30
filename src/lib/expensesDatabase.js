import { supabase } from './supabase.js'

// =============== EXPENSE OPERATIONS ===============

const convertExpenseToFrontend = (dbExpense) => ({
  id: dbExpense.id,
  date: dbExpense.date,
  amount: dbExpense.amount,
  description: dbExpense.description,
  scooterId: dbExpense.scooter_id,
  createdAt: dbExpense.created_at
})

export const getExpenses = async () => {
  try {
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .order('date', { ascending: false })

    if (error) throw error
    return (data || []).map(convertExpenseToFrontend)
  } catch (error) {
    console.error('Error fetching expenses:', error)
    throw new Error(`Failed to fetch expenses: ${error.message}`)
  }
}

export const addExpense = async (expense) => {
  try {
    const { data, error } = await supabase
      .from('expenses')
      .insert([{
        date: expense.date,
        amount: expense.amount,
        description: expense.description || null,
        scooter_id: expense.scooterId || null
      }])
      .select()
      .single()

    if (error) throw error
    return convertExpenseToFrontend(data)
  } catch (error) {
    console.error('Error adding expense:', error)
    throw new Error(`Failed to add expense: ${error.message}`)
  }
}

export const updateExpense = async (id, expense) => {
  try {
    const { data, error } = await supabase
      .from('expenses')
      .update({
        date: expense.date,
        amount: expense.amount,
        description: expense.description || null,
        scooter_id: expense.scooterId || null
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return convertExpenseToFrontend(data)
  } catch (error) {
    console.error('Error updating expense:', error)
    throw new Error(`Failed to update expense: ${error.message}`)
  }
}

export const deleteExpense = async (id) => {
  try {
    const { error } = await supabase
      .from('expenses')
      .delete()
      .eq('id', id)

    if (error) throw error
    return id
  } catch (error) {
    console.error('Error deleting expense:', error)
    throw new Error(`Failed to delete expense: ${error.message}`)
  }
}

