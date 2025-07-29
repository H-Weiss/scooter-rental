import { useState, useEffect } from 'react'
import { User, Phone, Calendar, MessageCircle, Search, History, Star, Plus, Download, RefreshCw, ArrowUpDown, Trash2 } from 'lucide-react'
import { getRentals, getCustomers, addCustomer, updateCustomer, deleteCustomer } from '../../lib/database'
import { migrateCustomersFromRentals, previewCustomerMigration } from '../../lib/customerMigration'
import CustomerForm from './CustomerForm'

const CustomerManagement = ({ onUpdate }) => {
  const [customers, setCustomers] = useState([])
  const [filteredCustomers, setFilteredCustomers] = useState([])
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [selectedCustomerForReview, setSelectedCustomerForReview] = useState(null)
  const [showCustomerForm, setShowCustomerForm] = useState(false)
  const [customerFormData, setCustomerFormData] = useState(null)
  const [isEditingCustomer, setIsEditingCustomer] = useState(false)
  const [showMigrationModal, setShowMigrationModal] = useState(false)
  const [migrationPreview, setMigrationPreview] = useState(null)
  const [isMigrating, setIsMigrating] = useState(false)
  const [sortOrder, setSortOrder] = useState('desc') // 'desc' = newest first, 'asc' = oldest first
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [customerToDelete, setCustomerToDelete] = useState(null)

  useEffect(() => {
    loadCustomers()
  }, [])

  const loadCustomers = async () => {
    try {
      setIsLoading(true)
      const [rentals, dbCustomers] = await Promise.all([
        getRentals(),
        getCustomers()
      ])
      
      // Create customer map from database customers first
      const customerMap = new Map()
      
      // Add database customers
      dbCustomers.forEach(dbCustomer => {
        customerMap.set(dbCustomer.passport_number, {
          passportNumber: dbCustomer.passport_number,
          name: dbCustomer.name,
          whatsappCountryCode: dbCustomer.whatsapp_country_code,
          whatsappNumber: dbCustomer.whatsapp_number,
          email: dbCustomer.email,
          notes: dbCustomer.notes,
          rentals: [],
          totalSpent: 0,
          totalDays: 0,
          firstRentalDate: null,
          lastRentalDate: null,
          createdAt: dbCustomer.created_at
        })
      })
      
      // Add customers from rentals if not in database
      rentals.forEach(rental => {
        const passportNumber = rental.passportNumber
        
        if (!customerMap.has(passportNumber)) {
          customerMap.set(passportNumber, {
            passportNumber,
            name: rental.customerName,
            whatsappCountryCode: rental.whatsappCountryCode,
            whatsappNumber: rental.whatsappNumber,
            email: null,
            notes: null,
            rentals: [],
            totalSpent: 0,
            totalDays: 0,
            firstRentalDate: rental.startDate,
            lastRentalDate: rental.startDate,
            createdAt: null // Not in database yet
          })
        }
      })
      
      // Calculate rental statistics for all customers
      rentals.forEach(rental => {
        const customer = customerMap.get(rental.passportNumber)
        if (!customer) return
        
        // Calculate rental details
        const start = new Date(rental.startDate)
        const end = new Date(rental.endDate)
        const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24))
        const rentalCost = days * rental.dailyRate
        
        // Update customer data
        customer.rentals.push(rental)
        customer.totalSpent += rentalCost
        customer.totalDays += days
        
        // Update first and last rental dates
        if (!customer.firstRentalDate || new Date(rental.startDate) < new Date(customer.firstRentalDate)) {
          customer.firstRentalDate = rental.startDate
        }
        if (!customer.lastRentalDate || new Date(rental.startDate) > new Date(customer.lastRentalDate)) {
          customer.lastRentalDate = rental.startDate
        }
      })
      
      const customersArray = Array.from(customerMap.values())
      setCustomers(customersArray)
      setFilteredCustomers(customersArray)
    } catch (error) {
      console.error('Error loading customers:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    let filtered = customers.filter(customer => 
      customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.passportNumber.toLowerCase().includes(searchTerm.toLowerCase())
    )
    
    // Sort by last rental date
    filtered.sort((a, b) => {
      const dateA = a.lastRentalDate ? new Date(a.lastRentalDate) : new Date(0)
      const dateB = b.lastRentalDate ? new Date(b.lastRentalDate) : new Date(0)
      
      if (sortOrder === 'desc') {
        return dateB - dateA // Newest first
      } else {
        return dateA - dateB // Oldest first
      }
    })
    
    setFilteredCustomers(filtered)
  }, [searchTerm, customers, sortOrder])

  const formatPhoneNumber = (countryCode, number) => {
    return `${countryCode}${number}`
  }

  const sendReviewRequest = (customer) => {
    setSelectedCustomerForReview(customer)
    setShowReviewModal(true)
  }

  const confirmSendReview = () => {
    if (!selectedCustomerForReview) return
    
    const phoneNumber = formatPhoneNumber(
      selectedCustomerForReview.whatsappCountryCode, 
      selectedCustomerForReview.whatsappNumber
    )
    
    // Create review request message
    const message = encodeURIComponent(
      `Hi ${selectedCustomerForReview.name}!\n\n` +
      `This is Ben from Chapo Samui.\n\n` +
      `Thank you for renting with us! We hope you enjoyed your experience.\n\n` +
      `We'd love to hear your feedback. Could you please take a moment to leave us a review on Google?\n\n` +
      `https://g.page/r/Cd9Imh0yY_E_EBM/review\n\n` +
      `Your review helps us improve and helps other customers find us. Thank you!`
    )
    
    // Open WhatsApp with pre-filled message
    window.open(`https://wa.me/${phoneNumber}?text=${message}`, '_blank')
    
    setShowReviewModal(false)
    setSelectedCustomerForReview(null)
  }

  const getCustomerStatus = (customer) => {
    if (!customer.rentals || customer.rentals.length === 0) {
      return { status: 'Inactive', color: 'gray' }
    }

    // Check if customer has any pending (future) rentals
    const hasPendingRentals = customer.rentals.some(rental => rental.status === 'pending')
    if (hasPendingRentals) {
      return { status: 'Pending', color: 'yellow' }
    }

    // Check if customer has any active rentals
    const hasActiveRentals = customer.rentals.some(rental => rental.status === 'active')
    if (hasActiveRentals) {
      return { status: 'Active', color: 'green' }
    }

    // If only completed rentals exist
    return { status: 'Inactive', color: 'gray' }
  }

  const handleAddCustomer = () => {
    setCustomerFormData(null)
    setIsEditingCustomer(false)
    setShowCustomerForm(true)
  }

  const handleEditCustomer = (customer) => {
    setCustomerFormData({
      passport_number: customer.passportNumber,
      name: customer.name,
      whatsapp_country_code: customer.whatsappCountryCode,
      whatsapp_number: customer.whatsappNumber,
      email: customer.email,
      notes: customer.notes
    })
    setIsEditingCustomer(true)
    setShowCustomerForm(true)
  }

  const handleSubmitCustomer = async (formData) => {
    try {
      if (isEditingCustomer) {
        await updateCustomer(formData.passportNumber, formData)
      } else {
        await addCustomer(formData)
      }
      
      // Reload customers
      await loadCustomers()
      
      // Close form
      setShowCustomerForm(false)
      setCustomerFormData(null)
      setIsEditingCustomer(false)
      
      // Notify parent if provided
      if (onUpdate) {
        onUpdate()
      }
    } catch (error) {
      throw error // Let the form handle the error
    }
  }

  const handleMigrateCustomers = async () => {
    try {
      // First show preview
      const preview = await previewCustomerMigration()
      setMigrationPreview(preview)
      setShowMigrationModal(true)
    } catch (error) {
      console.error('Error getting migration preview:', error)
      alert('Error preparing customer migration. Please try again.')
    }
  }

  const confirmMigration = async () => {
    try {
      setIsMigrating(true)
      const result = await migrateCustomersFromRentals()
      
      // Reload customers after migration
      await loadCustomers()
      
      setShowMigrationModal(false)
      setMigrationPreview(null)
      
      alert(`Migration completed successfully!\n\n✅ Migrated: ${result.migrated} new customers\n⏭️ Skipped: ${result.skipped} existing customers\n📊 Total processed: ${result.total} unique customers`)
      
    } catch (error) {
      console.error('Migration error:', error)
      alert(`Migration failed: ${error.message}`)
    } finally {
      setIsMigrating(false)
    }
  }

  const handleDeleteCustomer = (customer) => {
    if (customer.rentals && customer.rentals.length > 0) {
      alert('Cannot delete customer with rental history')
      return
    }
    setCustomerToDelete(customer)
    setShowDeleteModal(true)
  }

  const confirmDeleteCustomer = async () => {
    if (!customerToDelete) return
    
    try {
      await deleteCustomer(customerToDelete.passportNumber)
      
      // Reload customers
      await loadCustomers()
      
      // Close modal
      setShowDeleteModal(false)
      setCustomerToDelete(null)
      
      // Notify parent if provided
      if (onUpdate) {
        onUpdate()
      }
      
      alert('Customer deleted successfully')
    } catch (error) {
      console.error('Error deleting customer:', error)
      alert(`Failed to delete customer: ${error.message}`)
    }
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Loading customers...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 space-y-3 sm:space-y-0">
          <h2 className="text-xl sm:text-2xl font-semibold text-gray-900">Customer Management</h2>
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
            <button
              onClick={handleMigrateCustomers}
              className="px-3 py-2 sm:px-4 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 flex items-center justify-center text-sm sm:text-base"
            >
              <Download className="w-4 h-4 mr-2" />
              <span className="whitespace-nowrap">Migrate from Rentals</span>
            </button>
            <button
              onClick={handleAddCustomer}
              className="px-3 py-2 sm:px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 flex items-center justify-center text-sm sm:text-base"
            >
              <Plus className="w-4 h-4 mr-2" />
              <span className="whitespace-nowrap">Add Customer</span>
            </button>
          </div>
        </div>
        
        {/* Search Bar */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by name or passport number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Customer Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <User className="w-8 h-8 text-blue-500 mr-3" />
              <div>
                <p className="text-sm text-gray-600">Total Customers</p>
                <p className="text-2xl font-bold text-gray-900">{customers.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <Calendar className="w-8 h-8 text-green-500 mr-3" />
              <div>
                <p className="text-sm text-gray-600">Active Customers</p>
                <p className="text-2xl font-bold text-gray-900">
                  {customers.filter(c => getCustomerStatus(c).status === 'Active').length}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <Star className="w-8 h-8 text-yellow-500 mr-3" />
              <div>
                <p className="text-sm text-gray-600">Avg Rentals/Customer</p>
                <p className="text-2xl font-bold text-gray-900">
                  {customers.length > 0 ? (customers.reduce((sum, c) => sum + c.rentals.length, 0) / customers.length).toFixed(1) : 0}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Customer List */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rentals
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Spent
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <button
                      onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
                      className="flex items-center hover:text-gray-700 focus:outline-none"
                    >
                      Last Rental
                      <ArrowUpDown className="w-3 h-3 ml-1" />
                      <span className="text-xs ml-1">
                        ({sortOrder === 'desc' ? 'Newest' : 'Oldest'})
                      </span>
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredCustomers.map((customer) => {
                  const status = getCustomerStatus(customer)
                  return (
                    <tr key={customer.passportNumber} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{customer.name}</div>
                          <div className="text-sm text-gray-500">{customer.passportNumber}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-sm text-gray-500">
                          <Phone className="w-4 h-4 mr-1" />
                          {formatPhoneNumber(customer.whatsappCountryCode, customer.whatsappNumber)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {customer.rentals.length}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        ฿{customer.totalSpent.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(customer.lastRentalDate).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          status.status === 'Active' ? 'bg-green-100 text-green-800' :
                          status.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {status.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => setSelectedCustomer(customer)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            <History className="w-4 h-4 inline mr-1" />
                            <span className="hidden lg:inline">View</span>
                          </button>
                          <button
                            onClick={() => sendReviewRequest(customer)}
                            className="text-green-600 hover:text-green-900"
                          >
                            <MessageCircle className="w-4 h-4 inline mr-1" />
                            <span className="hidden lg:inline">Review</span>
                          </button>
                          {customer.rentals.length === 0 && (
                            <button
                              onClick={() => handleDeleteCustomer(customer)}
                              className="text-red-600 hover:text-red-900"
                              title="Delete customer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Customer Details Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6">
              <div className="flex-1">
                <h3 className="text-lg sm:text-xl font-semibold text-gray-900">{selectedCustomer.name}</h3>
                <p className="text-sm text-gray-500">Passport: {selectedCustomer.passportNumber}</p>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => {
                    handleEditCustomer(selectedCustomer)
                    setSelectedCustomer(null)
                  }}
                  className="px-3 py-1.5 sm:px-4 sm:py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 flex items-center text-sm sm:text-base"
                >
                  <svg className="w-4 h-4 mr-1 sm:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  <span className="hidden sm:inline">Edit</span>
                </button>
                <button
                  onClick={() => setSelectedCustomer(null)}
                  className="text-gray-400 hover:text-gray-600 p-1"
                >
                  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Customer Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Total Rentals</p>
                <p className="text-2xl font-bold text-gray-900">{selectedCustomer.rentals.length}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Total Days</p>
                <p className="text-2xl font-bold text-gray-900">{selectedCustomer.totalDays}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Total Spent</p>
                <p className="text-2xl font-bold text-gray-900">฿{selectedCustomer.totalSpent.toLocaleString()}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Avg Rental Value</p>
                <p className="text-2xl font-bold text-gray-900">
                  ฿{Math.round(selectedCustomer.totalSpent / selectedCustomer.rentals.length).toLocaleString()}
                </p>
              </div>
            </div>

            {/* Contact Information */}
            <div className="mb-6">
              <h4 className="text-lg font-medium text-gray-900 mb-3">Contact Information</h4>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">WhatsApp: {formatPhoneNumber(selectedCustomer.whatsappCountryCode, selectedCustomer.whatsappNumber)}</p>
                <p className="text-sm text-gray-600 mt-2">Customer Since: {new Date(selectedCustomer.firstRentalDate).toLocaleDateString()}</p>
              </div>
            </div>

            {/* Rental History */}
            <div>
              <h4 className="text-lg font-medium text-gray-900 mb-3">Rental History</h4>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Order #</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Scooter</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Period</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Days</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {selectedCustomer.rentals.sort((a, b) => new Date(b.startDate) - new Date(a.startDate)).map((rental) => {
                      const start = new Date(rental.startDate)
                      const end = new Date(rental.endDate)
                      const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24))
                      const total = days * rental.dailyRate
                      
                      return (
                        <tr key={rental.id}>
                          <td className="px-4 py-2 text-sm text-gray-900">{rental.orderNumber}</td>
                          <td className="px-4 py-2 text-sm text-gray-500">{rental.scooterLicense}</td>
                          <td className="px-4 py-2 text-sm text-gray-500">
                            {start.toLocaleDateString()} - {end.toLocaleDateString()}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-500">{days}</td>
                          <td className="px-4 py-2 text-sm font-medium text-gray-900">฿{total.toLocaleString()}</td>
                          <td className="px-4 py-2">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              rental.status === 'active' ? 'bg-green-100 text-green-800' :
                              rental.status === 'completed' ? 'bg-gray-100 text-gray-800' :
                              'bg-yellow-100 text-yellow-800'
                            }`}>
                              {rental.status}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Review Request Confirmation Modal */}
      {showReviewModal && selectedCustomerForReview && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Send Review Request</h3>
            <p className="text-gray-600 mb-6">
              Send WhatsApp message to {selectedCustomerForReview.name} asking for a Google review?
            </p>
            <div className="bg-gray-50 p-4 rounded-lg mb-6">
              <p className="text-sm text-gray-600">
                <strong>Customer:</strong> {selectedCustomerForReview.name}
              </p>
              <p className="text-sm text-gray-600 mt-1">
                <strong>WhatsApp:</strong> {formatPhoneNumber(selectedCustomerForReview.whatsappCountryCode, selectedCustomerForReview.whatsappNumber)}
              </p>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowReviewModal(false)
                  setSelectedCustomerForReview(null)
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmSendReview}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 flex items-center"
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                Send WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer Form Modal */}
      {showCustomerForm && (
        <CustomerForm
          onSubmit={handleSubmitCustomer}
          onClose={() => {
            setShowCustomerForm(false)
            setCustomerFormData(null)
            setIsEditingCustomer(false)
          }}
          initialData={customerFormData}
          isEditing={isEditingCustomer}
        />
      )}

      {/* Migration Modal */}
      {showMigrationModal && migrationPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              Migrate Customers from Rentals
            </h3>
            
            <div className="mb-6">
              <h4 className="text-lg font-medium text-gray-700 mb-3">Migration Preview:</h4>
              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                <p><strong>Total Rentals:</strong> {migrationPreview.totalRentals}</p>
                <p><strong>Unique Customers in Rentals:</strong> {migrationPreview.uniqueCustomers}</p>
                <p><strong>Already in Database:</strong> {migrationPreview.existingCustomers}</p>
                <div className="flex items-center">
                  <RefreshCw className="w-4 h-4 mr-2 text-green-600" />
                  <span><strong>New Customers to Migrate:</strong> {migrationPreview.newCustomers}</span>
                </div>
              </div>
            </div>

            {migrationPreview.newCustomers > 0 && (
              <div className="mb-6">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Sample of customers to be migrated:</h4>
                <div className="bg-blue-50 p-3 rounded text-sm space-y-1 max-h-32 overflow-y-auto">
                  {migrationPreview.previewData.map((customer, index) => (
                    <div key={index} className="text-gray-700">
                      {customer.name} ({customer.passport_number}) - {customer.rental_count} rental{customer.rental_count > 1 ? 's' : ''}
                    </div>
                  ))}
                  {migrationPreview.newCustomers > 5 && (
                    <div className="text-gray-500 italic">
                      ...and {migrationPreview.newCustomers - 5} more customers
                    </div>
                  )}
                </div>
              </div>
            )}

            {migrationPreview.newCustomers === 0 ? (
              <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-yellow-800">
                  ✅ All customers from your rentals are already in the database. No migration needed!
                </p>
              </div>
            ) : (
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-blue-800">
                  This will create {migrationPreview.newCustomers} new customer records based on your existing rental data. 
                  Customer details will be extracted from the first rental record for each passport number.
                </p>
              </div>
            )}

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowMigrationModal(false)
                  setMigrationPreview(null)
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                disabled={isMigrating}
              >
                Cancel
              </button>
              {migrationPreview.newCustomers > 0 && (
                <button
                  onClick={confirmMigration}
                  disabled={isMigrating}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  {isMigrating ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Migrating...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-2" />
                      Migrate {migrationPreview.newCustomers} Customers
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && customerToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Delete Customer</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this customer? This action cannot be undone.
            </p>
            <div className="bg-gray-50 p-4 rounded-lg mb-6">
              <p className="text-sm text-gray-600">
                <strong>Name:</strong> {customerToDelete.name}
              </p>
              <p className="text-sm text-gray-600 mt-1">
                <strong>Passport:</strong> {customerToDelete.passportNumber}
              </p>
              <p className="text-sm text-gray-600 mt-1">
                <strong>Rentals:</strong> {customerToDelete.rentals.length} (must be 0 to delete)
              </p>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false)
                  setCustomerToDelete(null)
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteCustomer}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 flex items-center"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Customer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CustomerManagement