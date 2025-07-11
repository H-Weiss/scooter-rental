import { useState, useEffect, useMemo } from 'react'
import { Calendar, momentLocalizer } from 'react-big-calendar'
import moment from 'moment'
import { Plus, Eye, DollarSign, Clock, Calendar as CalendarIcon } from 'lucide-react'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import './calendar.css'

// Fix moment locale and localizer initialization
moment.locale('en')
const localizer = momentLocalizer(moment)

// Define custom formats to prevent the formats error
const customFormats = {
  dateFormat: 'DD',
  dayFormat: (date, culture, localizer) => 
    localizer.format(date, 'DD', culture),
  dayHeaderFormat: (date, culture, localizer) =>
    window.innerWidth < 768 
      ? localizer.format(date, 'dd', culture)
      : localizer.format(date, 'dddd M/D', culture),
  dayRangeHeaderFormat: ({ start, end }, culture, localizer) =>
    window.innerWidth < 768
      ? `${localizer.format(start, 'M/D', culture)} - ${localizer.format(end, 'M/D', culture)}`
      : `${localizer.format(start, 'MMMM DD', culture)} - ${localizer.format(end, 'MMMM DD', culture)}`,
  monthHeaderFormat: (date, culture, localizer) => 
    localizer.format(date, 'MMMM YYYY', culture),
  weekdayFormat: (date, culture, localizer) => 
    localizer.format(date, 'dddd', culture),
  timeGutterFormat: (date, culture, localizer) => 
    localizer.format(date, 'HH:mm', culture),
  eventTimeRangeFormat: ({ start, end }, culture, localizer) =>
    `${localizer.format(start, 'HH:mm', culture)} - ${localizer.format(end, 'HH:mm', culture)}`
}

const RentalCalendar = ({ rentals = [], scooters = [], onNewRental, onViewRental }) => {
  const [selectedDate, setSelectedDate] = useState(null)
  const [showDayDetails, setShowDayDetails] = useState(false)

  // Debug logs להבנת המידע שמגיע
  useEffect(() => {
    console.log('=== RentalCalendar Debug ===')
    console.log('Rentals received:', rentals)
    console.log('Scooters received:', scooters)
    console.log('Rentals count:', rentals?.length || 0)
    console.log('Scooters count:', scooters?.length || 0)
    console.log('Rentals type:', Array.isArray(rentals))
    console.log('Scooters type:', Array.isArray(scooters))
  }, [rentals, scooters])

  // Guard against invalid data
  const validRentals = useMemo(() => {
    if (!Array.isArray(rentals)) {
      console.warn('Rentals is not an array:', rentals)
      return []
    }
    return rentals
  }, [rentals])

  const validScooters = useMemo(() => {
    if (!Array.isArray(scooters)) {
      console.warn('Scooters is not an array:', scooters)
      return []
    }
    return scooters
  }, [scooters])

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
    if (validScooters && Array.isArray(validScooters)) {
      validScooters.forEach((scooter) => {
        colorMap[scooter.id] = getScooterColor(scooter)
      })
    }
    return colorMap
  }, [validScooters])

  // Convert rentals to calendar events
  const events = useMemo(() => {
    console.log('=== Converting rentals to events ===')
    
    if (!validRentals || validRentals.length === 0) {
      console.log('No rentals to convert')
      return []
    }

    if (!validScooters || validScooters.length === 0) {
      console.log('No scooters available')
      return []
    }

    const calendarEvents = validRentals.map(rental => {
      console.log('Processing rental:', rental)
      
      // מציאת האופנוע המתאים
      const scooter = validScooters.find(s => s.id === rental.scooterId)
      const baseColor = scooterColors[rental.scooterId] || '#6B7280'
      
      // בדיקת תקינות התאריכים
      if (!rental.startDate || !rental.endDate) {
        console.warn('Missing dates in rental:', rental)
        return null
      }

      // יצירת תאריכים - גישה פשוטה ללא שעות
      let startDateTime, endDateTime
      
      try {
        // פשוט נשתמש בתאריכים בלבד עם שעה ברירת מחדל
        const startDateOnly = rental.startDate.split('T')[0] // לקחת רק את התאריך
        const endDateOnly = rental.endDate.split('T')[0]     // לקחת רק את התאריך
        
        // יצירת תאריכים עם שעות ברירת מחדל (9:00 ו-18:00)
        startDateTime = new Date(`${startDateOnly}T09:00:00`)
        endDateTime = new Date(`${endDateOnly}T18:00:00`)

        // בדיקה שהתאריכים תקינים
        if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
          console.error('Invalid dates for rental:', rental)
          return null
        }

        console.log('Created valid dates:', { 
          start: startDateTime, 
          end: endDateTime,
          startDateOnly,
          endDateOnly
        })

      } catch (error) {
        console.error('Error parsing dates for rental:', rental, error)
        return null
      }
      
      const event = {
        id: rental.id,
        title: `${rental.scooterLicense || 'Unknown'} - ${rental.customerName}`,
        start: startDateTime,
        end: endDateTime,
        allDay: false, // לא אירוע של כל היום
        resource: {
          rental,
          scooter,
          color: baseColor,
          isPaid: rental.paid || false,
          isActive: rental.status === 'active',
          startTime: rental.startTime || '09:00',
          endTime: rental.endTime || '18:00'
        }
      }

      console.log('Created event:', event)
      return event
    }).filter(event => event !== null) // סינון אירועים שנכשלו

    console.log('Final events:', calendarEvents)
    return calendarEvents
  }, [validRentals, validScooters, scooterColors])

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

  // Debug render
  console.log('=== Rendering Calendar ===')
  console.log('Events to display:', events.length)
  console.log('Valid Scooters available:', validScooters?.length || 0)
  console.log('Valid Rentals available:', validRentals?.length || 0)

  return (
    <div className="bg-white rounded-lg shadow-lg p-3 sm:p-6 mb-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 sm:mb-6 gap-4">
        <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
          Rental Calendar ({events.length} rentals)
        </h2>
        
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
      {validScooters && validScooters.length > 0 && (
        <div className="mb-4">
          <h3 className="text-xs sm:text-sm font-medium text-gray-700 mb-2">Scooters:</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
            {validScooters.map(scooter => (
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
      )}
  
      {/* Calendar Container - עם הגבלת גובה */}
      <div className="calendar-container" style={{ 
        height: window.innerWidth < 768 ? '350px' : '450px',
        maxHeight: window.innerWidth < 768 ? '350px' : '450px',
        overflow: 'hidden',
        marginBottom: '2rem'
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
          formats={customFormats}
          style={{ 
            height: '100%', 
            maxHeight: '100%',
            overflow: 'hidden'
          }}
          components={{
            event: ({ event }) => (
              <div className="flex items-center justify-between text-xs overflow-hidden">
                <span className="truncate flex-1 mr-1">{event.title}</span>
                <div className="flex items-center space-x-1 flex-shrink-0">
                  <Clock className="w-2 h-2" />
                  {event.resource.isPaid ? (
                    <DollarSign className="w-2 h-2 sm:w-3 sm:h-3" />
                  ) : (
                    <span className="text-red-200">!</span>
                  )}
                </div>
              </div>
            )
          }}
        />
      </div>

      {/* Empty State */}
      {events.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <CalendarIcon className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <p>No rentals to display</p>
          <p className="text-sm">Create a new rental to see it on the calendar</p>
        </div>
      )}
  
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
                        <div className="text-xs text-gray-500 flex items-center">
                          <Clock className="w-3 h-3 mr-1" />
                          {rental.startTime} - {rental.endTime}
                        </div>
                        <div className="text-xs text-gray-500">
                          {moment(rental.startDate).format('MMM D')} - {moment(rental.endDate).format('MMM D')}
                        </div>
                        {rental.whatsappNumber && (
                          <div className="text-xs text-blue-600">
                            WhatsApp: {rental.whatsappCountryCode} {rental.whatsappNumber}
                          </div>
                        )}
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