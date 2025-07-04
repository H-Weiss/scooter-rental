import { useState, useEffect, useMemo } from 'react'
import { Calendar, momentLocalizer } from 'react-big-calendar'
import moment from 'moment'
import { Plus, Eye, DollarSign } from 'lucide-react'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import './calendar.css'

const localizer = momentLocalizer(moment)

const RentalCalendar = ({ rentals, scooters, onNewRental, onViewRental }) => {
  const [selectedDate, setSelectedDate] = useState(null)
  const [showDayDetails, setShowDayDetails] = useState(false)

  // מיפוי צבעי CSS לצבעי האופנועים
  const colorMapping = {
    // צבעים בעברית
    'אדום': '#EF4444',
    'כחול': '#3B82F6', 
    'ירוק': '#10B981',
    'צהוב': '#F59E0B',
    'סגול': '#8B5CF6',
    'ורוד': '#EC4899',
    'כתום': '#F97316',
    'חום': '#A3A3A3',
    'שחור': '#374151',
    'לבן': '#6B7280',
    'אפור': '#6B7280',
    'טורקיז': '#06B6D4',
    'בז\'': '#D4B683',
    
    // צבעים באנגלית
    'red': '#EF4444',
    'blue': '#3B82F6',
    'green': '#10B981',
    'yellow': '#F59E0B',
    'purple': '#8B5CF6',
    'pink': '#EC4899',
    'orange': '#F97316',
    'brown': '#A3A3A3',
    'black': '#374151',
    'white': '#6B7280',
    'gray': '#6B7280',
    'grey': '#6B7280',
    'turquoise': '#06B6D4',
    'beige': '#D4B683',
    'lime': '#84CC16',
    'cyan': '#06B6D4',
    'navy': '#1E40AF',
    'maroon': '#7C2D12',
    'gold': '#F59E0B',
    'silver': '#9CA3AF',
    
    // צבעים בתאילנדית (אם רלוונטי)
    'แดง': '#EF4444', // אדום
    'น้ำเงิน': '#3B82F6', // כחול
    'เขียว': '#10B981', // ירוק
    'เหลือง': '#F59E0B', // צהוב  
    'ม่วง': '#8B5CF6', // סגול
    'ส้ม': '#F97316', // כתום
    'ดำ': '#374151', // שחור
    'ขาว': '#6B7280', // לבן
  }

  // פונקציה לקבלת צבע עבור אופנוע
  const getScooterColor = (scooter) => {
    if (!scooter || !scooter.color) {
      return '#6B7280' // אפור ברירת מחדל
    }
    
    const colorLower = scooter.color.toLowerCase().trim()
    
    // חיפוש ישיר
    if (colorMapping[colorLower]) {
      return colorMapping[colorLower]
    }
    
    // חיפוש חלקי - אם הצבע מכיל מילת מפתח
    for (const [key, value] of Object.entries(colorMapping)) {
      if (colorLower.includes(key.toLowerCase()) || key.toLowerCase().includes(colorLower)) {
        return value
      }
    }
    
    // אם לא נמצא התאמה, נשתמש בהאש של הטקסט ליצירת צבע קבוע
    return generateColorFromString(scooter.color)
  }

  // פונקציה ליצירת צבע קבוע מטקסט
  const generateColorFromString = (str) => {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // המרה ל-32bit integer
    }
    
    // יצירת צבע בהיר יותר לקריאות טובה יותר
    const hue = Math.abs(hash) % 360
    return `hsl(${hue}, 70%, 50%)`
  }

  // Generate colors for scooters based on their color field
  const scooterColors = useMemo(() => {
    const colorMap = {}
    scooters.forEach((scooter) => {
      colorMap[scooter.id] = getScooterColor(scooter)
    })
    return colorMap
  }, [scooters])

  // Convert rentals to calendar events
  const events = useMemo(() => {
    return rentals.map(rental => {
      const scooter = scooters.find(s => s.id === rental.scooterId)
      const baseColor = scooterColors[rental.scooterId] || '#6B7280'
      
      return {
        id: rental.id,
        title: `${rental.scooterLicense} - ${rental.customerName}`,
        start: new Date(rental.startDate),
        end: new Date(rental.endDate),
        resource: {
          rental,
          scooter,
          color: baseColor,
          isPaid: rental.paid,
          isActive: rental.status === 'active'
        }
      }
    })
  }, [rentals, scooters, scooterColors])

  // Custom event style
  const eventStyleGetter = (event) => {
    const { color, isPaid, isActive } = event.resource
    
    return {
      style: {
        backgroundColor: color,
        borderColor: color,
        opacity: isPaid ? 1 : 0.7,
        border: isPaid ? `2px solid ${color}` : `2px dashed ${color}`,
        borderRadius: '4px',
        color: 'white',
        fontSize: '12px',
        fontWeight: '500'
      }
    }
  }

  // Handle slot selection (for new rental)
  const handleSelectSlot = ({ start, end }) => {
    if (onNewRental) {
      onNewRental({ startDate: start, endDate: end })
    }
  }

  // Handle event selection (view rental)
  const handleSelectEvent = (event) => {
    if (onViewRental) {
      onViewRental(event.resource.rental)
    }
  }

  // Get rentals for selected day
  const getRentalsForDay = (date) => {
    return events.filter(event => {
      const eventStart = moment(event.start).startOf('day')
      const eventEnd = moment(event.end).startOf('day')
      const selectedDay = moment(date).startOf('day')
      
      return selectedDay.isBetween(eventStart, eventEnd, null, '[]')
    })
  }

  // Handle day click for details
  const handleDayClick = (date) => {
    const dayRentals = getRentalsForDay(date)
    if (dayRentals.length > 0) {
      setSelectedDate(date)
      setShowDayDetails(true)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-3 sm:p-6 mb-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 sm:mb-6 gap-4">
        <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Rental Calendar</h2>
        
        {/* Legend */}
        <div className="flex items-center space-x-4 text-xs sm:text-sm">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-blue-500 bg-blue-500 rounded"></div>
            <span>Paid</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-dashed border-blue-500 bg-blue-500 opacity-70 rounded"></div>
            <span>Unpaid</span>
          </div>
        </div>
      </div>
  
      {/* Scooter Legend - מותאם למובייל */}
      <div className="mb-4">
        <h3 className="text-xs sm:text-sm font-medium text-gray-700 mb-2">Scooters:</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
          {scooters.map(scooter => (
            <div key={scooter.id} className="flex items-center space-x-2 text-xs sm:text-sm bg-gray-50 px-2 py-1 rounded-full">
              <div 
                className="w-3 h-3 sm:w-4 sm:h-4 rounded-full border border-gray-300 flex-shrink-0" 
                style={{ backgroundColor: scooterColors[scooter.id] }}
              ></div>
              <span className="font-medium truncate">{scooter.licensePlate}</span>
              <span className="text-gray-500 truncate">({scooter.color})</span>
            </div>
          ))}
        </div>
      </div>
  
      {/* Calendar Container - עם הגבלת גובה */}
      <div className="calendar-container" style={{ 
        height: window.innerWidth < 768 ? '350px' : '450px',
        maxHeight: window.innerWidth < 768 ? '350px' : '450px',
        overflow: 'hidden',
        marginBottom: '2rem' // מרווח תחתון לוודא שלא נגע בתפריט
      }}>
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          eventPropGetter={eventStyleGetter}
          onSelectSlot={handleSelectSlot}
          onSelectEvent={handleSelectEvent}
          onNavigate={(date) => console.log('Navigate to:', date)}
          selectable
          popup
          views={['month', 'week', 'day']}
          defaultView="month"
          step={60}
          showMultiDayTimes
          style={{ 
            height: '100%', 
            maxHeight: '100%',
            overflow: 'hidden'
          }}
          components={{
            event: ({ event }) => (
              <div className="flex items-center justify-between text-xs overflow-hidden">
                <span className="truncate flex-1 mr-1">{event.title}</span>
                {event.resource.isPaid ? (
                  <DollarSign className="w-2 h-2 sm:w-3 sm:h-3 flex-shrink-0" />
                ) : (
                  <span className="text-red-200 flex-shrink-0">!</span>
                )}
              </div>
            )
          }}
          formats={{
            dayHeaderFormat: (date, culture, localizer) =>
              window.innerWidth < 768 
                ? localizer.format(date, 'dd', culture)
                : localizer.format(date, 'dddd M/D', culture),
            dayRangeHeaderFormat: ({ start, end }, culture, localizer) =>
              window.innerWidth < 768
                ? `${localizer.format(start, 'M/D', culture)} - ${localizer.format(end, 'M/D', culture)}`
                : `${localizer.format(start, 'MMMM DD', culture)} - ${localizer.format(end, 'MMMM DD', culture)}`
          }}
        />
      </div>
  
      {/* Day Details Modal */}
      {showDayDetails && selectedDate && (
        <DayDetailsModal
          date={selectedDate}
          rentals={getRentalsForDay(selectedDate)}
          onClose={() => setShowDayDetails(false)}
          onViewRental={onViewRental}
          onNewRental={onNewRental}
        />
      )}
    </div>
  )
}

// Day Details Modal Component
const DayDetailsModal = ({ date, rentals, onClose, onViewRental, onNewRental }) => {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-base sm:text-lg font-medium">
              {moment(date).format('MMMM D, YYYY')}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-xl sm:text-2xl p-1"
            >
              ×
            </button>
          </div>
  
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
              <span className="text-sm text-gray-600">
                {rentals.length} rental{rentals.length !== 1 ? 's' : ''} today
              </span>
              <button
                onClick={() => {
                  onNewRental?.({ startDate: date })
                  onClose()
                }}
                className="flex items-center justify-center px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 w-full sm:w-auto"
              >
                <Plus className="w-4 h-4 mr-1" />
                New Rental
              </button>
            </div>
  
            {rentals.map(event => {
              const { rental } = event.resource
              return (
                <div
                  key={rental.id}
                  className="border rounded-lg p-3 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => {
                    onViewRental?.(rental)
                    onClose()
                  }}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-start space-x-3 flex-1 min-w-0">
                      {/* נקודת צבע של האופנוע */}
                      <div 
                        className="w-4 h-4 rounded-full border border-gray-300 mt-0.5 flex-shrink-0" 
                        style={{ backgroundColor: event.resource.color }}
                      ></div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 truncate">
                          {rental.scooterLicense}
                        </div>
                        <div className="text-sm text-gray-600 truncate">
                          {rental.customerName}
                        </div>
                        <div className="text-xs text-gray-500">
                          {moment(rental.startDate).format('MMM D')} - {moment(rental.endDate).format('MMM D')}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 flex-shrink-0 ml-2">
                      {rental.paid ? (
                        <DollarSign className="w-4 h-4 text-green-600" />
                      ) : (
                        <span className="text-xs text-red-600 font-medium">Unpaid</span>
                      )}
                      <Eye className="w-4 h-4 text-gray-400" />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

export default RentalCalendar