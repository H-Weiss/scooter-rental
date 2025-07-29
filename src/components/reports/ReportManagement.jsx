import { useState, useEffect } from 'react'
import { FileText, Calendar, Download, Printer, Filter } from 'lucide-react'
import { getRentals, getScooters } from '../../lib/database'

const ReportManagement = ({ onUpdate }) => {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [rentals, setRentals] = useState([])
  const [scooters, setScooters] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [reportData, setReportData] = useState(null)
  const [selectedStatus, setSelectedStatus] = useState('all')

  useEffect(() => {
    const currentDate = new Date()
    const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
    setStartDate(firstDayOfMonth.toISOString().split('T')[0])
    setEndDate(currentDate.toISOString().split('T')[0])
  }, [])

  const loadData = async () => {
    try {
      setIsLoading(true)
      const [rentalsData, scootersData] = await Promise.all([
        getRentals(),
        getScooters()
      ])
      setRentals(rentalsData)
      setScooters(scootersData)
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const calculateRentalIncome = (rental) => {
    const start = new Date(rental.startDate)
    const end = new Date(rental.endDate)
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24))
    return days * rental.dailyRate
  }

  const generateReport = () => {
    if (!startDate || !endDate) {
      alert('Please select both start and end dates')
      return
    }

    const start = new Date(startDate)
    const end = new Date(endDate)
    end.setHours(23, 59, 59, 999)

    let filteredRentals = rentals.filter(rental => {
      const rentalStart = new Date(rental.startDate)
      const rentalEnd = new Date(rental.endDate)
      
      const isInDateRange = (
        (rentalStart >= start && rentalStart <= end) ||
        (rentalEnd >= start && rentalEnd <= end) ||
        (rentalStart <= start && rentalEnd >= end)
      )

      if (selectedStatus === 'all') {
        return isInDateRange
      }
      return isInDateRange && rental.status === selectedStatus
    })

    const scooterStats = {}
    let totalIncome = 0
    let totalDays = 0

    filteredRentals.forEach(rental => {
      const income = calculateRentalIncome(rental)
      const rentalStart = new Date(rental.startDate)
      const rentalEnd = new Date(rental.endDate)
      const days = Math.ceil((rentalEnd - rentalStart) / (1000 * 60 * 60 * 24))

      totalIncome += income
      totalDays += days

      if (!scooterStats[rental.scooterLicense]) {
        scooterStats[rental.scooterLicense] = {
          license: rental.scooterLicense,
          color: rental.scooterColor,
          rentalsCount: 0,
          totalDays: 0,
          totalIncome: 0
        }
      }

      scooterStats[rental.scooterLicense].rentalsCount += 1
      scooterStats[rental.scooterLicense].totalDays += days
      scooterStats[rental.scooterLicense].totalIncome += income
    })

    const report = {
      dateRange: {
        start: start.toLocaleDateString(),
        end: end.toLocaleDateString()
      },
      rentals: filteredRentals.sort((a, b) => new Date(a.startDate) - new Date(b.startDate)),
      scooterStats: Object.values(scooterStats).sort((a, b) => b.totalIncome - a.totalIncome),
      summary: {
        totalRentals: filteredRentals.length,
        totalIncome,
        totalDays,
        averageRentalDays: filteredRentals.length > 0 ? (totalDays / filteredRentals.length).toFixed(1) : 0,
        averageDailyRate: totalDays > 0 ? (totalIncome / totalDays).toFixed(0) : 0
      }
    }

    setReportData(report)
  }

  const exportToCSV = () => {
    if (!reportData) return

    let csv = 'Scooter Rental Report\n'
    csv += `Date Range: ${reportData.dateRange.start} - ${reportData.dateRange.end}\n\n`
    
    csv += 'RENTAL DETAILS\n'
    csv += 'Order #,Customer,Passport,Scooter,Start Date,End Date,Days,Daily Rate,Total Income,Status\n'
    
    reportData.rentals.forEach(rental => {
      const start = new Date(rental.startDate)
      const end = new Date(rental.endDate)
      const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24))
      const income = calculateRentalIncome(rental)
      
      csv += `${rental.orderNumber},${rental.customerName},${rental.passportNumber},${rental.scooterLicense},`
      csv += `${start.toLocaleDateString()},${end.toLocaleDateString()},${days},${rental.dailyRate},${income},${rental.status}\n`
    })
    
    csv += '\nSCOOTER SUMMARY\n'
    csv += 'License Plate,Color,Number of Rentals,Total Days,Total Income\n'
    
    reportData.scooterStats.forEach(stat => {
      csv += `${stat.license},${stat.color},${stat.rentalsCount},${stat.totalDays},${stat.totalIncome}\n`
    })
    
    csv += '\nOVERALL SUMMARY\n'
    csv += `Total Rentals,${reportData.summary.totalRentals}\n`
    csv += `Total Days Rented,${reportData.summary.totalDays}\n`
    csv += `Total Income,${reportData.summary.totalIncome}\n`
    csv += `Average Rental Duration,${reportData.summary.averageRentalDays} days\n`
    csv += `Average Daily Rate,${reportData.summary.averageDailyRate} THB\n`

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `rental_report_${startDate}_to_${endDate}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const printReport = () => {
    // Create a new window for printing
    const printWindow = window.open('', '_blank')
    
    // Get the report content
    const reportContent = document.getElementById('report-content')
    
    if (!reportContent || !printWindow) {
      alert('Unable to generate print preview')
      return
    }
    
    // Create print-specific HTML
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Rental Report ${startDate} to ${endDate}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 20px;
            color: #111827;
          }
          h1, h2, h3 {
            color: #111827;
            margin-bottom: 10px;
          }
          h1 { font-size: 24px; }
          h2 { font-size: 20px; margin-top: 30px; }
          h3 { font-size: 16px; }
          .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 2px solid #e5e7eb;
            padding-bottom: 20px;
          }
          .date-range {
            font-size: 14px;
            color: #6b7280;
            margin-top: 5px;
          }
          .summary-grid {
            display: grid;
            grid-template-columns: repeat(5, 1fr);
            gap: 15px;
            margin: 20px 0;
          }
          .summary-box {
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 15px;
            text-align: center;
          }
          .summary-label {
            font-size: 12px;
            color: #6b7280;
            margin-bottom: 5px;
          }
          .summary-value {
            font-size: 20px;
            font-weight: bold;
            color: #111827;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
          }
          th, td {
            border: 1px solid #e5e7eb;
            padding: 8px;
            text-align: left;
          }
          th {
            background-color: #f9fafb;
            font-weight: 600;
            font-size: 12px;
            text-transform: uppercase;
            color: #6b7280;
          }
          td {
            font-size: 14px;
          }
          tr:nth-child(even) {
            background-color: #f9fafb;
          }
          .status-badge {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 9999px;
            font-size: 12px;
            font-weight: 600;
          }
          .status-active {
            background-color: #d1fae5;
            color: #065f46;
          }
          .status-completed {
            background-color: #f3f4f6;
            color: #1f2937;
          }
          .status-pending {
            background-color: #fef3c7;
            color: #92400e;
          }
          .footer {
            margin-top: 40px;
            text-align: center;
            font-size: 12px;
            color: #9ca3af;
          }
          @media print {
            body {
              padding: 10px;
            }
            .summary-grid {
              grid-template-columns: repeat(5, 1fr);
            }
          }
        </style>
      </head>
      <body>
        ${reportContent.innerHTML}
        <div class="footer">
          Generated on ${new Date().toLocaleString()}
        </div>
      </body>
      </html>
    `)
    
    printWindow.document.close()
    
    // Wait for content to load then print
    printWindow.onload = () => {
      printWindow.print()
      printWindow.onafterprint = () => {
        printWindow.close()
      }
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Rental Reports</h2>
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
            <Filter className="w-5 h-5 mr-2" />
            Report Filters
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status Filter
              </label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Rentals</option>
                <option value="active">Active Only</option>
                <option value="completed">Completed Only</option>
                <option value="pending">Pending Only</option>
              </select>
            </div>
            
            <div className="flex items-end">
              <button
                onClick={generateReport}
                disabled={isLoading}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                <FileText className="w-4 h-4 mr-2" />
                Generate Report
              </button>
            </div>
          </div>
        </div>
      </div>

      {reportData && (
        <div className="space-y-6">
          <div id="report-content">
            {/* Report Header for Print */}
            <div className="header" style={{ display: 'none' }}>
              <h1>Scooter Rental Report</h1>
              <div className="date-range">{reportData.dateRange.start} - {reportData.dateRange.end}</div>
            </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                Report: {reportData.dateRange.start} - {reportData.dateRange.end}
              </h3>
              <div className="flex space-x-2">
                <button
                  onClick={exportToCSV}
                  className="px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 text-sm flex items-center"
                >
                  <Download className="w-4 h-4 mr-1" />
                  Export CSV
                </button>
                <button
                  onClick={printReport}
                  className="px-3 py-1.5 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 text-sm flex items-center"
                >
                  <Printer className="w-4 h-4 mr-1" />
                  Print
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6 summary-grid">
              <div className="bg-blue-50 p-4 rounded-lg summary-box">
                <p className="text-sm text-blue-600 font-medium summary-label">Total Rentals</p>
                <p className="text-2xl font-bold text-blue-900 summary-value">{reportData.summary.totalRentals}</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg summary-box">
                <p className="text-sm text-green-600 font-medium summary-label">Total Income</p>
                <p className="text-2xl font-bold text-green-900 summary-value">฿{reportData.summary.totalIncome.toLocaleString()}</p>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg summary-box">
                <p className="text-sm text-purple-600 font-medium summary-label">Total Days</p>
                <p className="text-2xl font-bold text-purple-900 summary-value">{reportData.summary.totalDays}</p>
              </div>
              <div className="bg-yellow-50 p-4 rounded-lg summary-box">
                <p className="text-sm text-yellow-600 font-medium summary-label">Avg Rental Days</p>
                <p className="text-2xl font-bold text-yellow-900 summary-value">{reportData.summary.averageRentalDays}</p>
              </div>
              <div className="bg-pink-50 p-4 rounded-lg summary-box">
                <p className="text-sm text-pink-600 font-medium summary-label">Avg Daily Rate</p>
                <p className="text-2xl font-bold text-pink-900 summary-value">฿{reportData.summary.averageDailyRate}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Income by Motorcycle</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      License Plate
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Color
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Rentals
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Days
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Income
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {reportData.scooterStats.map((stat, index) => (
                    <tr key={stat.license} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {stat.license}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {stat.color}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {stat.rentalsCount}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {stat.totalDays}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        ฿{stat.totalIncome.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Rental Details</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Order #
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Motorcycle
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Period
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Days
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Daily Rate
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {reportData.rentals.map((rental, index) => {
                    const start = new Date(rental.startDate)
                    const end = new Date(rental.endDate)
                    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24))
                    const income = calculateRentalIncome(rental)
                    
                    return (
                      <tr key={rental.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {rental.orderNumber}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {rental.customerName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {rental.scooterLicense}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {start.toLocaleDateString()} - {end.toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {days}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          ฿{rental.dailyRate}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          ฿{income.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full status-badge ${
                            rental.status === 'active' ? 'bg-green-100 text-green-800 status-active' :
                            rental.status === 'completed' ? 'bg-gray-100 text-gray-800 status-completed' :
                            'bg-yellow-100 text-yellow-800 status-pending'
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
          </div>{/* End of report-content */}
        </div>
      )}
    </div>
  )
}

export default ReportManagement